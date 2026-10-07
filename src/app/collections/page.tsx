import { CollectionsClient } from "@/components/collections/collections-client";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; create?: string }>;
}) {
  const { owner, create } = await searchParams;
  return <CollectionsClient startCreating={create === "1" && !owner} {...(owner ? { ownerId: owner } : {})} />;
}
