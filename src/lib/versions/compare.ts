// =============================================================================
// Version compare helper — Phase 6.5 #18
//
// Given two reconstructed payloads (both Record<string, unknown>), produces
// a flat list of fields with their status: ADDED, REMOVED, MODIFIED, UNCHANGED.
//
// Stable sort: alphabetic by field key.
// =============================================================================

export type FieldStatus = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";

export interface FieldDiff {
  key: string;
  status: FieldStatus;
  before?: unknown;
  after?: unknown;
}

export interface CompareSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

const DELETED = "__deleted";

export function diffPayloads(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { fields: FieldDiff[]; summary: CompareSummary } {
  const allKeys = new Set<string>([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);
  // Filter out the deleted sentinel at top level
  allKeys.delete(DELETED);

  const fields: FieldDiff[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;

  for (const key of [...allKeys].sort((a, b) => a.localeCompare(b))) {
    const hasBefore = key in before;
    const hasAfter = key in after;
    if (hasBefore && !hasAfter) {
      fields.push({ key, status: "REMOVED", before: before[key] });
      removed++;
    } else if (!hasBefore && hasAfter) {
      fields.push({ key, status: "ADDED", after: after[key] });
      added++;
    } else if (deepEqual(before[key], after[key])) {
      fields.push({ key, status: "UNCHANGED", before: before[key], after: after[key] });
      unchanged++;
    } else {
      fields.push({
        key,
        status: "MODIFIED",
        before: before[key],
        after: after[key],
      });
      modified++;
    }
  }

  return {
    fields,
    summary: { added, removed, modified, unchanged },
  };
}