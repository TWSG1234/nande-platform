import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_NICKNAME_LENGTH = 30;
const MAX_CONTENT_LENGTH = 500;

/** 留言一律當純文字處理：把任何看起來像 HTML 標籤的東西整段拿掉，
 * 就算有人想塞 <script>、<iframe> 之類的內容，存進資料庫的也只會是
 * 拿掉標籤後的純文字。前端顯示留言時一律用純文字方式渲染（絕對不會用
 * dangerouslySetInnerHTML），兩層一起防護。 */
function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, "").trim();
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await prisma.photoSubmission.findUnique({ where: { id: params.id } });
  if (!photo || photo.status !== "approved") {
    return NextResponse.json({ error: "找不到這張照片。" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { photoId: params.id, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, nickname: true, content: true, createdAt: true },
  });
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await prisma.photoSubmission.findUnique({ where: { id: params.id } });
  if (!photo || photo.status !== "approved") {
    return NextResponse.json({ error: "找不到這張照片，無法留言。" }, { status: 404 });
  }

  const body = await req.json();
  const nickname = stripHtml(String(body.nickname ?? ""));
  const content = stripHtml(String(body.content ?? ""));

  if (!nickname) {
    return NextResponse.json({ error: "請填寫暱稱。" }, { status: 400 });
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return NextResponse.json({ error: `暱稱請在 ${MAX_NICKNAME_LENGTH} 字以內。` }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "請輸入留言內容。" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `留言請在 ${MAX_CONTENT_LENGTH} 字以內。` }, { status: 400 });
  }

  try {
    const comment = await prisma.comment.create({
      data: { photoId: params.id, nickname, content },
      select: { id: true, nickname: true, content: true, createdAt: true },
    });
    return NextResponse.json({ comment });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "留言失敗，請稍後再試一次。" }, { status: 500 });
  }
}
