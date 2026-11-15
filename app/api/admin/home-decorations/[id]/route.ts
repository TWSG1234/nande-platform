import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { rowToDecoration } from "@/lib/home/decorationsDb";
import { AREAS, Area, DEFAULT_DESKTOP, DEFAULT_MOBILE, cleanName, parseDevice, sanitizeDevice } from "@/lib/home/decorations";
import { PngValidationError, saveDecorationPng } from "@/lib/home/decorUpload";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
const validId = (v: string) => /^[A-Za-z0-9_-]{1,64}$/.test(v);

function dbErrorMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? "");
  if (/does not exist|no such table|P2021/i.test(msg)) return "資料庫還沒有「首頁裝飾圖樣」資料表。請先執行 npm run db:push。";
  return "儲存失敗，請稍後再試一次。";
}

/**
 * 修改一張裝飾：可只改設定（JSON），或用 multipart 同時更換圖片（file 必須是透明底 PNG）。
 * 只動這一張；更換圖片時舊檔移到 uploads/_trash。圖片驗證失敗時整個請求都不生效。
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  if (!validId(params.id)) return NextResponse.json({ error: "不正確的編號。" }, { status: 400 });
  const existing = await prisma.homeDecoration.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!existing) return NextResponse.json({ error: "找不到這張裝飾圖樣，可能已被刪除。請重新整理頁面。" }, { status: 404 });

  const ct = req.headers?.get?.("content-type") || "";
  let fields: Record<string, unknown> = {};
  let file: File | null = null;
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const k of ["name", "isVisible", "area", "sortOrder", "desktop", "mobile"]) {
        const v = form.get(k);
        if (v !== null && v !== undefined) fields[k] = k === "desktop" || k === "mobile" ? (() => { try { return JSON.parse(String(v)); } catch { return undefined; } })() : k === "isVisible" ? String(v) === "true" : v;
      }
      const f = form.get("file");
      if (f && typeof f !== "string" && typeof (f as File).arrayBuffer === "function") file = f as File;
    } else {
      fields = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "送出的內容無法讀取。" }, { status: 400 });
  }

  const cur = rowToDecoration(existing as unknown as Record<string, unknown>);
  const data: Record<string, unknown> = {};
  if (fields.name !== undefined) data.name = cleanName(fields.name) || cur.name;
  if (typeof fields.isVisible === "boolean") data.isVisible = fields.isVisible;
  if (AREAS.includes(fields.area as Area)) data.area = fields.area;
  if (fields.sortOrder !== undefined && Number.isFinite(Number(fields.sortOrder))) data.sortOrder = Math.max(0, Math.min(9999, Math.round(Number(fields.sortOrder))));
  if (fields.desktop !== undefined) data.desktopJson = JSON.stringify(sanitizeDevice(fields.desktop, parseDevice(JSON.stringify(cur.desktop), DEFAULT_DESKTOP)));
  if (fields.mobile !== undefined) data.mobileJson = JSON.stringify(sanitizeDevice(fields.mobile, parseDevice(JSON.stringify(cur.mobile), DEFAULT_MOBILE)));

  let saved: { url: string; width: number; height: number } | null = null;
  if (file) {
    try {
      saved = await saveDecorationPng(file);
    } catch (err) {
      if (err instanceof PngValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error(err);
      return NextResponse.json({ error: "檔案存入固定資料夾失敗，請確認資料夾可寫入後再試。" }, { status: 500 });
    }
    data.imageUrl = saved.url;
    data.naturalWidth = saved.width;
    data.naturalHeight = saved.height;
  }

  try {
    const row = await prisma.homeDecoration.update({ where: { id: params.id }, data });
    if (saved && cur.imageUrl && cur.imageUrl !== saved.url) await getStorage().remove(cur.imageUrl);
    return NextResponse.json({ item: rowToDecoration(row as unknown as Record<string, unknown>) });
  } catch (err) {
    console.error(err);
    if (saved) await getStorage().remove(saved.url);
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

/** 刪除一張裝飾：資料列刪除，圖片移到 uploads/_trash（可找回）。其他裝飾與首頁功能不受影響。 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  if (!validId(params.id)) return NextResponse.json({ error: "不正確的編號。" }, { status: 400 });
  const existing = await prisma.homeDecoration.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!existing) return NextResponse.json({ ok: true });
  try {
    await prisma.homeDecoration.delete({ where: { id: params.id } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
  const url = (existing as { imageUrl?: string }).imageUrl;
  if (url) await getStorage().remove(url);
  return NextResponse.json({ ok: true });
}
