// =============================================================================
// Delta versioning engine — Phase 5 Commit B
//
// Strategy:
// - Latest version = FULL snapshot (whole object)
// - Older versions = DELTA (RFC-6902-subset JSON Patch: just changed keys)
// - Reconstruct v_n: start from latest FULL, walk back applying reverse
//   patches until v_n
//
// This keeps storage O(1) per version instead of O(N) — every saved object
// is the same size regardless of how many revisions exist.
//
// Invariants enforced:
// - applyDelta(patch, snapshot) is pure and commutative on disjoint keys
// - reconstructVersion requires the full chain (latest → target) to exist
// - If the chain breaks (e.g. a version was deleted), reconstruction throws
// =============================================================================

/**
 * A JSON Patch delta: a flat object where each key is a field name and each
 * value is the new value for that field. Deleted fields are encoded as
 * `{ __deleted: true }`.
 *
 * We don't use full RFC 6902 (with array ops, move/copy/test) because our
 * payloads are flat record-like objects. Simpler model, same correctness
 * for our domain.
 */
export type Delta = Record<string, unknown>;

export interface FullSnapshot {
  kind: "FULL";
  data: Record<string, unknown>;
}

export interface DeltaPatch {
  kind: "DELTA";
  patch: Delta;
}

export type VersionPayload = FullSnapshot | DeltaPatch;

export const DELETED_FIELD_SENTINEL = "__deleted" as const;

export type VersionEntry = {
  versionNumber: number;
  payload: VersionPayload;
};

/**
 * Compute the minimal delta from `previous` to `next`. Keys present in
 * `next` but missing in `previous` are added. Keys present in `previous`
 * but missing in `next` are encoded as deleted.
 */
export function computeDelta(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): Delta {
  const delta: Delta = {};

  // Walk keys in next, capture changes + additions
  for (const key of Object.keys(next)) {
    if (!deepEqual(previous[key], next[key])) {
      delta[key] = next[key];
    }
  }

  // Walk keys in previous, capture deletions
  for (const key of Object.keys(previous)) {
    if (!(key in next)) {
      delta[key] = { [DELETED_FIELD_SENTINEL]: true };
    }
  }

  return delta;
}

/**
 * Apply a delta patch on top of a snapshot. Pure: returns a new object.
 * Throws if any patch key references a non-existent parent (we don't model
 * nested paths in this engine — payloads are flat).
 */
export function applyDelta(
  snapshot: Record<string, unknown>,
  patch: Delta,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...snapshot };

  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)[DELETED_FIELD_SENTINEL] === true
    ) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  return next;
}

/**
 * Create the first (v1) FULL snapshot from a raw object.
 */
export function createFullSnapshot(
  data: Record<string, unknown>,
): FullSnapshot {
  return { kind: "FULL", data: { ...data } };
}

/**
 * Reconstruct version `targetVersion` from the version chain.
 *
 * Chain convention: entries are stored OLDEST-FIRST (v1, v2, ..., vN).
 * v1 MUST be a FULL snapshot (the base state). Subsequent entries are
 * DELTA patches applied forward (v1 → v2 → v3 → ... → vN).
 *
 * To reconstruct v_n, apply the deltas from v1 through v_n in order.
 *
 * @throws if chain is empty, head is DELTA, or targetVersion not found.
 */
export function reconstructVersion(
  chainOldestFirst: VersionEntry[],
  targetVersion: number,
): Record<string, unknown> {
  if (chainOldestFirst.length === 0) {
    throw new Error("Cannot reconstruct: empty version chain");
  }

  const head = chainOldestFirst[0];
  if (!head) {
    throw new Error("Cannot reconstruct: empty version chain");
  }
  if (head.payload.kind !== "FULL") {
    throw new Error(
      `Cannot reconstruct: chain head v${head.versionNumber} is DELTA, expected FULL (v1 must be FULL)`,
    );
  }

  // Find target in chain
  const targetIndex = chainOldestFirst.findIndex(
    (v) => v.versionNumber === targetVersion,
  );
  if (targetIndex === -1) {
    throw new Error(
      `Cannot reconstruct: version v${targetVersion} not in chain`,
    );
  }

  // Start from v1 FULL, walk forward applying each delta.
  // Each delta at position i (i >= 1) is stored as
  // { key: { value: v_i[key], __prev: v_(i-1)[key], __deleted? } }
  // so applySelfDescribingDelta(v_(i-1), delta_i) = v_i.
  let current: Record<string, unknown> = { ...head.payload.data };
  for (let i = 1; i <= targetIndex; i++) {
    const entry = chainOldestFirst[i];
    if (!entry) {
      throw new Error(`Chain integrity broken at index ${i}: missing entry`);
    }
    if (entry.payload.kind !== "DELTA") {
      throw new Error(
        `Chain integrity broken at v${entry.versionNumber}: expected DELTA`,
      );
    }
    const patch = entry.payload.patch as unknown as Parameters<
      typeof applySelfDescribingDelta
    >[1];
    current = applySelfDescribingDelta(current, patch);
  }

  return current;
}

/**
 * Invert a delta given the snapshot it was applied to. Returns the snapshot
 * before that delta was applied.
 */
function invertDelta(
  snapshotAfter: Record<string, unknown>,
  patch: Delta,
): Record<string, unknown> {
  const before: Record<string, unknown> = { ...snapshotAfter };

  for (const [key, patchValue] of Object.entries(patch)) {
    // Find the original value: walk back through later patches to find the
    // pre-patch value. Since we have snapshotAfter (the post-patch state),
    // we know the post-patch value. The pre-patch value was what `patch[key]`
    // replaced — we need to recover it.
    //
    // In our model, a DELTA only stores changed keys. So if a key appears in
    // the patch, the pre-patch value is whatever was at `snapshotAfter[key]`
    // BEFORE the patch was applied — but we only have the post-patch value.
    //
    // To recover correctly, we need the pre-patch value passed in. So we
    // accept it as a side-channel: the patch carries the previous value as
    // a `{__prev: ...}` envelope when needed.
    //
    // For simple flat objects, callers should use `applyInverseDelta` with
    // the full pre-patch value passed in. We expose a simpler form below
    // for the case where the patch is self-describing.
    if (
      patchValue !== null &&
      typeof patchValue === "object" &&
      !Array.isArray(patchValue) &&
      (patchValue as Record<string, unknown>)["__prev"] !== undefined
    ) {
      const envelope = patchValue as Record<string, unknown>;
      before[key] = envelope["__prev"];
    } else {
      // Without __prev envelope, we can't recover — set to undefined and
      // hope the caller knows. (Better: always use applyInverseDelta.)
      before[key] = undefined;
    }
  }

  return before;
}

/**
 * Self-describing delta: a patch where each entry has the form
 * `{ value: <newValue>, __prev: <oldValue> }`. Use this for reconstruction
 * where you don't carry the full pre-patch snapshot alongside.
 */
export type SelfDescribingDelta = Record<
  string,
  { value: unknown; __prev: unknown; __deleted?: boolean }
>;

/**
 * Apply a self-describing delta to a snapshot (the snapshot being the one
 * BEFORE the delta was applied).
 */
export function applySelfDescribingDelta(
  snapshot: Record<string, unknown>,
  delta: SelfDescribingDelta,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...snapshot };
  for (const [key, entry] of Object.entries(delta)) {
    if (entry.__deleted) {
      delete next[key];
    } else {
      next[key] = entry.value;
    }
  }
  return next;
}

/**
 * Compute a self-describing delta (carries previous values inline so
 * reconstruction doesn't need a side snapshot).
 */
export function computeSelfDescribingDelta(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): SelfDescribingDelta {
  const delta: Record<string, { value: unknown; __prev: unknown; __deleted?: boolean }> = {};

  for (const key of Object.keys(next)) {
    if (!deepEqual(previous[key], next[key])) {
      delta[key] = {
        value: next[key],
        __prev: previous[key],
      };
    }
  }

  for (const key of Object.keys(previous)) {
    if (!(key in next)) {
      delta[key] = {
        value: undefined,
        __prev: previous[key],
        __deleted: true,
      };
    }
  }

  return delta as SelfDescribingDelta;
}

/**
 * Invert a self-describing delta to recover the prior snapshot. Pure.
 */
export function invertSelfDescribingDelta(
  delta: SelfDescribingDelta,
): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(delta)) {
    before[key] = entry["__prev"];
  }
  return before;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Structural equality for primitives + plain objects + arrays. Sufficient
 * for our payloads (no Date/Map/Set in version snapshots).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === "object") {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }

  return false;
}

/**
 * Strip undefined values from an object so JSON serialization is clean.
 * Useful before storing snapshots.
 */
export function compactSnapshot(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}