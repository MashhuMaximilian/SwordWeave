import { encounterRequest } from "@/lib/encounters/http";
import { listEncounters, saveEncounter } from "@/lib/encounters/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
export const GET = () =>
  encounterRequest(async (owner) => ({
    encounters: await listEncounters(owner),
  }));
export const POST = (request: Request) =>
  encounterRequest(async (owner) =>
    saveEncounter(owner, await readBoundedJson(request, 131072)),
  );
