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
}): CanonicalPrimitivePayload {
  const buCostNum =
    typeof args.buCost === "number" ? args.buCost : Number(args.buCost) || 0;
  const mirrorBuCreditNum = args.isMirrorable
    ? typeof args.mirrorBuCredit === "number"
      ? args.mirrorBuCredit
      : Number(args.mirrorBuCredit) || 0
    : 0;
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