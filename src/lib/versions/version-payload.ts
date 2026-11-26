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

import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  effectVersions,
  itemVersions,
  capabilityVersions,
  characterVersions,
  primitiveVersions,
  heritageVersions,
} from "@/db/schema";
import {
  reconstructVersion,
  type VersionPayload,
} from "@/lib/versions/delta";

export type ReconstructableType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "EFFECT"
  | "ITEM"
  | "CHARACTER"
  | "LINEAGE_TEMPLATE"
  | "UPBRINGING_TEMPLATE"
  | "MANIFEST_TEMPLATE";

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
  const [target] = await fetchVersionRows(targetType, targetId, (_, number) => eq(number, versionNumber));
  if (!target) return null;
  // FULL versions are self-contained. DELTA reconstruction needs preceding
  // rows only; never download newer or unrelated history to open a preview.
  const rows = target.deltaKind === "FULL" ? [target]
    : await fetchVersionRows(targetType, targetId, (_, number) => lte(number, versionNumber));
  return reconstructPayload(target, rows);
}

/** Load an exact pin within its definition and fail closed on incomplete history. */
export async function getPinnedVersionPayload(
  targetType: ReconstructableType,
  targetId: string,
  versionId: string,
): Promise<ReconstructedVersion | null> {
  const [target] = await fetchVersionRows(targetType, targetId, id => eq(id, versionId));
  if (!target) return null;
  const last = target.versionNumber;
  const available = target.deltaKind === "FULL" ? [target]
    : await fetchVersionRows(targetType, targetId, (_, number) =>
      and(gte(number, Math.max(1, last - PIN_HISTORY_LIMIT + 1)), lte(number, last))!);
  return reconstructPinnedVersion(target, available);
}

const PIN_HISTORY_LIMIT = 80;

/** Shared with the sheet resolver so a reviewed pin has the same meaning when applied. */
export function reconstructPinnedVersion(target: VersionRowRaw, versions: readonly VersionRowRaw[]): ReconstructedVersion | null {
  const last = target.versionNumber;
  if (!Number.isSafeInteger(last) || last < 1) return null;
  const available = target.deltaKind === "FULL" ? [target] :
    versions.filter(row => row.versionNumber <= last && row.versionNumber > last - PIN_HISTORY_LIMIT)
      .sort((left, right) => left.versionNumber - right.versionNumber);
  let base = available.length - 1;
  while (base >= 0 && available[base]?.deltaKind !== "FULL") base--;
  if (base < 0 || available.at(-1)?.id !== target.id) return null;
  const chain = available.slice(base);
  if (!chain.every((row, index) => row.versionNumber === last - chain.length + 1 + index &&
    hasValidSnapshot(row, index === 0 ? "FULL" : "DELTA"))) return null;
  return reconstructPayload(target, chain, true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasValidSnapshot(row: VersionRowRaw, kind: "FULL" | "DELTA") {
  if (row.deltaKind !== kind || !isRecord(row.snapshot)) return false;
  if (kind === "FULL") return true;
  return Object.entries(row.snapshot).every(([field, value]) =>
    !["__proto__", "constructor", "prototype"].includes(field) && isRecord(value) &&
    (value["__deleted"] === true || (Object.hasOwn(value, "value") && !value["__deleted"])));
}

function reconstructPayload(target: VersionRowRaw, rows: VersionRowRaw[], strictEnvelope = false): ReconstructedVersion | null {
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

  let reconstructed = reconstructVersion(chain, target.versionNumber);

  // Some seed-script snapshots store {id, data: {...}, sourceOrigin}.
  // If the reconstructed payload has a "data" key that's an object
  // (and not a plain field like "description"), unwrap it.
  if (
    isRecord(reconstructed["data"]) &&
    ("id" in reconstructed || (strictEnvelope && reconstructed["kind"] === "FULL"))
  ) {
    // Historical source validation needs to see every authored field. An
    // envelope may carry provenance, but cannot hide separate content.
    if (strictEnvelope && Object.keys(reconstructed).some(field => ![
      "id", "kind", "data", "sourceOrigin", "sourceId", "sourceVersionId", "userId", "createdAt", "updatedAt",
    ].includes(field))) return null;
    reconstructed = reconstructed["data"] as Record<string, unknown>;
  }

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
  selectVersion: (id: AnyPgColumn, number: AnyPgColumn) => SQL,
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
        .where(and(eq(primitiveVersions.primitiveId, numId), selectVersion(primitiveVersions.id, primitiveVersions.versionNumber)))
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
        .where(and(eq(capabilityVersions.capabilityId, targetId), selectVersion(capabilityVersions.id, capabilityVersions.versionNumber)))
        .orderBy(capabilityVersions.versionNumber);
      return rows;
    }
    case "EFFECT": {
      return db.select({id: effectVersions.id, versionNumber: effectVersions.versionNumber,
        deltaKind: effectVersions.deltaKind, snapshot: effectVersions.snapshot}).from(effectVersions)
        .where(and(eq(effectVersions.effectId, targetId), selectVersion(effectVersions.id, effectVersions.versionNumber)))
        .orderBy(effectVersions.versionNumber);
    }
    case "ITEM": {
      return db.select({id: itemVersions.id, versionNumber: itemVersions.versionNumber,
        deltaKind: itemVersions.deltaKind, snapshot: itemVersions.snapshot}).from(itemVersions)
        .where(and(eq(itemVersions.itemId, targetId), selectVersion(itemVersions.id, itemVersions.versionNumber)))
        .orderBy(itemVersions.versionNumber);
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
        .where(and(eq(characterVersions.characterId, targetId), selectVersion(characterVersions.id, characterVersions.versionNumber)))
        .orderBy(characterVersions.versionNumber);
      return rows;
    }
    case "LINEAGE_TEMPLATE":
    case "UPBRINGING_TEMPLATE":
    case "MANIFEST_TEMPLATE": {
      const rows = await db
        .select({
          id: heritageVersions.id,
          versionNumber: heritageVersions.versionNumber,
          deltaKind: heritageVersions.deltaKind,
          snapshot: heritageVersions.snapshot,
        })
        .from(heritageVersions)
        .where(and(eq(heritageVersions.templateId, targetId), selectVersion(heritageVersions.id, heritageVersions.versionNumber)))
        .orderBy(heritageVersions.versionNumber);
      return rows;
    }
    default:
      return [];
  }
}
