// =============================================================================
// Version ID helpers — Phase 5 Commit C
//
// `reaction_aggregates`, `flag_aggregates`, and `reactions` tables all key
// on (target_type, target_id, version_id) where version_id is a real UUID.
//
// Real UUID version IDs come from the version tables:
//   - capability_versions.id
//   - character_versions.id
//   - template_versions.id
//   - primitive_versions.id (when published)
//
// For library items that have NOT been published via Phase 5 (the existing
// 169 primitives, 26 capabilities, etc.), there is no version_id. We
// synthesize a stable "virtual" UUID by hashing (targetType, targetId) so
// reactions still work consistently across page loads.
//
// This is fine because:
// - The target_id is already unique per item within its type
// - The version_id is just a per-item version pointer; for unversioned items
//   we collapse to a single virtual version
// - Real published items use their real version_id; reactions on those are
//   version-pinned as designed
// =============================================================================

import { createHash } from "crypto";
import type { publishTargetTypeEnum } from "@/db/schema";

export type ReactionTargetType =
  (typeof publishTargetTypeEnum.enumValues)[number];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/**
 * Synthesize a stable UUID-shaped version_id for unversioned targets.
 *
 * Uses MD5 of (targetType || targetId) and reformats as UUID v5-style:
 * 8-4-4-4-12 hex. (Not RFC-compliant UUID v5 namespace, but format-compatible
 * with our TEXT UUID columns.)
 */
export function resolveVirtualVersionId(
  targetType: ReactionTargetType,
  targetId: string,
): string {
  const h = createHash("md5").update(`${targetType}:${targetId}`).digest("hex");
  // Format as UUID: 8-4-4-4-12
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20, 32),
  ].join("-");
}