// =============================================================================
// dispatch-save — Phase 1 + Phase 4 content hashing of the edit-creates-fork
// refactor (§11 of docs/architecture/edit-creates-fork.md).
//
// The single entry point for every entity-save endpoint. Reads `intent` +
// `draftHash` + `sourceHash` + ownership and decides which concrete operation
// to run.
//
//   ┌──────────────────┬────────────┬─────────────────┬──────────────────┐
//   │ intent           │ owner      │ hashes match    │ outcome          │
//   ├──────────────────┼────────────┼─────────────────┼──────────────────┤
//   │ null (greenfield)│ —          │ sourceHash=null │ INSERT new row   │
//   │ null (greenfield)│ —          │ sourceHash=null │ no-op (empty)    │
//   │ null             │ caller     │ equal           │ no-op "Nothing…  │
//   │ null             │ caller     │ different       │ UPDATE in place  │
//   │ null             │ non-owner  │ equal           │ no-op            │
//   │ null             │ non-owner  │ different       │ INSERT new fork  │
//   │ fork             │ any        │ equal           │ no-op "Nothing…  │
//   │ fork             │ any        │ different       │ INSERT new fork  │
//   │ load             │ caller     │ equal           │ no-op "Nothing…  │
//   │ load             │ caller     │ different       │ UPDATE in place  │
//   │ load             │ non-owner  │ equal           │ no-op "Nothing…  │
//   │ load             │ non-owner  │ different       │ INSERT new fork  │
//   └──────────────────┴────────────┴─────────────────┴──────────────────┘
//
// Phase 4 (now folded into Phase 1 per Mashu after observing accidental
// forks on no-change saves): content-hash equality short-circuits the
// matrix. The no-op message is tailored per cell so the user always sees
// a coherent explanation of why nothing happened.
//
// `DispatchSaveParams` is intentionally generic — Phase 2 will pass
// effects/capabilities/items/templates through the same helper by
// binding the row type at each call site.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import type { SaveIntent } from "./save-intent";
import { isPrimitiveDraftEmpty } from "./hash-content";

export type DispatchOutcome =
  /**
   * The save was short-circuited because the form content hasn't changed
   * since the last save (or, for greenfield, the form is empty). The caller
   * shows `message` to the user and does NOT touch the database.
   */
  | {
      kind: "no-op";
      message: string;
      /**
       * True when the source row exists and the user owns it (or it's
       * system content). The caller uses this to decide whether to swap
       * the URL — for a no-op, the URL stays put either way.
       */
      swapTarget: false;
    }
  /**
   * The save materialized a brand-new fork row (intent=fork with changes,
   * OR caller-doesn't-own-source with changes, OR greenfield with content).
   * The caller updates their URL to target the new row.
   */
  | {
      kind: "forked";
      newId: string | number;
      sourceId: string | number | null;
      swapTarget: boolean;
    }
  /**
   * The save updated the source row in place (caller-owns-source +
   * intent=load + changes). The caller's URL stays put.
   */
  | {
      kind: "version-update";
      newId: string | number;
      sourceId: string | number;
      swapTarget: false;
    };

/**
 * Minimal source-row shape the dispatcher needs to make its decision.
 * `contentHash` may be null for legacy rows (treated as "always changed").
 */
export interface SourceRowIdentity {
  id: string | number;
  userId: string | null;
  contentHash: string | null;
}

export interface DecideSaveOutcomeParams {
  intent: SaveIntent;
  source: SourceRowIdentity | null;
  callerUserId: string;
  /**
   * SHA-256 hex of the canonical-JSON content envelope, computed by the
   * caller. Used to detect no-op saves. The dispatcher treats `null` as
   * "no hash provided" — falling back to the legacy always-change path.
   */
  draftHash: string | null;
  /**
   * True when the draft form is empty (no name, no content). Used by
   * the greenfield path to short-circuit "save an empty form" attempts.
   * When omitted, treated as `false`.
   */
  draftIsEmpty?: boolean;
}

// -----------------------------------------------------------------------------
// Per-cell messages. Centralized so we can change wording without rewriting
// the matrix logic.
// -----------------------------------------------------------------------------

const MSG_FORK_NO_CHANGES =
  "Nothing to fork — make a change first.";
const MSG_LOAD_OWN_NO_CHANGES =
  "Nothing has changed.";
const MSG_LOAD_NON_OWNER_NO_CHANGES =
  "Nothing to save.";
const MSG_GREENFIELD_EMPTY =
  "Nothing to change — give it a name first.";
const MSG_NO_HASH_PROVIDED =
  "Nothing saved — content hash missing. Refresh and try again.";

/**
 * Pure decision function. Given the inputs, returns the outcome. The caller
 * (the entity-save POST handler) is responsible for executing the resulting
 * INSERT or UPDATE. Keeping the decision separate from execution makes this
 * trivially unit-testable.
 */
export function decideSaveOutcome(
  params: DecideSaveOutcomeParams,
): DispatchOutcome {
  const {
    intent,
    source,
    callerUserId,
    draftHash,
    draftIsEmpty = false,
  } = params;

  // Guard: caller must always supply a draftHash. If they didn't, refuse
  // rather than risk creating an empty fork.
  if (draftHash === null || draftHash.length === 0) {
    return {
      kind: "no-op",
      message: MSG_NO_HASH_PROVIDED,
      swapTarget: false,
    };
  }

  // Greenfield save: no source row. Empty drafts are no-ops; non-empty
  // drafts always INSERT a fresh row.
  if (source === null) {
    if (draftIsEmpty) {
      return {
        kind: "no-op",
        message: MSG_GREENFIELD_EMPTY,
        swapTarget: false,
      };
    }
    return {
      kind: "forked",
      newId: -1, // sentinel — caller INSERTs and overwrites
      sourceId: null,
      swapTarget: false,
    };
  }

  const isOwner = source.userId === callerUserId;

  // Legacy source rows (contentHash === null) are treated as "always
  // changed" — fall through to the legacy matrix path. After their first
  // save under the new system, they'll have a hash and short-circuit
  // correctly on subsequent saves.
  const sourceHash = source.contentHash;
  const hashesMatch = sourceHash !== null && sourceHash === draftHash;

  // No-change short-circuit. Tailored message per cell so the user gets a
  // coherent explanation.
  if (hashesMatch) {
    if (intent === "fork") {
      return {
        kind: "no-op",
        message: MSG_FORK_NO_CHANGES,
        swapTarget: false,
      };
    }
    if (intent === "load" && isOwner) {
      return {
        kind: "no-op",
        message: MSG_LOAD_OWN_NO_CHANGES,
        swapTarget: false,
      };
    }
    if (intent === "load" && !isOwner) {
      return {
        kind: "no-op",
        message: MSG_LOAD_NON_OWNER_NO_CHANGES,
        swapTarget: false,
      };
    }
    if (intent === null && isOwner) {
      return {
        kind: "no-op",
        message: MSG_LOAD_OWN_NO_CHANGES,
        swapTarget: false,
      };
    }
    if (intent === null && !isOwner) {
      return {
        kind: "no-op",
        message: MSG_LOAD_NON_OWNER_NO_CHANGES,
        swapTarget: false,
      };
    }
  }

  // Changed (or legacy source with no hash). Apply the original matrix.
  if (intent === "fork") {
    return {
      kind: "forked",
      newId: -1,
      sourceId: source.id,
      swapTarget: true,
    };
  }

  if (isOwner) {
    return {
      kind: "version-update",
      newId: source.id,
      sourceId: source.id,
      swapTarget: false,
    };
  }

  return {
    kind: "forked",
    newId: -1,
    sourceId: source.id,
    swapTarget: true,
  };
}

/**
 * Convenience helper for the API route. Loads the source row's identity
 * AND its current content hash in one query. Phase 2 will add parallel
 * helpers for effects/capabilities/items/templates.
 */
export async function loadPrimitiveOwner(
  primitiveId: number,
): Promise<SourceRowIdentity | null> {
  const rows = await db
    .select({
      id: primitives.id,
      userId: primitives.userId,
      contentHash: primitives.contentHash,
    })
    .from(primitives)
    .where(eq(primitives.id, primitiveId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    contentHash: row.contentHash,
  };
}

// =============================================================================
// Phase 2 of the edit-creates-fork refactor (§11 of edit-creates-fork.md):
// generic `loadEntityOwner` that covers all 5 entity types. The dispatcher
// is entity-agnostic — it just needs the source row's (id, userId,
// contentHash) triple. Each route passes its target type in.
// =============================================================================

/**
 * The 5 entity types that participate in the deferred-fork dispatch matrix.
 * Mirrors the form's `build=<type>` URL convention.
 */
export type SaveTargetType =
  | "PRIMITIVE"
  | "EFFECT"
  | "CAPABILITY"
  | "ITEM"
  | "TEMPLATE";

/**
 * Loads the source row's identity (id, userId, contentHash) for any of the
 * 5 entity types. Returns null if the row doesn't exist. Used by the
 * per-entity POST handlers to populate the dispatcher's SourceRowIdentity.
 */
export async function loadEntityOwner(
  targetType: SaveTargetType,
  targetId: string | number,
): Promise<SourceRowIdentity | null> {
  if (targetType === "PRIMITIVE") {
    return loadPrimitiveOwner(Number(targetId));
  }

  if (targetType === "EFFECT") {
    const { effects } = await import("@/db/schema/engine");
    const rows = await db
      .select({
        id: effects.id,
        userId: effects.userId,
        contentHash: effects.contentHash,
      })
      .from(effects)
      .where(eq(effects.id, String(targetId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.userId, contentHash: row.contentHash };
  }

  if (targetType === "CAPABILITY") {
    const { capabilities } = await import("@/db/schema/engine");
    const rows = await db
      .select({
        id: capabilities.id,
        userId: capabilities.userId,
        contentHash: capabilities.contentHash,
      })
      .from(capabilities)
      .where(eq(capabilities.id, String(targetId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.userId, contentHash: row.contentHash };
  }

  if (targetType === "ITEM") {
    const { items } = await import("@/db/schema/items");
    const rows = await db
      .select({
        id: items.id,
        userId: items.userId,
        contentHash: items.contentHash,
      })
      .from(items)
      .where(eq(items.id, String(targetId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.userId, contentHash: row.contentHash };
  }

  if (targetType === "TEMPLATE") {
    const { templates } = await import("@/db/schema/characters");
    const rows = await db
      .select({
        id: templates.id,
        userId: templates.userId,
        contentHash: templates.contentHash,
      })
      .from(templates)
      .where(eq(templates.id, String(targetId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.userId, contentHash: row.contentHash };
  }

  // Exhaustiveness — if a new SaveTargetType is added without a case above,
  // TypeScript will fail this assignment at compile time.
  const _exhaustive: never = targetType;
  throw new Error(`Unknown target type: ${String(_exhaustive)}`);
}

// =============================================================================
// Phase 2 dispatch wrapper. Wraps the boilerplate that the per-entity POST
// and PATCH routes all need: parse intent, load source, compute draft hash,
// run decideSaveOutcome. Each route does its own per-entity execute (INSERT
// or UPDATE) after getting the outcome back.
//
// The canonical payload + draft-hash is entity-specific (different shape per
// targetType), so the caller pre-computes them and passes the draftHash in.
// =============================================================================

export interface DispatchEntitySaveArgs {
  targetType: SaveTargetType;
  sourceId: string | number | null;
  intent: SaveIntent;
  callerUserId: string;
  draftHash: string;
  draftIsEmpty: boolean;
}

export interface DispatchEntitySaveResult {
  source: SourceRowIdentity | null;
  outcome: DispatchOutcome;
}

/**
 * Resolve the dispatch matrix for any entity save. Combines the intent
 * parsing + source load + outcome decision in one call. The caller is
 * responsible for executing the INSERT or UPDATE that the outcome
 * prescribes.
 */
export async function dispatchEntitySave(
  args: DispatchEntitySaveArgs,
): Promise<DispatchEntitySaveResult> {
  const source = args.sourceId !== null
    ? await loadEntityOwner(args.targetType, args.sourceId)
    : null;

  const outcome = decideSaveOutcome({
    intent: args.intent,
    source,
    callerUserId: args.callerUserId,
    draftHash: args.draftHash,
    draftIsEmpty: args.draftIsEmpty,
  });

  return { source, outcome };
}

// Re-export isPrimitiveDraftEmpty so callers don't need a second import.
export { isPrimitiveDraftEmpty };