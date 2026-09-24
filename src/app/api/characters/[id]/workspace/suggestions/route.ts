import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canResolveCharacter, CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { loadDiscoveryCatalog } from "@/lib/character/workspace/discovery/catalog";
import { rankDiscoveryCandidates } from "@/lib/character/workspace/discovery/matching";

const requestSchema = z.object({
  query: z.string().trim().max(500).default(""),
  intent: z.enum(["surprise", "defense", "mobility", "training", "healing", "weakness"]).default("surprise"),
  budget: z.number().finite().min(0),
  debtAvailable: z.number().finite().min(0).default(0),
  kinds: z.array(z.enum(["primitive", "effect", "capability", "heritage", "item"])).min(1).max(5).default(["primitive"]),
  suppliedPrimitiveKeys: z.array(z.string().regex(/^primitive:.+$/)).max(10000).default([]),
  destinationIsItem: z.boolean().default(false),
  excludedKeys: z.array(z.string().regex(/^(primitive|effect|capability|heritage|item):.+$/)).max(10000).default([]),
});

/** Read-only discovery. Prices are an allowance filter; draft apply revalidates. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    await canResolveCharacter(userId, id);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid search and a non-negative BU allowance." }, { status: 400 });
    const criteria = parsed.data;
    const kinds = criteria.intent === "weakness" ? ["primitive" as const] : criteria.kinds;
    const catalog = await loadDiscoveryCatalog(kinds, userId);
    const suggestions = rankDiscoveryCandidates(catalog, { ...criteria, kinds, suppliedPrimitiveKeys: criteria.suppliedPrimitiveKeys as `primitive:${string}`[], excludedKeys: criteria.excludedKeys as `${typeof kinds[number]}:${string}`[] });
    return NextResponse.json({ suggestions, catalogCount: catalog.length, matchingCount: suggestions.length, matchingMethod: "Related words and mechanical fields; no generated rules." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CharacterAccessDenied) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("Character discovery failed", error);
    return NextResponse.json({ error: "Suggestions could not be loaded. Your draft has not changed." }, { status: 500 });
  }
}
