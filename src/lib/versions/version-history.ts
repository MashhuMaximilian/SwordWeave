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
  heritageVersions,
  effectVersions,
  itemVersions,
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
  | "EFFECT"
  | "ITEM"
  | "LINEAGE_TEMPLATE"
  | "UPBRINGING_TEMPLATE"
  | "MANIFEST_TEMPLATE";

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
  // Phase 8: per-entity iconography for the version-history header.
  // Same shape as the row-level resolver: nullable source, nullable
  // key/url, hex color (defaults to #ffffff on the DB column).
  targetIcon: {
    iconSource: "GAME_ICONS" | "UPLOAD" | null;
    iconKey: string | null;
    iconUrl: string | null;
    iconColor: string;
  };
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
  /**
   * Phase 9 follow-up: when the publisher is a Clerk admin, we render
   * them as "system" — same rule as the OwnerBar in the live preview.
   * Admins editing canon are swordweave staff acting on behalf of the
   * corpus, not a personal fork. Carrying the flag up from the join
   * lets the page display "system / unpublished" for admin edits
   * while keeping `publishedByUserId` accurate for audit purposes.
   */
  publisherIsAdmin: boolean | null;
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
  const target = await resolveTargetName(targetType, targetId);
  // Target must exist. If resolveTargetName returned null, the target is
  // either deleted, never existed, or the id is wrong — surface a 404.
  if (target === null) return null;
  const targetName = target.name;

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

    // Some seed-script snapshots store {id, data: {...}, sourceOrigin}.
    // If the reconstructed payload has a "data" key that's an object
    // (and not a plain field like "description"), unwrap it.
    if (
      payload &&
      typeof payload === "object" &&
      "data" in payload &&
      typeof payload["data"] === "object" &&
      payload["data"] !== null &&
      !Array.isArray(payload["data"]) &&
      "id" in payload
    ) {
      payload = payload["data"] as Record<string, unknown>;
    }

    const prev = i > 0 ? versions[i - 1] : null;
    const changeStats =
      r.deltaKind === "DELTA" && prev
        ? diffStats(prev.payload, payload)
        : { added: 0, modified: 0, removed: 0 };

    const publisherVisible =
      !r.publisherIsAnonymized && !r.publisherDeletedAt;
    // Phase 9 follow-up: when the publisher is a Clerk admin, mask
    // the username/displayName as null so the version-history UI
    // renders "system / unpublished" instead of "@xeun". The audit
    // trail is preserved (publishedByUserId stays set) so an admin
    // can still trace the edit, but the public-facing attribution
    // matches the OwnerBar's "by System" treatment in the live
    // preview. Same rule, same source of truth.
    const isAdminPublisher = r.publisherIsAdmin === true;

    versions.push({
      id: r.id,
      versionNumber: r.versionNumber,
      deltaKind: r.deltaKind,
      publishedAt: r.publishedAt,
      publishedByUserId: r.publishedByUserId,
      publishedByUsername:
        publisherVisible && !isAdminPublisher ? r.publisherUsername : null,
      publishedByDisplayName:
        publisherVisible && !isAdminPublisher
          ? r.publisherDisplayName
          : null,
      payload,
      changeStats,
    });
  }

  return {
    versions,
    targetType,
    targetId,
    targetName: targetName ?? "(unknown)",
    targetIcon: {
      iconSource: target?.iconSource ?? null,
      iconKey: target?.iconKey ?? null,
      iconUrl: target?.iconUrl ?? null,
      iconColor: target?.iconColor ?? "#ffffff",
    },
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
        // Phase 9 follow-up: hoist is_admin to mask admin publishers
        // as "system" in the version-history UI.
        publisherIsAdmin: users.isAdmin,
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
        publisherIsAdmin: users.isAdmin,
      })
      .from(capabilityVersions)
      .leftJoin(users, eq(users.id, capabilityVersions.publishedByUserId))
      .where(eq(capabilityVersions.capabilityId, targetId))
      .orderBy(asc(capabilityVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (type === "EFFECT") {
    return db
      .select({
        id: effectVersions.id,
        versionNumber: effectVersions.versionNumber,
        deltaKind: effectVersions.deltaKind,
        snapshot: effectVersions.snapshot,
        publishedAt: effectVersions.publishedAt,
        publishedByUserId: effectVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
        publisherIsAdmin: users.isAdmin,
      })
      .from(effectVersions)
      .leftJoin(users, eq(users.id, effectVersions.publishedByUserId))
      .where(eq(effectVersions.effectId, targetId))
      .orderBy(asc(effectVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (type === "ITEM") {
    return db
      .select({
        id: itemVersions.id,
        versionNumber: itemVersions.versionNumber,
        deltaKind: itemVersions.deltaKind,
        snapshot: itemVersions.snapshot,
        publishedAt: itemVersions.publishedAt,
        publishedByUserId: itemVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
        publisherIsAdmin: users.isAdmin,
      })
      .from(itemVersions)
      .leftJoin(users, eq(users.id, itemVersions.publishedByUserId))
      .where(eq(itemVersions.itemId, targetId))
      .orderBy(asc(itemVersions.versionNumber))
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
        publisherIsAdmin: users.isAdmin,
      })
      .from(characterVersions)
      .leftJoin(users, eq(users.id, characterVersions.publishedByUserId))
      .where(eq(characterVersions.characterId, String(targetId)))
      .orderBy(asc(characterVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  if (
    type === "LINEAGE_TEMPLATE" ||
    type === "UPBRINGING_TEMPLATE" ||
    type === "MANIFEST_TEMPLATE"
  ) {
    // template_versions.templateId is a uuid; the kind discriminator lives on
    // the heritage table, not the version table. Since uuid PKs are globally
    // unique, filtering by templateId alone is sufficient — the URL parameter
    // already encodes the kind.
    return db
      .select({
        id: heritageVersions.id,
        versionNumber: heritageVersions.versionNumber,
        deltaKind: heritageVersions.deltaKind,
        snapshot: heritageVersions.snapshot,
        publishedAt: heritageVersions.publishedAt,
        publishedByUserId: heritageVersions.publishedByUserId,
        publisherUsername: users.username,
        publisherDisplayName: users.displayName,
        publisherIsAnonymized: users.isAnonymized,
        publisherDeletedAt: users.deletedAt,
        publisherIsAdmin: users.isAdmin,
      })
      .from(heritageVersions)
      .leftJoin(users, eq(users.id, heritageVersions.publishedByUserId))
      .where(eq(heritageVersions.templateId, String(targetId)))
      .orderBy(asc(heritageVersions.versionNumber))
      .then((rs) => rs as RawVersionRow[]);
  }

  return [];
}

async function resolveTargetName(
  type: VersionTargetType,
  id: string,
): Promise<{
  name: string;
  iconSource: "GAME_ICONS" | "UPLOAD" | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
} | null> {
  const {
    primitives,
    capabilities,
    characters,
    heritage,
    effects,
    items,
  } = await import("@/db/schema");

  // Phase 8: per-entity iconography. We select the same 4 columns
  // every table has (iconSource, iconKey, iconUrl, iconColor) so the
  // version-history page can render the entity's icon in the header.
  const iconCols = {
    iconSource: true,
    iconKey: true,
    iconUrl: true,
    iconColor: true,
  } as const;

  if (type === "PRIMITIVE") {
    const numId = Number(id);
    if (!Number.isFinite(numId)) return null;
    const row = await db.query.primitives.findFirst({
      where: (table, { eq }) => eq(table.id, numId),
      columns: { name: true, ...iconCols },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: row.iconSource ?? null,
      iconKey: row.iconKey ?? null,
      iconUrl: row.iconUrl ?? null,
      iconColor: row.iconColor ?? "#ffffff",
    };
  }
  if (type === "CAPABILITY") {
    const row = await db.query.capabilities.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: { name: true, ...iconCols },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: row.iconSource ?? null,
      iconKey: row.iconKey ?? null,
      iconUrl: row.iconUrl ?? null,
      iconColor: row.iconColor ?? "#ffffff",
    };
  }
  if (type === "EFFECT") {
    const row = await db.query.effects.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: { name: true, ...iconCols },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: row.iconSource ?? null,
      iconKey: row.iconKey ?? null,
      iconUrl: row.iconUrl ?? null,
      iconColor: row.iconColor ?? "#ffffff",
    };
  }
  if (type === "ITEM") {
    const row = await db.query.items.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: { name: true, ...iconCols },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: row.iconSource ?? null,
      iconKey: row.iconKey ?? null,
      iconUrl: row.iconUrl ?? null,
      iconColor: row.iconColor ?? "#ffffff",
    };
  }
  if (type === "CHARACTER") {
    // Phase 8: characters table doesn't carry icon columns (only
    // portraitUrl, the free-form hero art field). The version-history
    // header falls back to no-icon for characters — same as the
    // /creations list which shows characters with a placeholder
    // glyph. Future: if the user asks for character icons, add the
    // same 4 columns here and merge them into the iconCols object.
    const row = await db.query.characters.findFirst({
      where: (table, { eq }) => eq(table.id, String(id)),
      columns: { name: true },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: null,
      iconKey: null,
      iconUrl: null,
      iconColor: "#ffffff",
    };
  }
  if (
    type === "LINEAGE_TEMPLATE" ||
    type === "UPBRINGING_TEMPLATE" ||
    type === "MANIFEST_TEMPLATE"
  ) {
    const tplKind = type.replace(/_TEMPLATE$/, "") as "LINEAGE" | "UPBRINGING" | "MANIFEST";
    const row = await db.query.heritage.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.kind, tplKind), eq(table.id, String(id))),
      columns: { name: true, ...iconCols },
    });
    if (!row) return null;
    return {
      name: row.name,
      iconSource: row.iconSource ?? null,
      iconKey: row.iconKey ?? null,
      iconUrl: row.iconUrl ?? null,
      iconColor: row.iconColor ?? "#ffffff",
    };
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