import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Google Drive 上傳（用在「學生投稿照片通過審核」的那一步）。
 *
 * 這裡需要三個環境變數（見 .env.example）：
 *   GOOGLE_CLIENT_EMAIL        — Service Account 的 email
 *   GOOGLE_PRIVATE_KEY         — Service Account 的私鑰
 *   GOOGLE_DRIVE_FOLDER_ID     — 目標資料夾 ID（要先把資料夾分享給上面的 email）
 *
 * 如果這三個變數沒有設定齊全，isDriveConfigured() 會回傳 false，這種情況下
 * 「通過」審核的照片會留在網站固定資料夾的 uploads/submissions（不會中斷流程，
 * 只是還沒真的存進 Google Drive）。等你設定好這三個環境變數、重新啟動網站，
 * 之後新通過的照片就會自動存進 Drive，不需要改任何程式碼。
 */

export function isDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

export async function uploadBufferToDrive(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ fileId: string; viewUrl: string }> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: params.filename,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID as string],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: "id",
  });

  const fileId = res.data.id as string;

  // 讓連結可以直接檢視（不公開列在資料夾，但知道連結的人可以看）
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return { fileId, viewUrl: `https://drive.google.com/uc?id=${fileId}` };
}
