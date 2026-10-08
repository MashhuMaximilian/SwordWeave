import { z } from "zod";
import { encounterRequest } from "@/lib/encounters/http";
import { partyCharacters } from "@/lib/encounters/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
export const GET = (r: Request) =>
  encounterRequest(async (owner) => ({
    characters: await partyCharacters(
      owner,
      undefined,
      Math.max(
        0,
        Math.min(
          1000000,
          Number(new URL(r.url).searchParams.get("offset")) || 0,
        ),
      ),
    ),
  }));
export const POST = (r: Request) =>
  encounterRequest(async (owner) => {
    const { ids } = z
      .object({ ids: z.array(z.uuid()).max(30) })
      .strict()
      .parse(await readBoundedJson(r, 8192));
    return { characters: await partyCharacters(owner, [...new Set(ids)]) };
  });
