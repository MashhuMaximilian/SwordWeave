/**
 * Content-addressed version ID.
 *
 * The version_id column on every character / capability / item junction
 * table (Phase 3) AND the id column on every _versions table (Phase 4
 * redo) is a content-addressed UUID v5.
 *
 * The hash input is `(entityKind, entityId, contentHash)`. Including the
 * entity identity in the input means:
 *   - Same content in two different entities yields two different version
 *     ids (so the _versions PK is unique across the whole table).
 *   - Same content re-saved on the same entity yields the same version id
 *     (so the dispatcher can detect no-op saves and avoid duplicate rows).
 *   - A slot version_id uniquely identifies "this version of this entity"
 *     - a stale-slot check is a single equality test, no entity disambiguation
 *     needed.
 *
 * UUID v5 = name-based UUID using a fixed namespace, computed from
 * SHA-1(namespace_bytes || name_bytes). Stable across all processes, all
 * time, all machines.
 *
 * @example
 *   const v1 = resolveContentVersionId("primitive", 13, "abc123");
 *   const v2 = resolveContentVersionId("primitive", 13, "abc123");
 *   v1 === v2  // true
 *
 *   const v3 = resolveContentVersionId("primitive", 14, "abc123");
 *   v1 === v3  // false (different entity)
 *
 *   const v4 = resolveContentVersionId("primitive", 13, "def456");
 *   v1 === v4  // false (different content)
 */

import { createHash } from "node:crypto";

/**
 * Fixed UUID namespace for SwordWeave content version IDs.
 * Standard UUID v5 namespace for URLs. Hardcoded - never change this
 * value, or every existing version_id in the database would silently
 * become invalid.
 */
const SWORDWEAVE_CONTENT_VERSION_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Derive a deterministic UUID v5 from (entityKind, entityId, contentHash).
 *
 * Stable forever: same triple yields the same UUID, every time.
 *
 * Collision-free in practice across all SwordWeave entities: the triple
 * is unique per (entity_kind, entity_id, content) combination, so two
 * different version rows will never share a UUID.
 */
export function resolveContentVersionId(
  entityKind: string,
  entityId: string | number,
  contentHash: string,
): string {
  if (!entityKind || typeof entityKind !== "string") {
    throw new Error("resolveContentVersionId: entityKind must be a non-empty string");
  }
  if (entityId === undefined || entityId === null || entityId === "") {
    throw new Error("resolveContentVersionId: entityId is required");
  }
  if (!contentHash || typeof contentHash !== "string") {
    throw new Error("resolveContentVersionId: contentHash must be a non-empty string");
  }

  // Compose the hash input: "<entityKind>:<entityId>:<contentHash>".
  // The colons are delimiters; the namespace prefix in UUID v5 is the
  // SWORDWEAVE_CONTENT_VERSION_NAMESPACE bytes (not visible here).
  const name = `${entityKind}:${entityId}:${contentHash}`;
  const nameBytes = Buffer.from(name, "utf8");

  // Parse the namespace UUID into 16 bytes (big-endian).
  const nsHex = SWORDWEAVE_CONTENT_VERSION_NAMESPACE.replace(/-/g, "");
  const nsBytes = Buffer.from(nsHex, "hex");

  // SHA-1(namespace || name)
  const hash = createHash("sha1").update(nsBytes).update(nameBytes).digest();

  // Set the version (high 4 bits of byte 6) to 5.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  // Set the variant (high 2 bits of byte 8) to 10.
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  // Take the first 16 bytes and format as canonical UUID.
  return bytesToUuidString(hash.subarray(0, 16));
}

/** Format 16 bytes as a 36-character canonical UUID string. */
function bytesToUuidString(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
