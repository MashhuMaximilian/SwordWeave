"use client";

import { useState } from "react";
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
  type Operand,
  type ValueToken,
  type ValueType,
} from "@/types/modifier";
import {
  allowedValueTypes,
  classifyTypedValue,
  NUMBER_SHORTCUTS,
  OPERATION_LABELS,
  RUNTIME_VARIABLES,
  SUB_CHOICE_KEYWORDS,
} from "@/lib/primitives/form-helpers";
import {
  MODIFIER_TARGET_SPEC,
  MODIFIER_TARGETS,
  type ModifierTarget,
} from "@/lib/primitives/modifier-scope";
import { EquationPicker } from "./equation-picker";
import type { ModifierDraft } from "./primitive-form";

const RECIPIENTS = ["SELF", "TARGET", "SCENE"] as const;
const SUBJECTS: ReadonlyArray<{
  label: string;
  value: ConditionPresetCategory;
}> = [
  { label: "Self", value: "self" },
  { label: "Target", value: "target" },
  { label: "Scene", value: "scene" },
];
const COMPARISONS = [
  { label: "is lower than", value: "<" },
  { label: "is at most", value: "<=" },
  { label: "is", value: "=" },
  { label: "is not", value: "!=" },
  { label: "is at least", value: ">=" },
  { label: "is greater than", value: ">" },
  { label: "is between", value: "between" },
] as const;
const CONDITION_STATS = [
  ["Vitality", "vitality"],
  ["Vitality %", "vitality_pct"],
  ["Save DC", "save_dc"],
  ["Block value", "block_value"],
  ["Physical", "physical"],
  ["Mental", "mental"],
  ["Magical", "magical"],
  ["Speed", "speed"],
  ["Carry capacity", "carry_capacity"],
  ["Load", "load"],
  ["Complexity", "complexity"],
  ["Upkeep cost", "upkeep_cost"],
] as const;
const CONDITION_FLAGS = [
  "prone",
  "stunned",
  "bleeding",
  "frightened",
  "blinded",
  "charmed",
  "grappled",
  "restrained",
  "sick",
  "wounded",
  "damaged last round",
  "equipped",
  "encumbered",
] as const;

interface Choice {
  label: string;
  search?: string;
  selected?: boolean;
  select: () => void;
}
interface Group {
  name: string;
  choices: Choice[];
  hint?: string;
}

type ActiveKey =
  | "target"
  | "operation"
  | "value"
  | "recipient"
  | `condition:${number}:subject`
  | `condition:${number}:thing`
  | `condition:${number}:operator`
  | `condition:${number}:value`;

function title(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function recipientLabel(value: ModifierDraft["recipient"]): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
function targetLabel(modifier: ModifierDraft): string {
  if (modifier.targetValues.length) {
    const spec = MODIFIER_TARGET_SPEC[modifier.target as ModifierTarget];
    return modifier.targetValues
      .map((value) => spec?.optionLabels?.[value] ?? title(value))
      .join(" / ");
  }
  return (
    modifier.freeTextNarrowFocus ||
    MODIFIER_TARGET_SPEC[modifier.target as ModifierTarget]?.label ||
    title(String(modifier.target))
  );
}
function valueLabel(modifier: ModifierDraft): string {
  if (modifier.valueKind === "equation")
    return renderEquation(modifier.operands) || "choose value";
  return (
    modifier.tokens.map(tokenLabel).join(" + ") ||
    modifier.value ||
    "choose value"
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
    min: { lead: "Set", join: "to", word: "minimum" },
    max: { lead: "Set", join: "to", word: "maximum" },
    set: { lead: "Set", join: "to", word: "exactly" },
    grant: { lead: "Grant", join: "to", word: "" },
    revoke: { lead: "Revoke", join: "from", word: "" },
  };
  return values[operation];
}
function conditionPhrase(pill: ConditionAuthoring["pills"][number]) {
  const subject = pill.category === "actor" ? "Self" : title(pill.category);
  if (pill.kind === "stat") {
    const comparator =
      COMPARISONS.find((item) => item.value === pill.operator)?.label ?? "is";
    const raw = pill.value ?? "value";
    const value =
      typeof raw === "number" && raw > 0 && raw < 1
        ? `${Math.round(raw * 100)}%`
        : String(raw);
    return {
      subject,
      thing: title(pill.stat ?? pill.label),
      comparator,
      value,
    };
  }
  if (pill.kind === "flag")
    return {
      subject,
      thing: title(pill.flag ?? pill.label),
      comparator: "is",
      value: "active",
    };
  if (pill.kind === "proficiency")
    return {
      subject,
      thing: title(pill.practice ?? pill.label),
      comparator: "is",
      value: "proficient",
    };
  return { subject, thing: pill.label, comparator: "is", value: "true" };
}
function rebuildConditionLabel(pill: ConditionAuthoring["pills"][number]) {
  const phrase = conditionPhrase(pill);
  return `${phrase.subject} ${phrase.thing} ${phrase.comparator} ${phrase.value}`;
}
function valueKindForCategory(category: string): ValueType {
  if (category === "Dice") return "dice";
  if (category === "Boolean") return "boolean";
  if (category === "Equation") return "equation";
  if (["Text", "Keywords"].includes(category)) return "text";
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
  const [active, setActive] = useState<ActiveKey>("target");
  const [category, setCategory] = useState("Attribute");
  const [categorySearch, setCategorySearch] = useState("");
  const [valueSearch, setValueSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [expandedValues, setExpandedValues] = useState(false);

  const open = (key: ActiveKey, preferred?: string) => {
    setActive(key);
    if (preferred) setCategory(preferred);
    setCategorySearch("");
    setValueSearch("");
    setExpandedCategories(false);
    setExpandedValues(false);
  };
  const patchPill = (
    index: number,
    patch: Partial<ConditionAuthoring["pills"][number]>,
  ) => {
    const pills = modifier.v1Condition.pills.map((pill, pillIndex) => {
      if (pillIndex !== index) return pill;
      const next = { ...pill, ...patch };
      return { ...next, label: rebuildConditionLabel(next) };
    });
    onConditionChange({ ...modifier.v1Condition, pills });
  };
  const addCondition = (join: "AND" | "OR" = "AND") => {
    const pills = [
      ...modifier.v1Condition.pills,
      {
        category: "self" as const,
        label: "Self Vitality % is lower than 50%",
        kind: "stat" as const,
        stat: "vitality_pct",
        operator: "<" as const,
        value: 0.5,
      },
    ];
    const operators =
      pills.length > 1 ? [...modifier.v1Condition.operators, join] : [];
    onConditionChange({
      ...modifier.v1Condition,
      categories: [
        ...new Set([...modifier.v1Condition.categories, "self" as const]),
      ],
      pills,
      operators,
    });
    open(`condition:${pills.length - 1}:subject`, "Scope");
  };
  const removeCondition = (index: number) => {
    const pills = modifier.v1Condition.pills.filter(
      (_, pillIndex) => pillIndex !== index,
    );
    const operators = pills
      .slice(1)
      .map(
        (_, operatorIndex) =>
          modifier.v1Condition.operators[operatorIndex] ?? "AND",
      );
    onConditionChange({ ...modifier.v1Condition, pills, operators });
    open(
      "target",
      MODIFIER_TARGET_SPEC[modifier.target as ModifierTarget]?.label ??
        "Attribute",
    );
  };
  const chooseToken = (token: ValueToken, kind: ValueType) => {
    onPatch({
      tokens: [token],
      operands: [],
      valueKind: kind,
      value: String(serializeValueField([token])[0] ?? ""),
    });
  };
  const chooseCustomValue = () => {
    const raw = valueSearch.trim();
    if (!raw) return;
    const kind = valueKindForCategory(category);
    const result = classifyTypedValue(raw, modifier.operation, kind);
    if (result.token) chooseToken(result.token, kind);
    setValueSearch("");
  };

  const groups: Group[] = (() => {
    const conditionMatch = active.match(
      /^condition:(\d+):(subject|thing|operator|value)$/,
    );
    if (active === "operation")
      return [
        {
          name: "Operations",
          choices: OPERATION_LABELS.map((item) => ({
            label: item.label,
            selected: modifier.operation === item.value,
            select: () => onOperation(item.value),
          })),
        },
      ];
    if (active === "recipient")
      return [
        {
          name: "Recipients",
          choices: RECIPIENTS.map((value) => ({
            label: recipientLabel(value),
            selected: modifier.recipient === value,
            select: () => onPatch({ recipient: value }),
          })),
        },
      ];
    if (active === "target")
      return MODIFIER_TARGETS.map((target) => {
        const spec = MODIFIER_TARGET_SPEC[target];
        const choices: Choice[] = spec.options?.length
          ? spec.options.map((value) => ({
              label: spec.optionLabels?.[value] ?? title(value),
              selected:
                modifier.target === target &&
                modifier.targetValues.includes(value),
              select: () =>
                onPatch({
                  target,
                  targetValues: [value],
                  freeTextNarrowFocus: "",
                  ...(target === "damage_healing_output"
                    ? { valueKind: "dice" as const }
                    : {}),
                }),
            }))
          : [
              {
                label: `Any ${spec.label}`,
                selected:
                  modifier.target === target && !modifier.targetValues.length,
                select: () =>
                  onPatch({
                    target,
                    targetValues: [],
                    freeTextNarrowFocus: "",
                    ...(target === "damage_healing_output"
                      ? { valueKind: "dice" as const }
                      : {}),
                  }),
              },
            ];
        return {
          name: spec.label,
          choices,
          ...(spec.freeTextPlaceholder
            ? { hint: spec.freeTextPlaceholder }
            : {}),
        };
      });
    if (active === "value") {
      const allowed = new Set(allowedValueTypes(modifier.operation));
      const result: Group[] = [];
      if (allowed.has("number"))
        result.push({
          name: "Number",
          choices: NUMBER_SHORTCUTS.map((value) => ({
            label: String(value),
            selected:
              modifier.tokens[0]?.kind === "number" &&
              modifier.tokens[0].value === value,
            select: () => chooseToken({ kind: "number", value }, "number"),
          })),
        });
      if (allowed.has("dice"))
        result.push({
          name: "Dice",
          choices: DICE_TYPES.map((die) => ({
            label: `1${die}`,
            selected:
              modifier.tokens[0]?.kind === "dice" &&
              modifier.tokens[0].expression === `1${die}`,
            select: () =>
              chooseToken({ kind: "dice", expression: `1${die}` }, "dice"),
          })),
        });
      if (allowed.has("boolean"))
        result.push({
          name: "Boolean",
          choices: ["true", "false"].map((name) => ({
            label: title(name),
            selected:
              modifier.tokens[0]?.kind === "behavior" &&
              modifier.tokens[0].name === name,
            select: () => chooseToken({ kind: "behavior", name }, "boolean"),
          })),
        });
      if (allowed.has("equation"))
        result.push({ name: "Equation", choices: [] });
      if (allowed.has("text"))
        result.push({
          name: "Text",
          choices: SUB_CHOICE_KEYWORDS.slice(0, 10).map((item) => ({
            label: `[${item.label.toLowerCase()}]`,
            select: () =>
              chooseToken(
                {
                  kind: "keyword",
                  text: item.label.toLowerCase().replaceAll(" ", "_"),
                },
                "text",
              ),
          })),
        });
      if (allowed.has("number")) {
        result.push({
          name: "Attribute",
          choices: ALL_ATTRIBUTES.map((attribute) => ({
            label: title(attribute),
            selected:
              modifier.tokens[0]?.kind === "attribute" &&
              modifier.tokens[0].attribute === attribute,
            select: () =>
              chooseToken({ kind: "attribute", attribute }, "number"),
          })),
        });
        result.push({
          name: "Practice",
          choices: ALL_PRACTICES.map((practice) => ({
            label: title(practice),
            selected:
              modifier.tokens[0]?.kind === "practice" &&
              modifier.tokens[0].practice === practice,
            select: () => chooseToken({ kind: "practice", practice }, "number"),
          })),
        });
        result.push({
          name: "Derived",
          choices: ALL_DERIVED.map((which) => ({
            label: which.toUpperCase().replace("PB_HALF", "PB/2"),
            selected:
              modifier.tokens[0]?.kind === "derived" &&
              modifier.tokens[0].which === which,
            select: () => chooseToken({ kind: "derived", which }, "number"),
          })),
        });
        result.push({
          name: "Runtime",
          choices: RUNTIME_VARIABLES.map((item) => ({
            label: `/${item.label}/`,
            selected:
              modifier.tokens[0]?.kind === "runtime" &&
              modifier.tokens[0].name === item.name,
            select: () =>
              chooseToken(
                { kind: "runtime", name: item.name, hint: item.hint },
                "number",
              ),
          })),
        });
      }
      result.push(
        ...Array.from(
          new Set(SUB_CHOICE_KEYWORDS.map((item) => item.group)),
        ).map((group) => ({
          name: group,
          choices: SUB_CHOICE_KEYWORDS.filter(
            (item) => item.group === group,
          ).map((item) => ({
            label: item.label,
            selected:
              modifier.tokens[0]?.kind === "keyword" &&
              modifier.tokens[0].text ===
                item.label.toLowerCase().replaceAll(" ", "_"),
            select: () =>
              chooseToken(
                {
                  kind: "keyword",
                  text: item.label.toLowerCase().replaceAll(" ", "_"),
                },
                "text",
              ),
          })),
        })),
      );
      return result;
    }
    if (conditionMatch) {
      const index = Number(conditionMatch[1]);
      const part = conditionMatch[2];
      const pill = modifier.v1Condition.pills[index];
      if (!pill) return [];
      if (part === "subject")
        return [
          {
            name: "Scope",
            choices: SUBJECTS.map((item) => ({
              label: item.label,
              selected: pill.category === item.value,
              select: () => patchPill(index, { category: item.value }),
            })),
          },
        ];
      if (part === "thing")
        return [
          {
            name: "Stat references",
            choices: CONDITION_STATS.map(([label, stat]) => ({
              label,
              selected: pill.kind === "stat" && pill.stat === stat,
              select: () =>
                patchPill(index, {
                  kind: "stat",
                  stat,
                  operator: pill.operator ?? "<",
                  value: pill.value ?? 0.5,
                }),
            })),
          },
          {
            name: "Practice proficiency",
            choices: ALL_PRACTICES.map((practice) => ({
              label: `${title(practice)} proficiency`,
              selected:
                pill.kind === "proficiency" && pill.practice === practice,
              select: () =>
                patchPill(index, {
                  kind: "proficiency",
                  practice,
                  operator: "=",
                  value: "proficient",
                }),
            })),
          },
          {
            name: "Status flags",
            choices: CONDITION_FLAGS.map((flag) => ({
              label: title(flag),
              selected:
                pill.kind === "flag" && pill.flag === flag.replaceAll(" ", "_"),
              select: () =>
                patchPill(index, {
                  kind: "flag",
                  flag: flag.replaceAll(" ", "_"),
                  operator: "=",
                  value: "active",
                }),
            })),
          },
        ];
      if (part === "operator")
        return [
          {
            name: "Comparison",
            choices: COMPARISONS.map((item) => ({
              label: item.label,
              selected: pill.operator === item.value,
              select: () => patchPill(index, { operator: item.value }),
            })),
          },
        ];
      return [
        {
          name: "Common values",
          choices: [0, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10].map((value) => ({
            label: value > 0 && value < 1 ? `${value * 100}%` : String(value),
            selected: pill.value === value,
            select: () => patchPill(index, { value }),
          })),
        },
      ];
    }
    return [];
  })();

  const currentCategory = groups.some((group) => group.name === category)
    ? category
    : (groups[0]?.name ?? "");
  const categoryMatches = groups.filter((group) =>
    group.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );
  const shownCategories = expandedCategories
    ? categoryMatches
    : categoryMatches.slice(0, 7);
  const selectedGroup =
    groups.find((group) => group.name === currentCategory) ?? groups[0];
  const valueMatches = (selectedGroup?.choices ?? []).filter((choice) =>
    `${choice.label} ${choice.search ?? ""}`
      .toLowerCase()
      .includes(valueSearch.toLowerCase()),
  );
  const shownValues = expandedValues ? valueMatches : valueMatches.slice(0, 10);
  const simple =
    active === "operation" ||
    active === "recipient" ||
    active.endsWith(":subject");
  const operation = operationWords(modifier.operation);

  return (
    <div className="v12-reference-rule-instrument">
      <div
        className="v12-reference-sentence"
        aria-label="Mechanical rule sentence"
      >
        {modifier.operation === "grant" || modifier.operation === "revoke" ? (
          <>
            <button
              type="button"
              className="v12-ref-slot is-operation"
              aria-pressed={active === "operation"}
              onClick={() => open("operation", "Operations")}
            >
              {operation.lead}
            </button>
            <button
              type="button"
              className="v12-ref-slot is-value"
              aria-pressed={active === "value"}
              onClick={() =>
                open(
                  "value",
                  modifier.valueKind === "dice"
                    ? "Dice"
                    : title(modifier.valueKind),
                )
              }
            >
              {valueLabel(modifier)}
            </button>
            <span>{operation.join}</span>
            <button
              type="button"
              className="v12-ref-slot is-variable"
              aria-pressed={active === "target"}
              onClick={() =>
                open(
                  "target",
                  MODIFIER_TARGET_SPEC[modifier.target as ModifierTarget]
                    ?.label,
                )
              }
            >
              {targetLabel(modifier)}
            </button>
          </>
        ) : (
          <>
            <span>{operation.lead}</span>
            <button
              type="button"
              className="v12-ref-slot is-variable"
              aria-pressed={active === "target"}
              onClick={() =>
                open(
                  "target",
                  MODIFIER_TARGET_SPEC[modifier.target as ModifierTarget]
                    ?.label,
                )
              }
            >
              {targetLabel(modifier)}
            </button>
            <span>{operation.join}</span>
            <button
              type="button"
              className="v12-ref-slot is-operation"
              aria-pressed={active === "operation"}
              onClick={() => open("operation", "Operations")}
            >
              {operation.word}
            </button>
            <button
              type="button"
              className="v12-ref-slot is-value"
              aria-pressed={active === "value"}
              onClick={() =>
                open(
                  "value",
                  modifier.valueKind === "dice"
                    ? "Dice"
                    : title(modifier.valueKind),
                )
              }
            >
              {valueLabel(modifier)}
            </button>
          </>
        )}
        <span>for</span>
        <button
          type="button"
          className="v12-ref-slot is-scope"
          aria-pressed={active === "recipient"}
          onClick={() => open("recipient", "Recipients")}
        >
          {recipientLabel(modifier.recipient)}
        </button>
        {modifier.v1Condition.pills.map((pill, index) => {
          const phrase = conditionPhrase(pill);
          return (
            <span
              className="v12-reference-condition"
              key={`${index}:${pill.label}`}
            >
              <b>
                {index
                  ? (modifier.v1Condition.operators[index - 1] ?? "AND")
                  : "WHEN"}
              </b>
              <button
                type="button"
                className="v12-ref-slot is-scope"
                onClick={() => open(`condition:${index}:subject`, "Scope")}
              >
                {phrase.subject}
              </button>
              <button
                type="button"
                className="v12-ref-slot is-variable"
                onClick={() =>
                  open(`condition:${index}:thing`, "Stat references")
                }
              >
                {phrase.thing}
              </button>
              <button
                type="button"
                className="v12-ref-slot is-operation"
                onClick={() =>
                  open(`condition:${index}:operator`, "Comparison")
                }
              >
                {phrase.comparator}
              </button>
              <button
                type="button"
                className="v12-ref-slot is-value"
                onClick={() =>
                  open(`condition:${index}:value`, "Common values")
                }
              >
                {phrase.value}
              </button>
              <button
                type="button"
                className="v12-reference-remove"
                onClick={() => removeCondition(index)}
                aria-label="Remove condition"
              >
                ×
              </button>
            </span>
          );
        })}
        {modifier.v1Condition.pills.length ? (
          <span className="v12-reference-condition-actions">
            <button type="button" onClick={() => addCondition("AND")}>
              ＋ AND
            </button>
            <button type="button" onClick={() => addCondition("OR")}>
              ＋ OR
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="v12-reference-add-condition"
            onClick={() => addCondition()}
          >
            ＋ when
          </button>
        )}
        <span>.</span>
      </div>

      <div className={`v12-reference-picker${simple ? " is-simple" : ""}`}>
        {!simple ? (
          <>
            <div className="v12-reference-search">
              <input
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                placeholder="Search categories…"
              />
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                aria-label="Clear category search"
              >
                ×
              </button>
            </div>
            <div className="v12-reference-choice-line">
              <div>
                {shownCategories.map((group) => (
                  <button
                    type="button"
                    key={group.name}
                    aria-pressed={currentCategory === group.name}
                    onClick={() => {
                      setCategory(group.name);
                      setValueSearch("");
                      setExpandedValues(false);
                    }}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              {categoryMatches.length > 7 ? (
                <button
                  type="button"
                  className="v12-reference-more"
                  onClick={() => setExpandedCategories((value) => !value)}
                >
                  {expandedCategories ? "less" : "all"}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
        {currentCategory === "Equation" && active === "value" ? (
          <div className="v12-reference-equation">
            <EquationPicker
              operands={modifier.operands}
              onChange={(operands: Operand[]) =>
                onPatch({
                  operands,
                  tokens: [],
                  valueKind: "equation",
                  value: renderEquation(operands),
                })
              }
            />
          </div>
        ) : (
          <>
            {!simple ? (
              <div className="v12-reference-search is-value">
                <input
                  value={valueSearch}
                  onChange={(event) => setValueSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      chooseCustomValue();
                    }
                  }}
                  placeholder={
                    active === "value"
                      ? "Search or type a value, die, keyword, or equation…"
                      : "Search presets…"
                  }
                />
                {active === "value" ? (
                  <small>#dice# · /runtime/ · [keyword] · equation</small>
                ) : null}
              </div>
            ) : null}
            <div className="v12-reference-choice-line">
              <div>
                {shownValues.map((choice) => (
                  <button
                    type="button"
                    key={choice.label}
                    aria-pressed={choice.selected}
                    onClick={choice.select}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              {valueMatches.length > 10 ? (
                <button
                  type="button"
                  className="v12-reference-more"
                  onClick={() => setExpandedValues((value) => !value)}
                >
                  {expandedValues ? "Less" : "See more"}
                </button>
              ) : null}
            </div>
            {active === "target" && selectedGroup?.hint ? (
              <div className="v12-reference-custom">
                <input
                  value={modifier.freeTextNarrowFocus}
                  onChange={(event) =>
                    onPatch({
                      freeTextNarrowFocus: event.target.value,
                      targetValues: [],
                    })
                  }
                  placeholder={selectedGroup.hint}
                />
                <small>Use a stable key with letters, numbers, _ or -.</small>
              </div>
            ) : null}
          </>
        )}
      </div>
      <p className="v12-reference-guidance">
        Conditions are optional. Add <b>when</b>, then continue with inline{" "}
        <b>AND</b> or <b>OR</b> clauses. Self, Target, and Scene open as direct
        choices.
      </p>
      <details className="v12-reference-resolver">
        <summary>
          Resolver mapping · stacking · structured output{" "}
          <span>
            {title(modifier.operation)} · {title(modifier.valueKind)} ·{" "}
            {modifier.stacking}
          </span>
        </summary>
        <div>
          <label>
            Stacking
            <select
              value={modifier.stacking}
              onChange={(event) =>
                onPatch({
                  stacking: event.target.value as ModifierDraft["stacking"],
                })
              }
            >
              <option>stack</option>
              <option>highest-only</option>
              <option>lowest-only</option>
              <option>unique-by-primitive</option>
              <option>unique-by-target</option>
              <option>replace</option>
            </select>
          </label>
          <button type="button" onClick={onClear}>
            Clear mechanical rule
          </button>
        </div>
      </details>
    </div>
  );
}
