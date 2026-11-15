import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApprovedPhoto, getVisibleComments } from "@/lib/publicPhotos";
import PhotoDetailContent from "@/components/PhotoDetailContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const photo = await getApprovedPhoto(params.id);
  if (!photo) return {};
  return { title: `${photo.title["zh-TW"]}｜照片投稿`, description: photo.caption?.["zh-TW"] };
}

export default async function PhotoDetailPage({ params }: { params: { id: string } }) {
  const photo = await getApprovedPhoto(params.id);
  if (!photo) notFound(); // PENDING/REJECTED/不存在 一律當成 404，不透露任何內部資訊

  const comments = await getVisibleComments(params.id);

  return (
    <PhotoDetailContent
      photo={{ ...photo, createdAt: photo.createdAt.toISOString() }}
      comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
    />
  );
}
