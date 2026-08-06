import { describe, expect, it } from "vitest";
import {
  normalizeBehaviorName,
  validateBehaviorName,
  validateModifierDraft,
  validateModifierDrafts,
  isModifierValid,
  type ModifierDraftForValidation,
} from "../modifier-validator";

describe("validateModifierDraft — widget rules (Phase 8.I i1, Mashu 2026-08-04)", () => {
  describe("widget: checklist", () => {
    it("rejects when targetValues is empty", () => {
      const draft: ModifierDraftForValidation = {
        target: "attribute",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Select at least one value for "Attribute"/);
    });

    it("rejects when targetValues has only empty strings", () => {
      const draft: ModifierDraftForValidation = {
        target: "attribute",
        targetValues: ["", ""],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Select at least one value/);
    });

    it("accepts when at least one value is checked", () => {
      const draft: ModifierDraftForValidation = {
        target: "attribute",
        targetValues: ["PHYSICAL"],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts defense_dc with no sub-target (single global Save DC, i2.0)", () => {
      // Phase 8.I i2.0 (Mashu 2026-08-05): defense_dc is now the
      // single global Save DC axis. There are no sub-targets, so
      // an empty targetValues is valid (the modifier just targets
      // "the" Save DC).
      const draft: ModifierDraftForValidation = {
        target: "defense_dc",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("rejects speed with no locomotion chosen (i2.7 free-text)", () => {
      // Phase-8.I-i2.7: speed widget became checklist-with-free-text.
      // Empty checklist + empty free-text → validator rejects.
      const draft: ModifierDraftForValidation = {
        target: "speed",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(
        /Select at least one value or enter text for "Speed"/,
      );
    });

    it("rejects skill_practice_check with no practice chosen", () => {
      const draft: ModifierDraftForValidation = {
        target: "skill_practice_check",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Select at least one value for "Skill \/ Practice Check"/);
    });

    it("rejects duration with no duration chosen (i2.7 free-text)", () => {
      // Phase-8.I-i2.7: duration widget became checklist-with-free-text.
      const draft: ModifierDraftForValidation = {
        target: "duration",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(
        /Select at least one value or enter text for "Duration"/,
      );
    });

    it("accepts targeting with one value", () => {
      const draft: ModifierDraftForValidation = {
        target: "targeting",
        targetValues: ["Cone"],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });
  });

  describe("widget: free-text", () => {
    it("rejects when freeTextNarrowFocus is empty", () => {
      const draft: ModifierDraftForValidation = {
        target: "strain",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Enter a value for "Strain"/);
    });

    it("rejects when freeTextNarrowFocus is whitespace only", () => {
      const draft: ModifierDraftForValidation = {
        target: "strain",
        targetValues: [],
        freeTextNarrowFocus: "   ",
      };
      expect(validateModifierDraft(draft)).toMatch(/Enter a value for "Strain"/);
    });

    it("accepts strain with text", () => {
      const draft: ModifierDraftForValidation = {
        target: "strain",
        targetValues: [],
        freeTextNarrowFocus: "3 vitality",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("rejects scene_pace with empty text", () => {
      const draft: ModifierDraftForValidation = {
        target: "scene_pace",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Enter a value for "Scene Pace"/);
    });

    it("accepts scene_pace with text", () => {
      const draft: ModifierDraftForValidation = {
        target: "scene_pace",
        targetValues: [],
        freeTextNarrowFocus: "Round",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("rejects behavior with empty text", () => {
      const draft: ModifierDraftForValidation = {
        target: "behavior",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Enter a value for "Behavior \(custom\)"/);
    });

    it("rejects behavior with reserved name", () => {
      const draft: ModifierDraftForValidation = {
        target: "behavior",
        targetValues: [],
        freeTextNarrowFocus: "set",
      };
      expect(validateModifierDraft(draft)).toMatch(/reserved/);
    });

    it("rejects behavior with reserved attribute name", () => {
      const draft: ModifierDraftForValidation = {
        target: "behavior",
        targetValues: [],
        freeTextNarrowFocus: "physical",
      };
      expect(validateModifierDraft(draft)).toMatch(/reserved/);
    });

    it("accepts behavior with non-reserved name", () => {
      const draft: ModifierDraftForValidation = {
        target: "behavior",
        targetValues: [],
        freeTextNarrowFocus: "darkvision",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts behavior with camelCase name (normalized form not reserved)", () => {
      const draft: ModifierDraftForValidation = {
        target: "behavior",
        targetValues: [],
        freeTextNarrowFocus: "blockValue",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });
  });

  describe("widget: checklist-with-free-text (targeting)", () => {
    it("rejects when both are empty", () => {
      const draft: ModifierDraftForValidation = {
        target: "targeting",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(/Select at least one value or enter text/);
    });

    it("accepts when only text is provided", () => {
      const draft: ModifierDraftForValidation = {
        target: "targeting",
        targetValues: [],
        freeTextNarrowFocus: "Spike on Touch",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts when only checklist is provided", () => {
      const draft: ModifierDraftForValidation = {
        target: "targeting",
        targetValues: ["Cone"],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });
  });

  describe("widget: none (no validation)", () => {
    it("accepts max_vitality regardless of values", () => {
      const draft: ModifierDraftForValidation = {
        target: "max_vitality",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("requires action_roll to have at least one sub-target (i2.0 + i2.7 free-text)", () => {
      // Phase 8.I i2.0: action_roll has 5 sub-targets.
      // Phase 8.I i2.7: widget became checklist-with-free-text.
      const draft: ModifierDraftForValidation = {
        target: "action_roll",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toMatch(
        /Select at least one value or enter text for "Action Roll"/,
      );
    });

    it("accepts action_roll with at least one sub-target (i2.0)", () => {
      const draft: ModifierDraftForValidation = {
        target: "action_roll",
        targetValues: ["ATTACK_ROLL"],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts proficiency_bonus with no values", () => {
      const draft: ModifierDraftForValidation = {
        target: "proficiency_bonus",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts item_slot_cost with no values", () => {
      const draft: ModifierDraftForValidation = {
        target: "item_slot_cost",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });

    it("accepts damage_healing_output with no values", () => {
      const draft: ModifierDraftForValidation = {
        target: "damage_healing_output",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });
  });

  describe("unknown target (backward compat)", () => {
    it("returns null — let server-side handler reject", () => {
      const draft: ModifierDraftForValidation = {
        target: "some_legacy_dotted_string",
        targetValues: [],
        freeTextNarrowFocus: "",
      };
      expect(validateModifierDraft(draft)).toBeNull();
    });
  });
});

describe("validateBehaviorName (Phase 8.I i1, R3-Q3)", () => {
  it("rejects empty string", () => {
    expect(validateBehaviorName("")).toMatch(/required/);
    expect(validateBehaviorName("   ")).toMatch(/required/);
  });

  it("rejects names that don't start with a letter", () => {
    expect(validateBehaviorName("1block")).toMatch(/start with a letter/);
    expect(validateBehaviorName("-block")).toMatch(/start with a letter/);
  });

  it("rejects reserved engine keywords", () => {
    expect(validateBehaviorName("set")).toMatch(/reserved/);
    expect(validateBehaviorName("add")).toMatch(/reserved/);
    expect(validateBehaviorName("grant")).toMatch(/reserved/);
  });

  it("rejects reserved attribute/practice names", () => {
    expect(validateBehaviorName("physical")).toMatch(/reserved/);
    expect(validateBehaviorName("mental")).toMatch(/reserved/);
    expect(validateBehaviorName("fieldcraft")).toMatch(/reserved/);
  });

  it("accepts custom names", () => {
    expect(validateBehaviorName("blockValue")).toBeNull();
    expect(validateBehaviorName("darkvision")).toBeNull();
    expect(validateBehaviorName("mana_pool")).toBeNull();
  });
});

describe("normalizeBehaviorName (Phase 8.I i1, R3-Q3)", () => {
  it("lowercases camelCase", () => {
    expect(normalizeBehaviorName("blockValue")).toBe("blockvalue");
  });

  it("preserves kebab-case", () => {
    expect(normalizeBehaviorName("block-value")).toBe("block-value");
  });

  it("lowercases SCREAMING_SNAKE", () => {
    expect(normalizeBehaviorName("BLOCK_VALUE")).toBe("block_value");
  });

  it("strips dots", () => {
    expect(normalizeBehaviorName("block.value")).toBe("blockvalue");
  });

  it("strips spaces", () => {
    expect(normalizeBehaviorName("block value")).toBe("blockvalue");
  });

  it("strips special chars except - and _", () => {
    expect(normalizeBehaviorName("block!@#value")).toBe("blockvalue");
    expect(normalizeBehaviorName("block*value")).toBe("blockvalue");
  });
});

describe("validateModifierDrafts (multi-modifier loop)", () => {
  it("returns null when all modifiers are valid", () => {
    const drafts: ModifierDraftForValidation[] = [
      { target: "attribute", targetValues: ["PHYSICAL"], freeTextNarrowFocus: "" },
      { target: "max_vitality", targetValues: [], freeTextNarrowFocus: "" },
    ];
    expect(validateModifierDrafts(drafts)).toBeNull();
  });

  it("returns the first invalid modifier with index", () => {
    // Phase 8.I i2.0 (Mashu 2026-08-05): defense_dc is now a single
    // global axis (no sub-targets), so a defense_dc modifier with
    // empty targetValues is valid. We use skill_practice_check
    // (which DOES require sub-targets) as the invalid one.
    const drafts: ModifierDraftForValidation[] = [
      { target: "attribute", targetValues: ["PHYSICAL"], freeTextNarrowFocus: "" },
      { target: "defense_dc", targetValues: [], freeTextNarrowFocus: "" },
      { target: "skill_practice_check", targetValues: [], freeTextNarrowFocus: "" },
    ];
    const err = validateModifierDrafts(drafts);
    expect(err).toMatch(/Modifier 3: Select at least one value for "Skill \/ Practice Check"/);
  });

  it("returns null for empty array", () => {
    expect(validateModifierDrafts([])).toBeNull();
  });
});

describe("isModifierValid (cheap boolean)", () => {
  it("returns true for valid modifier", () => {
    const draft: ModifierDraftForValidation = {
      target: "attribute",
      targetValues: ["PHYSICAL"],
      freeTextNarrowFocus: "",
    };
    expect(isModifierValid(draft)).toBe(true);
  });

  it("returns false for invalid modifier", () => {
    const draft: ModifierDraftForValidation = {
      target: "attribute",
      targetValues: [],
      freeTextNarrowFocus: "",
    };
    expect(isModifierValid(draft)).toBe(false);
  });
});
