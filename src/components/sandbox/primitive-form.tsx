"use client";
import { describePrimitiveDraft } from "@/lib/primitives/describe-draft";

// PrimitiveForm: controlled form-only composer.
// Receives optional initial state (for ?edit= pre-fill).
// Fires onStateChange on every keystroke so the parent can render a live preview.
// Save logic lives here so the form remains a self-contained save unit.
//
// The library list, live preview sidebar, and saved-records grid are NOT in this
// component. They live in the SandboxLayout columns owned by the page.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ModifierOperation,
  ModifierStackingMode,
} from "@/types/swordweave";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";
import type { PrimitiveFormState } from "./primitive-form-preview";
import { AuthorPublishFields } from "./author-publish-fields";
import { saveIntentLabel } from "@/lib/publishing/save-intent";
import { computePrimitiveContentHash } from "@/lib/publishing/hash-content";
import { legacyFieldsFromAuthoring } from "./condition-picker";
import type { ConditionAuthoring } from "@/types/condition";
import { buildCondition } from "@/lib/primitives/condition";
import {
  MODIFIER_TARGET_SPEC,
  MODIFIER_TARGETS,
  type ModifierTarget,
  type SkillPracticeGranularity,
  selectionForModifier,
  scopeForSelection,
} from "@/lib/primitives/modifier-scope";
import { validateModifierDrafts } from "@/lib/primitives/modifier-validator";
import {
  parseValueField,
  type Operand,
  type ValueToken,
  type ValueType,
} from "@/types/modifier";
import { classifyTypedValue } from "@/lib/primitives/form-helpers";
import {
  tokenKindToValueKind,
  operandsToTokens,
  serializeToken,
  serializeFirstToken,
  serializeOperandsAsExpression,
} from "@/lib/primitives/modifier-translator";
import { conditionToAuthoring } from "@/lib/primitives/condition";
import {
  mechanicalDescriptionFromModifiers,
  renderMechanicalRule,
  type AuthorableCompositionFamily,
  type CanonicalMechanicalRule,
} from "@/lib/primitives/mechanical-rule";
import { MARKET_FAMILIES } from "@/lib/primitives/canonical-market";
import { AuthorChapter, AuthorChapters } from "./author-chapters";
import { PrimitiveRuleInstrument } from "./primitive-rule-instrument";

type PrimitiveRow = {
  id: number;
  userId?: string | null;
  name: string;
  category: string;
  familyKey?: string | null;
  isPublic: boolean;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  mechanicalRule?: unknown;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: unknown;
  consequenceBehavior?:
    import("@/lib/character/consequences/types").ConsequenceBehavior | null;
  // Phase 8: per-entity iconography. The form's blankForm always sets
  // these with defaults; the optional flag here matches the
  // grammar-sandbox-client's `PrimitiveRow` so the two can be assigned
  // across files without TypeScript treating them as different types.
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
  /** Public-identity column (Phase 3 / migration 0020). */
  sourceOrigin: string | null;
  /** Free-form tags (comma-separated display in the form; array in the DB). */
  tags: string[];
};

type RuleKind = "MODIFIER" | AuthorableCompositionFamily | null;
type CompositionDraft = {
  family: AuthorableCompositionFamily;
  operation: "grant" | "revoke";
  recipient: "SELF" | "TARGET";
  value: string;
  tier: "Tier I" | "Tier II" | "Tier III" | "Tier IV";
};
const compositionOptions: ReadonlyArray<{
  value: AuthorableCompositionFamily;
  label: string;
  help: string;
  presets: readonly string[];
}> = [
  {
    value: "DOMAIN_ACCESS",
    label: "Domain access",
    help: "Choose the domain vocabulary this primitive unlocks and how advanced that access is.",
    presets: [],
  },
  {
    value: "VERB_ACCESS",
    label: "Verb access",
    help: "Choose the verb tier this primitive unlocks. Higher tiers permit broader and more reality-changing actions.",
    presets: [],
  },
  {
    value: "STRUCTURE",
    label: "Structure",
    help: "Structure describes how a capability is assembled or spreads. It does not decide who it targets or how far it reaches.",
    presets: ["Single point", "Linked", "Chain", "Aura", "Zone", "Wall"],
  },
  {
    value: "RANGE",
    label: "Range",
    help: "Range is the maximum distance from the user or origin to the chosen target. Pick the nearest band that covers the intended use.",
    presets: [
      "Touch",
      "Close (10 ft)",
      "Near (30 ft)",
      "Far (60 ft)",
      "Very Far (120 ft)",
      "Extreme (240 ft–3 miles)",
    ],
  },
  {
    value: "TARGETING",
    label: "Targeting",
    help: "Targeting says who or what can be affected and the selection pattern. Geometry and number of targets belong here.",
    presets: [
      "Self",
      "One target",
      "Multiple targets",
      "Area",
      "Cone",
      "Line",
      "Sphere",
      "Zone",
    ],
  },
  {
    value: "DICE",
    label: "Output die",
    help: "The output die is the die size used for damage or healing. The number of dice is scaled separately when a capability is built.",
    presets: ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"],
  },
  {
    value: "DURATION",
    label: "Duration",
    help: "Duration says how long the result remains active after it is created. Use Instant when nothing persists beyond resolution.",
    presets: [
      "Instant",
      "Short",
      "Medium",
      "Long",
      "Scene",
      "Persistent",
      "Permanent",
    ],
  },
];
const compositionBindingKey: Record<AuthorableCompositionFamily, string> = {
  DOMAIN_ACCESS: "domain",
  VERB_ACCESS: "tier",
  STRUCTURE: "structure",
  RANGE: "range",
  TARGETING: "targeting",
  DICE: "dice",
  DURATION: "duration",
};
const blankComposition: CompositionDraft = {
  family: "DOMAIN_ACCESS",
  operation: "grant",
  recipient: "SELF",
  value: "",
  tier: "Tier I",
};
function toCompositionRule(draft: CompositionDraft): CanonicalMechanicalRule {
  const accessRule =
    draft.family === "DOMAIN_ACCESS" || draft.family === "VERB_ACCESS";
  const bindings: Record<string, string> =
    draft.family === "DOMAIN_ACCESS"
      ? { domain: draft.value.trim(), tier: draft.tier }
      : {
          [compositionBindingKey[draft.family]]:
            draft.family === "VERB_ACCESS" ? draft.tier : draft.value.trim(),
        };
  return {
    family: draft.family,
    ...(accessRule
      ? { operation: draft.operation, recipient: draft.recipient }
      : {}),
    bindings,
  };
}
function compositionFromStoredRule(input: unknown): CompositionDraft | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const rule = input as Record<string, unknown>;
  if (!compositionOptions.some((option) => option.value === rule["family"]))
    return null;
  const family = rule["family"] as AuthorableCompositionFamily;
  const bindings =
    rule["bindings"] &&
    typeof rule["bindings"] === "object" &&
    !Array.isArray(rule["bindings"])
      ? (rule["bindings"] as Record<string, unknown>)
      : {};
  const rawTier = String(bindings["tier"] ?? "Tier I");
  const tier =
    (["Tier I", "Tier II", "Tier III", "Tier IV"] as const).find(
      (item) => item === rawTier,
    ) ?? "Tier I";
  return {
    family,
    operation: rule["operation"] === "revoke" ? "revoke" : "grant",
    recipient: rule["recipient"] === "TARGET" ? "TARGET" : "SELF",
    value:
      family === "VERB_ACCESS"
        ? ""
        : String(bindings[compositionBindingKey[family]] ?? ""),
    tier,
  };
}

export type ModifierDraft = {
  id: string;
  // Phase-7-E: target is the canonical short axis label
  // (e.g. "attribute", "defense_dc", "skill_practice_check").
  // The legacy dotted strings (e.g. "character.attribute.physical")
  // are still understood via selectionForModifier for backward
  // compatibility when loading older rows.
  target: ModifierTarget | string;
  operation: ModifierOperation;
  recipient: "SELF" | "TARGET" | "SCENE";
  // Phase 7.5: Value field is a token chip-stack. New writes
  // emit `tokens: ValueToken[]` via the serializer. The legacy
  // `value: string` field below is a derived cache populated
  // whenever `tokens` changes — kept so the existing
  // toHardModifier path and JSON preview keep working without
  // surgery. On load, parseValueField auto-coerces legacy rows
  // into tokens.
  tokens: ValueToken[];
  value: string;
  /**
   * Phase 7.5 v2: Value Type is now dynamic per op. The form's
   * Value Type select shows only the allowed types for the
   * current op. Stored as the canonical `ValueType` string
   * from `OP_VALUE_TYPE_MATRIX`.
   */
  valueKind: ValueType;
  /**
   * Phase 7.5 v4: operands — used when valueKind === "equation".
   * An equation is a list of (operator, value) pairs that
   * compose into an arithmetic expression. For non-equation
   * modes, this is empty and the legacy `tokens` field is used.
   *
   * Coexistence with tokens: the data shape is additive —
   * legacy rows have tokens but no operands; new equation
   * rows have operands but no tokens. The resolver converts
   * between them at the boundary.
   */
  operands: Operand[];
  // Phase-7-E: Target Value(s) for this modifier — multi-select on
  // the scope axis implied by `target`. Empty = "any".
  targetValues: string[];
  // Phase-7-E/UX2-r3: the granular broad/narrow split is gone
  // from this form. Practice is a single-select checklist; if a
  // user wants a narrow focus like "Awareness (Smell)" they
  // enter it in the Condition field below, not in the Practice
  // widget.
  //
  // `granularity` stays as `SkillPracticeGranularity` for
  // backward compatibility with existing serialized modifiers
  // (some primitives carry metadata.granularity = "narrow"). New
  // writes always set it to "broad" — the field is effectively
  // dead in the UI but kept in the data shape so older saves
  // round-trip without surprises.
  granularity: SkillPracticeGranularity;
  // Free-text narrow focus for the modifier (UX2-r3 moved here
  // from the old skill_practice_check / narrow pathway). Saves
  // raw text; the Condition triple below is where the user's
  // intent actually lives.
  freeTextNarrowFocus: string;
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal"
    | "includes"
    | "exists";
  conditionValue: string;
  stacking: ModifierStackingMode;
  // Phase-7-Q-B: canonical Condition v1 authoring state. Drives
  // the new ConditionPicker. The legacy conditionKey/Operator/Value
  // fields above are kept in sync via legacyFieldsFromAuthoring()
  // for round-trip compatibility with old toHardModifier paths.
  v1Condition: ConditionAuthoring;
};

// Phase 8.I i2.5e (Mashu 2026-08-05): synced to the canonical enum
// in src/db/schema/enums.ts. Previously the form only had 11 of the
// ~35 enum values, missing KINETIC_CONTROL, ACTION_ECONOMY,
// METAMORPHOSIS, SENSORY_ARRAY, EVALUATION_STRAIN, etc. Also had
// stale "DEFENSE" (renamed to "DEFENSIVE") and "OUTPUT" (no longer
// a valid category). Now mirrors the enum exactly.
const categories = [
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
  "SPEED_QUICKENING",
  "TACTICAL",
  "VITALITY",
  "SHEET_AUGMENT",
  "HERITAGE_AUGMENT",
  "BACKGROUND_AUGMENT",
  "CHARACTER_SHEET_AUGMENT",
  "PRACTICE_PROGRESSION_AUGMENT",
  "ITEM_AUGMENT",
] as const;

const categoryGroups = [
  ...new Set(MARKET_FAMILIES.map((family) => family.chapter)),
].map((chapter) => ({
  label: chapter,
  options: MARKET_FAMILIES.filter((family) => family.chapter === chapter).map(
    (family) => ({ value: family.key, label: family.label }),
  ),
}));

function CategoryOptions() {
  return categoryGroups.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </optgroup>
  ));
}

function familyForCategory(category: string) {
  return MARKET_FAMILIES.find((family) => family.categories.includes(category));
}

const costTiers = [
  "Tier 1: Minor (4 BU anchor)",
  "Tier 2: Standard (8 BU anchor)",
  "Tier 3: Major (12 BU anchor)",
  "Tier 4: Core Axis (16 BU anchor)",
  "Tier 5: Narrative Layer (32+ BU anchor)",
] as const;

// Phase-7-Q-B: the legacy `conditionOperators` list (the 8-operator
// dropdown) is gone. The ConditionPicker does not expose the
// operator — the picker maps a preset chip to a baseline mechanic,
// and the narrative/tags paths are display-only. The legacy
// `conditionKey / conditionOperator / conditionValue` fields on
// ModifierDraft remain as a transitional cache so the existing
// toHardModifier path keeps working without a separate code path.

const blankModifier: ModifierDraft = {
  id: "modifier-1",
  target: "attribute",
  operation: "add",
  recipient: "SELF",
  // Phase 7.5: tokens is the primary value storage. `value`
  // below is a derived cache (the first token's serialized form)
  // kept for backwards compat with the toHardModifier path and
  // the JSON preview.
  tokens: [{ kind: "number", value: 1 }],
  value: "1",
  valueKind: "number",
  // Phase 7.5 v4: empty operands. New equation rows populate
  // this; legacy rows have empty operands.
  operands: [],
  // Phase-7-E: defaults for the new Target Value widget. With
  // target=attribute and an empty values list, the form will
  // surface "any attribute (broad)" until the user checks one.
  targetValues: [],
  granularity: "broad",
  freeTextNarrowFocus: "",
  conditionMode: "always",
  conditionKey: "",
  conditionOperator: "equals",
  conditionValue: "",
  stacking: "stack",
  // Phase-7-Q-B: empty Condition v1 authoring state. Picker
  // starts collapsed with Target state open by default.
  v1Condition: {
    categories: [],
    pills: [],
    operators: [],
    narrative: "",
    includeTags: false,
  },
};

const blankForm: PrimitiveFormState = {
  name: "",
  category: "VERB_TIER",
  isPublic: false,
  costTier: "Tier 1: Minor (4 BU anchor)",
  buCost: "1",
  mechanicalOutputText: "",
  narrativeRule: "",
  isMirrorable: false,
  mirrorVector: "STANDARD_ONLY",
  mirrorBuCredit: "0",
  mirrorEligibilityNotes: "",
  // Phase 8: per-entity iconography
  sourceOrigin: "",
  tags: "",
  iconSource: null,
  iconKey: null,
  iconUrl: null,
  iconColor: "#ffffff",
};

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function toModifierDraft(
  modifier: ModifierDraft,
  index: number,
): ModifierDraft {
  return { ...modifier, id: `modifier-${index + 1}` };
}

function isHardModifierLike(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["kind"] === "modify"
  );
}

/**
 * Phase 8.I i2.5: detect a typed ValueToken object in a stored
 * HardModifier.value. Mirrors @/types/modifier isTokenLike.
 */
function isTypedTokenShape(v: unknown): boolean {
  if (v === null || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj["kind"] !== "string") return false;
  return [
    "number",
    "derived",
    "attribute",
    "practice",
    "behavior",
    "dice",
    "keyword",
    "runtime",
  ].includes(obj["kind"]);
}

/**
 * Phase 8.I i2.5: convert a typed token back to its canonical
 * display string for the cached `value` field. The user sees
 * this in the form\'s value input.
 */
function typedTokenToDisplayString(token: Record<string, unknown>): string {
  switch (token["kind"]) {
    case "derived":
      return String(token["which"] ?? "");
    case "attribute":
      return String(token["attribute"] ?? "");
    case "practice":
      return String(token["practice"] ?? "");
    case "behavior":
      return String(token["name"] ?? "");
    case "dice":
      return String(token["expression"] ?? "");
    case "number":
      return String(token["value"] ?? "0");
    case "keyword":
      // Phase 8.L round 131 (Mashu): read text OR value.
      return `[${String(token["text"] ?? token["value"] ?? "")}]`;
    case "runtime":
      return `/${String(token["name"] ?? "")}/`;
    default:
      return "";
  }
}

function fromHardModifier(
  modifier: Record<string, unknown>,
  index: number,
): ModifierDraft {
  const rawValue = modifier["value"];
  const rawMeta = modifier["metadata"];
  const meta =
    rawMeta && typeof rawMeta === "object"
      ? (rawMeta as Record<string, unknown>)
      : null;
  const operandsRaw = meta?.["operands"];

  // Phase 8.I i2.5h (Mashu 2026-08-06): tokens is the SOURCE OF
  // TRUTH for the chip stack. The cached `value` and `valueKind`
  // are DERIVED from tokens — never the other way around.
  let tokens: ReturnType<typeof parseValueField>;
  let valueKind: ModifierDraft["valueKind"] = "number";
  let value = "";
  let operands: ModifierDraft["operands"] = [];

  if (Array.isArray(operandsRaw) && operandsRaw.length > 0) {
    // Equation mode: operands live in metadata.operands.
    // The chip stack shows the FLATTENED operands.
    const opArr = operandsRaw as unknown as Operand[];
    tokens = operandsToTokens(opArr);
    valueKind = "equation";
    value = serializeOperandsAsExpression(opArr);
    operands = opArr;
  } else if (isTypedTokenShape(rawValue)) {
    // Typed token — chips come from parseValueField; valueKind
    // comes from the token's kind (not a hardcoded "number").
    tokens = parseValueField(rawValue);
    const first = tokens[0];
    valueKind = first ? tokenKindToValueKind(first.kind) : "number";
    value = serializeFirstToken(tokens);
  } else if (typeof rawValue === "boolean") {
    // Boolean stored as plain boolean — keep backwards compat.
    valueKind = "boolean";
    value = rawValue ? "true" : "false";
    tokens = [{ kind: "behavior", name: value }];
  } else if (typeof rawValue === "number") {
    valueKind = "number";
    value = String(rawValue);
    tokens = [{ kind: "number", value: rawValue }];
  } else if (typeof rawValue === "string") {
    // Plain string: classify via classifyTypedValue. Falls through
    // to a behavior token if unrecognized.
    tokens = parseValueField(rawValue);
    const first = tokens[0];
    valueKind = first ? tokenKindToValueKind(first.kind) : "text";
    value = first ? serializeToken(first) : rawValue;
  } else {
    // null / undefined / unknown — empty chip stack.
    tokens = [];
    valueKind = "number";
    value = "";
  }

  // Defensive: ensure tokens is never undefined.
  tokens = tokens ?? [];

  const condition = modifier["condition"];
  const cond =
    condition && typeof condition === "object"
      ? (condition as Record<string, unknown>)
      : null;
  const condRawValue = cond?.["value"];
  const condValue =
    condRawValue === undefined || condRawValue === null
      ? ""
      : typeof condRawValue === "string"
        ? condRawValue
        : String(condRawValue);

  // Phase-7-E: ask the helper which target + scope this modifier
  // corresponds to. selectionForModifier handles both new short-label
  // rows (with metadata.targetScope) and legacy dotted-target rows
  // (no metadata) — so old saves load into the new form unchanged.
  const selection = selectionForModifier({
    target:
      typeof modifier["target"] === "string"
        ? (modifier["target"] as string)
        : null,
    metadata:
      modifier["metadata"] && typeof modifier["metadata"] === "object"
        ? (modifier["metadata"] as Record<string, unknown>)
        : null,
  });

  // Phase 8.I i2.5c (Mashu 2026-08-05): selectionForModifier
  // doesn't handle free-text targets (behavior, strain, scene_pace).
  // The behavior name lives in metadata.behaviorName OR
  // metadata.scopeName. Read it here and inject into
  // freeTextNarrowFocus so the form's free-text input repopulates.
  let freeTextValue = selection.freeTextNarrowFocus ?? "";
  const mdObj = meta;
  const isFreeTextTarget = (() => {
    const t = selection.target;
    if (typeof t !== "string") return false;
    const spec = MODIFIER_TARGET_SPEC[t as ModifierTarget];
    return (
      spec?.widget === "free-text" ||
      spec?.widget === "checklist-with-free-text"
    );
  })();
  if (isFreeTextTarget && mdObj) {
    const bname = mdObj["behaviorName"];
    const sname = mdObj["scopeName"];
    if (typeof bname === "string" && bname.trim().length > 0) {
      freeTextValue = bname;
    } else if (typeof sname === "string" && sname.trim().length > 0) {
      freeTextValue = sname;
    }
  }

  return {
    id: `modifier-${index + 1}`,
    target: selection.target,
    operation: String(modifier["operation"] ?? "add") as ModifierOperation,
    recipient: String(
      meta?.["recipient"] ?? "SELF",
    ).toUpperCase() as ModifierDraft["recipient"],
    // Phase 8.I i2.5h: tokens + operands were already populated
    // above based on the metadata.operands check. Use those
    // directly. Don't re-parse — that would lose info.
    tokens,
    operands,
    value,
    valueKind,
    targetValues: [...selection.targetValues],
    granularity: "broad",
    freeTextNarrowFocus: freeTextValue,
    conditionMode: cond ? "custom" : "always",
    conditionKey: String(cond?.["key"] ?? ""),
    conditionOperator: String(
      cond?.["operator"] ?? "equals",
    ) as ModifierDraft["conditionOperator"],
    conditionValue: condValue,
    stacking: String(modifier["stacking"] ?? "stack") as ModifierStackingMode,
    // Phase 8.I i2.5h-fix (Mashu 2026-08-06): use the new
    // conditionToAuthoring() that reads the v1 condition shape
    // directly ({kind, customTags, presetKey, tokens, text}).
    // The previous legacy-only loader lost any condition saved
    // through the new picker — pills were dropped, leaving
    // only narrative text in the picker.
    v1Condition: conditionToAuthoring(cond),
  };
}

/**
 * Phase 8.I i2.5 (Mashu 2026-08-05): parseValue now writes typed
 * tokens to `value` instead of dropping non-numeric inputs to 0.
 *
 * The form's classifyTypedValue() — see @/lib/primitives/form-helpers —
 * recognizes these token kinds in the value string:
 *   - number:    plain numeric (e.g. "5", "-2", "1.5")
 *   - derived:   PB / PB/2 / LEVEL (auto-resolved at runtime)
 *   - attribute: physical / mental / magical (auto-resolved)
 *   - practice:  awareness / fieldcraft / etc. (auto-resolved)
 *   - behavior:  blockValue / darkvision / etc. (custom var)
 *   - keyword:   [fire] / [piercing] (tag-style)
 *   - dice:      #2d6+3# (rolled at runtime)
 *
 * Plain numeric values stay as-is (backwards compat). Boolean values
 * stay as-is. Anything else falls back to the raw string (legacy
 * behavior for unknown types).
 *
 * The engine's runtime-resolver (Phase 8.I i2.5) reads the typed
 * token from `value` and resolves it against character state at
 * evaluation time. Tagged keywords ([fire]) resolve to 0 (no
 * numeric contribution) but the tag itself carries through to
 * the ModifierContribution.
 */
function parseValue(
  value: string,
  valueKind: ModifierDraft["valueKind"],
): unknown {
  // Phase 8.I i2.5h (Mashu 2026-08-06): the form's primary
  // value storage is `tokens: ValueToken[]`. The cached `value`
  // string is a derived display cache, kept in sync with the
  // first token via serializeValueField on every change.
  //
  // parseValue() runs only at SAVE time to translate the cached
  // string into the stored HardModifier.value. We must NEVER
  // return 0 just because the string is empty — an empty string
  // means the chip stack is the source of truth, not 0.
  //
  // Phase 8.I i2.5h-fix: return the empty marker so toHardModifier
  // can fall back to the chips.
  if (valueKind === "boolean") {
    return value === "true";
  }
  const trimmed = String(value ?? "").trim();
  if (trimmed.length === 0) {
    // Empty cached value → toHardModifier should fall back to
    // the first token. We return null to signal this.
    return null;
  }
  const result = classifyTypedValue(trimmed, "add", valueKind);
  if (result.token) {
    return result.token;
  }
  // classifyTypedValue returned null → unrecognized input.
  // For number mode try numeric coercion; otherwise return null
  // so toHardModifier falls back to the chips.
  if (valueKind === "number") {
    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
  // Last resort: return the raw string (for text/dice modes
  // where unrecognized input should round-trip literally).
  return value;
}

function toHardModifier(
  modifier: ModifierDraft,
): import("@/types/swordweave").HardModifier {
  // Phase 8.I i2.5h (Mashu 2026-08-06): the stored value is
  // derived from the chip stack (tokens), not from re-parsing
  // the cached `value` string. The previous implementation called
  // parseValue(value, valueKind) which produced wrong tokens
  // whenever the cached string was empty (equation mode default)
  // or didn't round-trip cleanly (keyword/runtime tokens stored
  // with valueKind="number").
  //
  // For equation mode: stored value = first operand's value.
  // For simple mode: stored value = first token (the typed
  // token object). parseValue is now a FALLBACK only.
  // Phase 8.I i2.7d (Mashu 2026-08-06): equation mode now
  // stores the FULL operands array. Previously it stored only
  // operands[0].value, losing the rest of the expression and
  // breaking math like 2*pb. HardModifier.value accepts
  // JsonValue (including arrays) so persisting Operand[] is
  // type-safe.
  let baseValue: unknown = null;
  if (modifier.valueKind === "equation") {
    // Equation mode: stored value = full operands array
    // (single-operand equations store a length-1 array).
    baseValue = modifier.operands.length > 0 ? modifier.operands : 0;
  } else if (modifier.tokens.length > 0) {
    // Simple mode: stored value is the first token (typed object).
    baseValue = modifier.tokens[0] ?? 0;
  } else {
    // Fallback: re-parse the cached string.
    baseValue = parseValue(modifier.value, modifier.valueKind);
    if (baseValue === null) {
      // No tokens and no cached value — use a default for the kind.
      if (modifier.valueKind === "text") baseValue = "";
      else if (modifier.valueKind === "boolean") baseValue = false;
      else baseValue = 0;
    }
  }

  // Phase-7-E: write the canonical short axis + metadata.targetScope.
  // If the form somehow still holds a legacy dotted target (only
  // possible if the DB had one before this version), scopeForSelection
  // will throw a type error — we coerce back to a recognized axis by
  // routing through selectionForModifier at load time. for the write
  // path, the form only ever produces short labels so this is the
  // canonical happy path.
  const target = String(modifier.target);
  const targetForScope: ModifierTarget = (
    MODIFIER_TARGETS as readonly string[]
  ).includes(target)
      ? (target as ModifierTarget)
      : "action_roll";
  const { target: canonicalTarget, metadata: scopeMetadata } =
    scopeForSelection({
    target: targetForScope,
    targetValues: modifier.targetValues,
    // Phase-7-E/UX2-r3: skill_practice_check no longer has a
    // granularity knob. We always pass null; the conditional
    // is preserved here for backwards compatibility with the
    // helper signature, but the form doesn't expose a knob.
    granularity: null,
    freeTextNarrowFocus: modifier.freeTextNarrowFocus,
  });

  // Phase 8.I i2.5c (Mashu 2026-08-05): free-text targets
  // (behavior, strain, scene_pace, etc.) need the user-typed
  // name persisted to metadata. scopeForSelection() only handles
  // the targetScope axis — it drops freeTextNarrowFocus. We
  // write the behaviorName (or scopeName for non-behavior
  // free-text targets) here so the engine + load path can
  // recover it.
  const specForTarget = MODIFIER_TARGET_SPEC[canonicalTarget];
  const isFreeTextTarget =
    specForTarget?.widget === "free-text" ||
    specForTarget?.widget === "checklist-with-free-text";
  const freeTextValue = (modifier.freeTextNarrowFocus ?? "").trim();

  const hardModifier: import("@/types/swordweave").HardModifier = {
    kind: "modify" as const,
    target: canonicalTarget,
    operation: modifier.operation,
    value: baseValue as import("@/types/swordweave").JsonValue,
    stacking: modifier.stacking,
    metadata: {
      targetScope: scopeMetadata.targetScope,
      recipient: modifier.recipient,
      ...(scopeMetadata.granularity
        ? { granularity: scopeMetadata.granularity }
        : {}),
      // Persist the free-text name. For behavior target this
      // is the behavior variable name (e.g. "blockValue"). For
      // strain / scene_pace / duration it's the descriptive
      // key (e.g. "physical_pain", "round").
      ...(isFreeTextTarget && freeTextValue.length > 0
        ? {
            behaviorName: freeTextValue,
            scopeName: freeTextValue,
          }
        : {}),
    } as unknown as Record<string, import("@/types/swordweave").JsonValue>,
  };

  // Phase 7.5 v4: if valueKind is "equation", serialize the
  // operands into metadata so the engine has the full
  // expression. We also keep the legacy `value` as a derived
  // cache (e.g. first operand's number) for backwards compat
  // with older readers.
  if (modifier.valueKind === "equation" && modifier.operands.length > 0) {
    const meta = hardModifier.metadata as Record<
      string,
      import("@/types/swordweave").JsonValue
    >;
    meta["operands"] =
      modifier.operands as unknown as import("@/types/swordweave").JsonValue;
    meta["valueKind"] = "equation";
  }

  // Phase-7-Q-B: write the canonical v1 condition shape via
  // buildCondition(). Reads from `v1Condition` (the picker's
  // authoritative state) and ignores the legacy conditionKey/Operator/
  // Value cache. If v1Condition is empty, the resulting condition
  // is null and `condition` is omitted.
  const v1Condition = buildCondition(modifier.v1Condition);
  if (v1Condition) {
    return { ...hardModifier, condition: v1Condition };
  }

  return hardModifier;
}

export function PrimitiveForm({
  initialPrimitive,
  saveRequest = fetch,
  intent,
  sourceId,
  initialCategory,
  onStateChange,
  onSaved,
  onReset,
  /**
   * Phase 9.4 (Mashu 2026-09-07): pre-load the form with these
   * modifier drafts (used by the Promote tab to add a default
   * modifier like "when X then +Y" derived from the promoted
   * runtime condition). Each draft becomes a real row in the
   * modifier list — the user can edit / remove it before
   * saving. Empty array = no pre-loaded modifiers.
   *
   * `id` fields are regenerated by the form's modifierCounter
   * on mount, so callers can pass any string; the form replaces
   * them deterministically.
   */
  initialModifierDrafts,
}: {
  /**
   * If provided, the form opens pre-loaded with this primitive for editing.
   */
  saveRequest?: typeof fetch;
  characterId?: string;
  initialPrimitive?: PrimitiveRow | null;
  /** Category preselected by a contextual Library create action. */
  initialCategory?: string | null;
  /**
   * Phase 1 (round 6 of edit-creates-fork): the save-intent flag
   * from ?intent=fork|load. Threads into the save body so the
   * server can dispatch correctly. See §6.7 of the design doc.
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 1: the source entity's id from ?edit=<id>. Sent to the
   * server with the save body so dispatch-save.ts can look up the
   * row and decide fork-vs-version-update.
   */
  sourceId?: string | number | null;
  /**
   * Fires whenever the form or modifiers change. Used by the page to drive
   * the live Preview column.
   */
  onStateChange?: (state: {
    form: PrimitiveFormState;
    modifiers: ModifierDraft[];
    hardModifiers: unknown[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     * Page uses this to decide whether to show the unsaved-changes modal on
     * build-mode or library-row switches.
     */
    isDirty: boolean;
  }) => void;
  /**
   * Fires when the user clicks the Reset button. The parent uses this to
   * clear the Preview pane (set editing = null) so Reset returns the user
   * to the empty-form / empty-preview state.
   */
  onReset?: () => void;
  /**
   * Fires after a successful save. Used by the page to refresh the Library
   * table without re-mounting the form.
   */
  onSaved?: (primitive: PrimitiveRow & { dispatchOutcome?: unknown }) => void;
  /**
   * Phase 9.4 (Mashu 2026-09-07): pre-loaded modifier drafts.
   * The form's existing initialPrimitive.hard_modifiers path
   * still works; this is an additive entry point used by
   * character-sheet callers (EmbeddedPrimitiveForm) that want
   * to inject one or more draft rows without rebuilding a full
   * PrimitiveRow payload.
   */
  initialModifierDrafts?: ReadonlyArray<Partial<ModifierDraft>> | null;
}) {
  const contextualBlankForm = useMemo<PrimitiveFormState>(() => {
    const family = initialCategory
      ? MARKET_FAMILIES.find((item) => item.key === initialCategory)
      : undefined;
    return {
      ...blankForm,
      category: family?.categories[0] ?? initialCategory ?? blankForm.category,
    };
  }, [initialCategory]);
  const [form, setForm] = useState<PrimitiveFormState>(
    () => contextualBlankForm,
  );
  const [familyKey, setFamilyKey] = useState(() => {
    const contextual = initialCategory
      ? MARKET_FAMILIES.find((family) => family.key === initialCategory)
      : undefined;
    return (
      contextual?.key ??
      familyForCategory(contextualBlankForm.category)?.key ??
      MARKET_FAMILIES[0]!.key
    );
  });
  const [ruleKind, setRuleKind] = useState<RuleKind>(null);
  const [composition, setComposition] =
    useState<CompositionDraft>(blankComposition);
  const [modifierCounter, setModifierCounter] = useState(1);
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [message, setMessage] = useState("");
  // Local pending flag — independent of useTransition. The previous
  // implementation wrapped the save flow in startTransition() which
  // kept the button stuck on "Saving..." because router.refresh()
  // inside the transition triggered a Suspense-driven re-render that
  // held the transition open indefinitely. Tracking our own flag
  // decouples the button label from Next.js's navigation transitions
  // and lets us toggle it synchronously when the fetch resolves.
  const [isSaving, setIsSaving] = useState(false);
  // Tracks unsaved edits. Flipped to true on the first user mutation after a
  // load/reset/save; flipped back to false by resetEditor() and after a
  // successful save (resetEditor runs there too).
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  // Pre-load from initialPrimitive — only on mount or when the user
  // loads a different primitive (id changes). Without the id check,
  // switching rows in the library would not refresh the form.
  const bootstrappedRef = useRef<number | null>(null);
  useEffect(() => {
    const id = initialPrimitive?.id ?? null;
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialPrimitive) return;
    const stored = Array.isArray(initialPrimitive.hardModifiers)
      ? (initialPrimitive.hardModifiers as unknown[]).filter(isHardModifierLike)
      : [];
    // Empty stored list = no modifiers. Don't pre-populate a blank one
    // (the user has actively chosen to have no modifiers).
    const drafts =
      stored.length > 0
        ? stored.map((m, i) =>
            fromHardModifier(m as Record<string, unknown>, i),
          )
        : [];
    const storedComposition = compositionFromStoredRule(
      initialPrimitive.mechanicalRule,
    );

    setForm({
      name: initialPrimitive.name,
      category: initialPrimitive.category,
      isPublic: initialPrimitive.isPublic,
      costTier: initialPrimitive.costTier,
      buCost: String(initialPrimitive.buCost),
      mechanicalOutputText: initialPrimitive.mechanicalOutputText,
      narrativeRule: initialPrimitive.narrativeRule,
      isMirrorable: initialPrimitive.isMirrorable,
      mirrorVector: initialPrimitive.mirrorVector,
      mirrorBuCredit: String(initialPrimitive.mirrorBuCredit),
      mirrorEligibilityNotes: initialPrimitive.mirrorEligibilityNotes,
      // Phase 8: per-entity iconography
      sourceOrigin: initialPrimitive.sourceOrigin ?? "",
      tags: initialPrimitive.tags?.join(", ") ?? "",
      iconSource: initialPrimitive.iconSource,
      iconKey: initialPrimitive.iconKey,
      iconUrl: initialPrimitive.iconUrl,
      iconColor: initialPrimitive.iconColor,
    });
    setFamilyKey(
      initialPrimitive.familyKey ??
        familyForCategory(initialPrimitive.category)?.key ??
        MARKET_FAMILIES[0]!.key,
    );
    setModifiers(drafts);
    setRuleKind(
      drafts.length ? "MODIFIER" : (storedComposition?.family ?? null),
    );
    setComposition(storedComposition ?? blankComposition);
    setModifierCounter(drafts.length);
    setIsDirty(false); // pristine after load
    // Only set the "Loaded…" welcome message on a true cold load. If
    // the bootstrap is re-running because the parent just swapped in a
    // new initialPrimitive after a successful fork save (Phase 1 round
    // 7), the submit handler already set a "Primitive saved to your
    // account." message — clobbering it with the welcome text was the
    // root cause of Mashu's "no saved-to-account feedback after fork"
    // bug. Treat any non-empty existing message as authoritative.
    setMessage((current) =>
      current
        ? current
        : initialPrimitive.userId
          ? "Loaded your primitive for editing."
          : "Loaded library primitive. Saving creates your private copy.",
    );
  }, [initialPrimitive]);

  const mechanicalRule = useMemo<CanonicalMechanicalRule>(
    () =>
      ruleKind && ruleKind !== "MODIFIER"
        ? toCompositionRule({ ...composition, family: ruleKind })
        : { family: "DESCRIPTIVE" },
    [composition, ruleKind],
  );
  const activeHardModifiers = useMemo(
    () => (ruleKind === "MODIFIER" ? modifiers.map(toHardModifier) : []),
    [modifiers, ruleKind],
  );
  const mechanicalSentence = useMemo(
    () =>
      mechanicalDescriptionFromModifiers(activeHardModifiers) ||
      (ruleKind &&
      ruleKind !== "MODIFIER" &&
      (ruleKind === "VERB_ACCESS" || composition.value.trim())
        ? renderMechanicalRule(mechanicalRule)
        : ""),
    [activeHardModifiers, composition.value, mechanicalRule, ruleKind],
  );

  // Fire onStateChange on every form/modifier change.
  useEffect(() => {
    onStateChange?.({
      form: { ...form, mechanicalOutputText: mechanicalSentence },
      modifiers,
      hardModifiers: activeHardModifiers,
      isDirty,
    });
  }, [
    form,
    modifiers,
    mechanicalSentence,
    activeHardModifiers,
    onStateChange,
    isDirty,
  ]);

  // Phase 9.4 (Mashu 2026-09-07): on first mount, if the caller
  // supplied initialModifierDrafts (e.g. the Promote tab in the
  // character sheet injected a default modifier derived from the
  // chosen runtime condition), seed the modifier list with them.
  // Runs once. The bootstrap ref pattern below prevents re-seeding
  // if the same caller re-renders the form with the same drafts.
  const draftsBootstrapRef = useRef(false);
  useEffect(() => {
    if (draftsBootstrapRef.current) return;
    if (
      !initialModifierDrafts ||
      !Array.isArray(initialModifierDrafts) ||
      initialModifierDrafts.length === 0
    ) {
      draftsBootstrapRef.current = true;
      return;
    }
    draftsBootstrapRef.current = true;
    const seeded: ModifierDraft[] = initialModifierDrafts.map((partial, i) => ({
        ...blankModifier,
        ...partial,
        // Regenerate the modifier id deterministically from the
        // index so React keys stay stable on re-mount of the
        // same caller.
        id: `seeded-modifier-${i + 1}`,
    }));
    setModifiers(seeded);
    setRuleKind("MODIFIER");
    setModifierCounter((c) => Math.max(c, seeded.length));
  }, [initialModifierDrafts]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  function updateForm(
    field: keyof PrimitiveFormState,
    value: string | boolean,
  ) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function patchModifier(id: string, patch: Partial<ModifierDraft>) {
    setIsDirty(true);
    setModifiers((current) =>
      current.map((modifier) =>
        modifier.id === id ? { ...modifier, ...patch } : modifier,
      ),
    );
  }

  function updateModifierOperation(id: string, operation: ModifierOperation) {
    setIsDirty(true);
    setModifiers((current) =>
      current.map((modifier) => {
      if (modifier.id !== id) return modifier;
        const valueKind: ValueType =
          operation === "grant" || operation === "revoke"
        ? "text"
        : modifier.target === "damage_healing_output"
          ? "dice"
          : modifier.valueKind === "equation"
            ? "equation"
            : "number";
      return { ...modifier, operation, valueKind };
      }),
    );
  }

  function updateModifierCondition(id: string, next: ConditionAuthoring) {
    const legacy = legacyFieldsFromAuthoring(next);
    setIsDirty(true);
    setModifiers((current) =>
      current.map((modifier) =>
        modifier.id === id
          ? {
      ...modifier,
      v1Condition: next,
      ...legacy,
  }
          : modifier,
      ),
    );
  }

  function removeModifier(id: string) {
    setIsDirty(true);
    setModifiers((current) => current.filter((modifier) => modifier.id !== id));
  }

  function resetEditor() {
    setForm(contextualBlankForm);
    setFamilyKey(
      familyForCategory(contextualBlankForm.category)?.key ??
        MARKET_FAMILIES[0]!.key,
    );
    setRuleKind(null);
    setComposition(blankComposition);
    setModifierCounter(1);
    setModifiers([]);
    setShowJsonPreview(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh primitive.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.(); // tell parent so Preview pane can clear too
  }

  function submitPrimitive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    // Phase 8.I i1 (Mashu 2026-08-04): validate sub-target selection
    // before any network round-trip. Attribute increment with no
    // sub-target should not contribute; we block the save here so
    // existing data with malformed modifiers stays untouched.
    const validationError =
      ruleKind === "MODIFIER"
        ? validateModifierDrafts(
      modifiers.map((m) => ({
        target: String(m.target),
        targetValues: m.targetValues,
        freeTextNarrowFocus: m.freeTextNarrowFocus,
      })),
          )
        : null;
    if (validationError) {
      setMessage(validationError);
      setIsSaving(false);
      return;
    }

    setIsSaving(true);

    // (Async save flow — previously wrapped in startTransition(), which
    // kept the Save button stuck on "Saving..." indefinitely because
    // router.refresh() inside the transition triggered a Suspense
    // re-render. We now toggle a local isSaving flag instead.)
    (async () => {
      // Phase 4: compute the content hash so the server can detect no-op saves.
      const draftHash = await computePrimitiveContentHash({
        name: form.name,
        category: form.category,
        costTier: form.costTier,
        buCost: form.buCost,
        mechanicalOutputText: mechanicalSentence,
        mechanicalRule,
        narrativeRule: form.narrativeRule,
        isPublic: form.isPublic,
        isMirrorable: form.isMirrorable,
        mirrorVector: form.mirrorVector,
        mirrorBuCredit: form.mirrorBuCredit,
        mirrorEligibilityNotes: form.mirrorEligibilityNotes,
        hardModifiers: activeHardModifiers,
        // Phase 8: per-entity iconography
        iconSource: form.iconSource,
        iconKey: form.iconKey,
        iconUrl: form.iconUrl,
        iconColor: form.iconColor,
      });

      let response: Response;
      let payload: unknown;
      try {
        response = await saveRequest("/api/primitives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Phase 1: thread the intent flag + sourceId into the body.
            // The server's dispatch-save.ts decides fork vs version-update
            // vs no-op based on these + draftHash. See §6.7 of the design doc.
            // (Legacy `id` field is still honored as a fallback by the
            // server for the brief window where forms haven't been
            // migrated; new code prefers intent + sourceId.)
            ...(intent ? { intent } : {}),
            ...(sourceId != null ? { sourceId } : {}),
            ...(initialPrimitive?.id != null && initialPrimitive?.userId
              ? { id: initialPrimitive.id }
              : {}),
            draftHash,
            ...form,
            familyKey,
            mechanicalOutputText: mechanicalSentence,
            mechanicalRule,
            // Phase 7 Q-M: auto-derive mirror_bu_credit = bu_cost when
            // mirrorable. The server enforces this anyway, but we send the
            // canonical value so the content hash matches what's stored.
            mirrorVector: form.isMirrorable
              ? form.mirrorVector
              : "STANDARD_ONLY",
            mirrorBuCredit: form.isMirrorable ? Number(form.buCost) || 0 : 0,
            hardModifiers: activeHardModifiers,
          }),
        });
        payload = await response.json();
      } catch (err) {
        const m = err instanceof Error ? err.message : "Network error.";
        setMessage(m);
        setIsSaving(false);
        return;
      }

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save primitive.";
        setMessage(error);
        setIsSaving(false);
        return;
      }

      const dispatchOutcome =
        payload && typeof payload === "object" && "dispatchOutcome" in payload
          ? (payload.dispatchOutcome as unknown)
          : null;

      // Phase 4: handle the no-op short-circuit. The server already
      // determined nothing changed; surface its message and bail without
      // touching editing state, the URL, or the form.
      if (
        dispatchOutcome &&
        typeof dispatchOutcome === "object" &&
        "kind" in dispatchOutcome &&
        (dispatchOutcome as { kind: string }).kind === "no-op"
      ) {
        const msg =
          "message" in dispatchOutcome
            ? String((dispatchOutcome as { message?: unknown }).message ?? "")
            : "Nothing to save.";
        setMessage(msg);
        setIsSaving(false);
        return;
      }

      const primitive =
        payload && typeof payload === "object" && "primitive" in payload
          ? (payload.primitive as PrimitiveRow)
          : null;

      if (primitive) {
        // Phase 1: pass dispatchOutcome through so the parent can
        // swap URL params on fork-path saves.
        window.dispatchEvent(new CustomEvent("sw:library-changed"));
      onSaved?.({ ...primitive, dispatchOutcome });
      }
      // Phase 1 fork path: if dispatchOutcome.swapTarget is true,
      // the parent has just set editing = newRow via onSaved. Do
      // NOT resetEditor() here — that would call onReset which
      // clears editing back to null. Instead let the new initial
      // value flow in via the parent's state update.
      //
      // For greenfield inserts (no sourceId) and version-updates
      // (no swap), reset the form to blank.
      const outcome =
        payload && typeof payload === "object" && "dispatchOutcome" in payload
          ? (payload.dispatchOutcome as { swapTarget?: boolean } | null)
          : null;
      if (!outcome?.swapTarget) {
        resetEditor();
      }
      setMessage("Primitive saved to your account.");
      // Flip isSaving false SYNCHRONOUSLY before triggering router.refresh().
      // The refresh fires-and-forgets — we don't await it — so the button
      // label snaps back to "Save Primitive" the moment the server has
      // accepted the write. The refresh then re-fetches the page data in
      // the background.
      setIsSaving(false);
      // void (not awaited): this is the naviguation refresh. It's a
      // fire-and-forget side effect, separate from the save completion.
      void router.refresh();
    })();
  }

  const primitiveJsonPreview = {
    schemaVersion: "swordweave.package.v1",
    kind: "primitive",
    records: [
      {
        name: form.name || "Unnamed Primitive",
        category: form.category,
        isPublic: form.isPublic,
        costTier: form.costTier,
        buCost: Number(form.buCost) || 0,
        mechanicalOutputText: mechanicalSentence,
        mechanicalRule,
        narrativeRule: form.narrativeRule,
        isMirrorable: form.isMirrorable,
        mirrorVector: form.isMirrorable ? form.mirrorVector : "STANDARD_ONLY",
        mirrorBuCredit: form.isMirrorable
          ? Number(form.mirrorBuCredit) || 0
          : 0,
        mirrorEligibilityNotes: form.mirrorEligibilityNotes,
        hardModifiers: activeHardModifiers,
      },
    ],
  };

  return (
    <form
      className="v12-instrument v12-primitive-author grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2 sm:p-5"
      onSubmit={submitPrimitive}
    >
      <div className="v12-primitive-identity-head v12-section-head -mx-4 -mt-4 flex items-center justify-between gap-3 px-4 pb-3 pt-5 md:col-span-2 sm:-mx-5 sm:-mt-5 sm:px-5">
        <div className="flex items-center gap-2">
          <p className="v12-kicker text-xs text-muted-foreground">
            Identity · {initialPrimitive ? "exact primitive" : "new primitive"}
          </p>
          {/*
            Phase 1 (round 6 of edit-creates-fork): surface the intent
            flag as a chip so the user knows what save will do.
              - intent=fork → blue chip "Forking <source>"
              - intent=load → gray chip "Working on <source>"
            The chip is purely informational; dispatch-save.ts is the
            source of truth for what actually happens on save. The
            name shown comes from initialPrimitive when present,
            otherwise from the form's current `name` field.
          */}
          {(() => {
            const label = saveIntentLabel(
              intent ?? null,
              initialPrimitive?.name ?? null,
            );
            if (!label) return null;
            const isFork = intent === "fork";
            return (
              <span
                data-testid="save-intent-chip"
                className={
                  isFork
                    ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary"
                    : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                }
                title={
                  isFork
                    ? "Save will create a fork owned by you."
                    : "Save will update in place if you own this; otherwise create a fork."
                }
              >
                {label}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {/* Phase 1: Discard button — REMOVED. It navigated back to the
            originating (legacy) surface and was superseded by the Reset
            flow + the in-app discard prompt. Mashu: hide it. */}
          <button
            type="button"
            onClick={resetEditor}
            className="v12-metal-button h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <AuthorChapters defaultActive="identity" guideKind="primitive">
        <AuthorChapter id="identity" title="Identity">
      {/* Phase 7.5 v4-rev: mobile-first compact layout.
          Mashu (round 1): "Name and icon could be on the
          same row? Same for lexicon, tier, and cost? So we
          have 2 rows instead of like 5?"
          Mashu (round 2): "And in primitive the icon and
          name are still not on the same row. And the
          lexicon tier and cost are not on the same row
          (these 3 have to be on same row maybe the field
          value could be smaller text)"

          The previous attempt put Name on row 1 (full
          width), Icon on row 2 (full width), Lexicon + Tier
          on row 3, and Cost on row 4. That wasn't what
          Mashu asked for. The new layout:

            Row 1: [Icon] [Name........]
            Row 2: [Lexicon] [Tier] [Cost (BU)]

          The IconSlot is shrunk to 40px and the Name input
          takes the rest of the row. Lexicon/Tier/Cost are
          in a 3-col grid. The Cost field uses a smaller
          text size so the 3 columns fit on phone widths.
      */}
      <div className="space-y-2 md:hidden">
        <div className="grid grid-cols-[auto_1fr] items-center gap-2">
          <IconSlot
            appearance="medallion"
            iconSource={(form.iconSource as IconSource | null) ?? null}
            iconKey={form.iconKey ?? null}
            iconUrl={form.iconUrl ?? null}
            iconColor={form.iconColor ?? "#ffffff"}
            onChange={(next) =>
              setForm({
                ...form,
                iconSource: next.iconSource,
                iconKey: next.iconKey ?? null,
                iconUrl: next.iconUrl ?? null,
                iconColor: next.iconColor,
              })
            }
            size={40}
            label=""
            helper=""
          />
          <label className="block text-sm font-medium">
            Name
            <input
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Kinetic Velocity Arrest"
              required
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs font-medium">
            Lexicon
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
              value={familyKey}
                  onChange={(event) => {
                    const family = MARKET_FAMILIES.find(
                      (item) => item.key === event.target.value,
                    );
                    if (!family) return;
                    setFamilyKey(family.key);
                    updateForm("category", family.categories[0]!);
                  }}
            >
              <CategoryOptions />
            </select>
          </label>
          <label className="block text-xs font-medium">
            Tier
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
              value={form.costTier}
                  onChange={(event) =>
                    updateForm("costTier", event.target.value)
                  }
            >
              {costTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Cost (BU)
            <input
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
              value={form.buCost}
              onChange={(event) => updateForm("buCost", event.target.value)}
              min={0}
              step={1}
              type="number"
              required
            />
          </label>
        </div>
      </div>

      <div className="v12-primitive-core hidden md:col-span-2 md:grid">
        <label className="v12-field-name block text-sm font-medium">
          Name
          <input
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="Kinetic Velocity Arrest"
            required
          />
        </label>
        <div className="v12-field-icon">
          <span className="text-sm font-medium">Icon</span>
          <div className="mt-1.5">
            <IconSlot
              appearance="medallion"
              iconSource={(form.iconSource as IconSource | null) ?? null}
              iconKey={form.iconKey ?? null}
              iconUrl={form.iconUrl ?? null}
              iconColor={form.iconColor ?? "#ffffff"}
              onChange={(next) =>
                setForm({
                  ...form,
                  iconSource: next.iconSource,
                  iconKey: next.iconKey ?? null,
                  iconUrl: next.iconUrl ?? null,
                  iconColor: next.iconColor,
                })
              }
              size={40}
              label=""
              helper=""
            />
          </div>
        </div>
      </div>

      <div className="v12-market-identity-head hidden md:block md:col-span-2">
        <p className="v12-kicker">Market identity and provenance</p>
        <h2>Where this primitive belongs</h2>
      </div>

      <div className="v12-market-fields hidden md:col-span-2 md:grid">
      <label className="v12-field-market text-sm font-medium">
        Lexicon Category
        <select
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
          value={familyKey}
                onChange={(event) => {
                  const family = MARKET_FAMILIES.find(
                    (item) => item.key === event.target.value,
                  );
                  if (!family) return;
                  setFamilyKey(family.key);
                  updateForm("category", family.categories[0]!);
                }}
        >
          <CategoryOptions />
        </select>
      </label>

      <label className="v12-field-market text-sm font-medium">
        Cost Tier Bracket
        <select
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
          value={form.costTier}
          onChange={(event) => updateForm("costTier", event.target.value)}
        >
          {costTiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>

      <label className="v12-field-market text-sm font-medium">
        Exact BU
        <input
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
          value={form.buCost}
          onChange={(event) => updateForm("buCost", event.target.value)}
          min={0}
          step={1}
          type="number"
          required
        />
      </label>
      </div>

      <label className="v12-field-narrative block text-sm font-medium md:col-span-2">
        Verbose Narrative Rule
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.narrativeRule}
              onChange={(event) =>
                updateForm("narrativeRule", event.target.value)
              }
          placeholder="Roots an entity to its current spatial coordinate..."
        />
      </label>
        </AuthorChapter>
        <AuthorChapter id="mechanical" title="Mechanical rule">
      {/* Phase 7.5 v3: Mirror Vector card removed from primitive
          form. Mirror logic moves to capability/affect layer
          (Phase 8). The primitive no longer carries mirror state. */}

      <fieldset className="v12-mechanical-rule v12-rule space-y-3 rounded-md border border-border bg-background p-4 md:col-span-2">
        <div className="v12-mechanical-rule-head">
          <div>
            <p className="v12-kicker">Mechanical rule · optional</p>
            <h2>{ruleKind ? "Write one rule" : "No mechanical rule"}</h2>
          </div>
              {ruleKind ? (
                <button
                  type="button"
                  className="v12-metal-button"
                  onClick={() => {
                    setRuleKind(null);
                    setModifiers([]);
                    setComposition(blankComposition);
                    setIsDirty(true);
                  }}
                >
                  Clear rule
                </button>
              ) : null}
        </div>
        <p className="v12-rule-guidance">
              Add a rule only when the primitive changes a tracked value or
              defines a construction permission. Otherwise its verbose
              description is the complete player-facing explanation.
        </p>
            <div
              className="v12-rule-kind-picker"
              aria-label="Mechanical rule kind"
            >
          <span className="v12-rule-kind-label">Rule format</span>
              <button
                type="button"
                aria-pressed={ruleKind === "MODIFIER"}
                onClick={() => {
                  if (!modifiers[0])
                    setModifiers([
                      {
                        ...blankModifier,
                        id: `modifier-${modifierCounter}`,
                        tokens: [...blankModifier.tokens],
                        targetValues: [],
                      },
                    ]);
                  setRuleKind("MODIFIER");
                  setIsDirty(true);
                }}
              >
                Value or runtime change
              </button>
              {compositionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={ruleKind === option.value}
                  onClick={() => {
                    setModifiers([]);
                    setComposition((current) => ({
                      ...current,
                      family: option.value,
                      value:
                        current.family === option.value ? current.value : "",
                    }));
                    setRuleKind(option.value);
                    setIsDirty(true);
                  }}
                >
                  {option.label}
                </button>
              ))}
        </div>
        {ruleKind && ruleKind !== "MODIFIER" ? (
              <div className="v12-composition-author">
                <div className="v12-composition-heading">
                  <div>
                    <span>Construction rule</span>
                    <b>
                      {
                        compositionOptions.find(
                          (option) => option.value === ruleKind,
                        )?.label
                      }
                    </b>
          </div>
                  <p>
                    {
                      compositionOptions.find(
                        (option) => option.value === ruleKind,
                      )?.help
                    }
                  </p>
        </div>
                {ruleKind === "DOMAIN_ACCESS" || ruleKind === "VERB_ACCESS" ? (
                  <div className="v12-composition-access-row">
                    <div className="v12-composition-choice-group">
                      <b>Operation</b>
                      <div>
                        {(["grant", "revoke"] as const).map((operation) => (
                          <button key={operation} type="button" aria-pressed={composition.operation === operation} onClick={() => { setComposition((current) => ({ ...current, operation })); setIsDirty(true); }}>
                            {operation === "grant" ? "Grant" : "Revoke"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="v12-composition-choice-group">
                      <b>Tier</b>
                      <div>
                        {(["Tier I", "Tier II", "Tier III", "Tier IV"] as const).map((tier) => (
                          <button key={tier} type="button" aria-pressed={composition.tier === tier} onClick={() => { setComposition((current) => ({ ...current, tier })); setIsDirty(true); }}>
                            {tier.replace("Tier ", "")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="v12-composition-choice-group">
                      <b>Recipient</b>
                      <div>
                        {(["SELF", "TARGET"] as const).map((recipient) => (
                          <button key={recipient} type="button" aria-pressed={composition.recipient === recipient} onClick={() => { setComposition((current) => ({ ...current, recipient })); setIsDirty(true); }}>
                            {recipient === "SELF" ? "Self" : "Target"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {ruleKind === "DOMAIN_ACCESS" ? (
                  <label className="v12-composition-custom">
                    Domain
                        <input
                      value={composition.value}
                      onChange={(event) => {
                        setComposition((current) => ({
                          ...current,
                          value: event.target.value,
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Metal, Fire, Memory"
                      required
                        />
                      </label>
                    ) : null}
                {ruleKind !== "DOMAIN_ACCESS" && ruleKind !== "VERB_ACCESS" ? (
                  <>
                    <div
                      className="v12-composition-presets"
                      aria-label={`${compositionOptions.find((option) => option.value === ruleKind)?.label} presets`}
                    >
                      {compositionOptions
                        .find((option) => option.value === ruleKind)
                        ?.presets.map((preset) => (
                          <button
                            type="button"
                            key={preset}
                            aria-pressed={composition.value === preset}
                            onClick={() => {
                              setComposition((current) => ({
                                ...current,
                                value: preset,
                              }));
                              setIsDirty(true);
                        }}
                          >
                            {preset}
                          </button>
                        ))}
                    </div>
                    <label className="v12-composition-custom">
                      Custom value
                      <input
                        value={composition.value}
                        onChange={(event) => {
                          setComposition((current) => ({
                            ...current,
                            value: event.target.value,
                          }));
                          setIsDirty(true);
                      }}
                        placeholder={`Or write a custom ${compositionOptions.find((option) => option.value === ruleKind)?.label.toLowerCase()}`}
                        required
                    />
              </label>
                  </>
                ) : null}
                <p className="v12-composition-output">
                  {mechanicalSentence ||
                    "Choose or enter a value to preview the exact stored rule."}
                </p>
              </div>
            ) : null}
            {!ruleKind ? (
              <p className="v12-narrative-only-note">
                No mechanical output is stored. The verbose description remains
                the complete player-facing rule.
              </p>
            ) : null}
            {ruleKind === "MODIFIER" && modifiers[0] ? (
              <PrimitiveRuleInstrument
                modifier={modifiers[0]}
                onPatch={(patch) => patchModifier(modifiers[0]!.id, patch)}
                onOperation={(operation) =>
                  updateModifierOperation(modifiers[0]!.id, operation)
                }
                onConditionChange={(condition) =>
                  updateModifierCondition(modifiers[0]!.id, condition)
                }
                onClear={() => {
                  removeModifier(modifiers[0]!.id);
                  setRuleKind(null);
                }}
              />
            ) : null}
      </fieldset>

      <details
        className="v12-resolver-details rounded-md border border-border bg-background p-4 md:col-span-2"
        open={showJsonPreview}
        onToggle={(event) => setShowJsonPreview(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Full Primitive JSON Preview
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 text-xs">
          {JSON.stringify(primitiveJsonPreview, null, 2)}
        </pre>
      </details>
        </AuthorChapter>
        <AuthorChapter id="publish" title="Publish">
      <AuthorPublishFields
        tags={form.tags}
        sourceOrigin={form.sourceOrigin}
        isPublic={form.isPublic}
        onTagsChange={(value) => updateForm("tags", value)}
        onSourceOriginChange={(value) => updateForm("sourceOrigin", value)}
        onPublicChange={(value) => updateForm("isPublic", value)}
        sourcePlaceholder="Forgotten Realms"
      />
        </AuthorChapter>
      </AuthorChapters>

      <div className="v12-form-actions flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={isSaving}
          type="submit"
          data-sandbox-submit
        >
          {isSaving ? "Saving..." : "Save Primitive"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}
