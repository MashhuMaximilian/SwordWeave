// =============================================================================
// GET /api/characters/[id]/slots/stale-diffs — PLAN Eilxina Part F
// (Mashu 2026-09-10).
//
// Returns the list of stale slots for a character, with both the
// current pinned version's snapshot AND the latest version's snapshot,
// plus a small shallow diff describing field-level changes.
//
// Why this exists: the "Update all" button previously just bumped
// silently. The user can't audit what's about to change. This endpoint
// powers the new UpdateAllModal — the modal reads the response,
// renders one row per stale slot, lets the user check which to apply,
// and POSTs the chosen subset to /api/characters/[id]/slots/bump-all.
//
// Response shape:
//   {
//     items: [{
//       slotKind: "PRIMITIVE" | "CAPABILITY" | "ITEM",
//       slotInstanceId: string,
//       entityId: string | number,
//       entityName: string,
//       current: { versionId: string, versionNumber: number, snapshot: {...} },
//       latest:  { versionId: string, versionNumber: number, snapshot: {...} },
//       diff:    Array<{ field: string, before: unknown, after: unknown }>
//     }, ...]
//   }
//
// Auth: OWNER only (same as the bump-all endpoint that consumes this).
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterPrimitives,
  characterCapabilities,
  characterItems,
  primitiveVersions,
  capabilityVersions,
  itemVersions,
  primitives,
  capabilities,
  items as itemsTable,
} from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

interface DiffEntry {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * Shallow field diff between two snapshots. Both are jsonb Records.
 * Returns only the keys that differ. Arrays / nested objects are
 * compared by JSON.stringify — good enough for "is something different"
 * semantics; the UI shows the JSON if it does.
 */
function shallowDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const out: DiffEntry[] = [];
  for (const k of keys) {
    const b = (before ?? {})[k];
    const a = (after ?? {})[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ field: k, before: b, after: a });
    }
  }
  return out;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId } = await params;
    await resolveCharacterAccess(clerkUserId, characterId, {
      require: "OWNER",
    });

    const items: Array<{
      slotKind: "PRIMITIVE" | "CAPABILITY" | "ITEM";
      slotInstanceId: string;
      entityId: string | number;
      entityName: string;
      current: { versionId: string; versionNumber: number; snapshot: Record<string, unknown> };
      latest: { versionId: string; versionNumber: number; snapshot: Record<string, unknown> };
      diff: DiffEntry[];
    }> = [];

    // ---- PRIMITIVES ----
    const primSlots = await db
      .select({
        instanceId: characterPrimitives.instanceId,
        primitiveId: characterPrimitives.primitiveId,
        versionId: characterPrimitives.versionId,
        name: primitives.name,
      })
      .from(characterPrimitives)
      .innerJoin(primitives, eq(primitives.id, characterPrimitives.primitiveId))
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          isNotNull(characterPrimitives.versionId),
        ),
      );

    for (const slot of primSlots) {
      const [current] = await db
        .select()
        .from(primitiveVersions)
        .where(eq(primitiveVersions.id, slot.versionId!))
        .limit(1);
      const [latest] = await db
        .select()
        .from(primitiveVersions)
        .where(
          and(
            eq(primitiveVersions.primitiveId, slot.primitiveId),
            // PLAN Eilxina Part G (Mashu 2026-09-10): the previous
            // query had `.orderBy(/* is_latest desc, version desc */)`
            // (literally empty parens) and no `isLatest: true` filter,
            // so it returned whichever row Postgres happened to land
            // on first — usually the OLDEST version, not the latest.
            // That made `current.id === latest.id` always true and
            // the modal showed "nothing to update" even when the
            // header chip read "17 updates available". Filter to the
            // actual latest row, ordered by versionNumber as a
            // tiebreaker.
            eq(primitiveVersions.isLatest, true),
          ),
        )
        .orderBy(desc(primitiveVersions.versionNumber))
        .limit(1);
      if (!current || !latest || current.id === latest.id) continue;
      items.push({
        slotKind: "PRIMITIVE",
        slotInstanceId: slot.instanceId,
        entityId: slot.primitiveId,
        entityName: slot.name,
        current: {
          versionId: current.id,
          versionNumber: current.versionNumber,
          snapshot: current.snapshot,
        },
        latest: {
          versionId: latest.id,
          versionNumber: latest.versionNumber,
          snapshot: latest.snapshot,
        },
        diff: shallowDiff(current.snapshot, latest.snapshot),
      });
    }

    // ---- CAPABILITIES ----
    const capSlots = await db
      .select({
        capabilityId: characterCapabilities.capabilityId,
        characterId: characterCapabilities.characterId,
        versionId: characterCapabilities.versionId,
        name: capabilities.name,
      })
      .from(characterCapabilities)
      .innerJoin(
        capabilities,
        eq(capabilities.id, characterCapabilities.capabilityId),
      )
      .where(
        and(
          eq(characterCapabilities.characterId, characterId),
          isNotNull(characterCapabilities.versionId),
        ),
      );

    for (const slot of capSlots) {
      const [current] = await db
        .select()
        .from(capabilityVersions)
        .where(eq(capabilityVersions.id, slot.versionId!))
        .limit(1);
      const [latest] = await db
        .select()
        .from(capabilityVersions)
        .where(
          and(
            eq(capabilityVersions.capabilityId, slot.capabilityId),
            // PLAN Eilxina Part G (Mashu 2026-09-10): same fix as
            // primitives above — without `isLatest: true` the query
            // returned a random non-latest row, `current === latest`
            // matched, and the modal showed no diffs. Filter + sort.
            eq(capabilityVersions.isLatest, true),
          ),
        )
        .orderBy(desc(capabilityVersions.versionNumber))
        .limit(1);
      if (!current || !latest || current.id === latest.id) continue;
      items.push({
        slotKind: "CAPABILITY",
        // Capabilities use a composite (characterId, capabilityId) PK;
        // `${characterId}:${capabilityId}` is a stable handle for
        // the bump-all endpoint to address the row.
        slotInstanceId: `${slot.characterId}:${slot.capabilityId}`,
        entityId: slot.capabilityId,
        entityName: slot.name,
        current: {
          versionId: current.id,
          versionNumber: current.versionNumber,
          snapshot: current.snapshot,
        },
        latest: {
          versionId: latest.id,
          versionNumber: latest.versionNumber,
          snapshot: latest.snapshot,
        },
        diff: shallowDiff(current.snapshot, latest.snapshot),
      });
    }

    // ---- ITEMS ----
    const itemSlots = await db
      .select({
        itemId: characterItems.itemId,
        characterId: characterItems.characterId,
        versionId: characterItems.versionId,
        name: itemsTable.name,
      })
      .from(characterItems)
      .innerJoin(itemsTable, eq(itemsTable.id, characterItems.itemId))
      .where(
        and(
          eq(characterItems.characterId, characterId),
          isNotNull(characterItems.versionId),
        ),
      );

    for (const slot of itemSlots) {
      const [current] = await db
        .select()
        .from(itemVersions)
        .where(eq(itemVersions.id, slot.versionId!))
        .limit(1);
      const [latest] = await db
        .select()
        .from(itemVersions)
        .where(
          and(
            eq(itemVersions.itemId, slot.itemId),
            // PLAN Eilxina Part G (Mashu 2026-09-10): same fix.
            eq(itemVersions.isLatest, true),
          ),
        )
        .orderBy(desc(itemVersions.versionNumber))
        .limit(1);
      if (!current || !latest || current.id === latest.id) continue;
      items.push({
        slotKind: "ITEM",
        slotInstanceId: `${slot.characterId}:${slot.itemId}`,
        entityId: slot.itemId,
        entityName: slot.name,
        current: {
          versionId: current.id,
          versionNumber: current.versionNumber,
          snapshot: current.snapshot,
        },
        latest: {
          versionId: latest.id,
          versionNumber: latest.versionNumber,
          snapshot: latest.snapshot,
        },
        diff: shallowDiff(current.snapshot, latest.snapshot),
      });
    }

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "stale-diffs lookup failed.",
      },
      { status: err instanceof Error && err.message === "NOT_OWNER" ? 403 : 500 },
    );
  }
}
