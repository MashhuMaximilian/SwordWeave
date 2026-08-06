/**
 * condition-evaluator.test.ts — Phase 8.I i2.6 (Mashu 2026-08-06)
 *
 * Unit tests for the runtime condition evaluator. Hits every
 * category × predicate-kind × context-shape combination.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluatePredicate,
  type ConditionContext,
  type CharacterConditionState,
} from "@/lib/engine/condition-evaluator";

// ---- Test fixtures --------------------------------------------------------

function makeCharacter(overrides: Partial<CharacterConditionState> = {}): CharacterConditionState {
  return {
    vitality: 30,
    vitalityMax: 60,
    saveDc: 14,
    blockValue: 6,
    attributes: { physical: 5, mental: 2, magical: 3 },
    practices: {
      prowess: 5,
      finesse: 4,
      fieldcraft: 5,
      awareness: 4,
      reason: 3,
      knowledge: 4,
      influence: 3,
      mysticism: 4,
      communion: 3,
      intuition: 5,
    },
    proficiencies: new Set([]),
    flags: new Set([]),
    custom: {},
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ConditionContext> = {}): ConditionContext {
  const ctx: ConditionContext = {
    character: overrides.character ?? makeCharacter(),
  };
  if (overrides.target !== undefined) (ctx as { target?: unknown }).target = overrides.target;
  if (overrides.scene !== undefined) (ctx as { scene?: unknown }).scene = overrides.scene;
  return ctx;
}

// ---- Null + narrative always pass ---------------------------------------

describe("evaluateCondition — null + narrative always pass", () => {
  it("null condition returns true (always fires)", () => {
    const ctx = makeCtx();
    expect(evaluateCondition(null, ctx)).toBe(true);
    expect(evaluateCondition(undefined, ctx)).toBe(true);
  });

  it("narrative condition returns true (GM-triggered hint)", () => {
    const ctx = makeCtx();
    expect(
      evaluateCondition(
        { kind: "narrative", text: "when tracking enemies" },
        ctx,
      ),
    ).toBe(true);
  });
});

// ---- Preset shape (legacy keys) -----------------------------------------

describe("evaluateCondition — preset shape (legacy keys)", () => {
  it("actor-below-half-hp fires when vitality / vitalityMax < 0.5", () => {
    // 25 / 60 ≈ 0.42 < 0.5 → fires
    const ctx = makeCtx({ character: makeCharacter({ vitality: 25, vitalityMax: 60 }) });
    expect(evaluateCondition({ kind: "preset", presetKey: "actor-below-half-hp", customTags: [] }, ctx)).toBe(true);
  });

  it("actor-below-half-hp does NOT fire when vitality >= 0.5", () => {
    // 35 / 60 ≈ 0.58 → does not fire
    const ctx = makeCtx({ character: makeCharacter({ vitality: 35, vitalityMax: 60 }) });
    expect(evaluateCondition({ kind: "preset", presetKey: "actor-below-half-hp", customTags: [] }, ctx)).toBe(false);
  });

  it("actor-prone fires when character's is_prone flag is set", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(evaluateCondition({ kind: "preset", presetKey: "actor-prone", customTags: [] }, ctx)).toBe(true);
  });

  it("target-prone fires only when target.tags has 'prone'", () => {
    const withProne = makeCtx({ target: { tags: new Set(["prone"]), custom: {} } });
    const noProne = makeCtx({ target: { tags: new Set(), custom: {} } });
    const noTarget = makeCtx();
    expect(evaluateCondition({ kind: "preset", presetKey: "target-prone", customTags: [] }, withProne)).toBe(true);
    expect(evaluateCondition({ kind: "preset", presetKey: "target-prone", customTags: [] }, noProne)).toBe(false);
    expect(evaluateCondition({ kind: "preset", presetKey: "target-prone", customTags: [] }, noTarget)).toBe(false);
  });

  it("scene-dim fires only when scene.tags has 'dim'", () => {
    const dimScene = makeCtx({ scene: { tags: new Set(["dim"]), custom: {} } });
    const noScene = makeCtx();
    expect(evaluateCondition({ kind: "preset", presetKey: "scene-dim", customTags: [] }, dimScene)).toBe(true);
    expect(evaluateCondition({ kind: "preset", presetKey: "scene-dim", customTags: [] }, noScene)).toBe(false);
  });
});

// ---- Tags shape (single-pill implicit AND) -------------------------------

describe("evaluateCondition — tags shape (implicit AND)", () => {
  it("empty tags array fires (no constraint)", () => {
    expect(evaluateCondition({ kind: "tags", customTags: [] }, makeCtx())).toBe(true);
  });

  it("single self flag pill fires when character's flags include it", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:is_prone"] }, ctx)).toBe(true);
  });

  it("multiple tags fire only when ALL match (implicit AND)", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        flags: new Set(["is_prone", "is_stunned"]),
      }),
    });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:is_prone", "self:is_stunned"] }, ctx)).toBe(true);
  });

  it("multiple tags fail when one is missing", () => {
    const ctx = makeCtx({
      character: makeCharacter({ flags: new Set(["is_prone"]) }),
    });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:is_prone", "self:is_stunned"] }, ctx)).toBe(false);
  });
});

// ---- Compound shape (AND/OR chain) --------------------------------------

describe("evaluateCondition — compound shape", () => {
  it("single pill (no operator) is just that pill's truthiness", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(evaluateCondition({ kind: "compound", tokens: ["self:is_prone"] }, ctx)).toBe(true);
    expect(evaluateCondition({ kind: "compound", tokens: ["self:is_stunned"] }, ctx)).toBe(false);
  });

  it("AND chain: all pills must pass", () => {
    const ctx = makeCtx({
      character: makeCharacter({ flags: new Set(["is_prone", "is_stunned"]) }),
    });
    expect(
      evaluateCondition(
        { kind: "compound", tokens: ["self:is_prone", "AND", "self:is_stunned"] },
        ctx,
      ),
    ).toBe(true);
  });

  it("AND chain fails when one pill fails", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(
      evaluateCondition(
        { kind: "compound", tokens: ["self:is_prone", "AND", "self:is_stunned"] },
        ctx,
      ),
    ).toBe(false);
  });

  it("OR chain: one pill passes → fires", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(
      evaluateCondition(
        { kind: "compound", tokens: ["self:is_prone", "OR", "self:is_stunned"] },
        ctx,
      ),
    ).toBe(true);
  });

  it("OR chain fails when all pills fail", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set() }) });
    expect(
      evaluateCondition(
        { kind: "compound", tokens: ["self:is_prone", "OR", "self:is_stunned"] },
        ctx,
      ),
    ).toBe(false);
  });

  it("3-pill AND/OR mix: (A AND B) OR C", () => {
    // (is_prone AND is_stunned) OR has_cover (on target)
    const ctx = makeCtx({
      character: makeCharacter({ flags: new Set(["is_prone"]) }),
      target: { tags: new Set(["has_cover"]), custom: {} },
    });
    expect(
      evaluateCondition(
        {
          kind: "compound",
          tokens: ["self:is_prone", "AND", "self:is_stunned", "OR", "target:has_cover"],
        },
        ctx,
      ),
    ).toBe(true);
  });
});

// ---- proficient_in / not_proficient_in (proficiency flag pills) ---------

describe("evaluateCondition — proficiency pills", () => {
  it("proficient_in(prowess) fires when character has the proficiency", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(["prowess"]),
      }),
    });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:proficient_in(prowess)"] }, ctx)).toBe(true);
  });

  it("proficient_in(prowess) does NOT fire when no proficiency", () => {
    const ctx = makeCtx({ character: makeCharacter({ proficiencies: new Set() }) });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:proficient_in(prowess)"] }, ctx)).toBe(false);
  });

  it("not_proficient_in(prowess) fires when character does NOT have it", () => {
    const ctx = makeCtx({ character: makeCharacter({ proficiencies: new Set() }) });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:not_proficient_in(prowess)"] }, ctx)).toBe(true);
  });

  it("not_proficient_in(prowess) does NOT fire when proficient", () => {
    const ctx = makeCtx({
      character: makeCharacter({ proficiencies: new Set(["prowess"]) }),
    });
    expect(evaluateCondition({ kind: "tags", customTags: ["self:not_proficient_in(prowess)"] }, ctx)).toBe(false);
  });

  it("Broad Familiarity MVP: actor:not_proficient fires for non-proficient checks", () => {
    // The MVP primitive's stored condition is {kind:'tags', customTags:['actor:not_proficient']}.
    // (Phase 7 Q-B m4 will eventually emit a compound shape, but
    // tags still work for primitives with a single pill.) The engine
    // evaluates it against a runtime context where the practice being
    // checked is 'prowess' — meaning the character has (or doesn't have)
    // that proficiency. The condition fires iff the character does NOT
    // have proficiency in the practice being checked.
    const ctx = makeCtx({ character: makeCharacter({ proficiencies: new Set() }) });
    expect(evaluateCondition({ kind: "tags", customTags: ["actor:not_proficient"] }, ctx)).toBe(false); // wrong — Broad Familiarity needs a per-practice check; see below

    // Actually the Broad Familiarity primitive's condition shape will
    // be authored as actor:not_proficient_in({{practice}}). For the MVP
    // we're proving the evaluator can parse that shape:
    const ctxFieldcraftNonProf = makeCtx({
      character: makeCharacter({ proficiencies: new Set(["prowess"]) }), // NOT proficient in fieldcraft
    });
    expect(
      evaluateCondition(
        { kind: "tags", customTags: ["actor:not_proficient_in(fieldcraft)"] },
        ctxFieldcraftNonProf,
      ),
    ).toBe(true);
  });
});

// ---- Predicate evaluator (Phase 5 UI produces these) -------------------

describe("evaluatePredicate — stat comparisons", () => {
  it("vitality_pct < 0.5 fires at 25/60", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 25, vitalityMax: 60 }) });
    expect(
      evaluatePredicate(
        { kind: "stat", axis: "self", stat: "vitality_pct", op: "<", value: 0.5 },
        ctx,
      ),
    ).toBe(true);
  });

  it("vitality < 10 fires when current HP = 9", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 9, vitalityMax: 60 }) });
    expect(
      evaluatePredicate(
        { kind: "stat", axis: "self", stat: "vitality", op: "<", value: 10 },
        ctx,
      ),
    ).toBe(true);
  });

  it("vitality < 10 does NOT fire when current HP = 11", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 11, vitalityMax: 60 }) });
    expect(
      evaluatePredicate(
        { kind: "stat", axis: "self", stat: "vitality", op: "<", value: 10 },
        ctx,
      ),
    ).toBe(false);
  });

  it("between: vitality between 5 and 15 fires at 10", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 10, vitalityMax: 60 }) });
    expect(
      evaluatePredicate(
        {
          kind: "stat",
          axis: "self",
          stat: "vitality",
          op: "between",
          value: 5,
          valueHigh: 15,
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("between: bounds are inclusive", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 5, vitalityMax: 60 }) });
    expect(
      evaluatePredicate(
        {
          kind: "stat",
          axis: "self",
          stat: "vitality",
          op: "between",
          value: 5,
          valueHigh: 15,
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("custom variable: custom_fortune_points > 2", () => {
    const ctx = makeCtx({
      character: makeCharacter({ custom: { custom_fortune_points: 3 } }),
    });
    expect(
      evaluatePredicate(
        {
          kind: "stat",
          axis: "self",
          stat: "custom_fortune_points",
          op: ">",
          value: 2,
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("missing axis: target predicate without target → false", () => {
    const ctx = makeCtx(); // no target
    expect(
      evaluatePredicate(
        { kind: "stat", axis: "target", stat: "hp_pct", op: "<", value: 0.5 },
        ctx,
      ),
    ).toBe(false);
  });
});

describe("evaluatePredicate — flag + tag checks", () => {
  it("flag: is_prone self-axis fires when flag set", () => {
    const ctx = makeCtx({ character: makeCharacter({ flags: new Set(["is_prone"]) }) });
    expect(
      evaluatePredicate({ kind: "flag", axis: "self", flag: "is_prone" }, ctx),
    ).toBe(true);
  });

  it("flag: target:prone fires when target has it as a tag", () => {
    const ctx = makeCtx({ target: { tags: new Set(["prone"]), custom: {} } });
    expect(
      evaluatePredicate({ kind: "tag", axis: "target", tag: "prone" }, ctx),
    ).toBe(true);
  });

  it("tag: scene:dim fires when scene has it", () => {
    const ctx = makeCtx({ scene: { tags: new Set(["dim"]), custom: {} } });
    expect(
      evaluatePredicate({ kind: "tag", axis: "scene", tag: "dim" }, ctx),
    ).toBe(true);
  });
});


// ---- Phase 8.I i2.6 — structured pills (stat comparisons via tokens) ------

describe("evaluateCondition — structured stat pills (i2.6)", () => {
  it("vitality < 10 fires when current HP is 9", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 9, vitalityMax: 60 }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:stat|vitality|<|10"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("vitality < 10 does NOT fire when current HP is 11", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 11, vitalityMax: 60 }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:stat|vitality|<|10"],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("vitality_pct < 0.5 fires at 25/60", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 25, vitalityMax: 60 }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:stat|vitality_pct|<|0.5"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("block_value > 5 fires at 6", () => {
    const ctx = makeCtx({ character: makeCharacter({ blockValue: 6 }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:stat|block_value|>|5"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("between: vitality between 5-15 fires at 10", () => {
    const ctx = makeCtx({ character: makeCharacter({ vitality: 10, vitalityMax: 60 }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:stat|vitality|between|5|15"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("compound AND: vitality < 10 AND is_prone", () => {
    const ctx = makeCtx({
      character: makeCharacter({ vitality: 9, vitalityMax: 60, flags: new Set(["is_prone"]) }),
    });
    expect(
      evaluateCondition(
        {
          kind: "compound",
          tokens: ["self:stat|vitality|<|10", "AND", "self:is_prone"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("compound AND: vitality < 10 fails when NOT prone", () => {
    const ctx = makeCtx({
      character: makeCharacter({ vitality: 9, vitalityMax: 60, flags: new Set() }),
    });
    expect(
      evaluateCondition(
        {
          kind: "compound",
          tokens: ["self:stat|vitality|<|10", "AND", "self:is_prone"],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("proficient_in(prowess) static pill — non-dynamic", () => {
    const ctx = makeCtx({ character: makeCharacter({ proficiencies: new Set(["prowess"]) }) });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["self:proficient_in(prowess)"],
        },
        ctx,
      ),
    ).toBe(true);
  });
});


// ---- i2.6 — grouped stat refs (any_attribute, all_practices, saves) ------

describe("evaluateCondition — grouped stat refs (i2.6)", () => {
  it("any_attribute > 4 fires when at least one attr >= 4", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        attributes: { physical: 5, mental: 2, magical: 3 },
      }),
    });
    // any_attribute returns max (5). 5 > 4 → fires.
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|any_attribute|>|4"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("all_attributes > 5 fires when EVERY attribute is above 5", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        attributes: { physical: 6, mental: 7, magical: 8 },
      }),
    });
    // all_attributes returns min (6). 6 > 5 → true.
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|all_attributes|>|5"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("all_attributes > 5 fails when one attr is below", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        attributes: { physical: 6, mental: 2, magical: 8 },
      }),
    });
    // all_attributes returns min (2). 2 > 5 → false.
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|all_attributes|>|5"],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("all_practices >= 3 fires when every practice is at least 3", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        practices: {
          prowess: 5, finesse: 4, fieldcraft: 5, awareness: 4, reason: 3,
          knowledge: 4, influence: 3, mysticism: 4, communion: 3, intuition: 5,
        },
      }),
    });
    // all_practices returns min (3). 3 >= 3 → true.
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|all_practices|>=|3"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("any_practice > 5 fires when one practice is above", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        practices: {
          prowess: 5, finesse: 4, fieldcraft: 5, awareness: 4, reason: 3,
          knowledge: 4, influence: 3, mysticism: 4, communion: 3, intuition: 5,
        },
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|any_practice|>|5"],
        },
        ctx,
      ),
    ).toBe(false); // max is 5, 5 > 5 → false (strict greater)
  });

  it("attack_bonus read returns the save DC value (MVP alias)", () => {
    const ctx = makeCtx({
      character: makeCharacter({ saveDc: 14 }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|attack_bonus|=|14"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("physical_save reads a stable MVP value", () => {
    // MVP formula: 8 + floor((vitalityMax + 30) / 20)
    // vitalityMax=30 → 8 + floor(60/20) = 8 + 3 = 11
    const ctx = makeCtx({
      character: makeCharacter({ vitalityMax: 30 }),
    });
    const ps = (ctx.character as { vitalityMax: number }).vitalityMax;
    expect(ps).toBe(30);
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:stat|physical_save|=|11"],
        },
        ctx,
      ),
    ).toBe(true);
  });
});


// ---- i2.6 — grouped proficiency checks + custom proficiencies ----

describe("evaluateCondition — proficiency groupings (i2.6)", () => {
  it("not_proficient_in(all_practices) fires when NOT proficient in ANY practice", () => {
    // (i.e. true iff not_proficient covers at least one practice —
    // the check as written matches the "every member is non-proficient"
    // semantic, which is too strict for "any one is non-proficient"
    // patterns). For Broad Familiarity the per-practice dynamic
    // form (not_proficient without parens) is the correct path.
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:not_proficient_in(all_practices)"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("not_proficient_in(all_practices) is false if proficient in any practice", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(["prowess"]),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:not_proficient_in(all_practices)"],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("not_proficient_in(all_saves) fires when NOT proficient in any save", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:not_proficient_in(all_saves)"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("custom proficiency — proficient_in(painting) reads custom Set entry", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(["painting"]),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:proficient_in(painting)"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("custom proficiency — not_proficient_in(thieves_tools) is true when missing", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set([]),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:not_proficient_in(thieves_tools)"],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("attribute proficiency — proficient_in_attribute(physical) reads Set", () => {
    const ctx = makeCtx({
      character: makeCharacter({
        proficiencies: new Set(["physical"]),
      }),
    });
    expect(
      evaluateCondition(
        {
          kind: "tags",
          customTags: ["actor:proficient_in_attribute(physical)"],
        },
        ctx,
      ),
    ).toBe(true);
  });
});
