import { z } from "zod";
import { encounterRequest } from "@/lib/encounters/http";
import { getRun, mutateRun } from "@/lib/encounters/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
type Context = { params: Promise<{ id: string }> };
export const GET = (r: Request, c: Context) =>
  encounterRequest(async (owner) =>
    getRun(
      owner,
      z.uuid().parse((await c.params).id),
      new URL(r.url).searchParams.get("session") === "1",
    ),
  );
export const PATCH = (r: Request, c: Context) =>
  encounterRequest(async (owner) =>
    mutateRun(
      owner,
      z.uuid().parse((await c.params).id),
      await readBoundedJson(r, 131072),
    ),
  );
