import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { vitalityRuntimeUpdate } from "@/lib/character/vitality-update";
import { withCharacterMutation } from "@/lib/character/mutation-transaction";
import { readPlayState, reconcilePlayState } from "@/lib/play-state/service";
import { restRecoveryAllowance, restRecoveryChanges } from "@/lib/play-state/rest-recovery";
/**
 * POST /api/characters/[id]/rest
 *
 * Phase 8.2 batch 2 — long or short rest.
 *
 * Long rest (Mashu 2026-07-28):
 *   - currentVitality = maxVitality (full restore)
 *
 * Short rest (Mashu 2026-07-28):
 *   - currentVitality += Math.ceil(max / 2) (i.e. +50% of
 *     MAX vitality, not 50% of missing). Capped at max.
 *     Earlier code used 50% of MISSING (rounded up). The
 *     user clarified: "short rest restores 50% max
 *     vitality: current vitality + half max vitality up to
 *     max vitality."
 *   - Only actual recovery spends the allowance between long rests.
 *     Unused recovery carries into another agreed short rest.
 *   - Long rest resets this allowance, even when recovery is partial.
 *
 * Both:
 *   - Logged as a 'rest' event
 *   - vitality_change also logged so the audit trail is consistent
 *
 * Body:
 *   restType: "long" | "short"
 *   recoveryAmount?: nonnegative integer agreed by the table; defaults to available recovery
 *
 * Auth: required (character owner).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import {
  clampVitality,
  loadCharacterMaxVitality,
} from "@/lib/character/character-vitality";
import { appendCharacterLog } from "@/lib/character/character-log";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const restType = (body as Record<string, unknown>)["restType"];
    if (restType !== "long" && restType !== "short") {
      return NextResponse.json(
        { error: "restType must be 'long' or 'short'." },
        { status: 400 },
      );
    }

    // PLAN Eilxina Part C (Mashu 2026-09-09): permission gate.
    const { character: current } = await resolveCharacterAccess(userId, id, { require: "OWNER" });

    const { max, graph } = await loadCharacterMaxVitality(id);
    // Phase 8.I i2.7f: null currentVitality = at full HP.
    const prev = clampVitality(current.currentVitality ?? max, max);
    const state = await readPlayState("CHARACTER", id);
    const requestedAmount = (body as Record<string, unknown>)["recoveryAmount"];
    if (requestedAmount !== undefined && (typeof requestedAmount !== "number" || !Number.isSafeInteger(requestedAmount))) throw new Error("recoveryAmount must be an integer.");
    const recoveryChanges = restRecoveryChanges(restType, max, prev, state.overrides, requestedAmount as number | undefined);
    const next = recoveryChanges[0]!.value as number;
    const delta = next - prev;

    if (next !== prev) {
      await db
        .update(characters)
        .set({ currentVitality: next, updatedAt: new Date() })
        .where(eq(characters.id, id));
    }

    const restState = await reconcilePlayState("CHARACTER", id, Object.fromEntries(recoveryChanges.map(change => [change.field, change.value])));

    // Two log entries: one for the rest itself, one for the
    // underlying vitality change so the history panel can show
    // them on the same timeline.
    await appendCharacterLog(id, "rest", {
      restType,
      vitalityRestored: next - prev,
    });
    await appendCharacterLog(id, "vitality_change", {
      delta,
      prev,
      next,
      source: restType === "long" ? "long_rest" : "short_rest",
    });

    bustResolverCache(id);
    return NextResponse.json({
      character: {
        id,
        currentVitality: next,
        level: current.level,
      },
      max,
      runtime: vitalityRuntimeUpdate(await readDraftSheet(id, graph)),
      restType,
      vitalityRestored: next - prev,
      shortRestRecovery: restRecoveryAllowance(max, restState.overrides),
    });
  } catch (error) {
    // PLAN Eilxina Part C (Mashu 2026-09-09): CharacterAccessDenied → 403.
    if (error instanceof Error && error.name === "CharacterAccessDenied") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export async function POST(...args:Parameters<typeof handlePOST>){
 const {id}=await args[1].params;
 return withCharacterMutation(id,()=>handlePOST(...args));
}
