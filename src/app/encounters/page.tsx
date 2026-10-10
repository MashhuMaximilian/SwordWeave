import { EncounterArchive } from "@/components/encounters/encounter-archive";
import { EncounterWorkspace } from "@/components/encounters/encounter-workspace";
export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  return params.new === "1" ? <EncounterWorkspace startNew /> : <EncounterArchive />;
}
