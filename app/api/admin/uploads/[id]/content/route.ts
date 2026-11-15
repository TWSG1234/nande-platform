import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// 專門處理「編輯內容」——跟通過/拒絕/刪除是分開的操作，單純改文字不會
// 意外改變審核狀態。待審核、已通過的照片都可以用這支 API 編輯。
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  const titleZh = (body.title as string | undefined)?.trim() || "";
  const titleEn = (body.titleEn as string | undefined)?.trim() || "";
  if (!titleZh && !titleEn) {
    return NextResponse.json({ error: "請填寫中文標題或 English Title 至少一項。" }, { status: 400 });
  }

  try {
    const updated = await prisma.photoSubmission.update({
      where: { id: params.id },
      data: {
        // title 這個欄位在資料庫裡不能真的空白（照片牆需要一定顯示得出標題），
        // 中文沒填的話先用英文頂著，titleEn 仍然照實存管理員填的內容。
        title: titleZh || titleEn,
        titleEn,
        caption: (body.caption as string | undefined)?.trim() || null,
        captionEn: (body.captionEn as string | undefined)?.trim() || null,
      },
    });
    return NextResponse.json({ submission: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "找不到這筆投稿，或儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
