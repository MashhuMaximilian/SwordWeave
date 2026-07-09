// =============================================================================
// Version history query service — Phase 6.5 #8
//
// Lists all versions of a published target (PRIMITIVE, CAPABILITY, CHARACTER,
// TEMPLATE) with metadata for the version history page. Reconstructs each
// version's payload so the UI can show what changed without N+1 queries.
//
// Output VersionEntry[] is sorted ASC by versionNumber (v1 first).
// =============================================================================

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityVersions,
  characterVersions,
  primitiveVersions,
  templateVersions,
  users,
} from "@/db/schema";
import {
  reconstructVersion,
  type VersionPayload,
} from "@/lib/versions/delta";

export type VersionTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "CHARACTER"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE";

export interface VersionEntry {
  id: string;
  versionNumber: number;
  deltaKind: "FULL" | "DELTA";
  /** When this version was published */
  publishedAt: Date;
  /** Who published it */
  publishedByUserId: string | null;
  publishedByUsername: string | null;
  publishedByDisplayName: string | null;
  /** Reconstructed payload (FULL or DELTA applied cumulatively) */
  payload: Record<string, unknown>;
  /** Change stats — only meaningful for DELTA versions */
  changeStats: {
    added: number;
    modified: number;
    removed: number;
  };
}

export interface VersionHistoryResult {
  versions: VersionEntry[];
  targetType: VersionTargetType;
  targetId: string;
  targetName: string;
}

interface RawVersionRow {
  id: string;
  versionNumber: number;
  deltaKind: "FULL" | "DELTA";
  snapshot: unknown;
  publishedAt: Date;
  publishedByUserId: string | null;
  publisherUsername: string | null;
  publisherDisplayName: string | null;
  publisherIsAnonymized: boolean | null;
  publisherDeletedAt: Date | null;
}

/**
 * Fetch the full version history of a target, oldest → newest.
 *
 * @param targetType — which version table to read from
 * @param targetId   — id within that target's primary table
 */
export async function getVersionHistory(
  targetType: VersionTargetType,
  targetId: string,
): Promise<VersionHistoryResult | null> {
  const targetName = await resolveTargetName(targetType, targetId);
  // Target must exist. If resolveTargetName returned null, the target is
  // either deleted, never existed, or the id is wrong — surface a 404.
  if (targetName === null) return null;

  const rows = await fetchVersionRows(targetType, targetId);
  // Target exists but has zero published versions — return an empty list.
  // The page renders an "empty state" instead of 404.

  // Build a reconstructable chain. reconstructVersion() wants
  // [{ versionNumber, payload: { kind: 'FULL', data } | { kind: 'DELTA', patch } }, ...]
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

  const versions: VersionEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    let payload: Record<string, unknown> = {};
    try {
      payload = reconstructVersion(chain, r.versionNumber);
    } catch {
      payload = (r.snapshot ?? {}) as Record<string, unknown>;
    }

    const prev = i > 0 ? versions[i - 1] : null;
    const changeStats =
      r.deltaKind === "DELTA" && prev
        ? diffStats(prev.payload, payload)
        : { added: 0, modified: 0, removed: 0 };

    const publisherVisible =
      !r.publisherIsAnonymized && !r.publisherDeletedAt;

    versions.push({
      id: r.id,
      versionNumber: r.versionNumber,
      deltaKind: r.deltaKind,
      publishedAt: r.publishedAt,
      publishedByUserId: r.publishedByUserId,
      publishedByUsername: publisherVisible ? r.publisherUsername : null,
      publishedByDisplayName: publisherVisible ? r.publisherDisplayName : null,
      payload,
      changeStats,
    });
  }

  return {
    versions,
    targetType,
    targetId,
    targetName: targetName ?? "(unknown)",
  };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Dispatch on targetType → version table, fetching raw version rows with
 * publisher join. Pulled out as a function to keep type narrowing simple.
 */
async function fetchVersionRows(
  type: VersionTargetType,
  targetId: string,
): Promise<RawVersionRow[]> {
  if (type === "PRIMITIVE") {
    return db
      .select({
        id: primitiveVersions.id,
        versionNumber: primitiveVersions.versionNumber,
        deltaKind: primitiveVersions.deltaKind,
        snapshot: primitiveVersions.snapshot,
        publishedAt: primitiveVersions.publishedAt,
        publishedByUserId: primitiveVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
      })
      .from(primitiveVersions)
      .leftJoin(users, eq(users.id, primitiveVersions.publishedByUserId))
      .where(eq(primitiveVersions.primitiveId, Number(targetId)))
      .orderBy(asc(primitiveVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (type === "CAPABILITY") {
    return db
      .select({
        id: capabilityVersions.id,
        versionNumber: capabilityVersions.versionNumber,
        deltaKind: capabilityVersions.deltaKind,
        snapshot: capabilityVersions.snapshot,
        publishedAt: capabilityVersions.publishedAt,
        publishedByUserId: capabilityVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
      })
      .from(capabilityVersions)
      .leftJoin(users, eq(users.id, capabilityVersions.publishedByUserId))
      .where(eq(capabilityVersions.capabilityId, targetId))
      .orderBy(asc(capabilityVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (type === "CHARACTER") {
    return db
      .select({
        id: characterVersions.id,
        versionNumber: characterVersions.versionNumber,
        deltaKind: characterVersions.deltaKind,
        snapshot: characterVersions.snapshot,
        publishedAt: characterVersions.publishedAt,
        publishedByUserId: characterVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
      })
      .from(characterVersions)
      .leftJoin(users, eq(users.id, characterVersions.publishedByUserId))
      .where(eq(characterVersions.characterId, String(targetId)))
      .orderBy(asc(characterVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (
    type === "RACE_TEMPLATE" ||
    type === "BACKGROUND_TEMPLATE" ||
    type === "ARCHETYPE_TEMPLATE"
  ) {
    // template_versions.templateId is a uuid; the kind discriminator lives on
    // the templates table, not the version table. Since uuid PKs are globally
    // unique, filtering by templateId alone is sufficient — the URL parameter
    // already encodes the kind.
    return db
      .select({
        id: templateVersions.id,
        versionNumber: templateVersions.versionNumber,
        deltaKind: templateVersions.deltaKind,
        snapshot: templateVersions.snapshot,
        publishedAt: templateVersions.publishedAt,
        publishedByUserId: templateVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
      })
      .from(templateVersions)
      .leftJoin(users, eq(users.id, templateVersions.publishedByUserId))
      .where(eq(templateVersions.templateId, String(targetId)))
      .orderBy(asc(templateVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  return [];
}

async function resolveTargetName(
  type: VersionTargetType,
  id: string,
): Promise<string | null> {
  const {
    primitives,
    capabilities,
    characters,
    templates,
  } = await import("@/db/schema");

  if (type === "PRIMITIVE") {
    const numId = Number(id);
    if (!Number.isFinite(numId)) return null;
    const row = await db.query.primitives.findFirst({
      where: (table, { eq }) => eq(table.id, numId),
      columns: { name: true },
    });
    return row?.name ?? null;
  }
  if (type === "CAPABILITY") {
    const row = await db.query.capabilities.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: { name: true },
    });
    return row?.name ?? null;
  }
  if (type === "CHARACTER") {
    const row = await db.query.characters.findFirst({
      where: (table, { eq }) => eq(table.id, String(id)),
      columns: { name: true },
    });
    return row?.name ?? null;
  }
  if (
    type === "RACE_TEMPLATE" ||
    type === "BACKGROUND_TEMPLATE" ||
    type === "ARCHETYPE_TEMPLATE"
  ) {
    const tplKind = type.replace(/_TEMPLATE$/, "") as "RACE" | "BACKGROUND" | "ARCHETYPE";
    const row = await db.query.templates.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.kind, tplKind), eq(table.id, String(id))),
      columns: { name: true },
    });
    return row?.name ?? null;
  }
  return null;
}

/**
 * Compute a simple field-level diff stat between two reconstructed payloads.
 * Used to summarize a DELTA version's impact ("modified 3 fields, added 1").
 */
function diffStats(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): { added: number; modified: number; removed: number } {
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));

  let added = 0;
  let modified = 0;
  let removed = 0;

  for (const k of nextKeys) {
    if (!prevKeys.has(k)) {
      added++;
    } else if (
      JSON.stringify(prev[k]) !== JSON.stringify(next[k])
    ) {
      modified++;
    }
  }

  for (const k of prevKeys) {
    if (!nextKeys.has(k)) removed++;
  }

  return { added, modified, removed };
}