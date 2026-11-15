import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveLocalImage, ImageValidationError } from "@/lib/uploadImage";

// 公開端點，任何人（不需要登入）都可以從 /photo-submit 投稿照片。這裡完全不會
// 碰觸任何管理用的 API 或資料表以外的東西 —— 只會新增一筆 status = "pending"
// 的投稿，一定要管理員在 /admin/images/submissions 按下「通過」才會被視為已審核。
// 前台故意不提供「分類」欄位。投稿者填什麼語言都直接存進 title/caption，
// 沒有任何自動翻譯——如果投稿者只填了某一種語言，管理員可以在審核時另外
// 補上另一種語言，見 /admin/images/submissions 的「編輯內容」功能。
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim() || null;
  const nickname = (formData.get("nickname") as string | null)?.trim() || null; // 暱稱不處理，原樣保留
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "請選擇要上傳的照片。" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "請填寫照片名稱。" }, { status: 400 });
  }

  try {
    const previewUrl = await saveLocalImage(file, "submissions");
    const submission = await prisma.photoSubmission.create({
      data: {
        previewUrl,
        title,
        titleEn: "", // 投稿當下不翻譯，留給管理員審核時視需要補上
        nickname,
        caption,
        captionEn: caption ? "" : null,
        status: "pending",
      },
    });
    return NextResponse.json({ ok: true, id: submission.id });
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "上傳失敗，請稍後再試一次。" }, { status: 500 });
  }
}
