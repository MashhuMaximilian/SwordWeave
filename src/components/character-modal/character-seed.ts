/**
 * character-seed.ts — Phase 8.2 batch 7
 *
 * Helpers to convert a fetched character (the GET /api/characters/[id]
 * response shape) into:
 *
 *   1. An initial IdentityState / BackstoryState / AttributesState so the
 *      modal's per-tab drafts pre-fill.
 *   2. A PendingSlotsByTab so the modal's slot queues pre-populate with
 *      the character's existing primitive/capability/item/heritage links.
 *
 * The modal uses (1) to seed the Identity/Backstory/Attributes tabs'
 * controlled inputs, and (2) to seed the lineage/upbringing/manifest/
 * items tabs' slot lists.
 *
 * Why not just edit the character in place? Because the modal's UX is
 * "queue up your changes, then save." When you remove a primitive, the
 * removeSlot action drops it from the pendingSlots queue; on save we
 * send the full primitiveIds list (queue contents), and the server
 * PATCH replaces the join table wholesale. So pre-filling the queue
 * with the existing slots means "I removed one" → the queue no longer
 * contains it → the new primitiveIds list is correct without any
 * diff-tracking code.
 *
 * For metadata that the create flow doesn't track (slotSource,
 * versionId, isMirrored), we DON'T send it on PATCH for an edit —
 * the server's PATCH re-derives versionId and slotSource from the
 * current row's userId/sourceOrigin (see PATCH /api/characters/[id]).
 * The mirror flag IS preserved per-primitive since the existing
 * primitiveIds list we generate tags mirrored primitives via the
 * `mirroredPrimitiveIds` array (the PATCH route reads both).
 *
 * Slot metadata is preserved here so the user can SEE the original
 * mirror state on each slot card while editing — even though the
 * server will re-derive some of it on save. The mirror toggle still
 * works via setSlotMirror in the store.
 */

import type { CharacterTabId } from "./character-modal-store";
import type { PendingSlot, PendingSlotsByTab } from "./character-modal-store";

/**
 * Subset of the identity tab's controlled state — mirrors the
 * shape used in identity-tab.tsx. Kept narrow so this file doesn't
 * pull in every tab component.
 */
export interface IdentityDraftSeed {
  name: string;
  size: string;
  portraitUrl: string;
  notes: string;
}

/**
 * Subset of the backstory tab's state.
 */
export interface BackstoryDraftSeed {
  origin: string;
  motivation: string;
  ties: string;
  flaw: string;
}

/**
 * Subset of the attributes tab's state. The mode is inferred from
 * whether a custom buBudget was set (rare in practice — most
 * characters use level mode).
 */
export interface AttributesDraftSeed {
  level: number;
  mode: "level" | "buBudget";
  buBudget: number;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
}

/**
 * The character fetch response shape — narrowed to the fields we
 * actually seed the modal from. The GET endpoint returns more than
 * this (mirror aggregates, etc.); we ignore what the modal doesn't
 * need to keep this file focused.
 */
export interface CharacterSeed {
  id: string;
  name: string;
  size: string | null;
  level: number;
  portraitUrl: string | null;
  notes: string | null;
  startingBu: number;
  buSpent: number;
  dmBonusBu: number;
  /** Phase 8.2 batch 8: optional vitality state. Seed loader reads
   * this from the character row; null on the API means "use max". */
  currentVitality: number | null;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  practiceSlices: Record<string, number> | null;
  lineageName: string | null;
  lineageImageUrl: string | null;
  lineageDescription: string | null;
  upbringingName: string | null;
  upbringingImageUrl: string | null;
  upbringingDescription: string | null;
  manifestName: string | null;
  backstory: unknown | null;
  /**
   * Heritage slots (one each for LINEAGE / UPBRINGING / MANIFEST in
   * the canonical case). Each link carries the heritage's id and
   * kind, which is all we need to seed a heritage PendingSlot.
   */
  heritageLinks: Array<{
    heritageId: string;
    heritage: {
      id: string;
      kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
      name: string;
    };
  }>;
  /**
   * Primitives the character has slotted. We treat the source as
   * "PERSONAL" for all of them in v1 (the modal's slot UI only
   * shows primitives under a single tab, regardless of source).
   * isMirrored is preserved on the slot for the mirror toggle.
   */
  primitiveLinks: Array<{
    primitiveId: number;
    isMirrored: boolean | null;
    // Phase 8.2 batch 11: bundle-origin tracking. A primitive row
    // with a non-null origin came from a heritage/capability/effect
    // bundle expansion at create-time — not as a standalone PERSONAL
    // pick. The seed must skip these from the "attributes" tab queue
    // because they're already represented by the heritage/capability
    // slot, and seeding them again would (a) double-count BU in the
    // footer (each bundle primitive's buCost is already in the
    // heritage's computedBu), and (b) on save, PATCH would re-insert
    // them as PERSONAL, severing the origin link.
    originHeritageId: string | null;
    originCapabilityId: string | null;
    originEffectId: string | null;
    primitive: {
      id: number;
      name: string;
    };
  }>;
  /**
   * Capability slots.
   */
  capabilityLinks: Array<{
    capabilityId: string;
    capability: { id: string; name: string };
  }>;
  /**
   * Item slots.
   */
  itemLinks: Array<{
    itemId: string;
    item: { id: string; name: string };
  }>;
}

/** Returns a constant empty identity seed. */
export const IDENTITY_EMPTY: IdentityDraftSeed = {
  name: "",
  size: "MEDIUM",
  portraitUrl: "",
  notes: "",
};

/** Returns a constant empty backstory seed. */
export const BACKSTORY_EMPTY: BackstoryDraftSeed = {
  origin: "",
  motivation: "",
  ties: "",
  flaw: "",
};

/** Returns a constant empty attributes seed. */
export const ATTRIBUTES_EMPTY: AttributesDraftSeed = {
  level: 1,
  mode: "level",
  buBudget: 25,
  attrPhysical: 4,
  attrMental: 3,
  attrMagical: 3,
  attrProficient: null,
};

function isBackstoryShape(v: unknown): v is Partial<BackstoryDraftSeed> {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj["origin"] === "string" ||
    typeof obj["motivation"] === "string" ||
    typeof obj["ties"] === "string" ||
    typeof obj["flaw"] === "string"
  );
}

/**
 * Normalize the backstory jsonb payload into our seed shape.
 * Defensive: any missing field becomes an empty string.
 */
export function seedBackstory(character: CharacterSeed): BackstoryDraftSeed {
  if (!isBackstoryShape(character.backstory)) {
    return BACKSTORY_EMPTY;
  }
  const raw = character.backstory;
  return {
    origin: typeof raw.origin === "string" ? raw.origin : "",
    motivation: typeof raw.motivation === "string" ? raw.motivation : "",
    ties: typeof raw.ties === "string" ? raw.ties : "",
    flaw: typeof raw.flaw === "string" ? raw.flaw : "",
  };
}

/**
 * Build the Identity draft seed from a fetched character.
 */
export function seedIdentity(character: CharacterSeed): IdentityDraftSeed {
  return {
    name: character.name ?? "",
    size: character.size ?? "MEDIUM",
    portraitUrl: character.portraitUrl ?? "",
    notes: character.notes ?? "",
  };
}

/**
 * Build the Attributes draft seed. The mode is inferred:
 *  - If the character's startingBu is non-default (25) AND the
 *    level is 1, it's likely a buBudget character.
 *  - Otherwise, it's level-driven.
 *
 * In practice the create flow always uses level mode with
 * startingBu=25, so this heuristic rarely fires — but it's safe.
 */
export function seedAttributes(
  character: CharacterSeed,
): AttributesDraftSeed {
  const isBuBudget =
    character.startingBu !== 25 && character.level === 1;
  return {
    level: character.level,
    mode: isBuBudget ? "buBudget" : "level",
    buBudget: isBuBudget ? character.startingBu : 25,
    attrPhysical: character.attrPhysical,
    attrMental: character.attrMental,
    attrMagical: character.attrMagical,
    attrProficient: character.attrProficient,
  };
}

/**
 * Map a heritage slot link to a PendingSlot. The heritage's `kind`
 * determines which tab the slot lands in (LINEAGE → lineage, etc.).
 */
function seedHeritageSlot(
  link: CharacterSeed["heritageLinks"][number],
): PendingSlot {
  return {
    kind: "heritage",
    heritageId: link.heritageId,
    heritageKind: link.heritage.kind,
    name: link.heritage.name,
  };
}

/**
 * Map a primitive slot link to a PendingSlot.
 *
 * Phase 8.2 batch 11: skip primitives whose origin is set
 * (originHeritageId / originCapabilityId / originEffectId). Those
 * primitives came from a heritage or capability bundle expansion
 * at create-time — they're already represented by the heritage /
 * capability slot, and the bundled BU is already in the heritage
 * or capability's computedBu. Seeding them as standalone
 * "attributes" slots would double-count BU in the footer and, on
 * save, PATCH would re-insert them as PERSONAL, severing the
 * origin link.
 *
 * Mashu 2026-07-23 symptom: "in attributes should be nothing in
 * terms of primitives or whatever... each thing should be in its
 * own tab like we discussed" and "If I edit it it looks like it
 * places in the tab attributes all primitives or idk what exactly
 * and calculates things again". Root cause = this seed was
 * pushing every primitive row regardless of origin into the
 * attributes tab queue.
 */
function seedPrimitiveSlot(
  link: CharacterSeed["primitiveLinks"][number],
): PendingSlot | null {
  // Skip bundle-origin primitives — already represented by the
  // heritage/capability slot in the lineage/upbringing/manifest
  // (or attributes-as-capability) tab.
  if (
    link.originHeritageId ||
    link.originCapabilityId ||
    link.originEffectId
  ) {
    return null;
  }
  // Phase 8.2 batch 12: PERSONAL primitives were previously
  // pushed to the "attributes" tab on edit. That tab is the
  // stat / level / BU-allocation tab — not a slot receiver.
  // /atelier defaults the slot destination to "manifest" when
  // slotting from any non-slot tab, so on edit we mirror that:
  // PERSONAL primitives reappear under "manifest" alongside
  // any capabilities the user slotted directly there.
  return {
    kind: "primitive",
    primitiveId: link.primitiveId,
    tab: "manifest",
    name: link.primitive.name,
    mirror: link.isMirrored === true,
  };
}

/**
 * Map a capability slot link to a PendingSlot.
 */
function seedCapabilitySlot(
  link: CharacterSeed["capabilityLinks"][number],
): PendingSlot {
  return {
    kind: "capability",
    capabilityId: link.capabilityId,
    tab: "attributes",
    name: link.capability.name,
  };
}

/**
 * Map an item slot link to a PendingSlot.
 */
function seedItemSlot(
  link: CharacterSeed["itemLinks"][number],
): PendingSlot {
  return {
    kind: "item",
    itemId: link.itemId,
    tab: "items",
    name: link.item.name,
  };
}

/**
 * Build the full PendingSlotsByTab seed from a character's links.
 * Each queue is independent, so removing a slot from the queue
 * translates to "remove this entity from the character" on save.
 */
export function seedPendingSlots(
  character: CharacterSeed,
): PendingSlotsByTab {
  const out: PendingSlotsByTab = {
    identity: [],
    backstory: [],
    attributes: [],
    lineage: [],
    upbringing: [],
    manifest: [],
    items: [],
  };

  for (const h of character.heritageLinks) {
    if (h.heritage.kind === "LINEAGE") out.lineage.push(seedHeritageSlot(h));
    else if (h.heritage.kind === "UPBRINGING")
      out.upbringing.push(seedHeritageSlot(h));
    else if (h.heritage.kind === "MANIFEST")
      out.manifest.push(seedHeritageSlot(h));
  }
  for (const p of character.primitiveLinks) {
    // Phase 8.2 batch 11: skip bundle-origin primitives — see
    // seedPrimitiveSlot for the rationale. Returns null for those
    // rows; we only push genuine PERSONAL primitives into the
    // attributes tab queue.
    const slot = seedPrimitiveSlot(p);
    if (slot) out.attributes.push(slot);
  }
  for (const c of character.capabilityLinks) {
    out.attributes.push(seedCapabilitySlot(c));
  }
  for (const i of character.itemLinks) {
    out.items.push(seedItemSlot(i));
  }

  return out;
}

/**
 * Convenience: build all the seeds at once.
 */
export interface CharacterSeeds {
  identity: IdentityDraftSeed;
  backstory: BackstoryDraftSeed;
  attributes: AttributesDraftSeed;
  pendingSlots: PendingSlotsByTab;
}

export function buildCharacterSeeds(
  character: CharacterSeed,
): CharacterSeeds {
  return {
    identity: seedIdentity(character),
    backstory: seedBackstory(character),
    attributes: seedAttributes(character),
    pendingSlots: seedPendingSlots(character),
  };
}

/**
 * Re-export the tab id type for callers that don't want to import
 * the modal store module directly.
 */
export type { CharacterTabId };