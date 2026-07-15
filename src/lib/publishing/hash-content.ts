// =============================================================================
// hash-content — content hashing for no-op detection in the save matrix.
//
// Phase 1 of the edit-creates-fork refactor added the intent × ownership
// matrix but every save still materialized a new row (or UPDATE'd the source)
// even when the user hadn't actually changed anything. Phase 4 — rolled into
// Phase 1 by Mashu after observing "save with no changes creates a fork" in
// the wild — layers content hashing on top so the dispatch matrix can detect
// "no changes" and short-circuit before allocating a new row.
//
// Algorithm: SHA-256 over a canonical-JSON envelope of the form content.
//
//   { "v": 1, "primitive": { ...sorted-key payload... } }
//
// Canonicalization rules:
//   - Object keys are sorted lexicographically at every depth (deep sort).
//   - Arrays preserve their order (the order is itself part of the content).
//   - Undefined values are dropped; nulls are preserved.
//   - Numbers are serialized as JSON-native numbers (no trailing zeros).
//
// This module is safe in both Node.js (server) and the browser. It uses
// globalThis.crypto.subtle which is available in Node ≥ 19 and all modern
// browsers. The previous design (using a SHA-256 npm library) was rejected
// to keep the bundle size flat — the Web Crypto API is sufficient.
// =============================================================================

import type { HardModifier } from "@/types/swordweave";

/**
 * Canonical payload shape. The form serializes its state into this shape
 * before hashing. Keep the keys stable — any new field added here changes
 * the hash output for every existing row, so migration is required.
 */
export interface CanonicalPrimitivePayload {
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isPublic: boolean;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: readonly HardModifier[];
  // Phase 8: per-entity iconography. The icon is part of the entity's
  // identity, so a changed icon must trigger a content-hash diff and
  // therefore a save (per the no-op detection rules). Nullable fields
  // are coerced to empty strings / nulls so the canonical JSON is stable
  // across rows that have vs haven't been icon'd.
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
}

/**
 * The versioned envelope. Incrementing `v` invalidates every existing hash
 * — used when the canonical algorithm changes.
 */
const ENVELOPE_VERSION = 1 as const;

/**
 * Build the canonical payload from the form's draft state. Normalizes the
 * mirror fields (the route handler zeroes mirrorVector/mirrorBuCredit for
 * non-mirrorable rows; the hash must match what gets stored).
 */
export function buildCanonicalPrimitivePayload(args: {
  name: string;
  category: string;
  costTier: string;
  buCost: string | number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isPublic: boolean;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: string | number;
  mirrorEligibilityNotes: string;
  hardModifiers: readonly HardModifier[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): CanonicalPrimitivePayload {
  const buCostNum =
    typeof args.buCost === "number" ? args.buCost : Number(args.buCost) || 0;
  // Phase 7 Q-M: auto-derive mirror_bu_credit = bu_cost when isMirrorable.
  // The route handler already enforces this server-side, but the content
  // hash must match what gets STORED, otherwise save-to-update detection
  // breaks: client says mirror_bu_credit=0, server stores bu_cost, hash
  // sees a delta that isn't a real delta.
  const mirrorBuCreditNum = args.isMirrorable ? buCostNum : 0;
  // mirrorVector defaults to VARIABLE_VECTOR when mirrorable and caller
  // didn't supply one; STANDARD_ONLY when not mirrorable.
  const mirrorVectorFinal = args.isMirrorable
    ? args.mirrorVector || "VARIABLE_VECTOR"
    : "STANDARD_ONLY";

  return {
    name: args.name,
    category: args.category,
    costTier: args.costTier || "Tier 1: Minor (4 BU anchor)",
    buCost: buCostNum,
    mechanicalOutputText: args.mechanicalOutputText,
    narrativeRule: args.narrativeRule,
    isPublic: args.isPublic,
    isMirrorable: args.isMirrorable,
    mirrorVector: mirrorVectorFinal,
    mirrorBuCredit: mirrorBuCreditNum,
    mirrorEligibilityNotes: args.mirrorEligibilityNotes,
    hardModifiers: args.hardModifiers,
    iconSource: args.iconSource ?? null,
    iconKey: args.iconKey ?? null,
    iconUrl: args.iconUrl ?? null,
    iconColor: args.iconColor ?? "#ffffff",
  };
}

/**
 * Serialize a value into a canonical JSON string with deeply sorted keys.
 * Arrays preserve their order. Undefined values are dropped. Functions and
 * symbols throw — the payload must be plain data.
 */
export function canonicalJsonStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    // undefined is dropped by JSON.stringify naturally; null is "null".
    return value === null ? "null" : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot canonicalize non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => stringify(item));
    return `[${parts.join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`);
    return `{${parts.join(",")}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

/**
 * Compute the SHA-256 hex digest of the canonical-JSON content envelope.
 * Returns a 64-character lowercase hex string. Works in both Node.js (server)
 * and the browser via globalThis.crypto.subtle.
 */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "globalThis.crypto.subtle is unavailable — Node ≥ 19 required.",
    );
  }
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the content hash for a primitive's draft payload. Returns the
 * SHA-256 hex digest of `{"v":1,"primitive":{...canonical...}}`.
 */
export async function hashPrimitiveContent(
  payload: CanonicalPrimitivePayload,
): Promise<string> {
  const envelope = JSON.stringify({ v: ENVELOPE_VERSION, primitive: payload });
  return sha256Hex(envelope);
}

/**
 * Build + hash a primitive payload from raw form values. Synchronous until
 * the SHA-256 step, which is async by Web Crypto design.
 */
export async function computePrimitiveContentHash(args: {
  name: string;
  category: string;
  costTier: string;
  buCost: string | number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isPublic: boolean;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: string | number;
  mirrorEligibilityNotes: string;
  hardModifiers: readonly HardModifier[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): Promise<string> {
  const payload = buildCanonicalPrimitivePayload(args);
  return hashPrimitiveContent(payload);
}

/**
 * Whether a draft has any meaningful content (non-empty name AND has at least
 * a category set). Used by decideSaveOutcome to short-circuit greenfield
 * "save an empty form" attempts.
 */
export function isPrimitiveDraftEmpty(payload: CanonicalPrimitivePayload): boolean {
  return payload.name.trim().length === 0;
}

// =============================================================================
// Phase 2 of the edit-creates-fork refactor (§11 of edit-creates-fork.md):
// content-hash envelopes for effects, capabilities, items, and templates.
// Same algorithm as primitives (SHA-256 over a canonical-JSON envelope).
//
// Each entity type has a distinct canonical-payload shape that mirrors its
// form's draft state. The dispatcher is entity-agnostic — it just compares
// the source row's `contentHash` to the form's `draftHash` — so as long as
// the producer (this file) and the route's save body agree on the shape,
// no-op detection works.
// =============================================================================

// -----------------------------------------------------------------------------
// Effects
// -----------------------------------------------------------------------------

export interface CanonicalEffectPayload {
  name: string;
  narrativeDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; quantity: number; notes: string }[];
  // Phase 8: per-entity iconography (see CanonicalPrimitivePayload).
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
}

export function buildCanonicalEffectPayload(args: {
  name: string;
  narrativeDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; quantity: number; notes: string }[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): CanonicalEffectPayload {
  // Sort slots by primitiveId so the hash is order-independent. (The original
  // form preserves user-chosen order via sortOrder in the DB; for the
  // content-hash envelope we want the content to be canonical regardless of
  // how the slots were ordered in the form UI.)
  const sortedSlots = [...args.primitiveSlots]
    .map((s) => ({
      primitiveId: s.primitiveId,
      quantity: s.quantity,
      notes: s.notes ?? "",
    }))
    .sort((a, b) => a.primitiveId - b.primitiveId);

  return {
    name: args.name.trim(),
    narrativeDescription: args.narrativeDescription.trim(),
    tags: [...args.tags].map((t) => t.trim()).filter(Boolean).sort(),
    isPublic: Boolean(args.isPublic),
    primitiveSlots: sortedSlots,
    iconSource: args.iconSource ?? null,
    iconKey: args.iconKey ?? null,
    iconUrl: args.iconUrl ?? null,
    iconColor: args.iconColor ?? "#ffffff",
  };
}

export function isEffectDraftEmpty(payload: CanonicalEffectPayload): boolean {
  return payload.name.length === 0;
}

export async function hashEffectContent(
  payload: CanonicalEffectPayload,
): Promise<string> {
  const envelope = JSON.stringify({ v: ENVELOPE_VERSION, effect: payload });
  return sha256Hex(envelope);
}

export async function computeEffectContentHash(args: {
  name: string;
  narrativeDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; quantity: number; notes: string }[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): Promise<string> {
  return hashEffectContent(buildCanonicalEffectPayload(args));
}

// -----------------------------------------------------------------------------
// Capabilities
// -----------------------------------------------------------------------------

export interface CanonicalCapabilityPayload {
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; role: string; quantity: number; slotLabel: string; notes: string }[];
  /**
   * Effect slots as a flat list of effectIds. Per-effect `slotLabel` and
   * `notes` are NOT part of the canonical content identity — the
   * capability form stores effect slots as `string[]` (no per-slot
   * metadata), and including those fields in the hash would make
   * "save with no edits" always look like a change. The schema still
   * stores per-slot metadata; the hash just doesn't read it.
   */
  effectIds: readonly string[];
  // Phase 8: per-entity iconography (see CanonicalPrimitivePayload).
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
}

export function buildCanonicalCapabilityPayload(args: {
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; role: string; quantity: number; slotLabel: string; notes: string }[];
  effectIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): CanonicalCapabilityPayload {
  const sortedPrimitives = [...args.primitiveSlots]
    .map((s) => ({
      primitiveId: s.primitiveId,
      role: s.role,
      quantity: s.quantity,
      slotLabel: s.slotLabel ?? "",
      notes: s.notes ?? "",
    }))
    .sort((a, b) => a.primitiveId - b.primitiveId);

  return {
    name: args.name.trim(),
    type: args.type,
    sourceType: args.sourceType,
    verboseDescription: args.verboseDescription.trim(),
    tags: [...args.tags].map((t) => t.trim()).filter(Boolean).sort(),
    isPublic: Boolean(args.isPublic),
    primitiveSlots: sortedPrimitives,
    effectIds: [...args.effectIds].sort(),
    iconSource: args.iconSource ?? null,
    iconKey: args.iconKey ?? null,
    iconUrl: args.iconUrl ?? null,
    iconColor: args.iconColor ?? "#ffffff",
  };
}

export function isCapabilityDraftEmpty(payload: CanonicalCapabilityPayload): boolean {
  return payload.name.length === 0;
}

export async function hashCapabilityContent(
  payload: CanonicalCapabilityPayload,
): Promise<string> {
  const envelope = JSON.stringify({ v: ENVELOPE_VERSION, capability: payload });
  return sha256Hex(envelope);
}

export async function computeCapabilityContentHash(args: {
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  tags: readonly string[];
  isPublic: boolean;
  primitiveSlots: readonly { primitiveId: number; role: string; quantity: number; slotLabel: string; notes: string }[];
  effectIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): Promise<string> {
  return hashCapabilityContent(buildCanonicalCapabilityPayload(args));
}

// -----------------------------------------------------------------------------
// Items
// -----------------------------------------------------------------------------

export interface CanonicalItemPayload {
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  tags: readonly string[];
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  effectIds: readonly string[];
  // Phase 8: per-entity iconography (see CanonicalPrimitivePayload).
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
}

export function buildCanonicalItemPayload(args: {
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  tags: readonly string[];
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  effectIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): CanonicalItemPayload {
  return {
    name: args.name.trim(),
    itemType: args.itemType,
    rarity: args.rarity,
    buCost: Math.max(0, Math.floor(args.buCost)),
    description: args.description.trim(),
    slotCost: Math.max(0, Math.floor(args.slotCost)),
    quantity: Math.max(1, Math.floor(args.quantity)),
    isTwoHanded: Boolean(args.isTwoHanded),
    isConsumable: Boolean(args.isConsumable),
    actsAsFocus: Boolean(args.actsAsFocus),
    isPublic: Boolean(args.isPublic),
    tags: [...args.tags].map((t) => t.trim()).filter(Boolean).sort(),
    primitiveIds: [...args.primitiveIds].sort((a, b) => a - b),
    capabilityIds: [...args.capabilityIds].sort(),
    effectIds: [...args.effectIds].sort(),
    iconSource: args.iconSource ?? null,
    iconKey: args.iconKey ?? null,
    iconUrl: args.iconUrl ?? null,
    iconColor: args.iconColor ?? "#ffffff",
  };
}

export function isItemDraftEmpty(payload: CanonicalItemPayload): boolean {
  return payload.name.length === 0;
}

export async function hashItemContent(
  payload: CanonicalItemPayload,
): Promise<string> {
  const envelope = JSON.stringify({ v: ENVELOPE_VERSION, item: payload });
  return sha256Hex(envelope);
}

export async function computeItemContentHash(args: {
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  tags: readonly string[];
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  effectIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): Promise<string> {
  return hashItemContent(buildCanonicalItemPayload(args));
}

// -----------------------------------------------------------------------------
// Templates (race / background / archetype)
// -----------------------------------------------------------------------------

export interface CanonicalTemplatePayload {
  kind: string;
  name: string;
  description: string;
  suggestedTraits: string;
  isPublic: boolean;
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  // Phase 8: per-entity iconography (see CanonicalPrimitivePayload).
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
}

export function buildCanonicalTemplatePayload(args: {
  kind: string;
  name: string;
  description: string;
  suggestedTraits: string;
  isPublic: boolean;
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): CanonicalTemplatePayload {
  return {
    kind: args.kind,
    name: args.name.trim(),
    description: args.description.trim(),
    suggestedTraits: args.suggestedTraits.trim(),
    isPublic: Boolean(args.isPublic),
    primitiveIds: [...args.primitiveIds].sort((a, b) => a - b),
    capabilityIds: [...args.capabilityIds].sort(),
    iconSource: args.iconSource ?? null,
    iconKey: args.iconKey ?? null,
    iconUrl: args.iconUrl ?? null,
    iconColor: args.iconColor ?? "#ffffff",
  };
}

export function isTemplateDraftEmpty(payload: CanonicalTemplatePayload): boolean {
  return payload.name.length === 0;
}

export async function hashTemplateContent(
  payload: CanonicalTemplatePayload,
): Promise<string> {
  const envelope = JSON.stringify({ v: ENVELOPE_VERSION, template: payload });
  return sha256Hex(envelope);
}

export async function computeTemplateContentHash(args: {
  kind: string;
  name: string;
  description: string;
  suggestedTraits: string;
  isPublic: boolean;
  primitiveIds: readonly number[];
  capabilityIds: readonly string[];
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string;
}): Promise<string> {
  return hashTemplateContent(buildCanonicalTemplatePayload(args));
}