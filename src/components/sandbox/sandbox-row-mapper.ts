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

/**
 * Derive an entity's BU cost from its composed primitive links. Mirrors
 * the formula used by the sandbox preview pane (sandbox-preview-modal.tsx)
 * so the card and the preview always agree:
 *   sum over links of |primitive.buCost * quantity|
 * Returns null when there are no links (e.g. an effect/capability with no
 * primitives composed yet).
 */
function computeComposedBu(
  links: Array<{ primitive: { buCost: number }; quantity: number }> | undefined,
): number | null {
  if (!links || links.length === 0) return null;
  const total = links.reduce(
    (sum, l) => sum + Math.abs((l.primitive?.buCost ?? 0) * (l.quantity ?? 1)),
    0,
  );
  return total;
}

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
  /** Composed primitive links — used to derive the effect's BU cost
   *  (same formula the preview pane uses). */
  primitiveLinks?: Array<{ primitive: { buCost: number }; quantity: number }>;
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
  /** Composed primitive links — used to derive the capability's BU cost
   *  (same formula the preview pane uses). */
  primitiveLinks?: Array<{ primitive: { buCost: number }; quantity: number }>;
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

type SandboxBuild = {
  id: string;
  name: string;
  description: string | null;
  level: number;
  isPublic: boolean | null;
  // Phase 8: per-entity iconography (builds now carry the same icon
  // columns as the other entity tables). portraitUrl is still a
  // separate free-form hero art field; these four are the system
  // icon used by the picker and the cards.
  iconSource: "GAME_ICONS" | "UPLOAD" | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string | null;
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
  const buCost = computeComposedBu(row.primitiveLinks);
  return {
    id: `EFFECT:${row.id}`,
    targetType: "EFFECT",
    targetId: row.id,
    name: row.name,
    description: row.narrativeDescription,
    category: row.sourceOrigin,
    buCost,
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
  const buCost = computeComposedBu(row.primitiveLinks);
  return {
    id: `CAPABILITY:${row.id}`,
    targetType: "CAPABILITY",
    targetId: row.id,
    name: row.name,
    description: row.verboseDescription,
    category: row.type,
    buCost,
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

// -----------------------------------------------------------------------------
// buildToLibraryItem — surfaces a row from the `builds` table as a
// LibraryItem with targetType="BUILD_TEMPLATE". Library-browse filters
// route BUILD_TEMPLATE → this; /creations calls it so the user's own
// builds appear in the Creations table alongside other authored entries.
// Builds use portraitUrl (a free-form image link) rather than the Phase-8
// icon fields, so the icon columns stay null until/unless a future
// migration promotes the portrait to the icon slots.
// -----------------------------------------------------------------------------
export function buildToLibraryItem(
  row: SandboxBuild,
  visibility: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC" = "PRIVATE",
): LibraryItem {
  return {
    id: `BUILD_TEMPLATE:${row.id}`,
    targetType: "BUILD_TEMPLATE",
    targetId: row.id,
    name: row.name,
    description: row.description,
    category: "build",
    buCost: null,
    ...EMPTY_AUTHORS,
    ...EMPTY_ENGAGEMENT,
    tags: [],
    visibility,
    // Phase 8: builds now carry icon columns. portraitUrl (the hero
    // art field) is separate and lives only on the build composer /
    // detail page, not on the card.
    iconSource: row.iconSource,
    iconKey: row.iconKey,
    iconUrl: row.iconUrl,
    iconColor: row.iconColor ?? "#ffffff",
  };
}