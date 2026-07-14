import type { HardModifier } from "@/types/swordweave";

export const primitivePackageVersion = "swordweave.package.v1";
export const primitivePackageKind = "primitive";

// =============================================================================
// Canonical primitive category list
//
// This MUST stay in lockstep with `primitiveCategoryEnum` in
// `src/db/schema/enums.ts`. The export-package route at
// `/api/primitives/export` narrows each row's `category` through this
// type, so any category added to the DB enum (migration 0009, then
// Phase 7's SPEED_QUICKENING, then Phase-7-B's TACTICAL + VITALITY)
// must be appended here. The previous 16-value list was stale from
// before migration 0009 and broke the production build (`next build`
// runs `tsc` and rejects the narrower `PrimitiveCategoryValue` against
// the wider DB union).
//
// To add a category: add it to `primitiveCategoryEnum` in enums.ts
// AND to the array below (same string). Keep the order matching the
// DB enum for readability — strict ordering is not required.
// =============================================================================
export const primitiveCategories = [
  // Core BU Market categories
  "VERB_TIER",
  "DOMAIN",
  "SIZING",
  "TARGETING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "CONDITION",
  "DEFENSE",
  "STRUCTURAL",
  "PROBABILITY_BIAS",
  "TRIGGER_HOOK",
  "PERCEPTION_QUALIFIER",
  "KINETIC_CONTROL",
  "AGENCY_OVERRIDE",
  "METAMORPHOSIS",
  "ACTION_ECONOMY",
  "EVALUATION_STRAIN",
  "TEMPORAL_CHRONOLOGICAL",
  "SENSORY_ARRAY",
  "MOBILITY_LOCOMOTION",
  "TARGETING_AOE",
  "INTENSITY_DICE",
  "BOSS_ECONOMY",
  "DEFENSIVE",
  "SPEED_QUICKENING", // Phase 7: split from DURATION (when, not how long)
  // Phase 7-B: tactical + life-state primitives
  "TACTICAL", // Cover Tiers I-IV and future spatial/tactical modifiers
  "VITALITY", // Stabilize, Last Breath, and life-state engine primitives
  // Character-slot categories (legacy — slated for purge in Phase 7)
  "SHEET_AUGMENT",
  "HERITAGE_AUGMENT",
  "BACKGROUND_AUGMENT",
  "CHARACTER_SHEET_AUGMENT",
  "PRACTICE_PROGRESSION_AUGMENT",
  "ITEM_AUGMENT",
] as const;

export type PrimitiveCategoryValue = (typeof primitiveCategories)[number];

export type PrimitivePackageRecord = {
  name: string;
  category: PrimitiveCategoryValue;
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
};

export type PrimitivePackageV1 = {
  schemaVersion: typeof primitivePackageVersion;
  kind: typeof primitivePackageKind;
  exportedAt: string;
  records: PrimitivePackageRecord[];
};

export function isPrimitiveCategory(value: string): value is PrimitiveCategoryValue {
  return primitiveCategories.includes(value as PrimitiveCategoryValue);
}

export function parseHardModifiers(value: unknown): readonly HardModifier[] {
  if (Array.isArray(value)) {
    return value as readonly HardModifier[];
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("Hard modifiers must be a JSON array.");
  }

  return parsed as readonly HardModifier[];
}

function parseInteger(value: unknown, fieldName: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return numberValue;
}

export function parsePrimitiveRecord(value: unknown): PrimitivePackageRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Primitive record must be an object.");
  }

  const record = value as Record<string, unknown>;
  const name = String(record["name"] ?? "").trim();
  const category = String(record["category"] ?? "");
  const buCost = parseInteger(record["buCost"], "BU cost");
  const mirrorBuCredit = parseInteger(
    record["mirrorBuCredit"] ?? 0,
    "Mirror BU credit",
  );

  if (!name) {
    throw new Error("Primitive name is required.");
  }

  if (!isPrimitiveCategory(category)) {
    throw new Error(`Invalid primitive category: ${category}`);
  }

  const isMirrorable = Boolean(record["isMirrorable"]);

  return {
    name,
    category,
    costTier: String(record["costTier"] ?? "Tier 1: Minor (4 BU anchor)").trim(),
    buCost,
    mechanicalOutputText: String(record["mechanicalOutputText"] ?? "").trim(),
    narrativeRule: String(record["narrativeRule"] ?? "").trim(),
    isPublic: Boolean(record["isPublic"]),
    isMirrorable,
    mirrorVector: isMirrorable
      ? String(record["mirrorVector"] ?? "VARIABLE_VECTOR").trim()
      : "STANDARD_ONLY",
    mirrorBuCredit: isMirrorable ? mirrorBuCredit : 0,
    mirrorEligibilityNotes: String(
      record["mirrorEligibilityNotes"] ?? "",
    ).trim(),
    hardModifiers: parseHardModifiers(record["hardModifiers"]),
  };
}

export function parsePrimitivePackage(value: unknown): PrimitivePackageRecord[] {
  if (!value || typeof value !== "object") {
    throw new Error("Primitive package must be an object.");
  }

  const packageValue = value as Record<string, unknown>;

  if (packageValue["schemaVersion"] !== primitivePackageVersion) {
    throw new Error(`Expected schemaVersion ${primitivePackageVersion}.`);
  }

  if (packageValue["kind"] !== primitivePackageKind) {
    throw new Error("Primitive import only accepts primitive packages.");
  }

  if (!Array.isArray(packageValue["records"])) {
    throw new Error("Primitive package records must be an array.");
  }

  return packageValue["records"].map(parsePrimitiveRecord);
}

export function createPrimitivePackage(
  records: PrimitivePackageRecord[],
): PrimitivePackageV1 {
  return {
    schemaVersion: primitivePackageVersion,
    kind: primitivePackageKind,
    exportedAt: new Date().toISOString(),
    records,
  };
}
