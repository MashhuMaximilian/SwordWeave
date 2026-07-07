// =============================================================================
// dispatch-save — Phase 1 of the edit-creates-fork refactor (§11 of
// docs/architecture/edit-creates-fork.md).
//
// The single entry point for every entity-save endpoint. Reads `intent`
// + the source row's owner and decides which concrete operation to run:
//
//   ┌──────────────────┬─────────────────┬──────────────────┐
//   │ intent           │ owner           │ outcome          │
//   ├──────────────────┼─────────────────┼──────────────────┤
//   │ fork             │ any             │ INSERT new fork  │
//   │ load             │ caller owns     │ UPDATE in place  │
//   │ load             │ caller !owns    │ INSERT new fork  │
//   │ null             │ greenfield      │ INSERT new row   │
//   └──────────────────┴─────────────────┴──────────────────┘
//
// Phase 1 deliberately does NOT short-circuit on no-change detection.
// That lands in Phase 4 alongside content-hashed version snapshots —
// see the "Cut-list" note in §11 of the design doc. For now every
// save proceeds regardless of whether the user actually changed
// anything; OQ5's user-facing messages come online in Phase 4.
//
// `DispatchSaveParams` is intentionally generic — Phase 2 will pass
// effects/capabilities/items/templates through the same helper by
// binding the row type at each call site.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import type { SaveIntent } from "./save-intent";

export type DispatchOutcome =
  /**
   * The save materialized a brand-new fork row (caller-owns-source +
   * intent=fork, OR caller-doesn't-own-source + any intent, OR
   * greenfield + intent=fork). The caller updates their URL to
   * target the new row and shows the post-save modal.
   */
  | {
      kind: "forked";
      /** The new fork row's id (filled in by the caller after INSERT). */
      newId: string | number;
      /** The source row's id (or null if greenfield). */
      sourceId: string | number | null;
      /**
       * If true, the caller should swap their URL from `?edit=<source>`
       * to `?edit=<new>` so subsequent saves target the fork (not the
       * source). If false (load + owner, or greenfield), the URL stays
       * the same.
       */
      swapTarget: boolean;
    }
  /**
   * The save updated the source row in place (caller-owns-source +
   * intent=load). The caller's URL stays put. A toast says "Saved
   * version <N+1>" (Phase 4 wires the version number).
   */
  | {
      kind: "version-update";
      /** The same id the caller was editing. */
      newId: string | number;
      sourceId: string | number;
      swapTarget: false;
    };

/**
 * Minimal source-row shape the dispatcher needs to make its decision.
 * All callers pass a row fetched from Drizzle with at least id + userId.
 */
export interface SourceRowIdentity {
  id: string | number;
  userId: string | null;
}

/**
 * Pure decision function — given the inputs, returns the outcome. The
 * caller (the entity-save POST handler) is responsible for actually
 * executing the resulting INSERT or UPDATE. Keeping the decision
 * separate from execution makes this trivially unit-testable.
 */
export function decideSaveOutcome(params: {
  intent: SaveIntent;
  source: SourceRowIdentity | null;
  callerUserId: string;
}): DispatchOutcome {
  const { intent, source, callerUserId } = params;

  // Greenfield save: no source row → fresh INSERT, no fork lineage.
  if (source === null) {
    return {
      kind: "forked",
      newId: -1, // sentinel — caller INSERTs and overwrites
      sourceId: null,
      swapTarget: false, // greenfield INSERT returns the new row id
    };
  }

  const isOwner = source.userId === callerUserId;

  // intent=fork → ALWAYS create a fork (even if caller owns the source).
  // Per Mashu (round 6 revision): "if I use the fork button, even though
  // I am the owner, it still creates the fork."
  if (intent === "fork") {
    return {
      kind: "forked",
      newId: -1, // sentinel — caller INSERTs and overwrites
      sourceId: source.id,
      swapTarget: true,
    };
  }

  // intent=load + caller owns source → update in place.
  if (isOwner) {
    return {
      kind: "version-update",
      newId: source.id,
      sourceId: source.id,
      swapTarget: false,
    };
  }

  // intent=load + caller does NOT own → fork. Non-owner + any intent
  // other than "I am deliberately forking this" gets the same outcome.
  return {
    kind: "forked",
    newId: -1, // sentinel — caller INSERTs and overwrites
    sourceId: source.id,
    swapTarget: true,
  };
}

/**
 * DB helper — fetches the source row's owner for a primitive entity.
 * Used by /api/primitives POST handler to look up the row before
 * deciding the dispatch outcome. Phase 2 will add parallel helpers
 * for effects/capabilities/items/templates.
 */
export async function loadPrimitiveOwner(
  primitiveId: number,
): Promise<SourceRowIdentity | null> {
  const rows = await db
    .select({ id: primitives.id, userId: primitives.userId })
    .from(primitives)
    .where(eq(primitives.id, primitiveId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, userId: row.userId };
}