import { z } from "zod";
import { encounterRequest, encounterReadRequest } from "@/lib/encounters/http";
import {
  getEncounter,
  saveEncounter,
  deleteEncounter,
} from "@/lib/encounters/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
type Context = { params: Promise<{ id: string }> };
export const GET = (_: Request, c: Context) =>
  encounterReadRequest(async (owner) =>
    getEncounter(owner, z.uuid().parse((await c.params).id)),
  );
export const PATCH = (r: Request, c: Context) =>
  encounterRequest(async (owner) => {
    const body = z
      .object({
        revision: z.number().int().nonnegative(),
        definition: z.unknown(),
      })
      .strict()
      .parse(await readBoundedJson(r, 131072));
    return saveEncounter(
      owner,
      body.definition,
      z.uuid().parse((await c.params).id),
      body.revision,
    );
  });
export const DELETE = (_: Request, c: Context) =>
  encounterRequest(async (owner) =>
    deleteEncounter(owner, z.uuid().parse((await c.params).id)),
  );
