import { prisma } from "@/lib/prisma";
import { driveMode, prismaDriveAuthStore, uploadBufferViaOAuth } from "@/lib/googleDriveOAuth";

/**
 * Google Drive 上傳（用在「學生投稿照片通過審核」的那一步）。
 *
 * 已改為「管理員個人 Gmail 的 OAuth 2.0」，不再使用 Service Account（GOOGLE_CLIENT_EMAIL／
 * GOOGLE_PRIVATE_KEY 已不再被讀取）。設定與授權流程見 lib/googleDriveOAuth.ts 與手冊。
 *
 * 環境變數（見 .env.example）：
 *   GOOGLE_OAUTH_CLIENT_ID／GOOGLE_OAUTH_CLIENT_SECRET — OAuth Web Client
 *   GOOGLE_TOKEN_ENCRYPTION_KEY — 加密 Refresh Token 用
 *   GOOGLE_DRIVE_FOLDER_ID — 目標資料夾（沿用原本的「南得遇見你_學生投稿」）
 *
 * 完全沒設定 OAuth（沒有 Client ID／Secret）時，isDriveConfigured() 為 false：通過的照片留在
 * 網站儲存層、不上傳 Drive，審核流程不中斷（與舊版相同）。
 */

export function isDriveConfigured() {
  return driveMode() !== "off";
}

export async function uploadBufferToDrive(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ fileId: string; viewUrl: string }> {
  return uploadBufferViaOAuth(params, { store: prismaDriveAuthStore(prisma) });
}
