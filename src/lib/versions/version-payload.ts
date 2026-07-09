// =============================================================================
// Reconstruct a single historical version of a target.
//
// The version-history page shows the reconstructed payload inline (so the
// user can see what changed without going anywhere), but the sandbox needs
// to also load that exact payload into its form when the user clicks
// "Slot this version into build". This file isolates that fetch so both
// the version-history page and the sandbox can share the same code path.
//
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityVersions,
  characterVersions,
  primitiveVersions,
  templateVersions,
} from "@/db/schema";
import {
  reconstructVersion,
  type VersionPayload,
} from "@/lib/versions/delta";

export type ReconstructableType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "CHARACTER"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE";

export interface ReconstructedVersion {
  versionId: string;
  versionNumber: number;
  deltaKind: "FULL" | "DELTA";
  /** The reconstructed snapshot — same shape as the live row, minus
   *  audit fields (id, userId, createdAt, updatedAt). The sandbox
   *  form pre-fills from this. */
  payload: Record<string, unknown>;
}

/**
 * Fetch the reconstructed payload for a specific (target, versionNumber)
 * pair. Returns null if the version doesn't exist or the target type
 * isn't supported.
 *
 * The reconstruction walks the version chain (FULL snapshot + every
 * subsequent DELTA) and applies the DELTA patches to produce the final
 * payload. This is the same logic the version-history page uses.
 */
export async function getVersionPayload(
  targetType: ReconstructableType,
  targetId: string,
  versionNumber: number,
): Promise<ReconstructedVersion | null> {
  const rows = await fetchVersionRows(targetType, targetId);
  if (rows.length === 0) return null;

  // Find the row matching the requested version number.
  const target = rows.find((r) => r.versionNumber === versionNumber);
  if (!target) return null;

  // Reconstruct the chain. We pass all rows (including those AFTER the
  // target version) — reconstructVersion handles stopping at the right
  // point by trimming the chain to the requested version.
  //
  // The DB snapshot column stores plain data (for FULL) or delta patches
  // (for DELTA), NOT wrapped in VersionPayload. We wrap them here using
  // the deltaKind column to determine the correct envelope.
  const chain = rows.map((r) => ({
    versionNumber: r.versionNumber,
    payload: (r.deltaKind === "FULL"
      ? { kind: "FULL" as const, data: (r.snapshot ?? {}) as Record<string, unknown> }
      : { kind: "DELTA" as const, patch: (r.snapshot ?? {}) as Record<string, unknown> }
    ) as VersionPayload,
  }));

  const reconstructed = reconstructVersion(chain, versionNumber);
  if (!reconstructed) return null;

  return {
    versionId: target.id,
    versionNumber: target.versionNumber,
    deltaKind: target.deltaKind as "FULL" | "DELTA",
    payload: reconstructed as Record<string, unknown>,
  };
}

// =============================================================================
// Internal: per-type version row fetchers
// =============================================================================
//
// Same pattern as version-history.ts but scoped to a single target. We
// keep this isolated so changes to the history query don't accidentally
// affect the sandbox load path.
// =============================================================================

interface VersionRowRaw {
  id: string;
  versionNumber: number;
  deltaKind: string;
  snapshot: unknown;
}

async function fetchVersionRows(
  targetType: ReconstructableType,
  targetId: string,
): Promise<VersionRowRaw[]> {
  switch (targetType) {
    case "PRIMITIVE": {
      const numId = Number(targetId);
      if (!Number.isFinite(numId)) return [];
      const rows = await db
        .select({
          id: primitiveVersions.id,
          versionNumber: primitiveVersions.versionNumber,
          deltaKind: primitiveVersions.deltaKind,
          snapshot: primitiveVersions.snapshot,
        })
        .from(primitiveVersions)
        .where(eq(primitiveVersions.primitiveId, numId))
        .orderBy(primitiveVersions.versionNumber);
      return rows;
    }
    case "CAPABILITY": {
      const rows = await db
        .select({
          id: capabilityVersions.id,
          versionNumber: capabilityVersions.versionNumber,
          deltaKind: capabilityVersions.deltaKind,
          snapshot: capabilityVersions.snapshot,
        })
        .from(capabilityVersions)
        .where(eq(capabilityVersions.capabilityId, targetId))
        .orderBy(capabilityVersions.versionNumber);
      return rows;
    }
    case "CHARACTER": {
      const rows = await db
        .select({
          id: characterVersions.id,
          versionNumber: characterVersions.versionNumber,
          deltaKind: characterVersions.deltaKind,
          snapshot: characterVersions.snapshot,
        })
        .from(characterVersions)
        .where(eq(characterVersions.characterId, targetId))
        .orderBy(characterVersions.versionNumber);
      return rows;
    }
    case "RACE_TEMPLATE":
    case "BACKGROUND_TEMPLATE":
    case "ARCHETYPE_TEMPLATE": {
      const rows = await db
        .select({
          id: templateVersions.id,
          versionNumber: templateVersions.versionNumber,
          deltaKind: templateVersions.deltaKind,
          snapshot: templateVersions.snapshot,
        })
        .from(templateVersions)
        .where(eq(templateVersions.templateId, targetId))
        .orderBy(templateVersions.versionNumber);
      return rows;
    }
    default:
      return [];
  }
}
