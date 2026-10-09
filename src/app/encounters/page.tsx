import { EncounterWorkspace } from "@/components/encounters/encounter-workspace";
export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  return <EncounterWorkspace startNew={params.new === "1"} />;
}
