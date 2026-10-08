import { z } from "zod";
import { encounterRequest } from "@/lib/encounters/http";
import { getEncounter, startEncounter } from "@/lib/encounters/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
type Context = { params: Promise<{ id: string }> };
export const GET = (_: Request, c: Context) =>
  encounterRequest(async (owner) => ({
    runs: (await getEncounter(owner, z.uuid().parse((await c.params).id))).runs,
  }));
export const POST = (r: Request, c: Context) =>
  encounterRequest(async (owner) => {
    const b = z
      .object({ opId: z.uuid(), revision: z.number().int().nonnegative() })
      .strict()
      .parse(await readBoundedJson(r, 2048));
    return startEncounter(
      owner,
      z.uuid().parse((await c.params).id),
      b.opId,
      b.revision,
    );
  });
