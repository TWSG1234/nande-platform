import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { isDriveConfigured, uploadBufferToDrive } from "@/lib/driveService";
import { deleteLocalImage, readStoredImage } from "@/lib/uploadImage";
import { DriveError, describeError } from "@/lib/googleDriveOAuth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const reviewerId = (session.user as { id?: string } | undefined)?.id ?? null;

  const body = await req.json();
  const action = body.action as "approve" | "reject";

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "不明的操作。" }, { status: 400 });
  }

  const submission = await prisma.photoSubmission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.json({ error: "找不到這筆投稿。" }, { status: 404 });

  if (action === "reject") {
    const updated = await prisma.photoSubmission.update({
      where: { id: params.id },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewerId,
        rejectionReason: body.rejectionReason || "其他",
        rejectionNote: body.rejectionNote || null,
      },
    });
    return NextResponse.json({ submission: updated });
  }

  // action === "approve"
  // 分類是選填的：管理員可以在通過的時候順便指定這張投稿屬於哪個分類，
  // 前台投稿表單完全不會問這件事（分類由審核者決定，不是投稿者）。
  const category = body.category || submission.category || null;

  // 如果 Google Drive 已經設定好，通過的照片會實際搬到 Drive；
  // 沒設定的話，照片繼續留在固定資料夾的 uploads/submissions，
  // 一樣會被標記為「已通過」，不會卡住審核流程。
  if (isDriveConfigured() && submission.previewUrl?.startsWith("/uploads/")) {
    try {
      const buffer = await readStoredImage(submission.previewUrl);
      if (!buffer) throw new Error("找不到投稿的圖片檔案：" + submission.previewUrl);
      const ext = submission.previewUrl.split(".").pop() || "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const { fileId, viewUrl } = await uploadBufferToDrive({
        buffer,
        filename: `${submission.id}.${ext}`,
        mimeType,
      });

      const updated = await prisma.photoSubmission.update({
        where: { id: params.id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewerId,
          category,
          driveFileId: fileId,
          previewUrl: viewUrl,
        },
      });
      return NextResponse.json({ submission: updated });
    } catch (err) {
      // 不直接 console.error(err)：Google 錯誤物件含 request 設定，可能帶 token／secret。
      console.error("[drive-approve]", describeError(err));
      if (err instanceof DriveError) {
        const status = err.code === "DRIVE_UPLOAD_FAILED" ? 502 : 409;
        return NextResponse.json({ error: err.message, code: err.code }, { status });
      }
      return NextResponse.json(
        { error: "上傳到 Google Drive 時發生問題，請稍後再試一次，或檢查 Google Drive 設定。", code: "DRIVE_UPLOAD_FAILED" },
        { status: 500 }
      );
    }
  }

  const updated = await prisma.photoSubmission.update({
    where: { id: params.id },
    data: { status: "approved", reviewedAt: new Date(), reviewerId, category },
  });
  return NextResponse.json({ submission: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const existing = await prisma.photoSubmission.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "找不到這筆投稿。" }, { status: 404 });

  try {
    await prisma.photoSubmission.delete({ where: { id: params.id } });
    // Google Drive 上的檔案（driveFileId）目前不會自動刪除，只清理本機檔案；
    // previewUrl 指向 Drive 外部連結時 deleteLocalImage 會自動略過，不會出錯。
    await deleteLocalImage(existing.previewUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
