/**
 * Capability API helpers — server-side parsing and validation.
 *
 * Kept in lib/api so both /api/capabilities and /api/capabilities/[id]
 * share the same parsing logic. No DB dependency; pure functions.
 */
import type { JsonValue } from "@/types/swordweave";
import {
  compileCapabilityBU,
  type CapabilityAssembly,
} from "@/lib/engine/capabilities";

export type CapabilityPrimitiveRole =
  | "VERB"
  | "DOMAIN"
  | "SIZING"
  | "RANGE"
  | "DURATION"
  | "OUTPUT"
  | "AUGMENT"
  | "OTHER";

export interface ParsedCapabilityPrimitiveSlot {
  primitiveId: number;
  role: CapabilityPrimitiveRole;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  notes: string | null;
}

export type CapabilityType = "ACTIVE" | "PASSIVE" | "AUGMENT";
export type SourceType = "PHYSICAL" | "MAGICAL" | "PSYCHIC";

const VALID_TYPES: CapabilityType[] = ["ACTIVE", "PASSIVE", "AUGMENT"];
const VALID_SOURCES: SourceType[] = ["PHYSICAL", "MAGICAL", "PSYCHIC"];
const VALID_ROLES: CapabilityPrimitiveRole[] = [
  "VERB",
  "DOMAIN",
  "SIZING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "AUGMENT",
  "OTHER",
];

export function parseCapabilityType(value: unknown): CapabilityType | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_TYPES as string[]).includes(upper)) {
    return upper as CapabilityType;
  }
  return null;
}

export function parseSourceType(value: unknown): SourceType | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_SOURCES as string[]).includes(upper)) {
    return upper as SourceType;
  }
  return null;
}

export function parseRole(value: unknown): CapabilityPrimitiveRole | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_ROLES as string[]).includes(upper)) {
    return upper as CapabilityPrimitiveRole;
  }
  return null;
}

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export function parsePrimitiveSlots(value: unknown): ParsedCapabilityPrimitiveSlot[] {
  if (!Array.isArray(value)) {
    throw new Error("primitiveSlots must be an array.");
  }

  return value.map((slotValue, index) => {
    if (!slotValue || typeof slotValue !== "object") {
      throw new Error("Each primitive slot must be an object.");
    }
    const slot = slotValue as Record<string, unknown>;
    const primitiveId = Number(slot["primitiveId"]);
    const role = parseRole(slot["role"]);
    const quantity = Number(slot["quantity"] ?? 1);

    if (!Number.isInteger(primitiveId) || primitiveId <= 0) {
      throw new Error("primitiveId must be a positive integer.");
    }
    if (!role) {
      throw new Error(
        "role must be one of: VERB, DOMAIN, SIZING, RANGE, DURATION, OUTPUT, AUGMENT, OTHER.",
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("quantity must be a positive integer.");
    }

    return {
      primitiveId,
      role,
      quantity,
      sortOrder: Number(slot["sortOrder"] ?? index),
      slotLabel: slot["slotLabel"] ? String(slot["slotLabel"]) : null,
      notes: slot["notes"] ? String(slot["notes"]) : null,
    };
  });
}

/**
 * Minimal primitive shape needed by the engine for BU computation.
 * Maps cleanly to engine's Primitive type (id, name, category, buCost).
 */
export interface PrimitiveLike {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly buCost: number;
}

/**
 * Convert API primitive slots into a CapabilityAssembly and compute BU
 * via the engine. SERVER-AUTHORITATIVE — never trust client BU.
 */
export function buildAssemblyAndComputeBU(
  slots: ReadonlyArray<ParsedCapabilityPrimitiveSlot>,
  primitivesById: ReadonlyMap<string, PrimitiveLike>,
  meta: {
    id: string;
    name: string;
    type: string;
    sourceType: string;
    description?: string | undefined;
  },
): { assembly: CapabilityAssembly; totalBu: number } {
  const verbReferences: Array<{ primitiveId: string; quantity?: number }> = [];
  const domainReferences: Array<{ primitiveId: string; quantity?: number }> = [];
  const structuralPrimitives: Array<{ primitiveId: string; quantity?: number }> = [];
  const augmentPrimitives: Array<{ primitiveId: string; quantity?: number }> = [];
  let rangePrimitive: { primitiveId: string; quantity?: number } | null = null;
  let targetingPrimitive: { primitiveId: string; quantity?: number } | null = null;
  let durationPrimitive: { primitiveId: string; quantity?: number } | null = null;
  let outputPrimitive: { primitiveId: string; quantity?: number } | null = null;
  let sizingPrimitive: { primitiveId: string; quantity?: number } | null = null;

  for (const slot of slots) {
    const ref = { primitiveId: String(slot.primitiveId), quantity: slot.quantity };
    switch (slot.role) {
      case "VERB":
        verbReferences.push(ref);
        break;
      case "DOMAIN":
        domainReferences.push(ref);
        break;
      case "SIZING":
        sizingPrimitive = ref;
        break;
      case "RANGE":
        rangePrimitive = ref;
        break;
      case "DURATION":
        durationPrimitive = ref;
        break;
      case "OUTPUT":
        outputPrimitive = ref;
        break;
      case "AUGMENT":
        augmentPrimitives.push(ref);
        break;
      case "OTHER":
        structuralPrimitives.push(ref);
        break;
    }
  }

  // Cast PrimitiveLike[] to Map<string, Primitive> (engine cares only about
  // id/buCost/name/category for compileCapabilityBU; full Primitive shape is
  // larger but compatible).
  const enginePrimitivesById = primitivesById as ReadonlyMap<
    string,
    import("@/types/swordweave").Primitive
  >;

  const assembly: CapabilityAssembly = {
    id: meta.id,
    name: meta.name,
    type: meta.type as CapabilityAssembly["type"],
    sourceType: meta.sourceType as CapabilityAssembly["sourceType"],
    ...(meta.description ? { verboseDescription: meta.description } : {}),
    verbReferences,
    domainReferences,
    effectReferences: [],
    rangePrimitive,
    targetingPrimitive,
    durationPrimitive,
    outputPrimitive,
    sizingPrimitive,
    structuralPrimitives,
    augmentPrimitives,
    primitivesById: enginePrimitivesById,
  };

  const totalBu = compileCapabilityBU(assembly);
  return { assembly, totalBu };
}

export function safeMetadata(value: unknown): Record<string, JsonValue> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  return {};
}