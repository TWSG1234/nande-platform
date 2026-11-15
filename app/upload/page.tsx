import { redirect } from "next/navigation";

// 這個頁面改名叫「照片投稿」了，網址也改成 /photo-submit。
// 舊的 /upload 網址（例如已經印出去的 QR Code）保留成一個轉址，不會失效。
export default function UploadRedirectPage() {
  redirect("/photo-submit");
}
