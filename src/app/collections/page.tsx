import { CollectionsClient } from "@/components/collections/collections-client";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const { owner } = await searchParams;
  return <CollectionsClient {...(owner ? { ownerId: owner } : {})} />;
}
