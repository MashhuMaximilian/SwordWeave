/**
 * Practice system engine — Phase 4.
 *
 * Implements the SwordWeave Practice system from Notion:
 * - 10 practices across 3 attributes
 *   - Physical: Prowess, Finesse, Fieldcraft
 *   - Mental: Awareness, Reason, Knowledge, Influence
 *   - Magical: Mysticism, Communion, Intuition
 * - Attributes sum to exactly 10; each is in [-1, +5]
 * - PB applies to ALL practices under a proficient attribute
 * - Practice roll-up: attribute + PB (if proficient) + sum(primitive bonuses)
 *   — Phase 8.3g v4 (Mashu 2026-07-28): there is NO split across
 *     practices. Each practice gets the FULL attribute value.
 * - DC = 5 + relevant attribute + PB (attr prof only)
 *
 * Pure functions, no DB dependency.
 */

// =============================================================================
// Types
// =============================================================================

export type Attribute = "PHYSICAL" | "MENTAL" | "MAGICAL";

export type PhysicalPractice = "prowess" | "finesse" | "fieldcraft";
export type MentalPractice =
  | "awareness"
  | "reason"
  | "knowledge"
  | "influence";
export type MagicalPractice = "mysticism" | "communion" | "intuition";
export type Practice =
  | PhysicalPractice
  | MentalPractice
  | MagicalPractice;

export type PracticeAttributeMap = {
  readonly PHYSICAL: readonly PhysicalPractice[];
  readonly MENTAL: readonly MentalPractice[];
  readonly MAGICAL: readonly MagicalPractice[];
};

export const PRACTICE_ATTRIBUTE_MAP: PracticeAttributeMap = {
  PHYSICAL: ["prowess", "finesse", "fieldcraft"],
  MENTAL: ["awareness", "reason", "knowledge", "influence"],
  MAGICAL: ["mysticism", "communion", "intuition"],
};

export type PracticeSlices = {
  readonly [K in Practice]?: number;
};

export type Attributes = {
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
};

export type PracticeModifierBreakdown = {
  readonly practice: Practice;
  readonly attribute: Attribute;
  readonly total: number;
  /** The attribute contribution (= the FULL attribute value,
   *  not a sub-share). Field name kept as "slice" for
   *  backward compatibility with tests / sheet callers. */
  readonly slice: number;
  readonly pbContribution: number;
  readonly primitiveContributions: ReadonlyArray<{
    readonly primitiveId: number;
    readonly primitiveName: string;
    readonly bonus: number;
  }>;
};

// =============================================================================
// Validation
// =============================================================================

export const MIN_ATTRIBUTE = -1;
export const MAX_ATTRIBUTE = 5;
export const ATTRIBUTE_SUM = 10;
export const MIN_SLICE = -1;

/**
 * Validate that the three attributes sum to 10 and each is in [-1, +5].
 */
export function validateAttributes(attrs: Attributes): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  if (attrs.physical < MIN_ATTRIBUTE || attrs.physical > MAX_ATTRIBUTE) {
    errors.push(
      `Physical attribute ${attrs.physical} outside range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`,
    );
  }
  if (attrs.mental < MIN_ATTRIBUTE || attrs.mental > MAX_ATTRIBUTE) {
    errors.push(
      `Mental attribute ${attrs.mental} outside range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`,
    );
  }
  if (attrs.magical < MIN_ATTRIBUTE || attrs.magical > MAX_ATTRIBUTE) {
    errors.push(
      `Magical attribute ${attrs.magical} outside range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`,
    );
  }
  if (
    attrs.physical + attrs.mental + attrs.magical !== ATTRIBUTE_SUM
  ) {
    errors.push(
      `Attributes must sum to ${ATTRIBUTE_SUM} (got ${attrs.physical + attrs.mental + attrs.magical})`,
    );
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate that practice slices for an attribute sum to the attribute value,
 * and each slice is >= MIN_SLICE.
 *
 * NOTE: Phase 8.3g v4 (Mashu 2026-07-28) — this validation is now purely
 * informational and may not match the per-practice modifier calculation
 * (which uses the FULL attribute, not a slice share). It is kept for
 * the editor where the player manually distributes "slice points"
 * across practices.
 */
export function validatePracticeSlicesForAttribute(
  attribute: Attribute,
  attributeValue: number,
  slices: Readonly<Record<string, number>>,
): { readonly valid: boolean; readonly errors: readonly string[]; readonly sum: number } {
  const practices = PRACTICE_ATTRIBUTE_MAP[attribute];
  const errors: string[] = [];

  let sum = 0;
  for (const practice of practices) {
    const slice = slices[practice] ?? 0;
    if (slice < MIN_SLICE) {
      errors.push(
        `${practice} slice ${slice} below minimum ${MIN_SLICE}`,
      );
    }
    sum += slice;
  }

  if (sum !== attributeValue) {
    errors.push(
      `${attribute} practice slices sum to ${sum}, expected ${attributeValue}`,
    );
  }

  return { valid: errors.length === 0, errors, sum };
}

/**
 * Get the parent attribute of a practice.
 */
export function getPracticeAttribute(practice: Practice): Attribute {
  for (const attr of ["PHYSICAL", "MENTAL", "MAGICAL"] as const) {
    if (PRACTICE_ATTRIBUTE_MAP[attr].includes(practice as never)) {
      return attr;
    }
  }
  throw new Error(`Unknown practice: ${practice}`);
}

/**
 * DEFAULT auto-distribution of an attribute value across its practices.
 *
 * Phase 8.3g v4 (Mashu 2026-07-28): kept for the editor where the
 * player manually distributes "slice points" across an attribute's
 * practices. This is NOT used by the practice modifier calculation
 * anymore — every practice under an attribute gets the FULL attribute
 * value, not a sub-share.
 *
 * Strategy: spread positive value evenly; for odd remainders, give +1
 * to practices in order (prowess → finesse → fieldcraft, etc.)
 * Negative values: put all -1 into the first practice.
 *
 * Example: Physical +5 → { prowess: 2, finesse: 2, fieldcraft: 1 }
 *          Mental -1 → { awareness: -1, reason: 0, knowledge: 0, influence: 0 }
 *          Magical 0 → all zeros
 */
export function distributeAttributeSlices(
  attribute: Attribute,
  attributeValue: number,
): Record<Practice, number> {
  const practices = PRACTICE_ATTRIBUTE_MAP[attribute];
  const result = {} as Record<Practice, number>;
  for (const p of practices) {
    result[p] = 0;
  }

  if (attributeValue === 0) return result;

  if (attributeValue < 0) {
    // All negatives in first practice, clamped to MIN_SLICE
    const firstPractice = practices[0]!;
    result[firstPractice] = Math.max(MIN_SLICE, attributeValue);
    return result;
  }

  // Positive: distribute evenly
  const n = practices.length;
  const base = Math.floor(attributeValue / n);
  const remainder = attributeValue - base * n;

  for (let i = 0; i < n; i++) {
    const p = practices[i]!;
    result[p] = base + (i < remainder ? 1 : 0);
  }
  return result;
}

// =============================================================================
// Practice modifier (Phase 8.3g v4 — no slice split)
// =============================================================================
//
// Phase 8.3g v4 (Mashu 2026-07-28): reclaimed the old "slice" concept.
// Mashu: "Ok so for practices we have something old. You have the
// slice thing. That is old. I tried to tell you again and again and
// again. For a practice, the modifier is attribute + proficiency
// bonus if proficient + primitives where it's the case. There is
// nothing split."
//
//   practice_total = attribute[practice] + (PB if proficient) + sum(primitives)
//
// The "slice" field is now the FULL attribute value (not a share).
// Each practice under the same attribute has the same base, plus
// or minus primitive contributions. They are NOT split.
//
// Example: PHYS+5, not proficient, no primitives
//   prowess=5, finesse=5, fieldcraft=5  (NOT 2+2+1)
//
// Example: MENT+5, proficient, Psychic Firewall (+1 defense_dc.mental
//   doesn't affect practice; ignore for example)
//   awareness=5+6=11, reason=11, knowledge=11, influence=11
//
// The slices map is ignored for the per-practice modifier calculation;
// it is kept for the editor where the player decides how to spread
// slice points (informational only).

/**
 * The "slice" of a practice = the FULL attribute modifier,
 * not a sub-share. Phase 8.3g v4 (Mashu 2026-07-28):
 * "the modifier is attribute + proficiency bonus if proficient +
 * primitives where it's the case. There is nothing split."
 */
export function getPracticeSlice(
  practice: Practice,
  attributes: Attributes,
  _slices: PracticeSlices,
): number {
  const practiceAttribute = getPracticeAttribute(practice);
  return attributes[practiceAttribute.toLowerCase() as keyof Attributes];
}

/**
 * Compute the practice modifier for a single practice.
 *
 * Phase 8.3g v4 (Mashu 2026-07-28): practice =
 *   attribute + PB (if proficient) + primitives
 *
 * Phase 8.I i2 (Mashu 2026-08-04): primitiveBonuses is now a
 * Map<PrimitiveId, Map<Practice, {name, bonus}>>. See
 * computePracticeModifierAtLevel for the same shape.
 */
export function computePracticeModifier(
  practice: Practice,
  attributes: Attributes,
  slices: PracticeSlices,
  attrProficient: Attribute | null | undefined,
  primitiveBonuses: ReadonlyMap<
    number,
    ReadonlyMap<Practice, { readonly name: string; readonly bonus: number }>
  > = new Map(),
): PracticeModifierBreakdown {
  const attribute = getPracticeAttribute(practice);
  const slice = getPracticeSlice(practice, attributes, slices);

  // PB applies to ALL practices under the proficient attribute
  const isProficient = attrProficient === attribute;
  const pbContribution = isProficient ? STARTING_PB : 0;

  const primitiveContributions: Array<{
    primitiveId: number;
    primitiveName: string;
    bonus: number;
  }> = [];
  for (const [primitiveId, practiceMap] of primitiveBonuses.entries()) {
    const entry = practiceMap.get(practice);
    if (!entry) continue;
    primitiveContributions.push({
      primitiveId,
      primitiveName: entry.name,
      bonus: entry.bonus,
    });
  }

  const total =
    slice + pbContribution + primitiveContributions.reduce((t, p) => t + p.bonus, 0);

  return {
    practice,
    total,
    slice,
    pbContribution,
    primitiveContributions,
    attribute,
  };
}

/**
 * Compute practice modifier with explicit PB (for level-aware calculations).
 * Phase 8.3g v4 (Mashu 2026-07-28): same formula as
 * computePracticeModifier but uses level-scaled PB.
 *
 * Phase 8.I i2 (Mashu 2026-08-04): primitiveBonuses is now a
 * Map<PrimitiveId, Map<Practice, {name, bonus}>> so the per-practice
 * filtering happens here, not at the call site. Each primitive
 * only contributes to the practices in its sub-target.
 */
export function computePracticeModifierAtLevel(
  practice: Practice,
  attributes: Attributes,
  slices: PracticeSlices,
  attrProficient: Attribute | null | undefined,
  level: number,
  primitiveBonuses: ReadonlyMap<
    number,
    ReadonlyMap<Practice, { readonly name: string; readonly bonus: number }>
  > = new Map(),
): PracticeModifierBreakdown {
  const attribute = getPracticeAttribute(practice);
  const slice = getPracticeSlice(practice, attributes, slices);
  const isProficient = attrProficient === attribute;
  const pb = proficiencyBonus(level);
  const pbContribution = isProficient ? pb : 0;

  // Per-practice filter: only pick up primitives that have an
  // entry for THIS practice in their inner map. A primitive with
  // no skill_practice_check modifier or with sub-targets for
  // different practices contributes nothing here.
  const primitiveContributions: Array<{
    primitiveId: number;
    primitiveName: string;
    bonus: number;
  }> = [];
  for (const [primitiveId, practiceMap] of primitiveBonuses.entries()) {
    const entry = practiceMap.get(practice);
    if (!entry) continue;
    primitiveContributions.push({
      primitiveId,
      primitiveName: entry.name,
      bonus: entry.bonus,
    });
  }

  const total =
    slice + pbContribution + primitiveContributions.reduce((t, p) => t + p.bonus, 0);

  return {
    practice,
    total,
    slice,
    pbContribution,
    primitiveContributions,
    attribute,
  };
}

/**
 * Compute all 10 practice modifiers at once.
 */
export function computeAllPracticeModifiers(
  attributes: Attributes,
  slices: PracticeSlices,
  attrProficient: Attribute | null | undefined,
  level: number,
  primitiveBonuses: ReadonlyMap<
    number,
    ReadonlyMap<Practice, { readonly name: string; readonly bonus: number }>
  > = new Map(),
): ReadonlyArray<PracticeModifierBreakdown> {
  const allPractices: Practice[] = [
    ...PRACTICE_ATTRIBUTE_MAP.PHYSICAL,
    ...PRACTICE_ATTRIBUTE_MAP.MENTAL,
    ...PRACTICE_ATTRIBUTE_MAP.MAGICAL,
  ];
  return allPractices.map((p) =>
    computePracticeModifierAtLevel(
      p,
      attributes,
      slices,
      attrProficient,
      level,
      primitiveBonuses,
    ),
  );
}

// =============================================================================
// Proficiency Bonus
// =============================================================================

export const STARTING_PB = 2;
export const PB_PER_LEVEL_INTERVAL = 4;
export const MAX_PB = 10;

/**
 * Compute PB for a given level.
 * L1-3: +2, L5-7: +3, L9-11: +4, L13-15: +5, L17-19: +6, L20: +6
 * Wait — canonical D&D-style is +2, +3, +4, +5, +6 at L1, L5, L9, L13, L17.
 * Per Notion, "PB = +2 at L1, +1 every 4 levels" so L1=2, L5=3, L9=4, L13=5, L17=6.
 * Capped at MAX_PB.
 */
export function proficiencyBonus(level: number): number {
  if (level < 1) return 0;
  const pb = STARTING_PB + Math.floor((level - 1) / PB_PER_LEVEL_INTERVAL);
  return Math.min(pb, MAX_PB);
}

// =============================================================================
// Defensive DC
// =============================================================================

/**
 * Defensive DC = 5 + relevant attribute + PB (if proficient in that attribute).
 *
 * @param attribute The attribute the DC is for (PHYSICAL/MENTAL/MAGICAL)
 * @param attributes Character's attribute scores
 * @param attrProficient Proficient attribute (null = no proficiency)
 * @param level Character level (for PB)
 */
export function computeDefensiveDC(
  attribute: Attribute,
  attributes: Attributes,
  attrProficient: Attribute | null | undefined,
  level: number,
): number {
  const attrValue = attributes[attribute.toLowerCase() as keyof Attributes];
  const isProficient = attrProficient === attribute;
  const pb = isProficient ? proficiencyBonus(level) : 0;
  return 5 + attrValue + pb;
}

/**
 * Compute all three defensive DCs at once.
 */
export function computeAllDefensiveDCs(
  attributes: Attributes,
  attrProficient: Attribute | null | undefined,
  level: number,
): {
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
} {
  return {
    physical: computeDefensiveDC("PHYSICAL", attributes, attrProficient, level),
    mental: computeDefensiveDC("MENTAL", attributes, attrProficient, level),
    magical: computeDefensiveDC("MAGICAL", attributes, attrProficient, level),
  };
}
