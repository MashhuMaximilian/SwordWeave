"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ModifierOperation } from "@/types/swordweave";
import type {
  ConditionAuthoring,
  ConditionPresetCategory,
} from "@/types/condition";
import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  DICE_TYPES,
  renderEquation,
  serializeValueField,
  tokenLabel,
  type Operator,
  type ValueToken,
  type ValueType,
} from "@/types/modifier";
import {
  NUMBER_SHORTCUTS,
  RUNTIME_VARIABLES,
  SUB_CHOICE_KEYWORDS,
} from "@/lib/primitives/form-helpers";
import {
  MODIFIER_TARGET_SPEC,
  type ModifierTarget,
} from "@/lib/primitives/modifier-scope";
import { parseRuleFormula } from "@/lib/primitives/rule-formula";
import type { ModifierDraft } from "./primitive-form";

type PanelKey = "target" | "operation" | "value" | "recipient" | "trigger";
type TriggerMode = "always" | "tracked" | "declared";
type ConditionPill = ConditionAuthoring["pills"][number];
type ConditionPillPatch = {
  [Key in keyof ConditionPill]?: ConditionPill[Key] | undefined;
};

interface TargetFamily {
  readonly id: string;
  readonly label: string;
  readonly help: string;
  readonly targets: readonly ModifierTarget[];
}

const TARGET_FAMILIES: readonly TargetFamily[] = [
  {
    id: "sheet",
    label: "Character sheet",
    help: "Permanent and current numbers shown on the character sheet.",
    targets: [
      "attribute",
      "max_vitality",
      "current_vitality",
      "proficiency_bonus",
      "speed",
      "carry_capacity",
      "save_dc",
    ],
  },
  {
    id: "rolls",
    label: "Rolls & checks",
    help: "Bonuses, penalties, dice, and training used when play is resolved.",
    targets: ["skill_practice_check", "action_roll", "damage_healing_output"],
  },
  {
    id: "runtime",
    label: "Runtime & resources",
    help: "Values that change during play, including upkeep, load, and scene state.",
    targets: [
      "strain",
      "item_slot_cost",
      "scene_pace",
      "upkeep_cost",
      "maintained_capability",
      "complexity",
      "damage_modifier",
      "equip_slot",
    ],
  },
  {
    id: "shape",
    label: "Capability shape",
    help: "How an action is aimed, timed, typed, or allowed at the table.",
    targets: [
      "targeting",
      "duration",
      "combat_action",
      "size",
      "damage_type",
      "source_type",
    ],
  },
  {
    id: "custom",
    label: "Custom runtime value",
    help: "Create a stable named value when the system does not have one yet.",
    targets: ["behavior"],
  },
];

const TARGET_HELP: Partial<Record<ModifierTarget, string>> = {
  attribute:
    "Physical, Mental, or Magical. Choose Any to affect every attribute.",
  skill_practice_check:
    "A bonus or penalty applied when a Practice is rolled. Choose Any to affect every Practice.",
  action_roll:
    "Attack, save, initiative, or another roll made to resolve an action.",
  damage_healing_output:
    "The numeric or dice output produced as damage or healing when the rule resolves.",
  targeting:
    "Who or what the capability can affect and the geometric shape it can use.",
  duration: "How long an effect remains active after it is created.",
  behavior:
    "A named runtime number or switch, such as tracking_bonus or legendary_resistance.",
  damage_modifier:
    "A multiplier for a named damage type: resistance, vulnerability, immunity, or a custom scale.",
  maintained_capability:
    "Whether a named capability is currently being maintained.",
  scene_pace:
    "A round, scene, day, or another clock the rule reads during play.",
};

const STATE_TARGETS = new Set<ModifierTarget>([
  "targeting",
  "duration",
  "combat_action",
  "size",
  "damage_type",
  "source_type",
  "maintained_capability",
]);

const OPERATION_COPY: ReadonlyArray<{
  value: ModifierOperation;
  label: string;
  help: string;
}> = [
  { value: "add", label: "Add", help: "Increase it by the value." },
  { value: "subtract", label: "Subtract", help: "Reduce it by the value." },
  { value: "multiply", label: "Multiply", help: "Scale the current value." },
  { value: "divide", label: "Divide", help: "Split the current value." },
  { value: "min", label: "Minimum", help: "It cannot fall below the value." },
  { value: "max", label: "Maximum", help: "It cannot rise above the value." },
  { value: "set", label: "Set to", help: "Replace it with the value." },
  {
    value: "grant",
    label: "Grant",
    help: "Give a permission, state, or feature.",
  },
  {
    value: "revoke",
    label: "Revoke",
    help: "Remove a permission, state, or feature.",
  },
];

const STACKING_OPTIONS: ReadonlyArray<{
  value: ModifierDraft["stacking"];
  label: string;
  help: string;
}> = [
  {
    value: "stack",
    label: "Stack all",
    help: "Keep every contribution and combine them in resolver order.",
  },
  {
    value: "highest-only",
    label: "Highest only",
    help: "Keep only the largest contribution to this result.",
  },
  {
    value: "lowest-only",
    label: "Lowest only",
    help: "Keep only the smallest contribution to this result.",
  },
  {
    value: "unique-by-primitive",
    label: "Once per primitive",
    help: "The same primitive can contribute only once, even if applied repeatedly.",
  },
  {
    value: "unique-by-target",
    label: "Once per target",
    help: "Keep one contribution for each affected target.",
  },
  {
    value: "replace",
    label: "Newest replaces old",
    help: "The latest matching contribution replaces the one already stored.",
  },
];

const SUBJECTS: ReadonlyArray<{
  label: string;
  value: ConditionPresetCategory;
}> = [
  { label: "Self", value: "self" },
  { label: "Target", value: "target" },
  { label: "Scene", value: "scene" },
];

type ConditionReadFamily = {
  readonly id: string;
  readonly label: string;
  readonly values: ReadonlyArray<readonly [string, string]>;
};

const CONDITION_STAT_FAMILIES: readonly ConditionReadFamily[] = [
  {
    id: "sheet",
    label: "Character sheet",
    values: [
      ["Vitality", "vitality"],
      ["Max Vitality", "vitality_max"],
      ["Physical", "physical"],
      ["Mental", "mental"],
      ["Magical", "magical"],
      ["Proficiency Bonus", "proficiency_bonus"],
      ["Save DC", "save_dc"],
      ["Block value", "block_value"],
      ["Speed", "speed"],
      ["Carry capacity", "carry_capacity"],
    ],
  },
  {
    id: "rolls",
    label: "Rolls & checks",
    values: [
      ...ALL_PRACTICES.map((practice) => [title(practice), practice] as const),
      ["Action roll", "action_roll"],
      ["Attack bonus", "attack_bonus"],
      ["Damage output", "damage_output"],
      ["Healing output", "healing_output"],
      ["Initiative", "initiative"],
    ],
  },
  {
    id: "runtime",
    label: "Runtime & resources",
    values: [
      ["Load", "load"],
      ["Strain", "strain"],
      ["Item slot cost", "item_slot_cost"],
      ["Equip slots used", "equip_slots_used"],
      ["Scene pace", "scene_pace"],
      ["Complexity", "complexity"],
      ["Upkeep cost", "upkeep_cost"],
    ],
  },
  {
    id: "shape",
    label: "Capability shape",
    values: [
      ["Range", "range"],
      ["Targeting", "targeting"],
      ["Duration", "duration"],
      ["Combat action", "combat_action"],
      ["Size", "size"],
      ["Damage type", "damage_type"],
      ["Source type", "source_type"],
      ["Damage modifier", "damage_modifier"],
    ],
  },
];

const CONDITION_STATS = CONDITION_STAT_FAMILIES.flatMap(
  (family) => family.values,
);

const CONDITION_FLAGS = [
  "prone",
  "stunned",
  "bleeding",
  "frightened",
  "blinded",
  "charmed",
  "grappled",
  "restrained",
  "poisoned",
  "wounded",
  "damaged last round",
  "equipped",
  "encumbered",
  "in cover",
] as const;

const DECLARED_TRIGGER_GROUPS = [
  {
    label: "Exploration",
    values: [
      "tracking enemies",
      "searching for danger",
      "navigating difficult terrain",
      "examining a clue",
      "gathering information",
      "resting or making camp",
    ],
  },
  {
    label: "Combat",
    values: [
      "protecting an ally",
      "using this capability",
      "attacking from concealment",
      "after taking damage",
      "after dealing damage",
      "after missing an attack",
      "when initiative is rolled",
      "at the start of your turn",
      "at the end of your turn",
    ],
  },
  {
    label: "Scene & movement",
    values: [
      "when entering the area",
      "when leaving the area",
      "when crossing a threshold",
      "while in darkness",
      "while in difficult terrain",
      "when a hazard appears",
    ],
  },
  {
    label: "Social & story",
    values: [
      "while negotiating",
      "while deceiving someone",
      "when someone lies to you",
      "when an ally calls for help",
      "when the GM declares a complication",
      "when the GM calls for it",
    ],
  },
] as const;

const COMPARISONS = [
  ["is lower than", "<"],
  ["is at most", "<="],
  ["is", "="],
  ["is not", "!="],
  ["is at least", ">="],
  ["is greater than", ">"],
  ["is between", "between"],
] as const;

const RECIPIENTS = [
  ["SELF", "Self", "The character who owns or uses the rule."],
  ["TARGET", "Target", "The creature or object affected by the action."],
  ["SCENE", "Scene", "The shared environment or encounter state."],
] as const;

function title(value: string): string {
  const normalized =
    value === value.toUpperCase() ? value.toLowerCase() : value;
  return normalized
    .replaceAll("_", " ")
    .replaceAll(":", " · ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recipientLabel(value: ModifierDraft["recipient"]): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function targetFamilyFor(target: string): TargetFamily {
  return (
    TARGET_FAMILIES.find((family) =>
      family.targets.includes(target as ModifierTarget),
    ) ?? TARGET_FAMILIES[0]!
  );
}

function targetLabel(modifier: ModifierDraft): string {
  const target = modifier.target as ModifierTarget;
  const spec = MODIFIER_TARGET_SPEC[target];
  if (modifier.freeTextNarrowFocus.trim())
    return title(modifier.freeTextNarrowFocus);
  if (modifier.targetValues.length)
    return modifier.targetValues
      .map((value) => spec?.optionLabels?.[value] ?? title(value))
      .join(" + ");
  return spec
    ? spec.options?.length
      ? `Any ${spec.label}`
      : spec.label
    : title(String(modifier.target));
}

function valueLabel(modifier: ModifierDraft): string {
  if (modifier.valueKind === "equation")
    return renderEquation(modifier.operands) || "choose a formula";
  return (
    modifier.tokens.map(tokenLabel).join(" + ") ||
    modifier.value ||
    "choose a value"
  );
}

function operationWords(operation: ModifierOperation) {
  const values: Record<
    ModifierOperation,
    { lead: string; join: string; word: string }
  > = {
    add: { lead: "Change", join: "by", word: "adding" },
    subtract: { lead: "Change", join: "by", word: "subtracting" },
    multiply: { lead: "Change", join: "by", word: "multiplying by" },
    divide: { lead: "Change", join: "by", word: "dividing by" },
    min: { lead: "Set", join: "to", word: "a minimum of" },
    max: { lead: "Set", join: "to", word: "a maximum of" },
    set: { lead: "Set", join: "to", word: "exactly" },
    grant: { lead: "Grant", join: "to", word: "" },
    revoke: { lead: "Revoke", join: "from", word: "" },
  };
  return values[operation];
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "declared_trigger"
  );
}

function comparisonLabel(value: ConditionPill["operator"]): string {
  return COMPARISONS.find((item) => item[1] === value)?.[0] ?? "is";
}

function statLabel(value: string | undefined): string {
  if (value === "vitality_pct") return "Vitality";
  return (
    CONDITION_STATS.find((item) => item[1] === value)?.[0] ??
    title(value ?? "value")
  );
}

function conditionLabel(pill: ConditionPill): string {
  if (pill.kind === "flag" && pill.flag?.startsWith("manual:"))
    return pill.label;
  const subject = pill.category === "actor" ? "Self" : title(pill.category);
  if (pill.kind === "stat") {
    const raw = pill.value ?? "value";
    const formatted =
      pill.stat === "vitality_pct" && typeof raw === "number"
        ? `${Number((raw * 100).toFixed(5))}%`
        : typeof raw === "string" && raw.startsWith("formula:")
          ? raw.slice("formula:".length)
          : String(raw);
    const high =
      pill.operator === "between" && pill.valueHigh !== undefined
        ? ` and ${pill.stat === "vitality_pct" && typeof pill.valueHigh === "number" ? Number((pill.valueHigh * 100).toFixed(5)) : pill.valueHigh}`
        : "";
    return `${subject} ${statLabel(pill.stat)} ${comparisonLabel(pill.operator)} ${formatted}${high}`;
  }
  if (pill.kind === "proficiency")
    return `${subject} is proficient in ${title(pill.practice ?? "practice")}`;
  return `${subject} has ${title(pill.flag ?? pill.label)}`;
}

function triggerModeFor(condition: ConditionAuthoring): TriggerMode {
  if (!condition.pills.length && !condition.narrative.trim()) return "always";
  if (
    condition.pills.some(
      (pill) => pill.kind === "flag" && pill.flag?.startsWith("manual:"),
    ) ||
    condition.narrative.trim()
  )
    return "declared";
  return "tracked";
}

function labelForPill(pill: ConditionPill): string {
  if (pill.kind === "stat") return statLabel(pill.stat);
  if (pill.kind === "proficiency")
    return `${title(pill.practice ?? "practice")} proficiency`;
  if (pill.flag?.startsWith("manual:")) return pill.label;
  if (pill.flag?.startsWith("runtime:"))
    return title(pill.flag.slice("runtime:".length));
  return title(pill.flag ?? pill.label);
}

function runtimeKey(value: string, fallback: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_:.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback
  );
}

function valueKindForToken(token: ValueToken): ValueType {
  if (token.kind === "dice") return "dice";
  if (token.kind === "keyword" || token.kind === "behavior") return "text";
  return "number";
}

export function PrimitiveRuleInstrument({
  modifier,
  onPatch,
  onOperation,
  onConditionChange,
  onClear,
}: {
  modifier: ModifierDraft;
  onPatch: (patch: Partial<ModifierDraft>) => void;
  onOperation: (operation: ModifierOperation) => void;
  onConditionChange: (condition: ConditionAuthoring) => void;
  onClear: () => void;
}) {
  const [activePanel, setActivePanel] = useState<PanelKey>("target");
  const [targetFamily, setTargetFamily] = useState(
    targetFamilyFor(String(modifier.target)).id,
  );
  const [targetSearch, setTargetSearch] = useState("");
  const [valueFamily, setValueFamily] = useState("fixed");
  const [valueSearch, setValueSearch] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaText, setFormulaText] = useState("");
  const [declaredText, setDeclaredText] = useState("");
  const [expandedConditionIndex, setExpandedConditionIndex] = useState<
    number | null
  >(modifier.v1Condition.pills.length ? 0 : null);
  const [runtimeTemplate, setRuntimeTemplate] = useState<
    (typeof RUNTIME_VARIABLES)[number] | null
  >(null);

  const triggerMode = triggerModeFor(modifier.v1Condition);
  const operation = operationWords(modifier.operation);
  const parsedFormula = useMemo(
    () => parseRuleFormula(formulaText),
    [formulaText],
  );

  const chooseToken = (token: ValueToken) => {
    const kind = valueKindForToken(token);
    onPatch({
      tokens: [token],
      operands: [],
      valueKind: kind,
      value: String(serializeValueField([token])[0] ?? ""),
    });
  };

  const chooseTarget = (target: ModifierTarget, targetValue?: string) => {
    const sameTarget = modifier.target === target;
    let targetValues: string[] = [];
    if (targetValue)
      targetValues = sameTarget
        ? modifier.targetValues.includes(targetValue)
          ? modifier.targetValues.filter((value) => value !== targetValue)
          : [...modifier.targetValues, targetValue]
        : [targetValue];
    onPatch({
      target,
      targetValues,
      freeTextNarrowFocus: "",
      ...(target === "damage_healing_output"
        ? { valueKind: "dice" as const }
        : STATE_TARGETS.has(target) && modifier.valueKind === "dice"
          ? { valueKind: "text" as const }
          : {}),
    });
  };

  const chooseOperation = (next: ModifierOperation) => {
    onOperation(next);
    setValueFamily(next === "grant" || next === "revoke" ? "state" : "fixed");
  };

  const patchPill = (index: number, patch: ConditionPillPatch) => {
    const pills = modifier.v1Condition.pills.map((pill, pillIndex) => {
      if (pillIndex !== index) return pill;
      const next = { ...pill, ...patch } as ConditionPill;
      return { ...next, label: labelForPill(next) };
    });
    onConditionChange({ ...modifier.v1Condition, pills });
  };

  const removeCondition = (index: number) => {
    const pills = modifier.v1Condition.pills.filter((_, i) => i !== index);
    const operators = pills
      .slice(1)
      .map(
        (_, i) =>
          modifier.v1Condition.operators[i >= index ? i + 1 : i] ?? "AND",
      );
    onConditionChange({
      ...modifier.v1Condition,
      pills,
      operators,
      categories: [...new Set(pills.map((pill) => pill.category))],
    });
    setExpandedConditionIndex(
      pills.length ? Math.min(index, pills.length - 1) : null,
    );
  };

  const trackedCondition = (): ConditionPill => ({
    category: "self",
    label: "Vitality %",
    kind: "stat",
    stat: "vitality_pct",
    operator: "<",
    value: 0.5,
  });
  const addTrackedCondition = (join: "AND" | "OR" = "AND") => {
    const pills = [...modifier.v1Condition.pills, trackedCondition()];
    const operators =
      pills.length > 1 ? [...modifier.v1Condition.operators, join] : [];
    onConditionChange({
      categories: [...new Set(pills.map((item) => item.category))],
      pills,
      operators,
      narrative: "",
      includeTags: true,
    });
    setExpandedConditionIndex(pills.length - 1);
  };

  const declaredCondition = (text: string): ConditionPill => ({
    category: "self",
    label: text,
    kind: "flag",
    flag: `manual:${slug(text)}`,
    operator: "=",
    value: "active",
  });

  const chooseDeclaredTrigger = (text: string, join: "AND" | "OR" = "OR") => {
    const clean = text.trim();
    if (!clean) return;
    const current = modifier.v1Condition.pills;
    if (current.some((pill) => pill.label === clean)) return;
    const placeholderIndex = current.findIndex(
      (pill) => pill.flag === "manual:another_declared_event",
    );
    const replaceIndex =
      placeholderIndex >= 0
        ? placeholderIndex
        : current.length === 1 &&
            current[0]?.label === "tracking enemies" &&
            clean !== "tracking enemies"
          ? 0
          : -1;
    const pills =
      replaceIndex >= 0
        ? current.map((pill, index) =>
            index === replaceIndex ? declaredCondition(clean) : pill,
          )
        : [...current, declaredCondition(clean)];
    onConditionChange({
      categories: [...new Set(pills.map((pill) => pill.category))],
      pills,
      operators:
        replaceIndex >= 0
          ? modifier.v1Condition.operators
          : pills.length > 1
            ? [...modifier.v1Condition.operators, join]
            : [],
      narrative: "",
      includeTags: true,
    });
    setExpandedConditionIndex(
      replaceIndex >= 0 ? replaceIndex : pills.length - 1,
    );
    setDeclaredText("");
  };

  const addDeclaredCondition = (join: "AND" | "OR") => {
    if (
      modifier.v1Condition.pills.some(
        (pill) => pill.flag === "manual:another_declared_event",
      )
    )
      return;
    const pills = [
      ...modifier.v1Condition.pills,
      declaredCondition("another declared event"),
    ];
    onConditionChange({
      categories: [...new Set(pills.map((pill) => pill.category))],
      pills,
      operators:
        pills.length > 1 ? [...modifier.v1Condition.operators, join] : [],
      narrative: "",
      includeTags: true,
    });
    setExpandedConditionIndex(pills.length - 1);
  };

  const addCondition = (join: "AND" | "OR") => {
    if (triggerMode === "declared") addDeclaredCondition(join);
    else addTrackedCondition(join);
    setActivePanel("trigger");
  };

  const patchConnector = (index: number, value: "AND" | "OR") => {
    const operators = [...modifier.v1Condition.operators];
    operators[index - 1] = value;
    onConditionChange({ ...modifier.v1Condition, operators });
  };

  const setTriggerMode = (mode: TriggerMode) => {
    if (mode === "always") {
      onConditionChange({
        categories: [],
        pills: [],
        operators: [],
        narrative: "",
        includeTags: false,
      });
      setExpandedConditionIndex(null);
    } else if (mode === "tracked") {
      const pill = trackedCondition();
      onConditionChange({
        categories: ["self"],
        pills: [pill],
        operators: [],
        narrative: "",
        includeTags: true,
      });
      setExpandedConditionIndex(0);
    } else {
      onConditionChange({
        categories: ["self"],
        pills: [declaredCondition("tracking enemies")],
        operators: [],
        narrative: "",
        includeTags: true,
      });
      setExpandedConditionIndex(0);
    }
  };

  const openFormula = () => {
    setFormulaText(
      modifier.valueKind === "equation" && modifier.operands.length
        ? renderEquation(modifier.operands)
        : "PB + 1",
    );
    setFormulaOpen(true);
  };

  const applyFormula = () => {
    if (parsedFormula.error || !parsedFormula.operands.length) return;
    onPatch({
      operands: [...parsedFormula.operands],
      tokens: [],
      valueKind: "equation",
      value: renderEquation(parsedFormula.operands),
    });
    setFormulaOpen(false);
  };

  const selectedFamily =
    TARGET_FAMILIES.find((family) => family.id === targetFamily) ??
    TARGET_FAMILIES[0]!;
  const selectedStacking =
    STACKING_OPTIONS.find((option) => option.value === modifier.stacking) ??
    STACKING_OPTIONS[0]!;
  const targetMatches = selectedFamily.targets.filter((target) => {
    const spec = MODIFIER_TARGET_SPEC[target];
    return [
      spec.label,
      TARGET_HELP[target] ?? "",
      ...(spec.options ?? []).map(
        (value) => spec.optionLabels?.[value] ?? value,
      ),
    ]
      .join(" ")
      .toLowerCase()
      .includes(targetSearch.toLowerCase());
  });

  const panelCopy: Record<
    PanelKey,
    { eyebrow: string; title: string; help: string }
  > = {
    target: {
      eyebrow: "1 · Result",
      title: "What changes?",
      help: "Pick the exact sheet, roll, runtime, or capability value this one primitive controls.",
    },
    operation: {
      eyebrow: "2 · Operation",
      title: "How does it change?",
      help: "Choose any operation. The resolver applies it to the selected number, state, permission, die, or runtime value.",
    },
    value: {
      eyebrow: "3 · Value",
      title: "What value does it use?",
      help: "Use a fixed value, a character value, dice, a formula, a state, or any named runtime value.",
    },
    recipient: {
      eyebrow: "4 · Recipient",
      title: "Who or what receives it?",
      help: "This decides whose value is changed when the rule is used.",
    },
    trigger: {
      eyebrow: "5 · Trigger",
      title: "When does it apply?",
      help: "Leave it always active, read tracked game state, or declare a table event the player can switch on.",
    },
  };

  const valueFamilies = [
    ["fixed", "Fixed number"],
    ["sheet", "Sheet value"],
    ["dice", "Dice"],
    ["formula", "Formula"],
    ["state", "State / keyword"],
    ["runtime", "Custom runtime"],
  ] as const;

  return (
    <div className="v12-rule-builder">
      <nav className="v12-rule-steps" aria-label="Mechanical rule steps">
        {(
          [
            ["target", "Result", targetLabel(modifier)],
            ["operation", "Operation", title(modifier.operation)],
            ["value", "Value", valueLabel(modifier)],
            ["recipient", "Recipient", recipientLabel(modifier.recipient)],
            [
              "trigger",
              "Trigger",
              triggerMode === "always"
                ? "Always"
                : triggerMode === "tracked"
                  ? "Tracked"
                  : "Declared",
            ],
          ] as const
        ).map(([key, label, summary]) => (
          <button
            key={key}
            type="button"
            aria-current={activePanel === key ? "step" : undefined}
            onClick={() => setActivePanel(key)}
          >
            <span>{label}</span>
            <b>{summary}</b>
          </button>
        ))}
      </nav>

      <div className="v12-rule-sentence" aria-label="Mechanical rule sentence">
        {modifier.operation === "grant" || modifier.operation === "revoke" ? (
          <>
            <button
              type="button"
              className="is-operation"
              onClick={() => setActivePanel("operation")}
            >
              {operation.lead}
            </button>
            <button
              type="button"
              className="is-value"
              onClick={() => setActivePanel("value")}
            >
              {valueLabel(modifier)}
            </button>
            <span>{operation.join}</span>
            <button
              type="button"
              className="is-variable"
              onClick={() => setActivePanel("target")}
            >
              {targetLabel(modifier)}
            </button>
          </>
        ) : (
          <>
            <span>{operation.lead}</span>
            <button
              type="button"
              className="is-variable"
              onClick={() => setActivePanel("target")}
            >
              {targetLabel(modifier)}
            </button>
            <span>{operation.join}</span>
            <button
              type="button"
              className="is-operation"
              onClick={() => setActivePanel("operation")}
            >
              {operation.word}
            </button>
            <button
              type="button"
              className="is-value"
              onClick={() => setActivePanel("value")}
            >
              {valueLabel(modifier)}
            </button>
          </>
        )}
        <span>for</span>
        <button
          type="button"
          className="is-scope"
          onClick={() => setActivePanel("recipient")}
        >
          {recipientLabel(modifier.recipient)}
        </button>
        {modifier.v1Condition.pills.map((pill, index) => (
          <span className="v12-rule-condition" key={`${index}:${pill.label}`}>
            <b>
              {index
                ? (modifier.v1Condition.operators[index - 1] ?? "AND")
                : "WHEN"}
            </b>
            <button
              type="button"
              className="is-condition"
              onClick={() => {
                setActivePanel("trigger");
                setExpandedConditionIndex(index);
              }}
            >
              {conditionLabel(pill)}
            </button>
            <button
              type="button"
              className="v12-rule-condition-remove"
              onClick={() => removeCondition(index)}
              aria-label="Remove condition"
            >
              ×
            </button>
          </span>
        ))}
        {modifier.v1Condition.pills.length ? (
          <span className="v12-rule-inline-connectors">
            <button type="button" onClick={() => addCondition("AND")}>
              ＋ AND
            </button>
            <button type="button" onClick={() => addCondition("OR")}>
              ＋ OR
            </button>
          </span>
        ) : null}
        {!modifier.v1Condition.pills.length ? (
          <button
            type="button"
            className="v12-rule-add-when"
            onClick={() => setActivePanel("trigger")}
          >
            ＋ when
          </button>
        ) : null}
        <span>.</span>
      </div>

      <section className="v12-rule-panel">
        <header>
          <div>
            <span>{panelCopy[activePanel].eyebrow}</span>
            <h3>{panelCopy[activePanel].title}</h3>
          </div>
          <p>{panelCopy[activePanel].help}</p>
        </header>

        {activePanel === "target" ? (
          <div className="v12-rule-target-panel">
            <div
              className="v12-rule-family-tabs"
              role="tablist"
              aria-label="Result families"
            >
              {TARGET_FAMILIES.map((family) => (
                <button
                  type="button"
                  key={family.id}
                  role="tab"
                  aria-selected={selectedFamily.id === family.id}
                  onClick={() => {
                    setTargetFamily(family.id);
                    setTargetSearch("");
                  }}
                >
                  {family.label}
                </button>
              ))}
            </div>
            <div className="v12-rule-search-row">
              <input
                value={targetSearch}
                onChange={(event) => setTargetSearch(event.target.value)}
                placeholder={`Search ${selectedFamily.label.toLowerCase()}…`}
              />
              <small>{selectedFamily.help}</small>
            </div>
            <div className="v12-rule-target-grid">
              {targetMatches.map((target) => {
                const spec = MODIFIER_TARGET_SPEC[target];
                const isSelected = modifier.target === target;
                return (
                  <article
                    key={target}
                    className={isSelected ? "is-selected" : ""}
                  >
                    <button
                      type="button"
                      className="v12-rule-target-name"
                      onClick={() => chooseTarget(target)}
                    >
                      <b>{spec.label}</b>
                      <span>
                        {TARGET_HELP[target] ??
                          (spec.valueIsNumeric
                            ? "A number read and changed by the resolver."
                            : "A tracked rule value available during play.")}
                      </span>
                    </button>
                    {spec.options?.length ? (
                      <div className="v12-rule-subchoices">
                        <button
                          type="button"
                          aria-pressed={
                            isSelected && modifier.targetValues.length === 0
                          }
                          onClick={() => chooseTarget(target)}
                        >
                          Any
                        </button>
                        {spec.options.map((value) => (
                          <button
                            type="button"
                            key={value}
                            aria-pressed={
                              isSelected &&
                              modifier.targetValues.includes(value)
                            }
                            onClick={() => chooseTarget(target, value)}
                          >
                            {spec.optionLabels?.[value] ?? title(value)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {isSelected &&
                    (spec.widget === "free-text" ||
                      spec.widget === "checklist-with-free-text") ? (
                      <label className="v12-rule-custom-key">
                        <span>Stable runtime name</span>
                        <input
                          value={modifier.freeTextNarrowFocus}
                          onChange={(event) =>
                            onPatch({
                              freeTextNarrowFocus: event.target.value,
                              targetValues: [],
                            })
                          }
                          placeholder={
                            spec.freeTextPlaceholder ?? "e.g. tracking_bonus"
                          }
                        />
                      </label>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <div className="v12-rule-panel-next">
              <button type="button" onClick={() => setActivePanel("operation")}>
                Next · choose how it changes →
              </button>
            </div>
          </div>
        ) : null}

        {activePanel === "operation" ? (
          <div>
            <div className="v12-rule-operation-grid">
              {OPERATION_COPY.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  aria-pressed={modifier.operation === item.value}
                  onClick={() => chooseOperation(item.value)}
                >
                  <b>{item.label}</b>
                  <span>{item.help}</span>
                </button>
              ))}
            </div>
            <div className="v12-rule-panel-next">
              <button type="button" onClick={() => setActivePanel("value")}>
                Next · choose the value →
              </button>
            </div>
          </div>
        ) : null}

        {activePanel === "value" ? (
          <div className="v12-rule-value-panel">
            <div
              className="v12-rule-family-tabs"
              role="tablist"
              aria-label="Value sources"
            >
              {valueFamilies.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  role="tab"
                  aria-selected={valueFamily === key}
                  onClick={() => setValueFamily(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {valueFamily === "fixed" ? (
              <div className="v12-rule-value-body">
                <p>Use a constant. Decimals and negative values are allowed.</p>
                <div className="v12-rule-chip-row">
                  {NUMBER_SHORTCUTS.map((number) => (
                    <button
                      type="button"
                      key={number}
                      aria-pressed={
                        modifier.tokens[0]?.kind === "number" &&
                        modifier.tokens[0].value === number
                      }
                      onClick={() =>
                        chooseToken({ kind: "number", value: number })
                      }
                    >
                      {number}
                    </button>
                  ))}
                </div>
                <div className="v12-rule-entry-row">
                  <input
                    inputMode="decimal"
                    value={customValue}
                    onChange={(event) => setCustomValue(event.target.value)}
                    placeholder="Any number, e.g. 3.5 or -2"
                  />
                  <button
                    type="button"
                    disabled={
                      !Number.isFinite(Number(customValue)) ||
                      !customValue.trim()
                    }
                    onClick={() => {
                      chooseToken({
                        kind: "number",
                        value: Number(customValue),
                      });
                      setCustomValue("");
                    }}
                  >
                    Use number
                  </button>
                </div>
              </div>
            ) : null}
            {valueFamily === "sheet" ? (
              <div className="v12-rule-value-body">
                <p>
                  The resolver reads the current value from the character when
                  the rule is used.
                </p>
                <div className="v12-rule-value-groups">
                  <ValueGroup title="Attributes">
                    {ALL_ATTRIBUTES.map((attribute) => (
                      <Choice
                        key={attribute}
                        label={title(attribute)}
                        selected={
                          modifier.tokens[0]?.kind === "attribute" &&
                          modifier.tokens[0].attribute === attribute
                        }
                        onClick={() =>
                          chooseToken({ kind: "attribute", attribute })
                        }
                      />
                    ))}
                  </ValueGroup>
                  <ValueGroup title="Practices">
                    {ALL_PRACTICES.map((practice) => (
                      <Choice
                        key={practice}
                        label={title(practice)}
                        selected={
                          modifier.tokens[0]?.kind === "practice" &&
                          modifier.tokens[0].practice === practice
                        }
                        onClick={() =>
                          chooseToken({ kind: "practice", practice })
                        }
                      />
                    ))}
                  </ValueGroup>
                  <ValueGroup title="Derived">
                    {ALL_DERIVED.map((which) => (
                      <Choice
                        key={which}
                        label={
                          which === "pb_half"
                            ? "Half PB"
                            : which === "pb2" ||
                                which === "expertise" ||
                                which === "pb*2"
                              ? "Double PB"
                              : title(which)
                        }
                        selected={
                          modifier.tokens[0]?.kind === "derived" &&
                          modifier.tokens[0].which === which
                        }
                        onClick={() => chooseToken({ kind: "derived", which })}
                      />
                    ))}
                  </ValueGroup>
                </div>
              </div>
            ) : null}
            {valueFamily === "dice" ? (
              <div className="v12-rule-value-body">
                <p>
                  Dice are written as <code>#dice#</code>, for example{" "}
                  <code>#2d8+3#</code>.
                </p>
                <div className="v12-rule-chip-row">
                  {DICE_TYPES.map((die) => (
                    <button
                      type="button"
                      key={die}
                      aria-pressed={
                        modifier.tokens[0]?.kind === "dice" &&
                        modifier.tokens[0].expression === `1${die}`
                      }
                      onClick={() =>
                        chooseToken({ kind: "dice", expression: `1${die}` })
                      }
                    >
                      #1{die}#
                    </button>
                  ))}
                </div>
                <div className="v12-rule-entry-row">
                  <input
                    value={customValue}
                    onChange={(event) => setCustomValue(event.target.value)}
                    placeholder="#2d8+3#"
                  />
                  <button
                    type="button"
                    disabled={
                      !/^#?\d+d\d+(?:[+-]\d+)?#?$/i.test(customValue.trim())
                    }
                    onClick={() => {
                      chooseToken({
                        kind: "dice",
                        expression: customValue.trim().replace(/^#|#$/g, ""),
                      });
                      setCustomValue("");
                    }}
                  >
                    Use dice
                  </button>
                </div>
              </div>
            ) : null}
            {valueFamily === "formula" ? (
              <div className="v12-rule-formula-callout">
                <div>
                  <b>
                    {modifier.valueKind === "equation" &&
                    modifier.operands.length
                      ? renderEquation(modifier.operands)
                      : "Combine any sheet, runtime, number, die, and keyword."}
                  </b>
                  <p>
                    Examples: <code>Physical + PB/2</code>,{" "}
                    <code>(5 + PB) / Awareness</code>,{" "}
                    <code>PBd10 + 2d8 [fire]</code>.
                  </p>
                </div>
                <button type="button" onClick={openFormula}>
                  {modifier.valueKind === "equation"
                    ? "Edit formula"
                    : "Build formula"}
                </button>
              </div>
            ) : null}
            {valueFamily === "state" ? (
              <div className="v12-rule-value-body">
                <div className="v12-rule-search-row">
                  <input
                    value={valueSearch}
                    onChange={(event) => setValueSearch(event.target.value)}
                    placeholder="Search permissions, conditions, damage types, tiers…"
                  />
                  <small>
                    Keywords use square brackets: <code>[fire]</code>.
                  </small>
                </div>
                <div className="v12-rule-value-groups">
                  {[
                    ...new Set(SUB_CHOICE_KEYWORDS.map((item) => item.group)),
                  ].map((group) => {
                    const choices = SUB_CHOICE_KEYWORDS.filter(
                      (item) =>
                        item.group === group &&
                        item.label
                          .toLowerCase()
                          .includes(valueSearch.toLowerCase()),
                    );
                    if (!choices.length) return null;
                    return (
                      <ValueGroup title={group} key={group}>
                        {choices.map((item) => (
                          <Choice
                            key={item.label}
                            label={`[${item.label}]`}
                            selected={
                              modifier.tokens[0]?.kind === "keyword" &&
                              modifier.tokens[0].text === slug(item.label)
                            }
                            onClick={() =>
                              chooseToken({
                                kind: "keyword",
                                text: slug(item.label),
                              })
                            }
                          />
                        ))}
                      </ValueGroup>
                    );
                  })}
                </div>
                <div className="v12-rule-entry-row">
                  <input
                    value={customValue}
                    onChange={(event) => setCustomValue(event.target.value)}
                    placeholder="[custom keyword]"
                  />
                  <button
                    type="button"
                    disabled={!customValue.trim()}
                    onClick={() => {
                      chooseToken({
                        kind: "keyword",
                        text: slug(customValue.replace(/^\[|\]$/g, "")),
                      });
                      setCustomValue("");
                    }}
                  >
                    Use keyword
                  </button>
                </div>
              </div>
            ) : null}
            {valueFamily === "runtime" ? (
              <div className="v12-rule-value-body">
                <p>
                  Runtime values use slashes: <code>/scene_heat/</code>. A keyed
                  value first asks what kind of value, then which named thing it
                  belongs to.
                </p>
                <div className="v12-rule-value-groups">
                  {[
                    ...new Set(RUNTIME_VARIABLES.map((item) => item.group)),
                  ].map((group) => (
                    <ValueGroup title={group} key={group}>
                      {RUNTIME_VARIABLES.filter(
                        (item) => item.group === group,
                      ).map((item) => {
                        const needsKey = item.name.includes("<key>");
                        const selected =
                          runtimeTemplate?.name === item.name ||
                          (!needsKey &&
                            modifier.tokens[0]?.kind === "runtime" &&
                            modifier.tokens[0].name === item.name);
                        return (
                          <Choice
                            key={item.name}
                            label={`/${item.label}/`}
                            selected={selected}
                            onClick={() => {
                              if (needsKey) {
                                setRuntimeTemplate(item);
                                setCustomValue("");
                              } else {
                                setRuntimeTemplate(null);
                                chooseToken({
                                  kind: "runtime",
                                  name: item.name,
                                  hint: item.hint,
                                });
                              }
                            }}
                          />
                        );
                      })}
                    </ValueGroup>
                  ))}
                </div>
                {runtimeTemplate ? (
                  <div className="v12-rule-key-builder">
                    <div>
                      <b>Name the specific thing</b>
                      <span>
                        This key links the live value to one capability or
                        damage type. Use the same stable name wherever the rule
                        refers to it.
                      </span>
                    </div>
                    <code>
                      /
                      {runtimeTemplate.name.replace(
                        "<key>",
                        customValue.trim() ? slug(customValue) : "…",
                      )}
                      /
                    </code>
                    <div className="v12-rule-entry-row">
                      <input
                        value={customValue}
                        onChange={(event) => setCustomValue(event.target.value)}
                        placeholder={
                          runtimeTemplate.name.startsWith("maintained")
                            ? "e.g. flame_shield"
                            : runtimeTemplate.name.startsWith("damage")
                              ? "e.g. fire"
                              : "e.g. flame_shield"
                        }
                      />
                      <button
                        type="button"
                        disabled={!customValue.trim()}
                        onClick={() => {
                          chooseToken({
                            kind: "runtime",
                            name: runtimeTemplate.name.replace(
                              "<key>",
                              slug(customValue),
                            ),
                            hint: runtimeTemplate.hint,
                          });
                          setRuntimeTemplate(null);
                          setCustomValue("");
                        }}
                      >
                        Use named value
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="v12-rule-entry-row">
                    <input
                      value={customValue}
                      onChange={(event) => setCustomValue(event.target.value)}
                      placeholder="/tracking_bonus/"
                    />
                    <button
                      type="button"
                      disabled={!customValue.trim()}
                      onClick={() => {
                        chooseToken({
                          kind: "runtime",
                          name: slug(customValue.replace(/^\/|\/$/g, "")),
                          hint: "number",
                        });
                        setCustomValue("");
                      }}
                    >
                      Use custom runtime value
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            <div className="v12-rule-syntax-legend">
              <span>
                <b>#dice#</b> rolled value
              </span>
              <span>
                <b>/variable/</b> live value
              </span>
              <span>
                <b>[keyword]</b> state or tag
              </span>
            </div>
            <div className="v12-rule-panel-next">
              <button type="button" onClick={() => setActivePanel("recipient")}>
                Next · choose the recipient →
              </button>
            </div>
          </div>
        ) : null}

        {activePanel === "recipient" ? (
          <div>
            <div className="v12-rule-recipient-grid">
              {RECIPIENTS.map(([value, label, help]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={modifier.recipient === value}
                  onClick={() => onPatch({ recipient: value })}
                >
                  <b>{label}</b>
                  <span>{help}</span>
                </button>
              ))}
            </div>
            <div className="v12-rule-panel-next">
              <button type="button" onClick={() => setActivePanel("trigger")}>
                Next · choose when it applies →
              </button>
            </div>
          </div>
        ) : null}

        {activePanel === "trigger" ? (
          <div className="v12-rule-trigger-panel">
            <div
              className="v12-rule-trigger-modes"
              role="radiogroup"
              aria-label="Trigger mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={triggerMode === "always"}
                onClick={() => setTriggerMode("always")}
              >
                <b>Always</b>
                <span>Included whenever the primitive is active.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={triggerMode === "tracked"}
                onClick={() => setTriggerMode("tracked")}
              >
                <b>Tracked condition</b>
                <span>The engine reads sheet, target, or scene state.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={triggerMode === "declared"}
                onClick={() => setTriggerMode("declared")}
              >
                <b>Declared at table</b>
                <span>A player or GM switches on a named situation.</span>
              </button>
            </div>
            {triggerMode === "always" ? (
              <p className="v12-rule-trigger-note">
                No condition is stored. The modifier remains active for as long
                as its primitive, effect, item, or capability is active.
              </p>
            ) : null}
            {triggerMode === "tracked" ? (
              <TrackedConditionEditor
                condition={modifier.v1Condition}
                onPatchPill={patchPill}
                onRemove={removeCondition}
                onConnector={patchConnector}
                expandedIndex={expandedConditionIndex}
                onExpandedIndexChange={setExpandedConditionIndex}
              />
            ) : null}
            {triggerMode === "declared" ? (
              <div className="v12-rule-declared-editor">
                <p>
                  This creates a runtime flag. The player or GM can turn it on
                  for situations the sheet cannot detect by itself. Add several
                  events with the inline AND and OR controls above.
                </p>
                <div className="v12-rule-declared-current">
                  {modifier.v1Condition.pills.map((pill, index) => (
                    <article
                      className="v12-rule-condition-card v12-rule-declared-card"
                      key={index}
                    >
                      <header>
                        <div className="v12-rule-condition-join">
                          {index === 0 ? (
                            <strong>WHEN</strong>
                          ) : (
                            (["AND", "OR"] as const).map((value) => (
                              <button
                                type="button"
                                key={value}
                                aria-pressed={
                                  (modifier.v1Condition.operators[index - 1] ??
                                    "OR") === value
                                }
                                onClick={() => patchConnector(index, value)}
                              >
                                {value}
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          className="v12-rule-condition-summary"
                          aria-expanded={expandedConditionIndex === index}
                          onClick={() =>
                            setExpandedConditionIndex((current) =>
                              current === index ? null : index,
                            )
                          }
                        >
                          <b>{pill.label}</b>
                          <span aria-hidden="true">⌄</span>
                        </button>
                        <button
                          type="button"
                          className="v12-rule-condition-remove"
                          onClick={() => removeCondition(index)}
                          aria-label="Remove condition"
                        >
                          ×
                        </button>
                      </header>
                      {expandedConditionIndex === index ? (
                        <label className="v12-rule-declared-name">
                          <span>Table event</span>
                          <input
                            value={pill.label}
                            onChange={(event) => {
                              const clean = event.target.value;
                              patchPill(index, {
                                label: clean,
                                flag: `manual:${slug(clean)}`,
                              });
                            }}
                            placeholder="Name the table event"
                          />
                        </label>
                      ) : null}
                    </article>
                  ))}
                </div>
                <div className="v12-rule-declared-groups">
                  {DECLARED_TRIGGER_GROUPS.map((group) => (
                    <ValueGroup key={group.label} title={group.label}>
                      {group.values.map((text) => (
                        <button
                          type="button"
                          key={text}
                          aria-pressed={modifier.v1Condition.pills.some(
                            (pill) => pill.label === text,
                          )}
                          onClick={() => chooseDeclaredTrigger(text)}
                        >
                          {text}
                        </button>
                      ))}
                    </ValueGroup>
                  ))}
                </div>
                <div className="v12-rule-entry-row">
                  <input
                    value={declaredText}
                    onChange={(event) => setDeclaredText(event.target.value)}
                    placeholder="e.g. tracking a creature through the wilderness"
                  />
                  <button
                    type="button"
                    disabled={!declaredText.trim()}
                    onClick={() => chooseDeclaredTrigger(declaredText)}
                  >
                    Use trigger
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="v12-rule-stacking">
        <div className="v12-rule-stacking-copy">
          <b>Stacking rule</b>
          <span>
            When several effects modify the same result, decide which
            contributions the resolver keeps.
          </span>
        </div>
        <div className="v12-rule-stacking-picker">
          <label htmlFor="mechanical-rule-stacking">How they combine</label>
          <select
            id="mechanical-rule-stacking"
            aria-label="Stacking rule"
            value={modifier.stacking}
            onChange={(event) =>
              onPatch({
                stacking: event.target.value as ModifierDraft["stacking"],
              })
            }
          >
            {STACKING_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p>{selectedStacking.help}</p>
          <details>
            <summary>Compare all stacking rules</summary>
            <dl>
              {STACKING_OPTIONS.map((option) => (
                <div key={option.value}>
                  <dt>{option.label}</dt>
                  <dd>{option.help}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
        <button type="button" className="v12-rule-remove" onClick={onClear}>
          Remove mechanical rule
        </button>
      </section>

      {formulaOpen && typeof document !== "undefined"
        ? createPortal(
            <FormulaDialog
              text={formulaText}
              onTextChange={setFormulaText}
              parsed={parsedFormula}
              onCancel={() => setFormulaOpen(false)}
              onUse={applyFormula}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function ValueGroup({
  title: groupTitle,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <b>{groupTitle}</b>
      <div className="v12-rule-chip-row">{children}</div>
    </section>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  );
}

function TrackedConditionEditor({
  condition,
  onPatchPill,
  onRemove,
  onConnector,
  expandedIndex,
  onExpandedIndexChange,
}: {
  condition: ConditionAuthoring;
  onPatchPill: (index: number, patch: ConditionPillPatch) => void;
  onRemove: (index: number) => void;
  onConnector: (index: number, value: "AND" | "OR") => void;
  expandedIndex: number | null;
  onExpandedIndexChange: (index: number | null) => void;
}) {
  return (
    <div className="v12-rule-condition-editor">
      {condition.pills.map((pill, index) => (
        <ConditionCard
          key={`${index}:${pill.kind}:${pill.stat ?? pill.flag ?? pill.practice ?? pill.label}`}
          pill={pill}
          index={index}
          connector={condition.operators[index - 1] ?? "AND"}
          expanded={expandedIndex === index}
          onToggle={() =>
            onExpandedIndexChange(expandedIndex === index ? null : index)
          }
          onPatch={(patch) => onPatchPill(index, patch)}
          onRemove={() => onRemove(index)}
          onConnector={(value) => onConnector(index, value)}
        />
      ))}
    </div>
  );
}

function ConditionCard({
  pill,
  index,
  connector,
  expanded,
  onToggle,
  onPatch,
  onRemove,
  onConnector,
}: {
  pill: ConditionPill;
  index: number;
  connector: "AND" | "OR";
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: ConditionPillPatch) => void;
  onRemove: () => void;
  onConnector: (value: "AND" | "OR") => void;
}) {
  const initialGroup =
    pill.kind === "proficiency"
      ? "practice"
      : pill.kind === "flag"
        ? "state"
        : pill.stat === "vitality_pct"
          ? "sheet"
          : (CONDITION_STAT_FAMILIES.find((family) =>
              family.values.some((item) => item[1] === pill.stat),
            )?.id ?? "runtime");
  const raw = pill.value;
  const sheetReferenceNames = new Set<string>([
    ...ALL_ATTRIBUTES,
    ...ALL_PRACTICES,
    ...ALL_DERIVED,
    "proficiency_bonus",
  ]);
  const initialValueFamily =
    typeof raw === "string" && raw.startsWith("formula:")
      ? "formula"
      : typeof raw === "string" && /^#.*#$/.test(raw)
      ? "dice"
      : typeof raw === "string" && /^\/.*\/$/.test(raw)
        ? sheetReferenceNames.has(raw.slice(1, -1).toLowerCase())
          ? "sheet"
          : "runtime"
        : typeof raw === "string" && /^\[.*\]$/.test(raw)
          ? "state"
          : "fixed";
  const [readGroup, setReadGroup] = useState(initialGroup);
  const [valueFamily, setValueFamily] = useState<
    "fixed" | "sheet" | "dice" | "formula" | "state" | "runtime"
  >(initialValueFamily);
  const [diceDraft, setDiceDraft] = useState(
    typeof raw === "string" && /^#.*#$/.test(raw) ? raw.slice(1, -1) : "1d6",
  );
  const [formulaDraft, setFormulaDraft] = useState(
    typeof raw === "string" && raw.startsWith("formula:")
      ? raw.slice("formula:".length)
      : "PB + 1",
  );
  const [runtimeDraft, setRuntimeDraft] = useState(
    typeof raw === "string" && /^\/.*\/$/.test(raw) ? raw.slice(1, -1) : "",
  );
  const [keywordDraft, setKeywordDraft] = useState(
    typeof raw === "string" && /^\[.*\]$/.test(raw) ? raw.slice(1, -1) : "",
  );
  const [vitalityUnit, setVitalityUnit] = useState<"absolute" | "percent">(
    pill.stat === "vitality_pct" ? "percent" : "absolute",
  );
  const customStat =
    pill.kind === "stat" &&
    pill.stat !== "vitality_pct" &&
    !CONDITION_STATS.some((item) => item[1] === pill.stat);
  const customFlag =
    pill.kind === "flag" && Boolean(pill.flag?.startsWith("runtime:"));
  const setStat = (stat: string) => {
    const resolvedStat =
      stat === "vitality" && vitalityUnit === "percent" ? "vitality_pct" : stat;
    onPatch({
      kind: "stat",
      stat: resolvedStat,
      operator: pill.kind === "stat" ? (pill.operator ?? "<") : "<",
      value: resolvedStat === "vitality_pct" ? 0.5 : 1,
      valueHigh: undefined,
      practice: undefined,
      flag: undefined,
    });
  };
  const numericValue =
    typeof pill.value === "number"
      ? pill.stat === "vitality_pct"
        ? Number((pill.value * 100).toFixed(5))
        : pill.value
      : "";
  const switchVitalityUnit = (unit: "absolute" | "percent") => {
    if (unit === vitalityUnit) return;
    const displayed = typeof numericValue === "number" ? numericValue : 1;
    const highDisplayed =
      typeof pill.valueHigh === "number"
        ? pill.stat === "vitality_pct"
          ? Number((pill.valueHigh * 100).toFixed(5))
          : pill.valueHigh
        : undefined;
    setVitalityUnit(unit);
    onPatch({
      stat: unit === "percent" ? "vitality_pct" : "vitality",
      value: unit === "percent" ? displayed / 100 : displayed,
      valueHigh:
        highDisplayed === undefined
          ? undefined
          : unit === "percent"
            ? highDisplayed / 100
            : highDisplayed,
    });
  };
  const storeNumber = (text: string, high = false) => {
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    const stored = pill.stat === "vitality_pct" ? value / 100 : value;
    onPatch(high ? { valueHigh: stored } : { value: stored });
  };
  const parsedConditionFormula = parseRuleFormula(formulaDraft);
  return (
    <article className="v12-rule-condition-card">
      <header>
        <div className="v12-rule-condition-join">
          {index === 0 ? (
            <strong>WHEN</strong>
          ) : (
            <>
              {(["AND", "OR"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={connector === value}
                  onClick={() => onConnector(value)}
                >
                  {value}
                </button>
              ))}
            </>
          )}
        </div>
        <button
          type="button"
          className="v12-rule-condition-summary"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <b>{conditionLabel(pill)}</b>
          <span aria-hidden="true">⌄</span>
        </button>
        <button
          type="button"
          className="v12-rule-condition-remove"
          onClick={onRemove}
          aria-label="Remove condition"
        >
          ×
        </button>
      </header>
      {expanded ? (
        <>
          <div className="v12-rule-condition-stage">
            <span>Who</span>
            <div className="v12-rule-chip-row">
              {SUBJECTS.map((item) => (
                <Choice
                  key={item.value}
                  label={item.label}
                  selected={
                    (pill.category === "actor" ? "self" : pill.category) ===
                    item.value
                  }
                  onClick={() => onPatch({ category: item.value })}
                />
              ))}
            </div>
          </div>
          <div className="v12-rule-condition-stage">
            <span>Read</span>
            <div className="v12-rule-condition-palette">
              <div
                className="v12-rule-family-tabs"
                role="tablist"
                aria-label="Tracked condition value types"
              >
                {[
                  ...CONDITION_STAT_FAMILIES.map(
                    (family) => [family.id, family.label] as const,
                  ),
                  ["practice", "Practice proficiency"] as const,
                  ["state", "State / event"] as const,
                ].map(([value, label]) => (
                  <button
                    type="button"
                    role="tab"
                    key={value}
                    aria-selected={readGroup === value}
                    onClick={() => setReadGroup(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {CONDITION_STAT_FAMILIES.map((family) =>
                readGroup === family.id ? (
                  <div className="v12-rule-chip-row" key={family.id}>
                    {family.values.map(([label, value]) => (
                      <Choice
                        key={value}
                        label={label}
                        selected={
                          pill.kind === "stat" &&
                          (value === "vitality"
                            ? pill.stat === "vitality" ||
                              pill.stat === "vitality_pct"
                            : pill.stat === value)
                        }
                        onClick={() => setStat(value)}
                      />
                    ))}
                    {family.id === "runtime" ? (
                      <Choice
                        label="Custom runtime value…"
                        selected={customStat}
                        onClick={() => setStat("custom_value")}
                      />
                    ) : null}
                  </div>
                ) : null,
              )}
              {readGroup === "practice" ? (
                <div className="v12-rule-chip-row">
                  {ALL_PRACTICES.map((practice) => (
                    <Choice
                      key={practice}
                      label={title(practice)}
                      selected={
                        pill.kind === "proficiency" &&
                        pill.practice === practice
                      }
                      onClick={() =>
                        onPatch({
                          kind: "proficiency",
                          practice,
                          operator: "=",
                          value: "proficient",
                          stat: undefined,
                          flag: undefined,
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
              {readGroup === "state" ? (
                <div className="v12-rule-chip-row">
                  {CONDITION_FLAGS.map((flag) => (
                    <Choice
                      key={flag}
                      label={title(flag)}
                      selected={
                        pill.kind === "flag" && pill.flag === slug(flag)
                      }
                      onClick={() =>
                        onPatch({
                          kind: "flag",
                          flag: slug(flag),
                          operator: "=",
                          value: "active",
                          stat: undefined,
                          practice: undefined,
                        })
                      }
                    />
                  ))}
                  <Choice
                    label="Custom tracked state…"
                    selected={customFlag}
                    onClick={() =>
                      onPatch({
                        kind: "flag",
                        flag: "runtime:custom_event",
                        operator: "=",
                        value: "active",
                        stat: undefined,
                        practice: undefined,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
          {customStat ? (
            <label className="v12-rule-condition-custom">
              <span>Runtime name</span>
              <input
                value={pill.stat ?? ""}
                onChange={(event) =>
                  onPatch({
                    stat: runtimeKey(event.target.value, "custom_value"),
                  })
                }
                placeholder="scene_heat"
              />
            </label>
          ) : null}
          {customFlag ? (
            <label className="v12-rule-condition-custom">
              <span>Runtime name</span>
              <input
                value={pill.flag?.slice("runtime:".length) ?? ""}
                onChange={(event) =>
                  onPatch({
                    flag: `runtime:${runtimeKey(event.target.value, "custom_event")}`,
                  })
                }
                placeholder="combat_started"
              />
            </label>
          ) : null}
          {pill.kind === "stat" ? (
            <>
              <div className="v12-rule-condition-stage">
                <span>Compare</span>
                <div className="v12-rule-chip-row">
                  {COMPARISONS.map(([label, value]) => (
                    <Choice
                      key={value}
                      label={label}
                      selected={pill.operator === value}
                      onClick={() =>
                        onPatch({
                          operator: value,
                          valueHigh:
                            value === "between"
                              ? (pill.valueHigh ?? pill.value)
                              : undefined,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="v12-rule-condition-stage">
                <span>Value</span>
                <div className="v12-rule-condition-value">
                  <div
                    className="v12-rule-family-tabs"
                    role="tablist"
                    aria-label="Comparison value sources"
                  >
                    {(
                      [
                        ["fixed", "Fixed number"],
                        ["sheet", "Sheet value"],
                        ["dice", "Dice"],
                        ["formula", "Formula"],
                        ["state", "State / keyword"],
                        ["runtime", "Custom runtime"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        type="button"
                        role="tab"
                        key={value}
                        aria-selected={valueFamily === value}
                        onClick={() => setValueFamily(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {valueFamily === "fixed" ? (
                    <div className="v12-rule-fixed-condition">
                      {pill.stat === "vitality" ||
                      pill.stat === "vitality_pct" ? (
                        <p className="v12-rule-percent-help">Toggle % to compare a percentage; leave it off for exact Vitality.</p>
                      ) : null}
                      <div className="v12-rule-entry-row">
                        <div className="v12-rule-number-entry">
                          {pill.stat === "vitality" || pill.stat === "vitality_pct" ? (
                            <button type="button" className="v12-rule-percent-toggle" aria-pressed={vitalityUnit === "percent"} aria-label={vitalityUnit === "percent" ? "Use absolute Vitality" : "Use Vitality percentage"} onClick={() => switchVitalityUnit(vitalityUnit === "percent" ? "absolute" : "percent")}>%</button>
                          ) : null}
                          <input type="number" step="any" inputMode="decimal" value={numericValue} onChange={(event) => storeNumber(event.target.value)} placeholder="Any whole or decimal number" />
                        </div>
                        <div className="v12-rule-chip-row">
                          {(pill.stat === "vitality_pct"
                            ? [10, 25, 31.28436, 50, 75]
                            : NUMBER_SHORTCUTS
                          ).map((value) => (
                            <Choice
                              key={value}
                              label={String(value)}
                              selected={numericValue === value}
                              onClick={() => storeNumber(String(value))}
                            />
                          ))}
                        </div>
                      </div>
                      <small>
                        {pill.stat === "vitality_pct"
                          ? "Percentage is selected. Enter 50 for 50%, or use any decimal percentage such as 31.28436."
                          : pill.stat === "vitality"
                            ? "Absolute Vitality is selected. Enter the exact number of Vitality points."
                            : "Whole numbers, decimals, and negative values are allowed."}
                      </small>
                    </div>
                  ) : null}
                  {valueFamily === "sheet" ? (
                    <div className="v12-rule-condition-library">
                      <ValueGroup title="Attributes">
                      {ALL_ATTRIBUTES.map((value) => (
                        <Choice
                          key={value}
                          label={`/${title(value)}/`}
                          selected={pill.value === `/${value}/`}
                          onClick={() => onPatch({ value: `/${value}/` })}
                        />
                      ))}
                      </ValueGroup>
                      <ValueGroup title="Practices">
                      {ALL_PRACTICES.map((value) => (
                        <Choice
                          key={value}
                          label={`/${title(value)}/`}
                          selected={pill.value === `/${value}/`}
                          onClick={() => onPatch({ value: `/${value}/` })}
                        />
                      ))}
                      </ValueGroup>
                      <ValueGroup title="Derived values">
                        {ALL_DERIVED.map((value) => (
                          <Choice key={value} label={`/${title(value)}/`} selected={pill.value === `/${value}/` || (value === "pb" && pill.value === "/proficiency_bonus/")} onClick={() => onPatch({ value: `/${value === "pb" ? "proficiency_bonus" : value}/` })} />
                        ))}
                      </ValueGroup>
                    </div>
                  ) : null}
                  {valueFamily === "dice" ? (
                    <div className="v12-rule-condition-library">
                      <div className="v12-rule-chip-row">{DICE_TYPES.map((die) => (
                        <Choice
                          key={die}
                          label={`#1${die}#`}
                          selected={pill.value === `#1${die}#`}
                          onClick={() => onPatch({ value: `#1${die}#` })}
                        />
                      ))}</div>
                      <div className="v12-rule-entry-row">
                        <input value={diceDraft} onChange={(event) => setDiceDraft(event.target.value)} placeholder="2d8 + 3" />
                        <button type="button" disabled={!diceDraft.trim()} onClick={() => onPatch({ value: `#${diceDraft.trim().replace(/^#|#$/g, "")}#` })}>Use #dice#</button>
                      </div>
                    </div>
                  ) : null}
                  {valueFamily === "formula" ? (
                    <div className="v12-rule-condition-formula">
                      <input value={formulaDraft} onChange={(event) => setFormulaDraft(event.target.value)} placeholder="(5 + PB) / Awareness + 2d8" />
                      <button type="button" disabled={Boolean(parsedConditionFormula.error)} onClick={() => onPatch({ value: `formula:${renderEquation(parsedConditionFormula.operands)}` })}>Use formula</button>
                      <small className={parsedConditionFormula.error ? "has-error" : ""}>{parsedConditionFormula.error ?? renderEquation(parsedConditionFormula.operands)}</small>
                    </div>
                  ) : null}
                  {valueFamily === "runtime" ? (
                    <div className="v12-rule-condition-library">
                      {Array.from(new Set(RUNTIME_VARIABLES.map((item) => item.group))).map((group) => (
                        <ValueGroup key={group} title={group}>
                          {RUNTIME_VARIABLES.filter((item) => item.group === group).map((item) => (
                            <Choice key={item.name} label={`/${item.label}/`} selected={!item.name.includes("<key>") && pill.value === `/${item.name}/`} onClick={() => { if (item.name.includes("<key>")) { setRuntimeDraft(item.name.replace("<key>", "")); return; } onPatch({ value: `/${item.name}/` }); }} />
                          ))}
                        </ValueGroup>
                      ))}
                      <div className="v12-rule-entry-row">
                      <input
                        value={runtimeDraft}
                        onChange={(event) =>
                          setRuntimeDraft(event.target.value)
                        }
                        placeholder="scene_heat"
                      />
                      <button
                        type="button"
                        disabled={!runtimeDraft.trim()}
                        onClick={() =>
                          onPatch({
                            value: `/${runtimeKey(runtimeDraft, "runtime_value")}/`,
                          })
                        }
                      >
                        Use /variable/
                      </button>
                      </div>
                    </div>
                  ) : null}
                  {valueFamily === "state" ? (
                    <div className="v12-rule-condition-library">
                      {Array.from(new Set(SUB_CHOICE_KEYWORDS.map((item) => item.group))).map((group) => (
                        <ValueGroup key={group} title={group}>
                          {SUB_CHOICE_KEYWORDS.filter((item) => item.group === group).map((item) => { const value = slug(item.label); return <Choice key={`${group}:${value}`} label={`[${item.label}]`} selected={pill.value === `[${value}]`} onClick={() => onPatch({ value: `[${value}]` })} />; })}
                        </ValueGroup>
                      ))}
                      <div className="v12-rule-entry-row">
                      <input
                        value={keywordDraft}
                        onChange={(event) =>
                          setKeywordDraft(event.target.value)
                        }
                        placeholder="fire"
                      />
                      <button
                        type="button"
                        disabled={!keywordDraft.trim()}
                        onClick={() =>
                          onPatch({ value: `[${slug(keywordDraft)}]` })
                        }
                      >
                        Use [keyword]
                      </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {pill.operator === "between" ? (
                <label className="v12-rule-condition-custom">
                  <span>Upper value</span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={
                      typeof pill.valueHigh === "number"
                        ? pill.stat === "vitality_pct"
                          ? Number((pill.valueHigh * 100).toFixed(5))
                          : pill.valueHigh
                        : String(pill.valueHigh ?? "")
                    }
                    onChange={(event) => storeNumber(event.target.value, true)}
                    placeholder="Upper number"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <p className="v12-rule-condition-state">
              This tracked state is either active or inactive; it does not need
              a comparison value.
            </p>
          )}
        </>
      ) : null}
    </article>
  );
}

function FormulaDialog({
  text,
  onTextChange,
  parsed,
  onCancel,
  onUse,
}: {
  text: string;
  onTextChange: (value: string) => void;
  parsed: ReturnType<typeof parseRuleFormula>;
  onCancel: () => void;
  onUse: () => void;
}) {
  const [operator, setOperator] = useState<Operator>("+");
  const [library, setLibrary] = useState("sheet");
  const formulaLibraries = [
    ["sheet", "Sheet values"],
    ["numbers", "Numbers"],
    ["dice", "Dice"],
    ["runtime", "Runtime"],
    ["tags", "Tags"],
  ] as const;
  const append = (snippet: string) =>
    onTextChange(
      text.trim()
        ? `${text.trim()} ${operator === "*" ? "×" : operator === "/" ? "÷" : operator} ${snippet}`
        : snippet,
    );
  const formulaChoices: ReadonlyArray<readonly [string, string]> =
    library === "numbers"
      ? NUMBER_SHORTCUTS.map((value) => [String(value), String(value)] as const)
      : library === "sheet"
        ? [
            ...ALL_ATTRIBUTES.map(
              (value) => [title(value), title(value)] as const,
            ),
            ...ALL_PRACTICES.map(
              (value) => [title(value), title(value)] as const,
            ),
            ["PB", "PB"] as const,
            ["Half PB", "PB/2"] as const,
            ["Double PB", "PB×2"] as const,
            ["Level", "Level"] as const,
          ]
        : library === "dice"
          ? DICE_TYPES.map((die) => [`#1${die}#`, `#1${die}#`] as const)
          : library === "runtime"
            ? RUNTIME_VARIABLES.filter(
                (item) => !item.name.includes("<key>"),
              ).map((item) => [`/${item.label}/`, `/${item.name}/`] as const)
            : SUB_CHOICE_KEYWORDS.filter((item) =>
                ["Damage Type", "Condition", "Bias"].includes(item.group),
              ).map(
                (item) => [`[${item.label}]`, `[${slug(item.label)}]`] as const,
              );
  return (
    <div
      className="v12-rule-formula-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        className="v12-rule-formula-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-formula-title"
      >
        <header>
          <div>
            <span>Expression builder</span>
            <h2 id="rule-formula-title">Build the rule value</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close formula builder"
          >
            ×
          </button>
        </header>
        <div className="v12-rule-formula-body">
          <label className="v12-rule-formula-input">
            <span>Formula</span>
            <textarea
              autoFocus
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              spellCheck={false}
              placeholder="(5 + PB) / Awareness + #2d8# + PBd10 [fire]"
            />
          </label>
          <div
            className={`v12-rule-formula-preview${parsed.error ? " has-error" : ""}`}
          >
            <small>Resolved expression</small>
            <b>{parsed.error ?? renderEquation(parsed.operands)}</b>
          </div>
          <div className="v12-rule-formula-operators">
            <span>Next operator</span>
            {(["+", "-", "*", "/", "%"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={operator === value}
                onClick={() => setOperator(value)}
              >
                {value === "*" ? "×" : value === "/" ? "÷" : value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onTextChange(`(${text.trim()})`)}
            >
              Group all ( )
            </button>
          </div>
          <div
            className="v12-rule-family-tabs"
            role="tablist"
            aria-label="Formula value library"
          >
            {formulaLibraries.map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={library === key}
                onClick={() => setLibrary(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="v12-rule-formula-library">
            {formulaChoices.map(([label, snippet]) => (
              <button
                type="button"
                key={`${label}:${snippet}`}
                onClick={() => append(snippet)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="v12-rule-formula-help">
            <b>Syntax</b>
            <span>
              <code>#dice#</code> rolls dice, <code>/variable/</code> reads a
              live runtime value, and <code>[keyword]</code> carries a state or
              damage tag. Use + − × ÷ %, and parentheses. A keyed runtime value
              must contain its real name, for example{" "}
              <code>/maintained:flame_shield/</code>.
            </span>
          </div>
        </div>
        <footer>
          <button type="button" onClick={() => onTextChange("")}>
            Clear
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={!!parsed.error || !parsed.operands.length}
            onClick={onUse}
          >
            Use formula
          </button>
        </footer>
      </section>
    </div>
  );
}
