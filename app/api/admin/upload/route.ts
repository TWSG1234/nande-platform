import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { saveLocalImage, ImageValidationError } from "@/lib/uploadImage";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "請選擇要上傳的圖片。" }, { status: 400 });
  }

  try {
    const url = await saveLocalImage(file, "content");
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "圖片上傳失敗，請稍後再試一次。" }, { status: 500 });
  }
}
