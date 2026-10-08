import { EncounterWorkspace } from "@/components/encounters/encounter-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EncounterWorkspace id={(await params).id} />;
}
