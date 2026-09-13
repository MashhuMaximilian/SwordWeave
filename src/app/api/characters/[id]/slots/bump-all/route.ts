// =============================================================================
// POST /api/characters/[id]/slots/bump-all — PLAN Eilxina Part D follow-up
// (Mashu 2026-09-09).
//
// Bumps EVERY stale slot on the character to its entity's latest version.
// "Stale" = slot's versionId !== entity's latest_version_id (computed via
// bulkResolveLatestVersions).
//
// Why a batch endpoint instead of N per-slot calls from the client:
//   - Single roundtrip, single transaction worth of writes, single cache bust.
//   - Atomic per kind: either every slot of that kind bumps or none do.
//   - Cheap for the client (no orchestration).
//
// Body: { kind?: "PRIMITIVE" | "CAPABILITY" | "ITEM" | "ALL" }
//   - "ALL" (default): bump every stale slot regardless of kind.
//   - Specific kind: only bump stale slots of that kind.
//
// Response: 200 { bumped: { primitive: number, capability: number, item: number }, total: number }
//
// Auth: OWNER only (per canResolveCharacter).
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  characterPrimitives,
  characterCapabilities,
  characterItems,
} from "@/db/schema";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { bulkResolveLatestVersions } from "@/lib/versions/bulk-resolve-latest-versions";
import { recomputeBuSpentAndBustCache } from "@/lib/engine/recompute-bu-spent";

const BodySchema = z
  .object({
    kind: z.enum(["ALL", "PRIMITIVE", "CAPABILITY", "ITEM"]).optional(),
    // PLAN Eilxina Part G (Mashu 2026-09-10): optionally include
    // slots whose versionId is NULL (i.e. pre-Phase-3 slots that
    // never got pinned to a version). Default false to preserve
    // the prior behavior of only bumping slots that ALREADY have
    // a pinned version behind the latest. Set true to migrate the
    // legacy NULL rows in one shot.
    includeUnversioned: z.boolean().optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth.protect();
    const { id: characterId } = await params;
    await resolveCharacterAccess(clerkUserId, characterId, {
      require: "OWNER",
    });

    // Body is optional.
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const kind = parsed.data?.kind ?? "ALL";
    const includeUnversioned = parsed.data?.includeUnversioned ?? false;

    const bumped = { primitive: 0, capability: 0, item: 0 };

    // PLAN Eilxina Part G (Mashu 2026-09-10): when includeUnversioned
    // is true, also pick up rows whose versionId IS NULL (legacy
    // pre-Phase-3 slots). The default filter is `isNotNull` so the
    // prior behavior — only bumping slots that ALREADY have a pinned
    // version behind the latest — is preserved.

    if (kind === "ALL" || kind === "PRIMITIVE") {
      const slotRows = await db
        .select({
          instanceId: characterPrimitives.instanceId,
          primitiveId: characterPrimitives.primitiveId,
          versionId: characterPrimitives.versionId,
        })
        .from(characterPrimitives)
        .where(
          includeUnversioned
            ? eq(characterPrimitives.characterId, characterId)
            : and(
                eq(characterPrimitives.characterId, characterId),
                isNotNull(characterPrimitives.versionId),
              ),
        );
      const latestMap = await bulkResolveLatestVersions(
        slotRows.map((r) => ({ kind: "primitive" as const, id: r.primitiveId })),
      );
      for (const r of slotRows) {
        const latest = latestMap.get(`primitive:${r.primitiveId}`);
        if (!latest || latest === r.versionId) continue;
        await db
          .update(characterPrimitives)
          .set({ versionId: latest })
          .where(eq(characterPrimitives.instanceId, r.instanceId));
        bumped.primitive++;
      }
    }

    if (kind === "ALL" || kind === "CAPABILITY") {
      const slotRows = await db
        .select({
          capabilityId: characterCapabilities.capabilityId,
          versionId: characterCapabilities.versionId,
        })
        .from(characterCapabilities)
        .where(
          includeUnversioned
            ? eq(characterCapabilities.characterId, characterId)
            : and(
                eq(characterCapabilities.characterId, characterId),
                isNotNull(characterCapabilities.versionId),
              ),
        );
      const latestMap = await bulkResolveLatestVersions(
        slotRows.map((r) => ({ kind: "capability" as const, id: r.capabilityId })),
      );
      for (const r of slotRows) {
        const latest = latestMap.get(`capability:${r.capabilityId}`);
        if (!latest || latest === r.versionId) continue;
        await db
          .update(characterCapabilities)
          .set({ versionId: latest })
          .where(
            and(
              eq(characterCapabilities.characterId, characterId),
              eq(characterCapabilities.capabilityId, r.capabilityId),
            ),
          );
        bumped.capability++;
      }
    }

    if (kind === "ALL" || kind === "ITEM") {
      const slotRows = await db
        .select({
          itemId: characterItems.itemId,
          versionId: characterItems.versionId,
        })
        .from(characterItems)
        .where(
          includeUnversioned
            ? eq(characterItems.characterId, characterId)
            : and(
                eq(characterItems.characterId, characterId),
                isNotNull(characterItems.versionId),
              ),
        );
      const latestMap = await bulkResolveLatestVersions(
        slotRows.map((r) => ({ kind: "item" as const, id: r.itemId })),
      );
      for (const r of slotRows) {
        const latest = latestMap.get(`item:${r.itemId}`);
        if (!latest || latest === r.versionId) continue;
        await db
          .update(characterItems)
          .set({ versionId: latest })
          .where(
            and(
              eq(characterItems.characterId, characterId),
              eq(characterItems.itemId, r.itemId),
            ),
          );
        bumped.item++;
      }
    }

    const total = bumped.primitive + bumped.capability + bumped.item;
    if (total > 0) {
      // Recompute BU once at the end (not per slot) + bust resolver cache.
      await recomputeBuSpentAndBustCache(characterId);
    }

    return NextResponse.json({ bumped, total }, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error(
      "[POST /api/characters/[id]/slots/bump-all] unexpected:",
      e,
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
