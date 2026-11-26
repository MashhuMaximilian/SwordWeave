import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { listCharacterCompanionCandidates, listCharacterCompanions } from "@/lib/character/companions";
import { privateJson } from "@/lib/http/private-json";
import { CHARACTER_SIZES } from "@/lib/heritage/lineage-size";

const pickerFilters = z.object({
  size: z.enum(CHARACTER_SIZES).optional(),
  origin: z.enum(["system", "community"]).optional(),
  maxBudget: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  sort: z.enum(["name", "budget"]).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const query = new URL(request.url).searchParams;
  if (query.get("view") === "public") return privateJson({ companions: [] });
  const { userId } = await auth();
  if (!userId) return privateJson({ error: "Sign in to view companions." }, { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return privateJson({ error: "Character not found." }, { status: 404 });
  try {
    if (query.get("picker") === "1") {
      const search = z.string().trim().max(120).safeParse(query.get("q") ?? "");
      if (!search.success) return privateJson({ error: "Search for a shorter monster name." }, { status: 400 });
      const offset = z.coerce.number().int().min(0).max(100_000).safeParse(query.get("offset") ?? 0);
      if (!offset.success) return privateJson({ error: "Invalid Bestiary page." }, { status: 400 });
      const filters = pickerFilters.safeParse({
        size: query.get("size") || undefined,
        origin: query.get("origin") || undefined,
        maxBudget: query.get("maxBudget") || undefined,
        sort: query.get("sort") || undefined,
      });
      if (!filters.success) return privateJson({ error: "Invalid Bestiary filters." }, { status: 400 });
      const { size, origin, maxBudget, sort } = filters.data;
      return privateJson(await listCharacterCompanionCandidates(id.data, userId, search.data, offset.data, {
        ...(size ? { size } : {}), ...(origin ? { origin } : {}),
        ...(maxBudget === undefined ? {} : { maxBudget }), ...(sort ? { sort } : {}),
      }));
    }
    return privateJson({ companions: await listCharacterCompanions(id.data, userId) });
  } catch (error) {
    if (error instanceof CharacterAccessDenied)
      return privateJson({ error: "Character not found." }, { status: 404 });
    return privateJson({ error: "Companions could not be loaded." }, { status: 500 });
  }
}
