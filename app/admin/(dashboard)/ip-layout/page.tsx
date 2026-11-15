import IpLayoutAdmin from "@/components/admin/IpLayoutAdmin";

export const dynamic = "force-dynamic";

export default function IpLayoutPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">🧩 IP 角色版面</h1>
      <p className="mb-6 mt-1 text-sm text-ink-400">
        分別調整桌機、平板、手機首頁上「布迪、威洛、帕菲」的位置、大小與角度；也可以在這裡更換角色外觀圖片。預覽就是真正的首頁，儲存後前台立即生效。
      </p>
      <IpLayoutAdmin />
    </div>
  );
}
