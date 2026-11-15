import { redirect } from "next/navigation";

// 投稿審核搬到「圖片管理」底下了，舊網址保留轉址，避免書籤失效。
export default function AdminUploadsRedirectPage() {
  redirect("/admin/images/submissions");
}
