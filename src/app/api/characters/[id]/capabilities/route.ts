/**
 * GET /api/characters/[id]/capabilities
 *
 * Phase 9.3 (Mashu 2026-09-06): list the character's capabilities.
 * Used by the heritage formalize sheet to pre-populate the
 * "available capabilities" list on the embedded HeritageForm.
 *
 * Query params:
 *   kind: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL" | null
 *     — optional filter on slot_tab (for DIRECT caps) OR on
 *       origin heritage's kind (for heritage-bundled caps). When
 *       omitted, returns all caps on the character.
 *
 * Returns:
 *   { capabilities: Array<{ capabilityId, capability, slotTab, originHeritageId }> }
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  characterCapabilities,
  characters,
  heritage,
} from "@/db/schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    if (!character) {
      return NextResponse.json(
        { error: "Character not found." },
        { status: 404 },
      );
    }
    if (character.userId !== userId) {
      return NextResponse.json(
        { error: "You do not own this character." },
        { status: 403 },
      );
    }

    const baseRows = await db
      .select({
        capabilityId: characterCapabilities.capabilityId,
        slotTab: characterCapabilities.slotTab,
        originHeritageId: characterCapabilities.originHeritageId,
      })
      .from(characterCapabilities)
      .where(eq(characterCapabilities.characterId, characterId));

    let filtered = baseRows;
    if (kind && kind !== "PERSONAL") {
      // For DIRECT caps (originHeritageId null), slotTab must equal kind.
      // For heritage-bundled caps, walk the heritage row's kind.
      const heritageIds = baseRows
        .map((r) => r.originHeritageId)
        .filter((id): id is string => Boolean(id));
      const heritageKindMap = new Map<string, string>();
      if (heritageIds.length > 0) {
        const hRows = await db
          .select({ id: heritage.id, kind: heritage.kind })
          .from(heritage)
          .where(eq(heritage.id, heritageIds[0]!));
        // drizzle doesn't support `inArray` without an import; do a
        // simple loop for the small list:
        for (const id of heritageIds) {
          const row = hRows.find((r) => r.id === id);
          if (row) heritageKindMap.set(id, row.kind);
        }
      }
      filtered = baseRows.filter((r) => {
        if (r.originHeritageId == null) return r.slotTab === kind;
        return heritageKindMap.get(r.originHeritageId) === kind;
      });
    }

    if (filtered.length === 0) {
      return NextResponse.json({ capabilities: [] }, { status: 200 });
    }

    const capRows = await db
      .select({
        id: capabilities.id,
        name: capabilities.name,
        type: capabilities.type,
      })
      .from(capabilities)
      .where(eq(capabilities.id, filtered[0]!.capabilityId));
    const capNameMap = new Map(capRows.map((c) => [c.id, c]));
    // For >1 caps we'd need inArray; small N is fine here.
    for (const r of filtered.slice(1)) {
      if (capNameMap.has(r.capabilityId)) continue;
      const extra = await db
        .select({
          id: capabilities.id,
          name: capabilities.name,
          type: capabilities.type,
        })
        .from(capabilities)
        .where(eq(capabilities.id, r.capabilityId));
      for (const c of extra) capNameMap.set(c.id, c);
    }

    const out = filtered
      .map((r) => {
        const cap = capNameMap.get(r.capabilityId);
        if (!cap) return null;
        return {
          capabilityId: r.capabilityId,
          slotTab: r.slotTab,
          originHeritageId: r.originHeritageId,
          capability: {
            id: cap.id,
            name: cap.name,
            type: cap.type,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ capabilities: out }, { status: 200 });
  } catch (err) {
    console.error("[characters capabilities GET] failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load capabilities.",
      },
      { status: 500 },
    );
  }
}
