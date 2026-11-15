/**
 * npm run db:patch-content — 單獨執行「內容小修補」（先自動備份）。
 * 平常不用手動執行：npm run db:update 已包含這一步。
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import type { DataConfig } from "../../lib/config/dataConfig";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";
import { patchLife1EnglishComic, type PatchStore } from "./contentPatchCore";

export async function applyContentPatches(prisma: PrismaClient, cfg: DataConfig): Promise<string[]> {
  if (cfg.mode !== "local") return ["遠端模式不處理內容小修補。"];
  const uploads = cfg.uploadsDir!;
  const assets = path.join(process.cwd(), "prisma", "assets", "uploads");
  const cols = (await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("ChinesePage")`)).map((r) => r.name);
  if (!cols.includes("comicImagesEn")) return ["⚠ ChinesePage 缺少 comicImagesEn 欄位（結構落後），內容修補略過。"];

  const store: PatchStore = {
    findComicPage: async (stageId) => {
      const p = await prisma.chinesePage.findFirst({ where: { stageId, type: "comic" }, orderBy: { order: "asc" } });
      return p && { id: p.id, comicImagesEn: p.comicImagesEn };
    },
    setComicEn: async (id, json) => {
      await prisma.chinesePage.update({ where: { id }, data: { comicImagesEn: json } });
    },
  };
  const ensureFile = (publicUrl: string) => {
    const rel = publicUrl.replace(/^\/uploads\//, "");
    const to = path.join(uploads, rel);
    if (existsSync(to)) return true; // 已存在 → 不覆蓋
    const from = path.join(assets, rel);
    if (!existsSync(from)) return false;
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
    return true;
  };
  const r = await patchLife1EnglishComic(store, { ensureFile });
  return [(r.status === "updated" ? "✅ " : "ℹ ") + r.message];
}

async function main() {
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("目前只支援本機 SQLite。");
    process.exit(1);
  }
  console.log(describeConfig(cfg).join("\n"));
  const { prisma } = openPrisma(cfg);
  try {
    console.log("✅ 已備份：" + (await runBackup(prisma, cfg, "before-content-patch")));
    console.log((await applyContentPatches(prisma, cfg)).join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module) {
  main().catch((e) => {
    console.error("失敗：", e);
    process.exit(1);
  });
}
