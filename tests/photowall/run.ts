/** 照片牆圖片載入與分批顯示的回歸測試（純邏輯 + 伺服器端渲染的初始 HTML，不連網、不碰資料庫）。 */
import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DETAIL_THUMB_WIDTH, GRID_THUMB_WIDTH, PHOTO_PAGE_SIZE, driveFileIdOf, driveThumbnailUrl, nextCount, photoSources, remaining, stageAfterError, visibleSlice,
} from "../../lib/photoImage";
import { LanguageProvider } from "../../context/LanguageContext";
import PhotoWallClient, { PublicPhoto } from "../../components/PhotoWallClient";
import PhotoDetailContent from "../../components/PhotoDetailContent";
import PhotoImage from "../../components/PhotoImage";

let pass = 0, fail = 0;
async function t(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); pass++; console.log("  ✅ " + name); } catch (e) { fail++; console.log("  ❌ " + name + "\n     " + (e as Error).message); }
}
const ID1 = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", ID2 = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa98765_-";
const driveUrl = (id: string) => `https://drive.google.com/uc?id=${id}`;
const photo = (i: number, imageUrl: string | null): PublicPhoto => ({
  id: "p" + String(i).padStart(3, "0"), imageUrl, title: { "zh-TW": "標題" + i, en: "Title " + i }, caption: null,
  createdAt: new Date(Date.UTC(2026, 10, 30 - i)).toISOString(), commentCount: i % 3,
});
const wrap = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(LanguageProvider, null, el));
const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const srcOf = (tag: string) => (tag.match(/\ssrc="([^"]*)"/) ?? [])[1]?.replace(/&amp;/g, "&");

(async () => {
  console.log("照片牆圖片與分批顯示測試");
  await t("Drive File ID：uc?id、open?id、thumbnail?id、file/d/<id> 都能取出；多餘參數不影響", () => {
    assert.equal(driveFileIdOf(driveUrl(ID1)), ID1);
    assert.equal(driveFileIdOf(`https://drive.google.com/uc?id=${ID1}&export=view`), ID1);
    assert.equal(driveFileIdOf(`https://drive.google.com/uc?export=view&id=${ID2}`), ID2);
    assert.equal(driveFileIdOf(`https://drive.google.com/open?id=${ID1}`), ID1);
    assert.equal(driveFileIdOf(`https://drive.google.com/thumbnail?id=${ID1}&sz=w600`), ID1);
    assert.equal(driveFileIdOf(`https://drive.google.com/file/d/${ID1}/view?usp=sharing`), ID1);
  });
  await t("非 Drive／偽造網址一律不處理：站內路徑、Cloudinary、假網域、http、缺 id、非法 id、空值", () => {
    for (const u of ["/uploads/submissions/a.jpg", "https://res.cloudinary.com/x/image/upload/a.jpg", `https://drive.google.com.evil.example/uc?id=${ID1}`,
      `https://evil.example/uc?id=${ID1}`, `http://drive.google.com/uc?id=${ID1}`, "https://drive.google.com/uc", "https://drive.google.com/uc?id=short",
      `https://drive.google.com/uc?id=${ID1}%22onerror%3D`, "https://drive.google.com/drive/folders/" + ID1, "not a url", "", null, undefined]) {
      assert.equal(driveFileIdOf(u as string), null, String(u));
    }
  });
  await t("縮圖網址：格式正確（w600／較大尺寸），寬度被限制在合理範圍，非法 ID 會報錯", () => {
    assert.equal(driveThumbnailUrl(ID1, 600), `https://drive.google.com/thumbnail?id=${ID1}&sz=w600`);
    assert.equal(driveThumbnailUrl(ID1, 99999), `https://drive.google.com/thumbnail?id=${ID1}&sz=w2000`);
    assert.equal(driveThumbnailUrl(ID1, 1), `https://drive.google.com/thumbnail?id=${ID1}&sz=w100`);
    assert.throws(() => driveThumbnailUrl("bad id&x=1", 600));
    assert.equal(GRID_THUMB_WIDTH, 600); assert.ok(DETAIL_THUMB_WIDTH > GRID_THUMB_WIDTH && DETAIL_THUMB_WIDTH <= 2000);
  });
  await t("photoSources：Drive → 縮圖優先、原網址備援（格子 w600／詳情頁較大）；非 Drive 原樣且無備援；無圖片回 null", () => {
    assert.deepEqual(photoSources(driveUrl(ID1), "grid"), { primary: `https://drive.google.com/thumbnail?id=${ID1}&sz=w600`, fallback: driveUrl(ID1) });
    assert.deepEqual(photoSources(driveUrl(ID2), "detail"), { primary: `https://drive.google.com/thumbnail?id=${ID2}&sz=w${DETAIL_THUMB_WIDTH}`, fallback: driveUrl(ID2) });
    for (const u of ["/uploads/submissions/a.jpg", "https://res.cloudinary.com/x/a.png"]) for (const k of ["grid", "detail"] as const) assert.deepEqual(photoSources(u, k), { primary: u, fallback: null });
    assert.equal(photoSources(null, "grid"), null); assert.equal(photoSources("", "detail"), null);
  });
  await t("失敗狀態機：縮圖失敗→退回原網址；原圖也失敗→佔位；沒有備援直接佔位；不會無限重試", () => {
    assert.equal(stageAfterError("primary", true), "fallback");
    assert.equal(stageAfterError("fallback", true), "failed");
    assert.equal(stageAfterError("primary", false), "failed");
    assert.equal(stageAfterError("failed", true), "failed"); assert.equal(stageAfterError("failed", false), "failed");
    let s = stageAfterError("primary", true); const seen = [s]; for (let i = 0; i < 5; i++) { s = stageAfterError(s, true); seen.push(s); }
    assert.deepEqual([...new Set(seen)], ["fallback", "failed"]);
  });
  await t("PhotoImage 初始輸出：Drive 用縮圖、lazy／async、無障礙文字；非 Drive 維持原網址；詳情頁用 eager", () => {
    const g = imgs(wrap(React.createElement(PhotoImage, { imageUrl: driveUrl(ID1), alt: "A", kind: "grid" })))[0]!;
    assert.equal(srcOf(g), `https://drive.google.com/thumbnail?id=${ID1}&sz=w600`); assert.match(g, /loading="lazy"/); assert.match(g, /decoding="async"/); assert.match(g, /alt="A"/);
    const n = imgs(wrap(React.createElement(PhotoImage, { imageUrl: "/uploads/submissions/a.jpg", alt: "B", kind: "grid" })))[0]!;
    assert.equal(srcOf(n), "/uploads/submissions/a.jpg");
    const d = imgs(wrap(React.createElement(PhotoImage, { imageUrl: driveUrl(ID1), alt: "C", kind: "detail", eager: true })))[0]!;
    assert.equal(srcOf(d), `https://drive.google.com/thumbnail?id=${ID1}&sz=w${DETAIL_THUMB_WIDTH}`); assert.match(d, /loading="eager"/);
  });
  await t("分批：每批 12 張；載入更多後順序不變、不重複、不遺漏；最後一批數量正確", () => {
    const all = Array.from({ length: 30 }, (_, i) => photo(i, driveUrl(ID1)));
    assert.equal(PHOTO_PAGE_SIZE, 12);
    let shown = PHOTO_PAGE_SIZE; const b1 = visibleSlice(all, shown); assert.equal(b1.length, 12); assert.deepEqual(b1.map((p) => p.id), all.slice(0, 12).map((p) => p.id));
    assert.equal(remaining(all.length, shown), 18);
    shown = nextCount(shown, all.length); const b2 = visibleSlice(all, shown); assert.equal(b2.length, 24);
    assert.deepEqual(b2.slice(0, 12).map((p) => p.id), b1.map((p) => p.id)); // 前一批沒有被重排
    shown = nextCount(shown, all.length); const b3 = visibleSlice(all, shown); assert.equal(b3.length, 30); assert.equal(remaining(all.length, shown), 0);
    assert.deepEqual(b3.map((p) => p.id), all.map((p) => p.id)); assert.equal(new Set(b3.map((p) => p.id)).size, 30);
    assert.equal(nextCount(30, 30), 30); assert.deepEqual(visibleSlice([] as number[], 12), []); assert.equal(visibleSlice(all, 5).length, 5);
    // createdAt 由新到舊的排序在切片後仍成立
    const ts = b3.map((p) => +new Date(p.createdAt)); assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
  });
  await t("照片牆渲染：30 張只輸出前 12 張（順序＝原順序）、顯示『載入更多（18）』；≤12 張沒有按鈕；空清單維持原本提示", () => {
    const all = Array.from({ length: 30 }, (_, i) => photo(i, i % 2 ? driveUrl(ID1) : driveUrl(ID2)));
    const html = wrap(React.createElement(PhotoWallClient, { photos: all }));
    const hrefs = [...html.matchAll(/href="\/photo-submit\/(p\d+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, all.slice(0, 12).map((p) => p.id)); assert.equal(imgs(html).length, 12);
    assert.ok(imgs(html).every((x) => /loading="lazy"/.test(x) && /decoding="async"/.test(x) && /thumbnail\?id=.*sz=w600/.test(srcOf(x)!)));
    assert.match(html, /載入更多（18）/);
    const few = wrap(React.createElement(PhotoWallClient, { photos: all.slice(0, 12) })); assert.equal(imgs(few).length, 12); assert.ok(!/載入更多/.test(few));
    assert.match(wrap(React.createElement(PhotoWallClient, { photos: [] })), /目前還沒有照片/);
  });
  await t("照片牆：新舊 Drive 投稿與非 Drive 圖片混合都能渲染；沒有圖片網址的投稿不輸出 <img>；原本的連結、標題、留言數仍在", () => {
    const mix = [photo(0, driveUrl(ID1)), photo(1, driveUrl(ID2)), photo(2, "/uploads/submissions/x.png"), photo(3, null)];
    const html = wrap(React.createElement(PhotoWallClient, { photos: mix }));
    const s = imgs(html).map(srcOf);
    assert.deepEqual(s, [`https://drive.google.com/thumbnail?id=${ID1}&sz=w600`, `https://drive.google.com/thumbnail?id=${ID2}&sz=w600`, "/uploads/submissions/x.png"]);
    for (const p of mix) { assert.ok(html.includes(`/photo-submit/${p.id}`)); assert.ok(html.includes(p.title["zh-TW"])); }
    assert.ok(html.includes("投稿照片"));
  });
  await t("詳情頁：Drive 投稿用較大縮圖；非 Drive 維持原網址；標題、說明、留言區仍顯示", () => {
    const base = { id: "p1", title: { "zh-TW": "詳情標題", en: "T" }, caption: { "zh-TW": "說明文字", en: "C" }, createdAt: new Date().toISOString() };
    const h1 = wrap(React.createElement(PhotoDetailContent, { photo: { ...base, imageUrl: driveUrl(ID1) }, comments: [] }));
    assert.equal(srcOf(imgs(h1)[0]!), `https://drive.google.com/thumbnail?id=${ID1}&sz=w${DETAIL_THUMB_WIDTH}`);
    assert.ok(h1.includes("詳情標題") && h1.includes("說明文字") && h1.includes("返回照片牆"));
    const h2 = wrap(React.createElement(PhotoDetailContent, { photo: { ...base, imageUrl: "/uploads/submissions/z.jpg" }, comments: [] }));
    assert.equal(srcOf(imgs(h2)[0]!), "/uploads/submissions/z.jpg");
    assert.equal(imgs(wrap(React.createElement(PhotoDetailContent, { photo: { ...base, imageUrl: null }, comments: [] }))).length, 0);
  });
  console.log(`\n通過 ${pass}，失敗 ${fail}`); process.exit(fail ? 1 : 0);
})();
