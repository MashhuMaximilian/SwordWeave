/**
 * POST /api/characters/[id]/capabilities/attach
 *
 * Phase 9.3 (Mashu 2026-09-06): attach a capability (existing or
 * just-created in atelier) onto this character. The atelier owns
 * the capability creation flow; this route only handles the
 * "slot it on this character" step that atelier doesn't do.
 *
 * Body:
 *   capabilityId: string (required)
 *   slotTab: "LINEAGE" | "UPBRINGING" | "MANIFEST" | null
 *     — where on the character sheet the capability should live.
 *       Heritage-bundled caps (originHeritageId != null) inherit
 *       their tab from the heritage's kind, so this is for
 *       DIRECT slots only.
 *   acquiredAtLevel?: number (default 1)
 *
 * Returns:
 *   { characterCapability: {...} }
 *
 * Auth: required (character owner). Character must be in BUILD mode.
 *
 * Idempotent: if the cap is already attached, returns 200 with
 * the existing row (no duplicate key error). If slotTab changes,
 * updates the row.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterCapabilities,
  capabilities,
} from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendCharacterLog } from "@/lib/character/character-log";
import {
  resolveCharacterAccess,
} from "@/lib/character/resolve-character-access";
import { withCharacterSnapshot } from "@/lib/character/with-character-snapshot";

const ALLOWED_SLOT_TABS = ["LINEAGE", "UPBRINGING", "MANIFEST"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id: characterId } = await params;

    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const values = body as Record<string, unknown>;

    const capabilityIdRaw = String(values["capabilityId"] ?? "").trim();
    if (!capabilityIdRaw) {
      return NextResponse.json(
        { error: "capabilityId is required." },
        { status: 400 },
      );
    }

    const slotTabRaw = values["slotTab"];
    let slotTab: (typeof ALLOWED_SLOT_TABS)[number] | null = null;
    if (slotTabRaw != null && slotTabRaw !== "") {
      if (
        typeof slotTabRaw !== "string" ||
        !(ALLOWED_SLOT_TABS as readonly string[]).includes(slotTabRaw)
      ) {
        return NextResponse.json(
          {
            error: `slotTab must be one of ${ALLOWED_SLOT_TABS.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      slotTab = slotTabRaw as (typeof ALLOWED_SLOT_TABS)[number];
    }

    const acquiredAtLevel = (() => {
      const n = Number(values["acquiredAtLevel"]);
      if (!Number.isFinite(n) || n < 1) return 1;
      return Math.min(Math.floor(n), 99);
    })();

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character } = await resolveCharacterAccess(userId, characterId, {
      require: "OWNER",
    });
    if (character.mode === "PLAY") {
      return NextResponse.json(
        {
          error:
            "Character is in PLAY mode. Switch to BUILD mode to attach capabilities.",
        },
        { status: 409 },
      );
    }

    // Capability must exist.
    const capability = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, capabilityIdRaw),
    });
    if (!capability) {
      return NextResponse.json(
        { error: "Capability not found." },
        { status: 404 },
      );
    }

    // Idempotent attach. If a row exists, update slotTab if it changed.
    const existing = await db.query.characterCapabilities.findFirst({
      where: and(
        eq(characterCapabilities.characterId, characterId),
        eq(characterCapabilities.capabilityId, capabilityIdRaw),
      ),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let row: any = existing;
    if (existing) {
      if (slotTab && existing.slotTab !== slotTab) {
        const updated = await db
          .update(characterCapabilities)
          .set({ slotTab })
          .where(
            and(
              eq(characterCapabilities.characterId, characterId),
              eq(characterCapabilities.capabilityId, capabilityIdRaw),
            ),
          )
          .returning();
        row = updated[0] ?? existing;
      }
    } else {
      const inserted = await db
        .insert(characterCapabilities)
        .values({
          characterId,
          capabilityId: capabilityIdRaw,
          acquiredAtLevel,
          slotTab: slotTab ?? "MANIFEST",
        } as never)
        .returning();
      row = inserted[0] ?? null;
    }

    bustResolverCache(characterId);

    // Audit log. Use the capability_attached payload kind so the
    // character log has a distinct event for this flow.
    await appendCharacterLog(characterId, "capability_attached", {
      capabilityId: capabilityIdRaw,
      capabilityName: capability.name,
      slotTab: row?.slotTab ?? null,
      acquiredAtLevel,
    });

    await withCharacterSnapshot(characterId, async () => {
      // Snapshot captures fresh state after the capability attach
    }, { publishedByUserId: userId });

    return NextResponse.json(
      { characterCapability: row ?? null },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied
    // → 403. Anything else → existing 500 fallback.
    if (err instanceof Error && err.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[characters capabilities/attach] failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to attach capability.",
      },
      { status: 500 },
    );
  }
}
