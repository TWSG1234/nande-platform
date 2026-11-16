/** Google Drive 授權的錯誤辨識碼與中文說明（純文字，前後端共用，不含任何機密）。 */
export type DriveErrorCode =
  | "DRIVE_NOT_CONFIGURED"
  | "DRIVE_TABLE_MISSING"
  | "DRIVE_NOT_AUTHORIZED"
  | "DRIVE_AUTH_REVOKED"
  | "DRIVE_STATE_INVALID"
  | "DRIVE_ACCESS_DENIED"
  | "DRIVE_NO_REFRESH_TOKEN"
  | "DRIVE_SCOPE_MISSING"
  | "DRIVE_FOLDER_INACCESSIBLE"
  | "DRIVE_UPLOAD_FAILED"
  | "DRIVE_EXCHANGE_FAILED";

export const DRIVE_MESSAGES: Record<DriveErrorCode, string> = {
  DRIVE_NOT_CONFIGURED: "Google Drive 的環境變數沒有設定齊全（請看「Google Drive 授權」頁面列出的缺少項目）。",
  DRIVE_TABLE_MISSING: "資料庫還沒有 GoogleDriveAuth 資料表。請先依手冊在 Neon（或本機 db:push）建立這張新資料表後再授權。",
  DRIVE_NOT_AUTHORIZED: "尚未授權 Google Drive。請到「後台 → Google Drive 授權」按「授權 Google Drive」。",
  DRIVE_AUTH_REVOKED: "Google Drive 授權已過期或被撤銷。請到「後台 → Google Drive 授權」按「重新授權」。",
  DRIVE_STATE_INVALID: "授權驗證碼（state）不符或已過期，為了安全已中止。請回到授權頁面重新按一次授權。",
  DRIVE_ACCESS_DENIED: "你在 Google 的授權畫面按了拒絕／取消，沒有完成授權。",
  DRIVE_NO_REFRESH_TOKEN: "Google 沒有回傳 Refresh Token。請先到 Google 帳戶「安全性 → 第三方存取」移除這個應用程式，再重新授權。",
  DRIVE_SCOPE_MISSING: "授權時沒有勾選 Google Drive 權限。請重新授權，並在授權畫面保留 Drive 權限的勾選。",
  DRIVE_FOLDER_INACCESSIBLE: "授權的 Google 帳號無法寫入 GOOGLE_DRIVE_FOLDER_ID 指定的資料夾（可能用了不同的 Gmail，或資料夾 ID 錯誤）。",
  DRIVE_UPLOAD_FAILED: "上傳到 Google Drive 失敗，請稍後再試一次。",
  DRIVE_EXCHANGE_FAILED: "向 Google 換取授權憑證失敗（授權碼可能已使用過或過期）。請重新授權。",
};

export function driveMessage(code: string | null | undefined): string {
  return (code && (DRIVE_MESSAGES as Record<string, string>)[code]) || "Google Drive 發生未知問題。";
}
