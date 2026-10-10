import { encounterReadRequest } from "@/lib/encounters/http";
import { listEncounterDirectory } from "@/lib/encounters/directory";
export const GET = (request: Request) =>
  encounterReadRequest(async (viewer) => {
    const params = new URL(request.url).searchParams;
    const requested = Number(params.get("offset"));
    const offset = Number.isSafeInteger(requested)
      ? Math.max(0, Math.min(requested, 1000000))
      : 0;
    const rows = await listEncounterDirectory(viewer, {
      search: (params.get("q") ?? "").slice(0, 200),
      offset,
      limit: 25,
    });
    return { encounters: rows.slice(0, 24), hasMore: rows.length > 24 };
  });
