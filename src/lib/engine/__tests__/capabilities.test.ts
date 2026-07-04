/**
 * capabilities.test.ts — Capability compilation, BU total, validation
 */
import { describe, expect, it } from "vitest";
import {
  compileCapabilityBU,
  compileCapabilityEffects,
  validateCapability,
  compileCapability,
  calculateCapabilityMirrorDebt,
  capabilityToAssembly,
  type CapabilityAssembly,
} from "../capabilities";
import type {
  Primitive,
  PrimitiveReference,
  HardModifier,
  Effect,
  Capability,
} from "@/types/swordweave";

// =============================================================================
// Test helpers
// =============================================================================

function makePrimitive(overrides: Partial<Primitive>): Primitive {
  return {
    id: overrides.id ?? "prim-default",
    name: overrides.name ?? "Test Primitive",
    category: overrides.category ?? "verb-tier",
    buCost: overrides.buCost ?? 4,
    ...(overrides.description !== undefined
      ? { description: overrides.description }
      : {}),
    hardModifiers: overrides.hardModifiers ?? [],
  };
}

const strikeVerb = makePrimitive({
  id: "verb-strike",
  name: "Strike",
  category: "verb-tier",
  buCost: 4,
});

const fireDomain = makePrimitive({
  id: "domain-fire",
  name: "Fire",
  category: "domain-license",
  buCost: 4,
});

const physicalDomain = makePrimitive({
  id: "domain-physical",
  name: "Physical",
  category: "domain-license",
  buCost: 4,
});

const touchRange = makePrimitive({
  id: "range-touch",
  name: "Touch",
  category: "range",
  buCost: 0,
});

const singleTarget = makePrimitive({
  id: "target-single",
  name: "Single Target",
  category: "targeting",
  buCost: 0,
});

const instantDuration = makePrimitive({
  id: "duration-instant",
  name: "Instant",
  category: "duration",
  buCost: 0,
});

const impactDie = makePrimitive({
  id: "output-impact",
  name: "Impact Die Block (1d6)",
  category: "output",
  buCost: 4,
});

const expertiseAug = makePrimitive({
  id: "aug-expertise",
  name: "Expertise Upgrade",
  category: "character-sheet-augment",
  buCost: 8,
});

const baseMap = new Map<string, Primitive>([
  ["verb-strike", strikeVerb],
  ["domain-fire", fireDomain],
  ["domain-physical", physicalDomain],
  ["range-touch", touchRange],
  ["target-single", singleTarget],
  ["duration-instant", instantDuration],
  ["output-impact", impactDie],
  ["aug-expertise", expertiseAug],
]);

function makeAssembly(
  overrides: Partial<CapabilityAssembly> = {},
): CapabilityAssembly {
  // Use 'in' check to distinguish undefined (use default) from null (use null)
  const rangePrimitive = "rangePrimitive" in overrides
    ? overrides.rangePrimitive ?? null
    : { primitiveId: "range-touch" };
  const targetingPrimitive = "targetingPrimitive" in overrides
    ? overrides.targetingPrimitive ?? null
    : { primitiveId: "target-single" };
  const durationPrimitive = "durationPrimitive" in overrides
    ? overrides.durationPrimitive ?? null
    : { primitiveId: "duration-instant" };
  const outputPrimitive = "outputPrimitive" in overrides
    ? overrides.outputPrimitive ?? null
    : { primitiveId: "output-impact" };

  return {
    id: overrides.id ?? "cap-1",
    name: overrides.name ?? "Test Capability",
    type: overrides.type ?? "active",
    sourceType: overrides.sourceType ?? "physical",
    ...(overrides.verboseDescription !== undefined
      ? { verboseDescription: overrides.verboseDescription }
      : {}),
    verbReferences: overrides.verbReferences ?? [
      { primitiveId: "verb-strike" },
    ],
    domainReferences: overrides.domainReferences ?? [
      { primitiveId: "domain-fire" },
    ],
    effectReferences: overrides.effectReferences ?? [],
    rangePrimitive,
    targetingPrimitive,
    durationPrimitive,
    outputPrimitive,
    sizingPrimitive: overrides.sizingPrimitive ?? null,
    structuralPrimitives: overrides.structuralPrimitives ?? [],
    augmentPrimitives: overrides.augmentPrimitives ?? [],
    primitivesById: overrides.primitivesById ?? baseMap,
  };
}

// =============================================================================
// compileCapabilityBU
// =============================================================================

describe("compileCapabilityBU", () => {
  it("sums verb + domain + range + targeting + duration + output", () => {
    // strike 4 + fire 4 + touch 0 + single 0 + instant 0 + impact 4 = 12
    const result = compileCapabilityBU(makeAssembly());
    expect(result).toBe(12);
  });

  it("respects quantity multiplier", () => {
    const assembly = makeAssembly({
      domainReferences: [
        { primitiveId: "domain-fire", quantity: 2 },
      ],
    });
    // strike 4 + fire 4*2 + ... = 16
    expect(compileCapabilityBU(assembly)).toBe(16);
  });

  it("includes structural primitives", () => {
    const structPrim = makePrimitive({
      id: "struct-1",
      name: "Custom Structure",
      category: "structural",
      buCost: 4,
    });
    const map = new Map(baseMap);
    map.set("struct-1", structPrim);

    const assembly = makeAssembly({
      structuralPrimitives: [{ primitiveId: "struct-1" }],
      primitivesById: map,
    });
    expect(compileCapabilityBU(assembly)).toBe(16); // 12 + 4
  });

  it("includes augment primitives", () => {
    const assembly = makeAssembly({
      augmentPrimitives: [{ primitiveId: "aug-expertise" }],
    });
    expect(compileCapabilityBU(assembly)).toBe(20); // 12 + 8
  });

  it("returns 0 for assembly with no primitives", () => {
    const assembly = makeAssembly({
      verbReferences: [],
      domainReferences: [],
      rangePrimitive: null,
      targetingPrimitive: null,
      durationPrimitive: null,
      outputPrimitive: null,
    });
    expect(compileCapabilityBU(assembly)).toBe(0);
  });

  it("ignores references to missing primitives", () => {
    const assembly = makeAssembly({
      verbReferences: [{ primitiveId: "nonexistent" }],
    });
    expect(compileCapabilityBU(assembly)).toBe(8); // only domain + output
  });
});

// =============================================================================
// compileCapabilityEffects
// =============================================================================

describe("compileCapabilityEffects", () => {
  it("collects modifiers from all referenced primitives", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: 2,
    };
    const primWithMod = makePrimitive({
      id: "verb-with-mod",
      name: "Strike+",
      category: "verb-tier",
      buCost: 4,
      hardModifiers: [mod],
    });
    const map = new Map(baseMap);
    map.set("verb-with-mod", primWithMod);

    const assembly = makeAssembly({
      verbReferences: [{ primitiveId: "verb-with-mod" }],
      primitivesById: map,
    });
    const modifiers = compileCapabilityEffects(assembly);
    expect(modifiers).toContainEqual(mod);
  });

  it("respects quantity on repeated primitives", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: 1,
    };
    const primWithMod = makePrimitive({
      id: "prim-qty",
      name: "Repeatable",
      category: "verb-tier",
      buCost: 4,
      hardModifiers: [mod],
    });
    const map = new Map(baseMap);
    map.set("prim-qty", primWithMod);

    const assembly = makeAssembly({
      verbReferences: [{ primitiveId: "prim-qty", quantity: 3 }],
      primitivesById: map,
    });
    const modifiers = compileCapabilityEffects(assembly);
    expect(modifiers.filter((m) => m.target === "action.damage")).toHaveLength(3);
  });

  it("collects modifiers from nested effects", () => {
    const nestedMod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: 5,
    };
    const nestedPrim = makePrimitive({
      id: "nested-prim",
      name: "Nested Effect Primitive",
      category: "output",
      buCost: 4,
      hardModifiers: [nestedMod],
    });
    const map = new Map(baseMap);
    map.set("nested-prim", nestedPrim);

    const nestedEffect: Effect = {
      id: "fx-1",
      name: "Burning",
      description: "Apply burning damage",
      primitiveReferences: [{ primitiveId: "nested-prim" }],
    };

    const assembly = makeAssembly({
      effectReferences: [nestedEffect],
      primitivesById: map,
    });
    const modifiers = compileCapabilityEffects(assembly);
    expect(modifiers).toContainEqual(nestedMod);
  });
});

// =============================================================================
// validateCapability
// =============================================================================

describe("validateCapability", () => {
  it("passes for a complete valid assembly", () => {
    const result = validateCapability(makeAssembly());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when no verb", () => {
    const result = validateCapability(
      makeAssembly({ verbReferences: [] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Capability must have at least 1 verb primitive");
  });

  it("fails when no range", () => {
    const result = validateCapability(
      makeAssembly({ rangePrimitive: null }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Capability must have exactly 1 range gate primitive");
  });

  it("fails when no duration", () => {
    const result = validateCapability(
      makeAssembly({ durationPrimitive: null }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Capability must have exactly 1 duration primitive");
  });

  it("fails when no targeting", () => {
    const result = validateCapability(
      makeAssembly({ targetingPrimitive: null }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Capability must have at least 1 targeting primitive");
  });

  it("fails when active has no domain", () => {
    const result = validateCapability(
      makeAssembly({ domainReferences: [], type: "active" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Active capability must have at least 1 domain primitive");
  });

  it("warns (not fails) when passive has no domain", () => {
    const result = validateCapability(
      makeAssembly({ domainReferences: [], type: "passive" }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when active has no output primitive", () => {
    const result = validateCapability(
      makeAssembly({ outputPrimitive: null, type: "active" }),
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("output primitive"))).toBe(true);
  });

  it("flags atomicity violation: primitive defines own movement", () => {
    const badPrim = makePrimitive({
      id: "bad-verb",
      name: "Bad Verb",
      category: "verb-tier",
      buCost: 4,
      hardModifiers: [
        {
          kind: "modify",
          target: "character.movement.land",
          operation: "add",
          value: 10,
        },
      ],
    });
    const map = new Map(baseMap);
    map.set("bad-verb", badPrim);

    const result = validateCapability(
      makeAssembly({
        verbReferences: [{ primitiveId: "bad-verb" }],
        primitivesById: map,
      }),
    );
    expect(result.warnings.some((w) => w.includes("movement"))).toBe(true);
  });

  it("flags atomicity violation: primitive defines own damage", () => {
    const badPrim = makePrimitive({
      id: "bad-domain",
      name: "Bad Domain",
      category: "domain-license",
      buCost: 4,
      hardModifiers: [
        {
          kind: "modify",
          target: "action.damage",
          operation: "add",
          value: 5,
        },
      ],
    });
    const map = new Map(baseMap);
    map.set("bad-domain", badPrim);

    const result = validateCapability(
      makeAssembly({
        domainReferences: [{ primitiveId: "bad-domain" }],
        primitivesById: map,
      }),
    );
    expect(result.warnings.some((w) => w.includes("damage"))).toBe(true);
  });

  it("errors when primitive is not in primitivesById", () => {
    const result = validateCapability(
      makeAssembly({
        verbReferences: [{ primitiveId: "ghost" }],
      }),
    );
    expect(result.errors.some((e) => e.includes("ghost"))).toBe(true);
  });
});

// =============================================================================
// compileCapability (full pipeline)
// =============================================================================

describe("compileCapability", () => {
  it("returns BU total + modifiers + validation", () => {
    const result = compileCapability(makeAssembly());
    expect(result.totalBu).toBe(12);
    expect(result.validation.valid).toBe(true);
    expect(result.verbNames).toContain("Strike");
    expect(result.domainNames).toContain("Fire");
    expect(result.rangeName).toBe("Touch");
    expect(result.targetingName).toBe("Single Target");
    expect(result.durationName).toBe("Instant");
    expect(result.outputName).toBe("Impact Die Block (1d6)");
  });

  it("produces empty modifier list when primitives have no hard modifiers", () => {
    const result = compileCapability(makeAssembly());
    expect(result.hardModifiers).toHaveLength(0);
  });

  it("aggregates modifiers across verbs, domains, and effects", () => {
    const verbMod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: 2,
    };
    const domainMod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: 1,
    };

    const verbWithMod = makePrimitive({
      id: "verb-with-mod",
      name: "Strike+",
      category: "verb-tier",
      buCost: 4,
      hardModifiers: [verbMod],
    });
    const domainWithMod = makePrimitive({
      id: "domain-with-mod",
      name: "Fire+",
      category: "domain-license",
      buCost: 4,
      hardModifiers: [domainMod],
    });
    const map = new Map(baseMap);
    map.set("verb-with-mod", verbWithMod);
    map.set("domain-with-mod", domainWithMod);

    const assembly = makeAssembly({
      verbReferences: [{ primitiveId: "verb-with-mod" }],
      domainReferences: [{ primitiveId: "domain-with-mod" }],
      primitivesById: map,
    });

    const result = compileCapability(assembly);
    expect(result.hardModifiers).toContainEqual(verbMod);
    expect(result.hardModifiers).toContainEqual(domainMod);
  });
});

// =============================================================================
// calculateCapabilityMirrorDebt
// =============================================================================

describe("calculateCapabilityMirrorDebt", () => {
  it("returns 0 when no primitives are mirrored", () => {
    const debt = calculateCapabilityMirrorDebt(
      makeAssembly(),
      new Map(),
    );
    expect(debt).toBe(0);
  });

  it("sums BU cost of mirrored primitives", () => {
    const flags = new Map([["verb-strike", true]]);
    const debt = calculateCapabilityMirrorDebt(makeAssembly(), flags);
    expect(debt).toBe(4); // strike is 4 BU
  });

  it("respects quantity", () => {
    const flags = new Map([["domain-fire", true]]);
    const assembly = makeAssembly({
      domainReferences: [{ primitiveId: "domain-fire", quantity: 2 }],
    });
    const debt = calculateCapabilityMirrorDebt(assembly, flags);
    expect(debt).toBe(8); // 4 * 2
  });

  it("sums across verbs, domains, structural, augment", () => {
    const flags = new Map([
      ["verb-strike", true],
      ["domain-fire", true],
      ["aug-expertise", true],
    ]);
    const debt = calculateCapabilityMirrorDebt(
      makeAssembly({
        augmentPrimitives: [{ primitiveId: "aug-expertise" }],
      }),
      flags,
    );
    expect(debt).toBe(16); // 4 + 4 + 8
  });
});

// =============================================================================
// capabilityToAssembly
// =============================================================================

describe("capabilityToAssembly", () => {
  it("distributes primitives into correct slots by category", () => {
    const cap: Capability = {
      id: "cap-1",
      name: "Fire Strike",
      type: "active",
      sourceType: "physical",
      description: "A basic fire strike",
      verbs: [{ primitiveId: "verb-strike" }],
      domains: [{ primitiveId: "domain-fire" }],
      effects: [],
    };
    const assembly = capabilityToAssembly(
      cap,
      baseMap,
      new Map(),
    );
    expect(assembly.verbReferences).toHaveLength(1);
    expect(assembly.domainReferences).toHaveLength(1);
    expect(assembly.rangePrimitive).toBeNull();
    expect(assembly.targetingPrimitive).toBeNull();
    expect(assembly.durationPrimitive).toBeNull();
    expect(assembly.outputPrimitive).toBeNull();
  });

  it("places range/targeting/duration/output in their slots", () => {
    const cap: Capability = {
      id: "cap-2",
      name: "Touch Fire Strike",
      type: "active",
      sourceType: "physical",
      description: "",
      verbs: [
        { primitiveId: "verb-strike" },
        { primitiveId: "range-touch" },
        { primitiveId: "target-single" },
        { primitiveId: "duration-instant" },
        { primitiveId: "output-impact" },
      ],
      domains: [{ primitiveId: "domain-fire" }],
      effects: [],
    };
    const assembly = capabilityToAssembly(cap, baseMap, new Map());
    expect(assembly.verbReferences).toHaveLength(1);
    expect(assembly.rangePrimitive).not.toBeNull();
    expect(assembly.rangePrimitive?.primitiveId).toBe("range-touch");
    expect(assembly.targetingPrimitive?.primitiveId).toBe("target-single");
    expect(assembly.durationPrimitive?.primitiveId).toBe("duration-instant");
    expect(assembly.outputPrimitive?.primitiveId).toBe("output-impact");
  });

  it("resolves effect references from effectsById", () => {
    const effect: Effect = {
      id: "fx-1",
      name: "Burning",
      description: "",
      primitiveReferences: [],
    };
    const cap: Capability = {
      id: "cap-3",
      name: "Burning Strike",
      type: "active",
      sourceType: "physical",
      description: "",
      verbs: [{ primitiveId: "verb-strike" }],
      domains: [{ primitiveId: "domain-fire" }],
      effects: ["fx-1"],
    };
    const effectsMap = new Map([["fx-1", effect]]);
    const assembly = capabilityToAssembly(cap, baseMap, effectsMap);
    expect(assembly.effectReferences).toHaveLength(1);
    expect(assembly.effectReferences[0]?.name).toBe("Burning");
  });
});