/**
 * capabilities.ts — Capability compilation, validation, and BU total calculation
 *
 * Pure functions. No I/O. No DB.
 *
 * A Capability is composed of:
 *   - Verbs (1+): action permissions (Strike, Move, Create, etc.)
 *   - Domains (1+): thematic reality licenses (Fire, Physical, Mind, etc.)
 *   - Effects (0+): nested conditions or modifications
 *   - Range gate (1): how far it reaches (Touch/Close/Near/Far/etc.)
 *   - Targeting (1): single, multiple, AoE shape
 *   - Duration (1): how long it persists
 *   - Output: dice expressions and damage/healing payload
 *
 * BU Total = sum of all primitive BU costs in the capability.
 *
 * Canonical rules from Notion (locked):
 *  - Capability cost = 0 BU at runtime (Strain + Cost is the runtime toll)
 *  - Volatility ceiling by level caps mirror debt (in bu.ts)
 *  - Mirrorable primitives can be inverted (cost credit)
 *  - Atomicity test: primitives must NOT define own targeting, range, or damage dice
 */

import type {
  Capability,
  CapabilityType,
  Effect,
  HardModifier,
  JsonValue,
  Primitive,
  PrimitiveReference,
  PrimitiveCategory,
  SourceType,
} from "@/types/swordweave";

// =============================================================================
// Compile-time types
// =============================================================================

/**
 * Extended Capability with assembly details.
 * This is what the compiler sees — it has all the pieces before
 * producing the final Capability record.
 */
export interface CapabilityAssembly {
  readonly id: string;
  readonly name: string;
  readonly type: CapabilityType;
  readonly sourceType: SourceType;
  readonly verboseDescription?: string;
  readonly verbReferences: readonly PrimitiveReference[];
  readonly domainReferences: readonly PrimitiveReference[];
  readonly effectReferences: readonly Effect[];
  readonly rangePrimitive: PrimitiveReference | null;
  readonly targetingPrimitive: PrimitiveReference | null;
  readonly durationPrimitive: PrimitiveReference | null;
  readonly outputPrimitive: PrimitiveReference | null;
  readonly sizingPrimitive?: PrimitiveReference | null;
  readonly structuralPrimitives: readonly PrimitiveReference[];
  readonly augmentPrimitives: readonly PrimitiveReference[];
  readonly primitivesById: ReadonlyMap<string, Primitive>;
}

/**
 * Validation result. Lists errors and warnings separately.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Compilation result: the final BU cost, modifier list, and any
 * synthesis metadata (e.g., inferred damage dice expression).
 */
export interface CapabilityCompilation {
  readonly totalBu: number;
  readonly hardModifiers: readonly HardModifier[];
  readonly verbNames: readonly string[];
  readonly domainNames: readonly string[];
  readonly rangeName: string | null;
  readonly targetingName: string | null;
  readonly durationName: string | null;
  readonly outputName: string | null;
  readonly effectNames: readonly string[];
  readonly validation: ValidationResult;
}

// =============================================================================
// BU Calculation
// =============================================================================

/**
 * Calculate the BU total of a capability by summing primitive costs.
 *
 * @param assembly Capability assembly with all primitives referenced
 * @returns Total BU cost
 */
export function compileCapabilityBU(assembly: CapabilityAssembly): number {
  let total = 0;

  for (const ref of assembly.verbReferences) {
    const prim = assembly.primitivesById.get(ref.primitiveId);
    if (prim) {
      total += prim.buCost * (ref.quantity ?? 1);
    }
  }

  for (const ref of assembly.domainReferences) {
    const prim = assembly.primitivesById.get(ref.primitiveId);
    if (prim) {
      total += prim.buCost * (ref.quantity ?? 1);
    }
  }

  if (assembly.rangePrimitive) {
    const prim = assembly.primitivesById.get(assembly.rangePrimitive.primitiveId);
    if (prim) {
      total += prim.buCost * (assembly.rangePrimitive.quantity ?? 1);
    }
  }

  if (assembly.targetingPrimitive) {
    const prim = assembly.primitivesById.get(assembly.targetingPrimitive.primitiveId);
    if (prim) {
      total += prim.buCost * (assembly.targetingPrimitive.quantity ?? 1);
    }
  }

  if (assembly.durationPrimitive) {
    const prim = assembly.primitivesById.get(assembly.durationPrimitive.primitiveId);
    if (prim) {
      total += prim.buCost * (assembly.durationPrimitive.quantity ?? 1);
    }
  }

  if (assembly.outputPrimitive) {
    const prim = assembly.primitivesById.get(assembly.outputPrimitive.primitiveId);
    if (prim) {
      total += prim.buCost * (assembly.outputPrimitive.quantity ?? 1);
    }
  }

  if (assembly.sizingPrimitive) {
    const prim = assembly.primitivesById.get(assembly.sizingPrimitive.primitiveId);
    if (prim) {
      total += prim.buCost * (assembly.sizingPrimitive.quantity ?? 1);
    }
  }

  for (const ref of assembly.structuralPrimitives) {
    const prim = assembly.primitivesById.get(ref.primitiveId);
    if (prim) {
      total += prim.buCost * (ref.quantity ?? 1);
    }
  }

  for (const ref of assembly.augmentPrimitives) {
    const prim = assembly.primitivesById.get(ref.primitiveId);
    if (prim) {
      total += prim.buCost * (ref.quantity ?? 1);
    }
  }

  return total;
}

// =============================================================================
// Modifier Compilation
// =============================================================================

/**
 * Collect all hard modifiers from the capability's primitives.
 *
 * Modifiers are pulled from each primitive's `hardModifiers` field and
 * aggregated. This produces the runtime modifier list to apply when the
 * capability is invoked.
 */
export function compileCapabilityEffects(
  assembly: CapabilityAssembly,
): readonly HardModifier[] {
  const all: HardModifier[] = [];

  const collect = (refs: readonly PrimitiveReference[]) => {
    for (const ref of refs) {
      const prim = assembly.primitivesById.get(ref.primitiveId);
      if (!prim) continue;
      const quantity = ref.quantity ?? 1;
      for (let i = 0; i < quantity; i++) {
        all.push(...prim.hardModifiers);
      }
    }
  };

  collect(assembly.verbReferences);
  collect(assembly.domainReferences);

  if (assembly.rangePrimitive) collect([assembly.rangePrimitive]);
  if (assembly.targetingPrimitive) collect([assembly.targetingPrimitive]);
  if (assembly.durationPrimitive) collect([assembly.durationPrimitive]);
  if (assembly.outputPrimitive) collect([assembly.outputPrimitive]);
  if (assembly.sizingPrimitive) collect([assembly.sizingPrimitive]);

  collect(assembly.structuralPrimitives);
  collect(assembly.augmentPrimitives);

  // Collect modifiers from nested effects
  for (const effect of assembly.effectReferences) {
    // Effects reference primitives via effect.primitiveReferences
    // but the Effect type only has name + description + primitiveReferences
    // We'll process what we can: nested primitives are looked up by ID
    for (const ref of effect.primitiveReferences) {
      const prim = assembly.primitivesById.get(ref.primitiveId);
      if (!prim) continue;
      const quantity = ref.quantity ?? 1;
      for (let i = 0; i < quantity; i++) {
        all.push(...prim.hardModifiers);
      }
    }
  }

  return all;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a capability assembly against canonical rules.
 *
 * Validation rules (from BU Market + Capability Composition Map):
 *   1. Must have at least 1 verb
 *   2. Must have at least 1 domain (for active capabilities; passive optional)
 *   3. Must have exactly 1 range gate
 *   4. Must have exactly 1 duration
 *   5. Must have at least 1 targeting type
 *   6. Active capabilities must have an output primitive (damage/healing dice)
 *   7. Atomicity Test: a primitive must not define own targeting, range, or damage
 *      (this is checked at primitive creation time, not capability compile time)
 *   8. Mirror ceiling: warning if capability includes many mirrorable primitives
 *      (volatility debt check is in bu.ts)
 */
export function validateCapability(
  assembly: CapabilityAssembly,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: At least 1 verb
  if (assembly.verbReferences.length === 0) {
    errors.push("Capability must have at least 1 verb primitive");
  }

  // Rule 2: At least 1 domain (active)
  if (
    assembly.type === "active" &&
    assembly.domainReferences.length === 0
  ) {
    errors.push("Active capability must have at least 1 domain primitive");
  }

  // Rule 3: Exactly 1 range gate (must exist)
  if (!assembly.rangePrimitive) {
    errors.push("Capability must have exactly 1 range gate primitive");
  }

  // Rule 4: Exactly 1 duration
  if (!assembly.durationPrimitive) {
    errors.push("Capability must have exactly 1 duration primitive");
  }

  // Rule 5: At least 1 targeting
  if (!assembly.targetingPrimitive) {
    errors.push("Capability must have at least 1 targeting primitive");
  }

  // Rule 6: Active capabilities need output
  if (
    assembly.type === "active" &&
    !assembly.outputPrimitive
  ) {
    warnings.push(
      "Active capability without output primitive (no damage/healing dice). " +
        "May be intentional for pure utility abilities.",
    );
  }

  // Rule 7: Atomicity test is checked in primitive validation, not here.
  // We only flag if a primitive in the assembly defines its own range/targeting/damage.

  for (const ref of [
    ...assembly.verbReferences,
    ...assembly.domainReferences,
    ...assembly.structuralPrimitives,
    ...assembly.augmentPrimitives,
  ]) {
    const prim = assembly.primitivesById.get(ref.primitiveId);
    if (!prim) {
      errors.push(`Primitive reference ${ref.primitiveId} not found in primitivesById`);
      continue;
    }

    // Atomicity: a primitive that defines its own range/targeting/damage
    // is a "composite" primitive and should be flagged.
    const primCategory = prim.category;
    const definesRange = prim.hardModifiers.some(
      (m) =>
        typeof m.target === "string" &&
        m.target.startsWith("character.movement."),
    );
    const definesTargeting = prim.hardModifiers.some(
      (m) =>
        typeof m.target === "string" &&
        m.target.startsWith("action.targetCount"),
    );
    const definesDamage = prim.hardModifiers.some(
      (m) =>
        typeof m.target === "string" &&
        m.target.startsWith("action.damage"),
    );

    // For atomic primitives in verb/domain/structural/augment categories,
    // these definitions are violations of the atomicity test.
    const atomicCategories: PrimitiveCategory[] = [
      "verb-tier",
      "domain-license",
      "structural",
      "character-sheet-augment",
    ];

    if (atomicCategories.includes(primCategory)) {
      if (definesRange) {
        warnings.push(
          `Primitive "${prim.name}" (${primCategory}) defines its own movement — violates atomicity test`,
        );
      }
      if (definesTargeting) {
        warnings.push(
          `Primitive "${prim.name}" (${primCategory}) defines its own targeting — violates atomicity test`,
        );
      }
      if (definesDamage) {
        warnings.push(
          `Primitive "${prim.name}" (${primCategory}) defines its own damage — violates atomicity test`,
        );
      }
    }
  }

  // Check that referenced primitives exist in the map
  const checkRefs = (refs: readonly PrimitiveReference[]) => {
    for (const ref of refs) {
      if (!assembly.primitivesById.has(ref.primitiveId)) {
        errors.push(`Primitive reference ${ref.primitiveId} not found`);
      }
    }
  };
  checkRefs(assembly.verbReferences);
  checkRefs(assembly.domainReferences);
  checkRefs(assembly.structuralPrimitives);
  checkRefs(assembly.augmentPrimitives);
  if (assembly.rangePrimitive) checkRefs([assembly.rangePrimitive]);
  if (assembly.targetingPrimitive) checkRefs([assembly.targetingPrimitive]);
  if (assembly.durationPrimitive) checkRefs([assembly.durationPrimitive]);
  if (assembly.outputPrimitive) checkRefs([assembly.outputPrimitive]);
  if (assembly.sizingPrimitive) checkRefs([assembly.sizingPrimitive]);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Full Compilation
// =============================================================================

/**
 * Run full capability compilation: BU total, modifiers, validation.
 *
 * This is the main entry point for "compile a capability into its final form."
 */
export function compileCapability(
  assembly: CapabilityAssembly,
): CapabilityCompilation {
  const totalBu = compileCapabilityBU(assembly);
  const hardModifiers = compileCapabilityEffects(assembly);
  const validation = validateCapability(assembly);

  // Extract names for human-readable output
  const getName = (id: string) => assembly.primitivesById.get(id)?.name ?? id;
  const verbNames = assembly.verbReferences.map((r) => getName(r.primitiveId));
  const domainNames = assembly.domainReferences.map((r) => getName(r.primitiveId));
  const rangeName = assembly.rangePrimitive
    ? getName(assembly.rangePrimitive.primitiveId)
    : null;
  const targetingName = assembly.targetingPrimitive
    ? getName(assembly.targetingPrimitive.primitiveId)
    : null;
  const durationName = assembly.durationPrimitive
    ? getName(assembly.durationPrimitive.primitiveId)
    : null;
  const outputName = assembly.outputPrimitive
    ? getName(assembly.outputPrimitive.primitiveId)
    : null;
  const effectNames = assembly.effectReferences.map((e) => e.name);

  return {
    totalBu,
    hardModifiers,
    verbNames,
    domainNames,
    rangeName,
    targetingName,
    durationName,
    outputName,
    effectNames,
    validation,
  };
}

// =============================================================================
// Capability → PrimitiveReference helpers
// =============================================================================

/**
 * Convert a Capability (final record) back into a CapabilityAssembly.
 *
 * This is useful when you load a capability from the DB and need to compile it.
 * Note: this requires a primitive lookup map.
 */
export function capabilityToAssembly(
  capability: Capability,
  primitivesById: ReadonlyMap<string, Primitive>,
  effectsById: ReadonlyMap<string, Effect>,
): CapabilityAssembly {
  // Distinguish primitive references by category
  const verbReferences: PrimitiveReference[] = [];
  const domainReferences: PrimitiveReference[] = [];
  const structuralPrimitives: PrimitiveReference[] = [];
  const augmentPrimitives: PrimitiveReference[] = [];
  let rangePrimitive: PrimitiveReference | null = null;
  let targetingPrimitive: PrimitiveReference | null = null;
  let durationPrimitive: PrimitiveReference | null = null;
  let outputPrimitive: PrimitiveReference | null = null;
  let sizingPrimitive: PrimitiveReference | null = null;

  const allRefs: PrimitiveReference[] = [
    ...capability.verbs,
    ...capability.domains,
  ];

  for (const ref of allRefs) {
    const prim = primitivesById.get(ref.primitiveId);
    if (!prim) continue;
    switch (prim.category) {
      case "verb-tier":
        verbReferences.push(ref);
        break;
      case "domain-license":
        domainReferences.push(ref);
        break;
      case "range":
        rangePrimitive = ref;
        break;
      case "targeting":
        targetingPrimitive = ref;
        break;
      case "duration":
        durationPrimitive = ref;
        break;
      case "output":
        outputPrimitive = ref;
        break;
      case "sizing":
        sizingPrimitive = ref;
        break;
      case "structural":
        structuralPrimitives.push(ref);
        break;
      case "character-sheet-augment":
      case "item-augment":
      case "monster-augment":
      case "background-augment":
      case "heritage-augment":
        augmentPrimitives.push(ref);
        break;
      default:
        structuralPrimitives.push(ref);
    }
  }

  // Resolve effects
  const effectReferences: Effect[] = [];
  for (const effectId of capability.effects) {
    const effect = effectsById.get(effectId);
    if (effect) effectReferences.push(effect);
  }

  return {
    id: capability.id,
    name: capability.name,
    type: capability.type,
    sourceType: capability.sourceType,
    ...(capability.description ? { verboseDescription: capability.description } : {}),
    verbReferences,
    domainReferences,
    effectReferences,
    rangePrimitive,
    targetingPrimitive,
    durationPrimitive,
    outputPrimitive,
    sizingPrimitive,
    structuralPrimitives,
    augmentPrimitives,
    primitivesById,
  };
}

// =============================================================================
// Mirror debt (volatility)
// =============================================================================

/**
 * Calculate the mirror debt (volatility) for a capability.
 *
 * Mirror debt = sum of mirror_bu_credit for all mirrorable primitives in the
 * capability that are flagged as inverted (negative usage).
 *
 * Used by the engine to enforce volatility ceiling by level.
 */
export function calculateCapabilityMirrorDebt(
  assembly: CapabilityAssembly,
  mirrorFlags: ReadonlyMap<string, boolean>, // primitiveId → isMirrored
): number {
  let debt = 0;

  const collect = (refs: readonly PrimitiveReference[]) => {
    for (const ref of refs) {
      const isMirrored = mirrorFlags.get(ref.primitiveId) ?? false;
      if (!isMirrored) continue;
      const prim = assembly.primitivesById.get(ref.primitiveId);
      if (!prim) continue;
      debt += prim.buCost * (ref.quantity ?? 1);
    }
  };

  collect(assembly.verbReferences);
  collect(assembly.domainReferences);
  if (assembly.rangePrimitive) collect([assembly.rangePrimitive]);
  if (assembly.targetingPrimitive) collect([assembly.targetingPrimitive]);
  if (assembly.durationPrimitive) collect([assembly.durationPrimitive]);
  if (assembly.outputPrimitive) collect([assembly.outputPrimitive]);
  if (assembly.sizingPrimitive) collect([assembly.sizingPrimitive]);
  collect(assembly.structuralPrimitives);
  collect(assembly.augmentPrimitives);

  return debt;
}