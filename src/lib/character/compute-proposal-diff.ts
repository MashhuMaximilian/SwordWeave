// =============================================================================
// computeProposalDiff — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Computes the field-level diff between two version rows (current
// vs proposed) for the proposal review screen. The diff is a
// JSON-serializable shape stored in character_proposals.proposed_diff.
//
// Why a separate helper: the canonical payload builders in
// hash-content.ts use different shapes per entity kind. To produce
// a meaningful diff, we walk both snapshots as flat Record<string,
// unknown> and shallow-compare scalar fields. Non-scalar fields
// (hardModifiers, etc.) are flagged as "complex" so the review UI
// can show a "details changed" chip without trying to diff nested
// structures inline.
// =============================================================================

import type { FieldChange } from "@/lib/character/proposal-types";

const SIMPLE_FIELDS = [
  "name",
  "buCost",
  "description",
  "verboseDescription",
  "category",
  "kind",
  "size",
  "rarity",
  "itemType",
  "slotCost",
  "isMirrorable",
  "mirrorBuCredit",
  "mirrorVector",
  "targetType",
  "operation",
] as const;

type SimpleFieldName = (typeof SIMPLE_FIELDS)[number];

/** Walk two flat snapshots and return the list of changed fields.
 *  Both args must already be unwrapped from the {kind, data} envelope
 *  — pass r.snapshot for primitives, r.snapshot for effects, etc. */
export function computeProposalDiff(
  currentSnapshot: Record<string, unknown> | null,
  proposedSnapshot: Record<string, unknown> | null,
): { fieldChanges: FieldChange[] } {
  const fieldChanges: FieldChange[] = [];

  // Iterate over the SIMPLE_FIELDS list. Non-simple fields are skipped
  // here — they appear on the review screen as "details changed" via
  // a separate hardModifiers/linksChanged flag below.
  for (const field of SIMPLE_FIELDS) {
    const before = currentSnapshot?.[field] ?? null;
    const after = proposedSnapshot?.[field] ?? null;
    if (!valueEquals(before, after)) {
      fieldChanges.push({ field, from: before, to: after });
    }
  }

  // Detect changes in the hardModifiers array. We don't try to diff
  // nested objects — just flag it as a complex change.
  const beforeMods = JSON.stringify(
    currentSnapshot?.["hardModifiers"] ?? null,
  );
  const afterMods = JSON.stringify(
    proposedSnapshot?.["hardModifiers"] ?? null,
  );
  if (beforeMods !== afterMods) {
    fieldChanges.push({
      field: "hardModifiers",
      from: "(complex)",
      to: "(changed)",
      complex: true,
    });
  }

  return { fieldChanges };
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null && b === undefined) return true;
  if (b === null && a === undefined) return true;
  if (typeof a !== typeof b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
