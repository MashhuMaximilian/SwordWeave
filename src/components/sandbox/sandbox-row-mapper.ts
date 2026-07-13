// =============================================================================
// Sandbox row → LibraryItem mapper
//
// The sandbox build forms consume full row types (PrimitiveRow, EffectRow,
// CapabilityRow, TemplateRow, ItemRow). The Library column renders the same
// rows through the shared LibraryTable which expects the unified LibraryItem
// shape produced by queryLibrary().
//
// This module converts each sandbox row into a LibraryItem so the sandbox
// can render its left column through LibraryTable without a second DB query.
//
// Tradeoff: the sandbox library column does NOT show engagement metrics
// (likes/forks/reactions). Engagement is fetched only by /library/browse.
// If/when the sandbox wants engagement, swap to a queryLibrary() call here.
// =============================================================================

import type { LibraryItem } from "@/lib/publishing/library-query";

type SandboxPrimitive = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean | null;
  mechanicalOutputText: string | null;
  narrativeRule: string | null;
  // Phase 8: per-entity iconography (sandbox-side row mirror).
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
};

type SandboxEffect = {
  id: string;
  name: string;
  narrativeDescription: string | null;
  sourceOrigin: string | null;
  tags: string[] | null;
  isPublic: boolean | null;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
};

type SandboxCapability = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string | null;
  sourceOrigin: string | null;
  tags: string[] | null;
  isPublic: boolean | null;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
};

type SandboxTemplate = {
  id: string;
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
  name: string;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean | null;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
};

type SandboxItem = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string | null;
  isPublic: boolean | null;
  tags: string[] | null;
  slotCost: number;
  quantity: number;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
};

type SandboxCharacter = {
  id: string;
  name: string;
  size: string;
  level: number;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: string | null;
  isPublic: boolean | null;
  // Characters (builds) don't carry icon columns — falls back to null
  // in characterToLibraryItem.
};

const EMPTY_AUTHORS = {
  authorId: null,
  authorUsername: null,
  authorDisplayName: null,
  authorAvatarUrl: null,
};

const EMPTY_ENGAGEMENT = {
  likesCount: 0,
  dislikesCount: 0,
  forkCount: 0,
  netReactions: 0,
  publishedAt: null,
};

export function primitiveToLibraryItem(
  row: SandboxPrimitive,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `PRIMITIVE:${row.id}`,
    targetType: "PRIMITIVE",
    targetId: String(row.id),
    name: row.name,
    description: row.narrativeRule ?? row.mechanicalOutputText ?? null,
    category: row.category,
    buCost: row.buCost,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: [],
    visibility,
    // Phase 8: per-entity iconography
    iconSource: row.iconSource as "GAME_ICONS" | "UPLOAD" | null,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}

export function effectToLibraryItem(
  row: SandboxEffect,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `EFFECT:${row.id}`,
    targetType: "EFFECT",
    targetId: row.id,
    name: row.name,
    description: row.narrativeDescription,
    category: row.sourceOrigin,
    buCost: null,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: row.tags ?? [],
    visibility,
    // Phase 8: per-entity iconography
    iconSource: row.iconSource as "GAME_ICONS" | "UPLOAD" | null,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}

export function capabilityToLibraryItem(
  row: SandboxCapability,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `CAPABILITY:${row.id}`,
    targetType: "CAPABILITY",
    targetId: row.id,
    name: row.name,
    description: row.verboseDescription,
    category: row.type,
    buCost: null,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: row.tags ?? [],
    visibility,
    // Phase 8: per-entity iconography
    iconSource: row.iconSource as "GAME_ICONS" | "UPLOAD" | null,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}

export function templateToLibraryItem(
  row: SandboxTemplate,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  // Map kind to one of the three target types so the chip filter can match.
  const targetType =
    row.kind === "RACE"
      ? "RACE_TEMPLATE"
      : row.kind === "BACKGROUND"
        ? "BACKGROUND_TEMPLATE"
        : "ARCHETYPE_TEMPLATE";
  return {
    id: `${targetType}:${row.id}`,
    targetType,
    targetId: row.id,
    name: row.name,
    description: row.description ?? row.suggestedTraits ?? null,
    category: row.kind,
    buCost: null,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: [],
    visibility,
    // Phase 8: per-entity iconography
    iconSource: row.iconSource as "GAME_ICONS" | "UPLOAD" | null,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}

export function itemToLibraryItem(
  row: SandboxItem,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `ITEM:${row.id}`,
    targetType: "ITEM",
    targetId: row.id,
    name: row.name,
    description: row.description,
    category: row.itemType,
    buCost: row.buCost,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: row.tags ?? [],
    visibility,
    // Phase 8: per-entity iconography
    iconSource: row.iconSource as "GAME_ICONS" | "UPLOAD" | null,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}

export function characterToLibraryItem(
  row: SandboxCharacter,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `CHARACTER:${row.id}`,
    targetType: "CHARACTER",
    targetId: row.id,
    name: row.name,
    description: `L${row.level} ${row.size} · P${row.attrPhysical} M${row.attrMental} Mg${row.attrMagical}${row.attrProficient ? ` (+${row.attrProficient})` : ""}`,
    category: row.size,
    buCost: null,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: [],
    visibility,
    // Phase 8: characters/builds don't carry icon columns; null fallback
    // keeps the type contract honest. (Builds use portraitUrl instead.)
    iconSource: null,
    iconKey: null,
    iconUrl: null,
    iconColor: "#ffffff",
  };
}