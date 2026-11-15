import type { Metadata } from "next";
import PhotoWallClient from "@/components/PhotoWallClient";
import { getApprovedPhotos } from "@/lib/publicPhotos";

export const metadata: Metadata = {
  title: "照片投稿 Photo Wall",
  description: "分享你在台灣看見的風景、校園生活與難忘時刻。",
};

export const dynamic = "force-dynamic";

export default async function PhotoSubmitPage() {
  const photos = await getApprovedPhotos();
  return <PhotoWallClient photos={photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />;
}
