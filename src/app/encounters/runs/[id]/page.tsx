import { EncounterRun } from "@/components/encounters/encounter-run";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EncounterRun id={(await params).id} />;
}
