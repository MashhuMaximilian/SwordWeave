import { CollectionsClient } from "@/components/collections/collections-client";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionsClient collectionId={id} />;
}
