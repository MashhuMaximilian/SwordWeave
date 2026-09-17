"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ModifierOperation } from "@/types/swordweave";
import type { ConditionAuthoring, ConditionPresetCategory } from "@/types/condition";
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
import { NUMBER_SHORTCUTS, RUNTIME_VARIABLES, SUB_CHOICE_KEYWORDS } from "@/lib/primitives/form-helpers";
import { MODIFIER_TARGET_SPEC, type ModifierTarget } from "@/lib/primitives/modifier-scope";
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
  { id: "sheet", label: "Character sheet", help: "Permanent and current numbers shown on the character sheet.", targets: ["attribute", "max_vitality", "current_vitality", "proficiency_bonus", "speed", "carry_capacity", "save_dc"] },
  { id: "rolls", label: "Rolls & checks", help: "Bonuses, penalties, dice, and training used when play is resolved.", targets: ["skill_practice_check", "action_roll", "damage_healing_output"] },
  { id: "runtime", label: "Runtime & resources", help: "Values that change during play, including upkeep, load, and scene state.", targets: ["strain", "item_slot_cost", "scene_pace", "upkeep_cost", "maintained_capability", "complexity", "damage_modifier"] },
  { id: "shape", label: "Capability shape", help: "How an action is aimed, timed, typed, or allowed at the table.", targets: ["targeting", "duration", "combat_action", "size", "equip_slot", "damage_type", "source_type"] },
  { id: "custom", label: "Custom runtime value", help: "Create a stable named value when the system does not have one yet.", targets: ["behavior"] },
];

const TARGET_HELP: Partial<Record<ModifierTarget, string>> = {
  attribute: "Physical, Mental, or Magical. Choose Any to affect every attribute.",
  skill_practice_check: "A bonus or penalty applied when a Practice is rolled. Choose Any to affect every Practice.",
  action_roll: "Attack, save, initiative, or another roll made to resolve an action.",
  damage_healing_output: "The numeric or dice output produced as damage or healing when the rule resolves.",
  targeting: "Who or what the capability can affect and the geometric shape it can use.",
  duration: "How long an effect remains active after it is created.",
  behavior: "A named runtime number or switch, such as tracking_bonus or legendary_resistance.",
  damage_modifier: "A multiplier for a named damage type: resistance, vulnerability, immunity, or a custom scale.",
  maintained_capability: "Whether a named capability is currently being maintained.",
  scene_pace: "A round, scene, day, or another clock the rule reads during play.",
};

const STATE_TARGETS = new Set<ModifierTarget>(["targeting", "duration", "combat_action", "size", "equip_slot", "damage_type", "source_type", "maintained_capability"]);

const OPERATION_COPY: ReadonlyArray<{ value: ModifierOperation; label: string; help: string }> = [
  { value: "add", label: "Add", help: "Increase it by the value." },
  { value: "subtract", label: "Subtract", help: "Reduce it by the value." },
  { value: "multiply", label: "Multiply", help: "Scale the current value." },
  { value: "divide", label: "Divide", help: "Split the current value." },
  { value: "min", label: "Minimum", help: "It cannot fall below the value." },
  { value: "max", label: "Maximum", help: "It cannot rise above the value." },
  { value: "set", label: "Set to", help: "Replace it with the value." },
  { value: "grant", label: "Grant", help: "Give a permission, state, or feature." },
  { value: "revoke", label: "Revoke", help: "Remove a permission, state, or feature." },
];

const SUBJECTS: ReadonlyArray<{ label: string; value: ConditionPresetCategory }> = [
  { label: "Self", value: "self" },
  { label: "Target", value: "target" },
  { label: "Scene", value: "scene" },
];

const CONDITION_STATS = [
  ["Vitality", "vitality"], ["Vitality %", "vitality_pct"], ["Max Vitality", "vitality_max"], ["Save DC", "save_dc"], ["Block value", "block_value"], ["Physical", "physical"], ["Mental", "mental"], ["Magical", "magical"], ["Speed", "speed"], ["Carry capacity", "carry_capacity"], ["Load", "load"], ["Complexity", "complexity"], ["Upkeep cost", "upkeep_cost"],
] as const;

const CONDITION_FLAGS = ["prone", "stunned", "bleeding", "frightened", "blinded", "charmed", "grappled", "restrained", "poisoned", "wounded", "damaged last round", "equipped", "encumbered", "in cover"] as const;

const DECLARED_TRIGGERS = ["tracking enemies", "searching for danger", "protecting an ally", "using this capability", "after taking damage", "after dealing damage", "at the start of your turn", "at the end of your turn", "when entering the area", "when the GM calls for it"] as const;

const COMPARISONS = [["is lower than", "<"], ["is at most", "<="], ["is", "="], ["is not", "!="], ["is at least", ">="], ["is greater than", ">"], ["is between", "between"]] as const;

const RECIPIENTS = [
  ["SELF", "Self", "The character who owns or uses the rule."],
  ["TARGET", "Target", "The creature or object affected by the action."],
  ["SCENE", "Scene", "The shared environment or encounter state."],
] as const;

function title(value: string): string {
  const normalized = value === value.toUpperCase() ? value.toLowerCase() : value;
  return normalized.replaceAll("_", " ").replaceAll(":", " · ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recipientLabel(value: ModifierDraft["recipient"]): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function targetFamilyFor(target: string): TargetFamily {
  return TARGET_FAMILIES.find((family) => family.targets.includes(target as ModifierTarget)) ?? TARGET_FAMILIES[0]!;
}

function operationOptions(target: string): readonly ModifierOperation[] {
  const typedTarget = target as ModifierTarget;
  if (STATE_TARGETS.has(typedTarget)) return ["grant", "revoke", "set"];
  if (typedTarget === "damage_modifier") return ["multiply", "divide", "min", "max", "set"];
  if (typedTarget === "damage_healing_output") return ["add", "subtract", "min", "max", "set"];
  return ["add", "subtract", "multiply", "divide", "min", "max", "set", "grant", "revoke"];
}

function targetLabel(modifier: ModifierDraft): string {
  const target = modifier.target as ModifierTarget;
  const spec = MODIFIER_TARGET_SPEC[target];
  if (modifier.freeTextNarrowFocus.trim()) return title(modifier.freeTextNarrowFocus);
  if (modifier.targetValues.length) return modifier.targetValues.map((value) => spec?.optionLabels?.[value] ?? title(value)).join(" + ");
  return spec ? `Any ${spec.label}` : title(String(modifier.target));
}

function valueLabel(modifier: ModifierDraft): string {
  if (modifier.valueKind === "equation") return renderEquation(modifier.operands) || "choose a formula";
  return modifier.tokens.map(tokenLabel).join(" + ") || modifier.value || "choose a value";
}

function operationWords(operation: ModifierOperation) {
  const values: Record<ModifierOperation, { lead: string; join: string; word: string }> = {
    add: { lead: "Change", join: "by", word: "adding" }, subtract: { lead: "Change", join: "by", word: "subtracting" }, multiply: { lead: "Change", join: "by", word: "multiplying by" }, divide: { lead: "Change", join: "by", word: "dividing by" }, min: { lead: "Set", join: "to", word: "a minimum of" }, max: { lead: "Set", join: "to", word: "a maximum of" }, set: { lead: "Set", join: "to", word: "exactly" }, grant: { lead: "Grant", join: "to", word: "" }, revoke: { lead: "Revoke", join: "from", word: "" },
  };
  return values[operation];
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "declared_trigger";
}

function comparisonLabel(value: ConditionPill["operator"]): string {
  return COMPARISONS.find((item) => item[1] === value)?.[0] ?? "is";
}

function statLabel(value: string | undefined): string {
  return CONDITION_STATS.find((item) => item[1] === value)?.[0] ?? title(value ?? "value");
}

function conditionLabel(pill: ConditionPill): string {
  if (pill.kind === "flag" && pill.flag?.startsWith("manual:")) return pill.label;
  const subject = pill.category === "actor" ? "Self" : title(pill.category);
  if (pill.kind === "stat") {
    const raw = pill.value ?? "value";
    const formatted = pill.stat === "vitality_pct" && typeof raw === "number" ? `${Number((raw * 100).toFixed(5))}%` : String(raw);
    const high = pill.operator === "between" && pill.valueHigh !== undefined ? ` and ${pill.stat === "vitality_pct" && typeof pill.valueHigh === "number" ? Number((pill.valueHigh * 100).toFixed(5)) : pill.valueHigh}` : "";
    return `${subject} ${statLabel(pill.stat)} ${comparisonLabel(pill.operator)} ${formatted}${high}`;
  }
  if (pill.kind === "proficiency") return `${subject} is proficient in ${title(pill.practice ?? "practice")}`;
  return `${subject} has ${title(pill.flag ?? pill.label)}`;
}

function triggerModeFor(condition: ConditionAuthoring): TriggerMode {
  if (!condition.pills.length && !condition.narrative.trim()) return "always";
  if (condition.pills.some((pill) => pill.kind === "flag" && pill.flag?.startsWith("manual:")) || condition.narrative.trim()) return "declared";
  return "tracked";
}

function conditionThingKey(pill: ConditionPill): string {
  if (pill.kind === "stat") {
    const known = CONDITION_STATS.some((item) => item[1] === pill.stat);
    return known ? `stat:${pill.stat ?? "vitality_pct"}` : "stat:__custom__";
  }
  if (pill.kind === "proficiency") return `practice:${pill.practice ?? "awareness"}`;
  if (pill.flag?.startsWith("runtime:")) return "flag:__custom__";
  return `flag:${pill.flag ?? "prone"}`;
}

function labelForPill(pill: ConditionPill): string {
  if (pill.kind === "stat") return statLabel(pill.stat);
  if (pill.kind === "proficiency") return `${title(pill.practice ?? "practice")} proficiency`;
  if (pill.flag?.startsWith("runtime:")) return title(pill.flag.slice("runtime:".length));
  return title(pill.flag ?? pill.label);
}

function runtimeKey(value: string, fallback: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_:.-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function valueKindForToken(token: ValueToken): ValueType {
  if (token.kind === "dice") return "dice";
  if (token.kind === "keyword" || token.kind === "behavior") return "text";
  return "number";
}

export function PrimitiveRuleInstrument({ modifier, onPatch, onOperation, onConditionChange, onClear }: { modifier: ModifierDraft; onPatch: (patch: Partial<ModifierDraft>) => void; onOperation: (operation: ModifierOperation) => void; onConditionChange: (condition: ConditionAuthoring) => void; onClear: () => void }) {
  const [activePanel, setActivePanel] = useState<PanelKey>("target");
  const [targetFamily, setTargetFamily] = useState(targetFamilyFor(String(modifier.target)).id);
  const [targetSearch, setTargetSearch] = useState("");
  const [valueFamily, setValueFamily] = useState("fixed");
  const [valueSearch, setValueSearch] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaText, setFormulaText] = useState("");
  const [declaredText, setDeclaredText] = useState("");

  const triggerMode = triggerModeFor(modifier.v1Condition);
  const operation = operationWords(modifier.operation);
  const parsedFormula = useMemo(() => parseRuleFormula(formulaText), [formulaText]);

  const chooseToken = (token: ValueToken) => {
    const kind = valueKindForToken(token);
    onPatch({ tokens: [token], operands: [], valueKind: kind, value: String(serializeValueField([token])[0] ?? "") });
  };

  const chooseTarget = (target: ModifierTarget, targetValue?: string) => {
    const spec = MODIFIER_TARGET_SPEC[target];
    const sameTarget = modifier.target === target;
    let targetValues: string[] = [];
    if (targetValue) targetValues = sameTarget ? (modifier.targetValues.includes(targetValue) ? modifier.targetValues.filter((value) => value !== targetValue) : [...modifier.targetValues, targetValue]) : [targetValue];
    const allowed = operationOptions(target);
    if (!allowed.includes(modifier.operation)) onOperation(allowed[0]!);
    onPatch({ target, targetValues, freeTextNarrowFocus: "", ...(target === "damage_healing_output" ? { valueKind: "dice" as const } : STATE_TARGETS.has(target) && modifier.valueKind === "dice" ? { valueKind: "text" as const } : {}) });
    if (!spec.options?.length) setActivePanel("operation");
  };

  const chooseOperation = (next: ModifierOperation) => {
    onOperation(next);
    setActivePanel("value");
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
    const operators = pills.slice(1).map((_, i) => modifier.v1Condition.operators[i >= index ? i + 1 : i] ?? "AND");
    onConditionChange({ ...modifier.v1Condition, pills, operators, categories: [...new Set(pills.map((pill) => pill.category))] });
  };

  const trackedCondition = (): ConditionPill => ({ category: "self", label: "Vitality %", kind: "stat", stat: "vitality_pct", operator: "<", value: 0.5 });
  const addTrackedCondition = (join: "AND" | "OR" = "AND") => {
    const pills = [...modifier.v1Condition.pills, trackedCondition()];
    const operators = pills.length > 1 ? [...modifier.v1Condition.operators, join] : [];
    onConditionChange({ categories: [...new Set(pills.map((item) => item.category))], pills, operators, narrative: "", includeTags: true });
  };

  const chooseDeclaredTrigger = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const pill: ConditionPill = { category: "self", label: clean, kind: "flag", flag: `manual:${slug(clean)}`, operator: "=", value: "active" };
    onConditionChange({ categories: ["self"], pills: [pill], operators: [], narrative: "", includeTags: true });
    setDeclaredText("");
  };

  const setTriggerMode = (mode: TriggerMode) => {
    if (mode === "always") {
      onConditionChange({ categories: [], pills: [], operators: [], narrative: "", includeTags: false });
    } else if (mode === "tracked") {
      const pill = trackedCondition();
      onConditionChange({ categories: ["self"], pills: [pill], operators: [], narrative: "", includeTags: true });
    } else {
      chooseDeclaredTrigger("tracking enemies");
    }
  };

  const openFormula = () => {
    setFormulaText(modifier.valueKind === "equation" && modifier.operands.length ? renderEquation(modifier.operands) : "PB + 1");
    setFormulaOpen(true);
  };

  const applyFormula = () => {
    if (parsedFormula.error || !parsedFormula.operands.length) return;
    onPatch({ operands: [...parsedFormula.operands], tokens: [], valueKind: "equation", value: renderEquation(parsedFormula.operands) });
    setFormulaOpen(false);
    setActivePanel("recipient");
  };

  const selectedFamily = TARGET_FAMILIES.find((family) => family.id === targetFamily) ?? TARGET_FAMILIES[0]!;
  const targetMatches = selectedFamily.targets.filter((target) => {
    const spec = MODIFIER_TARGET_SPEC[target];
    return [spec.label, TARGET_HELP[target] ?? "", ...(spec.options ?? []).map((value) => spec.optionLabels?.[value] ?? value)].join(" ").toLowerCase().includes(targetSearch.toLowerCase());
  });

  const panelCopy: Record<PanelKey, { eyebrow: string; title: string; help: string }> = {
    target: { eyebrow: "1 · Result", title: "What changes?", help: "Pick the exact sheet, roll, runtime, or capability value this one primitive controls." },
    operation: { eyebrow: "2 · Operation", title: "How does it change?", help: "Only operations that make sense for the selected result are shown." },
    value: { eyebrow: "3 · Value", title: "What value does it use?", help: "Use a fixed value, a character value, dice, a formula, a state, or any named runtime value." },
    recipient: { eyebrow: "4 · Recipient", title: "Who or what receives it?", help: "This decides whose value is changed when the rule is used." },
    trigger: { eyebrow: "5 · Trigger", title: "When does it apply?", help: "Leave it always active, read tracked game state, or declare a table event the player can switch on." },
  };

  const valueFamilies = [["fixed", "Fixed number"], ["sheet", "Sheet value"], ["dice", "Dice"], ["formula", "Formula"], ["state", "State / keyword"], ["runtime", "Custom runtime"]] as const;

  return (
    <div className="v12-rule-builder">
      <nav className="v12-rule-steps" aria-label="Mechanical rule steps">
        {([["target", "Result", targetLabel(modifier)], ["operation", "Operation", title(modifier.operation)], ["value", "Value", valueLabel(modifier)], ["recipient", "Recipient", recipientLabel(modifier.recipient)], ["trigger", "Trigger", triggerMode === "always" ? "Always" : triggerMode === "tracked" ? "Tracked" : "Declared"]] as const).map(([key, label, summary]) => (
          <button key={key} type="button" aria-current={activePanel === key ? "step" : undefined} onClick={() => setActivePanel(key)}><span>{label}</span><b>{summary}</b></button>
        ))}
      </nav>

      <div className="v12-rule-sentence" aria-label="Mechanical rule sentence">
        {modifier.operation === "grant" || modifier.operation === "revoke" ? <>
          <button type="button" className="is-operation" onClick={() => setActivePanel("operation")}>{operation.lead}</button><button type="button" className="is-value" onClick={() => setActivePanel("value")}>{valueLabel(modifier)}</button><span>{operation.join}</span><button type="button" className="is-variable" onClick={() => setActivePanel("target")}>{targetLabel(modifier)}</button>
        </> : <>
          <span>{operation.lead}</span><button type="button" className="is-variable" onClick={() => setActivePanel("target")}>{targetLabel(modifier)}</button><span>{operation.join}</span><button type="button" className="is-operation" onClick={() => setActivePanel("operation")}>{operation.word}</button><button type="button" className="is-value" onClick={() => setActivePanel("value")}>{valueLabel(modifier)}</button>
        </>}
        <span>for</span><button type="button" className="is-scope" onClick={() => setActivePanel("recipient")}>{recipientLabel(modifier.recipient)}</button>
        {modifier.v1Condition.pills.map((pill, index) => <span className="v12-rule-condition" key={`${index}:${pill.label}`}><b>{index ? modifier.v1Condition.operators[index - 1] ?? "AND" : "WHEN"}</b><button type="button" className="is-condition" onClick={() => setActivePanel("trigger")}>{conditionLabel(pill)}</button><button type="button" className="v12-rule-condition-remove" onClick={() => removeCondition(index)} aria-label="Remove condition">×</button></span>)}
        {!modifier.v1Condition.pills.length ? <button type="button" className="v12-rule-add-when" onClick={() => setActivePanel("trigger")}>＋ when</button> : null}<span>.</span>
      </div>

      <section className="v12-rule-panel">
        <header><div><span>{panelCopy[activePanel].eyebrow}</span><h3>{panelCopy[activePanel].title}</h3></div><p>{panelCopy[activePanel].help}</p></header>

        {activePanel === "target" ? <div className="v12-rule-target-panel">
          <div className="v12-rule-family-tabs" role="tablist" aria-label="Result families">{TARGET_FAMILIES.map((family) => <button type="button" key={family.id} role="tab" aria-selected={selectedFamily.id === family.id} onClick={() => { setTargetFamily(family.id); setTargetSearch(""); }}>{family.label}</button>)}</div>
          <div className="v12-rule-search-row"><input value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder={`Search ${selectedFamily.label.toLowerCase()}…`} /><small>{selectedFamily.help}</small></div>
          <div className="v12-rule-target-grid">{targetMatches.map((target) => {
            const spec = MODIFIER_TARGET_SPEC[target]; const isSelected = modifier.target === target;
            return <article key={target} className={isSelected ? "is-selected" : ""}>
              <button type="button" className="v12-rule-target-name" onClick={() => chooseTarget(target)}><b>{spec.label}</b><span>{TARGET_HELP[target] ?? (spec.valueIsNumeric ? "A number read and changed by the resolver." : "A tracked rule value available during play.")}</span></button>
              {spec.options?.length ? <div className="v12-rule-subchoices"><button type="button" aria-pressed={isSelected && modifier.targetValues.length === 0} onClick={() => chooseTarget(target)}>Any</button>{spec.options.map((value) => <button type="button" key={value} aria-pressed={isSelected && modifier.targetValues.includes(value)} onClick={() => chooseTarget(target, value)}>{spec.optionLabels?.[value] ?? title(value)}</button>)}</div> : null}
              {isSelected && (spec.widget === "free-text" || spec.widget === "checklist-with-free-text") ? <label className="v12-rule-custom-key"><span>Stable runtime name</span><input value={modifier.freeTextNarrowFocus} onChange={(event) => onPatch({ freeTextNarrowFocus: event.target.value, targetValues: [] })} placeholder={spec.freeTextPlaceholder ?? "e.g. tracking_bonus"} /></label> : null}
            </article>;
          })}</div>
          <div className="v12-rule-panel-next"><button type="button" onClick={() => setActivePanel("operation")}>Next · choose how it changes →</button></div>
        </div> : null}

        {activePanel === "operation" ? <div className="v12-rule-operation-grid">{OPERATION_COPY.filter((item) => operationOptions(String(modifier.target)).includes(item.value)).map((item) => <button type="button" key={item.value} aria-pressed={modifier.operation === item.value} onClick={() => chooseOperation(item.value)}><b>{item.label}</b><span>{item.help}</span></button>)}</div> : null}

        {activePanel === "value" ? <div className="v12-rule-value-panel">
          <div className="v12-rule-family-tabs" role="tablist" aria-label="Value sources">{valueFamilies.map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={valueFamily === key} onClick={() => setValueFamily(key)}>{label}</button>)}</div>
          {valueFamily === "fixed" ? <div className="v12-rule-value-body"><p>Use a constant. Decimals and negative values are allowed.</p><div className="v12-rule-chip-row">{NUMBER_SHORTCUTS.map((number) => <button type="button" key={number} aria-pressed={modifier.tokens[0]?.kind === "number" && modifier.tokens[0].value === number} onClick={() => { chooseToken({ kind: "number", value: number }); setActivePanel("recipient"); }}>{number}</button>)}</div><div className="v12-rule-entry-row"><input inputMode="decimal" value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="Any number, e.g. 3.5 or -2" /><button type="button" disabled={!Number.isFinite(Number(customValue)) || !customValue.trim()} onClick={() => { chooseToken({ kind: "number", value: Number(customValue) }); setCustomValue(""); setActivePanel("recipient"); }}>Use number</button></div></div> : null}
          {valueFamily === "sheet" ? <div className="v12-rule-value-body"><p>The resolver reads the current value from the character when the rule is used.</p><div className="v12-rule-value-groups"><ValueGroup title="Attributes">{ALL_ATTRIBUTES.map((attribute) => <Choice key={attribute} label={title(attribute)} selected={modifier.tokens[0]?.kind === "attribute" && modifier.tokens[0].attribute === attribute} onClick={() => { chooseToken({ kind: "attribute", attribute }); setActivePanel("recipient"); }} />)}</ValueGroup><ValueGroup title="Practices">{ALL_PRACTICES.map((practice) => <Choice key={practice} label={title(practice)} selected={modifier.tokens[0]?.kind === "practice" && modifier.tokens[0].practice === practice} onClick={() => { chooseToken({ kind: "practice", practice }); setActivePanel("recipient"); }} />)}</ValueGroup><ValueGroup title="Derived">{ALL_DERIVED.map((which) => <Choice key={which} label={which === "pb_half" ? "Half PB" : which === "pb2" || which === "expertise" || which === "pb*2" ? "Double PB" : title(which)} selected={modifier.tokens[0]?.kind === "derived" && modifier.tokens[0].which === which} onClick={() => { chooseToken({ kind: "derived", which }); setActivePanel("recipient"); }} />)}</ValueGroup></div></div> : null}
          {valueFamily === "dice" ? <div className="v12-rule-value-body"><p>Choose a die, or type a full dice expression such as 2d8+3.</p><div className="v12-rule-chip-row">{DICE_TYPES.map((die) => <button type="button" key={die} onClick={() => { chooseToken({ kind: "dice", expression: `1${die}` }); setActivePanel("recipient"); }}>1{die}</button>)}</div><div className="v12-rule-entry-row"><input value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="e.g. 2d8+3" /><button type="button" disabled={!/^\d+d\d+(?:[+-]\d+)?$/i.test(customValue.trim())} onClick={() => { chooseToken({ kind: "dice", expression: customValue.trim() }); setCustomValue(""); setActivePanel("recipient"); }}>Use dice</button></div></div> : null}
          {valueFamily === "formula" ? <div className="v12-rule-formula-callout"><div><b>{modifier.valueKind === "equation" && modifier.operands.length ? renderEquation(modifier.operands) : "Combine any sheet, runtime, number, die, and keyword."}</b><p>Examples: <code>Physical + PB/2</code>, <code>(5 + PB) / Awareness</code>, <code>PBd10 + 2d8 [fire]</code>.</p></div><button type="button" onClick={openFormula}>{modifier.valueKind === "equation" ? "Edit formula" : "Build formula"}</button></div> : null}
          {valueFamily === "state" ? <div className="v12-rule-value-body"><div className="v12-rule-search-row"><input value={valueSearch} onChange={(event) => setValueSearch(event.target.value)} placeholder="Search permissions, conditions, damage types, tiers…" /><small>States are saved as structured keywords, not arbitrary prose.</small></div><div className="v12-rule-value-groups">{[...new Set(SUB_CHOICE_KEYWORDS.map((item) => item.group))].map((group) => { const choices = SUB_CHOICE_KEYWORDS.filter((item) => item.group === group && item.label.toLowerCase().includes(valueSearch.toLowerCase())); if (!choices.length) return null; return <ValueGroup title={group} key={group}>{choices.map((item) => <Choice key={item.label} label={item.label} selected={modifier.tokens[0]?.kind === "keyword" && modifier.tokens[0].text === slug(item.label)} onClick={() => { chooseToken({ kind: "keyword", text: slug(item.label) }); setActivePanel("recipient"); }} />)}</ValueGroup>; })}</div><div className="v12-rule-entry-row"><input value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="Custom state, permission, or keyword" /><button type="button" disabled={!customValue.trim()} onClick={() => { chooseToken({ kind: "keyword", text: slug(customValue) }); setCustomValue(""); setActivePanel("recipient"); }}>Use keyword</button></div></div> : null}
          {valueFamily === "runtime" ? <div className="v12-rule-value-body"><p>Reference a value that exists only during play. If it has not been created yet, the resolver keeps the reference ready for it.</p><div className="v12-rule-chip-row">{RUNTIME_VARIABLES.map((item) => <button type="button" key={item.name} onClick={() => { chooseToken({ kind: "runtime", name: item.name, hint: item.hint }); setActivePanel("recipient"); }}>/{item.label}/</button>)}</div><div className="v12-rule-entry-row"><input value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="e.g. tracking_bonus or scene_heat" /><button type="button" disabled={!customValue.trim()} onClick={() => { chooseToken({ kind: "runtime", name: slug(customValue), hint: "number" }); setCustomValue(""); setActivePanel("recipient"); }}>Use runtime value</button></div></div> : null}
        </div> : null}

        {activePanel === "recipient" ? <div className="v12-rule-recipient-grid">{RECIPIENTS.map(([value, label, help]) => <button type="button" key={value} aria-pressed={modifier.recipient === value} onClick={() => { onPatch({ recipient: value }); setActivePanel("trigger"); }}><b>{label}</b><span>{help}</span></button>)}</div> : null}

        {activePanel === "trigger" ? <div className="v12-rule-trigger-panel">
          <div className="v12-rule-trigger-modes" role="radiogroup" aria-label="Trigger mode"><button type="button" role="radio" aria-checked={triggerMode === "always"} onClick={() => setTriggerMode("always")}><b>Always</b><span>Included whenever the primitive is active.</span></button><button type="button" role="radio" aria-checked={triggerMode === "tracked"} onClick={() => setTriggerMode("tracked")}><b>Tracked condition</b><span>The engine reads sheet, target, or scene state.</span></button><button type="button" role="radio" aria-checked={triggerMode === "declared"} onClick={() => setTriggerMode("declared")}><b>Declared at table</b><span>A player or GM switches on a named situation.</span></button></div>
          {triggerMode === "always" ? <p className="v12-rule-trigger-note">No condition is stored. The modifier remains active for as long as its primitive, effect, item, or capability is active.</p> : null}
          {triggerMode === "tracked" ? <div className="v12-rule-condition-editor">{modifier.v1Condition.pills.map((pill, index) => { const customStat = pill.kind === "stat" && !CONDITION_STATS.some((item) => item[1] === pill.stat); const customFlag = pill.kind === "flag" && pill.flag?.startsWith("runtime:"); return <div className="v12-rule-condition-row" key={`${index}:${pill.label}`}>{index ? <select value={modifier.v1Condition.operators[index - 1] ?? "AND"} onChange={(event) => { const operators = [...modifier.v1Condition.operators]; operators[index - 1] = event.target.value as "AND" | "OR"; onConditionChange({ ...modifier.v1Condition, operators }); }} aria-label="Condition connector"><option>AND</option><option>OR</option></select> : <strong>WHEN</strong>}<select value={pill.category === "actor" ? "self" : pill.category} onChange={(event) => patchPill(index, { category: event.target.value as ConditionPresetCategory })} aria-label="Condition subject">{SUBJECTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={conditionThingKey(pill)} onChange={(event) => { const split = event.target.value.indexOf(":"); const kind = event.target.value.slice(0, split); const value = event.target.value.slice(split + 1); if (kind === "stat") patchPill(index, { kind: "stat", stat: value === "__custom__" ? "custom_value" : value, operator: "<", value: value === "vitality_pct" ? 0.5 : 1, practice: undefined, flag: undefined }); else if (kind === "practice") patchPill(index, { kind: "proficiency", practice: value, operator: "=", value: "proficient", stat: undefined, flag: undefined }); else patchPill(index, { kind: "flag", flag: value === "__custom__" ? "runtime:custom_event" : value, operator: "=", value: "active", stat: undefined, practice: undefined }); }} aria-label="Condition value"><optgroup label="Tracked numbers">{CONDITION_STATS.map(([label, value]) => <option key={value} value={`stat:${value}`}>{label}</option>)}<option value="stat:__custom__">Custom runtime number…</option></optgroup><optgroup label="Practice proficiency">{ALL_PRACTICES.map((practice) => <option key={practice} value={`practice:${practice}`}>{title(practice)} proficiency</option>)}</optgroup><optgroup label="Status and state">{CONDITION_FLAGS.map((flag) => <option key={flag} value={`flag:${slug(flag)}`}>{title(flag)}</option>)}<option value="flag:__custom__">Custom tracked state or event…</option></optgroup></select>{customStat ? <input className="is-runtime-key" value={pill.stat ?? ""} onChange={(event) => patchPill(index, { stat: runtimeKey(event.target.value, "custom_value") })} aria-label="Runtime number name" placeholder="e.g. scene_heat" /> : null}{customFlag ? <input className="is-runtime-key" value={pill.flag?.slice("runtime:".length) ?? ""} onChange={(event) => patchPill(index, { flag: `runtime:${runtimeKey(event.target.value, "custom_event")}` })} aria-label="Tracked state or event name" placeholder="e.g. combat_started" /> : null}{pill.kind === "stat" ? <><select value={pill.operator ?? "<"} onChange={(event) => patchPill(index, { operator: event.target.value as NonNullable<ConditionPill["operator"]> })} aria-label="Comparison">{COMPARISONS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select><input type="number" step="any" value={pill.stat === "vitality_pct" && typeof pill.value === "number" ? Number((pill.value * 100).toFixed(5)) : pill.value ?? ""} onChange={(event) => patchPill(index, { value: pill.stat === "vitality_pct" ? Number(event.target.value) / 100 : Number(event.target.value) })} aria-label="Comparison value" />{pill.stat === "vitality_pct" ? <em>%</em> : null}{pill.operator === "between" ? <><span>and</span><input type="number" step="any" value={pill.stat === "vitality_pct" && typeof pill.valueHigh === "number" ? Number((pill.valueHigh * 100).toFixed(5)) : pill.valueHigh ?? ""} onChange={(event) => patchPill(index, { valueHigh: pill.stat === "vitality_pct" ? Number(event.target.value) / 100 : Number(event.target.value) })} aria-label="Upper comparison value" /></> : null}</> : <span className="v12-rule-condition-state">is active</span>}<button type="button" className="v12-rule-condition-remove" onClick={() => removeCondition(index)} aria-label="Remove condition">×</button></div>; })}<div className="v12-rule-condition-add"><button type="button" onClick={() => addTrackedCondition("AND")}>＋ AND condition</button><button type="button" onClick={() => addTrackedCondition("OR")}>＋ OR condition</button></div></div> : null}
          {triggerMode === "declared" ? <div className="v12-rule-declared-editor"><p>This creates a runtime flag. The player or GM can turn it on for situations the sheet cannot detect by itself.</p><div className="v12-rule-chip-row">{DECLARED_TRIGGERS.map((text) => <button type="button" key={text} aria-pressed={modifier.v1Condition.pills[0]?.label === text} onClick={() => chooseDeclaredTrigger(text)}>{text}</button>)}</div><div className="v12-rule-entry-row"><input value={declaredText} onChange={(event) => setDeclaredText(event.target.value)} placeholder="e.g. tracking a creature through the wilderness" /><button type="button" disabled={!declaredText.trim()} onClick={() => chooseDeclaredTrigger(declaredText)}>Use trigger</button></div></div> : null}
        </div> : null}
      </section>

      <details className="v12-rule-advanced"><summary>Advanced resolver settings <span>{title(modifier.operation)} · {title(modifier.valueKind)} · {modifier.stacking}</span></summary><div><label>Stacking<select value={modifier.stacking} onChange={(event) => onPatch({ stacking: event.target.value as ModifierDraft["stacking"] })}><option>stack</option><option>highest-only</option><option>lowest-only</option><option>unique-by-primitive</option><option>unique-by-target</option><option>replace</option></select></label><p><b>Stored target</b><code>{String(modifier.target)}</code></p><p><b>Stored value</b><code>{valueLabel(modifier)}</code></p><button type="button" onClick={onClear}>Remove mechanical rule</button></div></details>

      {formulaOpen && typeof document !== "undefined"
        ? createPortal(
            <FormulaDialog text={formulaText} onTextChange={setFormulaText} parsed={parsedFormula} onCancel={() => setFormulaOpen(false)} onUse={applyFormula} />,
            document.body,
          )
        : null}
    </div>
  );
}

function ValueGroup({ title: groupTitle, children }: { title: string; children: ReactNode }) {
  return <section><b>{groupTitle}</b><div className="v12-rule-chip-row">{children}</div></section>;
}

function Choice({ label, selected, onClick }: { label: string; selected?: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick}>{label}</button>;
}

function FormulaDialog({ text, onTextChange, parsed, onCancel, onUse }: { text: string; onTextChange: (value: string) => void; parsed: ReturnType<typeof parseRuleFormula>; onCancel: () => void; onUse: () => void }) {
  const [operator, setOperator] = useState<Operator>("+");
  const [library, setLibrary] = useState("sheet");
  const formulaLibraries = [["sheet", "Sheet values"], ["numbers", "Numbers"], ["dice", "Dice"], ["runtime", "Runtime"], ["tags", "Tags"]] as const;
  const append = (snippet: string) => onTextChange(text.trim() ? `${text.trim()} ${operator === "*" ? "×" : operator === "/" ? "÷" : operator} ${snippet}` : snippet);
  const formulaChoices: ReadonlyArray<readonly [string, string]> = library === "numbers" ? NUMBER_SHORTCUTS.map((value) => [String(value), String(value)] as const) : library === "sheet" ? [...ALL_ATTRIBUTES.map((value) => [title(value), title(value)] as const), ...ALL_PRACTICES.map((value) => [title(value), title(value)] as const), ["PB", "PB"] as const, ["Half PB", "PB/2"] as const, ["Double PB", "PB×2"] as const, ["Level", "Level"] as const] : library === "dice" ? DICE_TYPES.map((die) => [`1${die}`, `1${die}`] as const) : library === "runtime" ? RUNTIME_VARIABLES.map((item) => [`/${item.label}/`, `/${item.name}/`] as const) : SUB_CHOICE_KEYWORDS.filter((item) => ["Damage Type", "Condition", "Bias"].includes(item.group)).map((item) => [`[${item.label}]`, `[${slug(item.label)}]`] as const);
  return <div className="v12-rule-formula-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}><section className="v12-rule-formula-dialog" role="dialog" aria-modal="true" aria-labelledby="rule-formula-title"><header><div><span>Expression builder</span><h2 id="rule-formula-title">Build the rule value</h2></div><button type="button" onClick={onCancel} aria-label="Close formula builder">×</button></header><div className="v12-rule-formula-body"><label className="v12-rule-formula-input"><span>Formula</span><textarea autoFocus value={text} onChange={(event) => onTextChange(event.target.value)} spellCheck={false} placeholder="(5 + PB) / Awareness + 2d8 + PBd10 [fire]" /></label><div className={`v12-rule-formula-preview${parsed.error ? " has-error" : ""}`}><small>Resolved expression</small><b>{parsed.error ?? renderEquation(parsed.operands)}</b></div><div className="v12-rule-formula-operators"><span>Next operator</span>{(["+", "-", "*", "/", "%"] as const).map((value) => <button type="button" key={value} aria-pressed={operator === value} onClick={() => setOperator(value)}>{value === "*" ? "×" : value === "/" ? "÷" : value}</button>)}<button type="button" onClick={() => onTextChange(`(${text.trim()})`)}>Group all ( )</button></div><div className="v12-rule-family-tabs" role="tablist" aria-label="Formula value library">{formulaLibraries.map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={library === key} onClick={() => setLibrary(key)}>{label}</button>)}</div><div className="v12-rule-formula-library">{formulaChoices.map(([label, snippet]) => <button type="button" key={`${label}:${snippet}`} onClick={() => append(snippet)}>{label}</button>)}</div><div className="v12-rule-formula-help"><b>How formulas work</b><span>Use + − × ÷ %, and parentheses. Names read live character or runtime values. Dice use 2d8. PBd10 means PB × 1d10. After a value, % 0.10 increases the running total by 10%. Tags such as [fire] describe the output without changing its number.</span></div></div><footer><button type="button" onClick={() => onTextChange("")}>Clear</button><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="is-primary" disabled={!!parsed.error || !parsed.operands.length} onClick={onUse}>Use formula</button></footer></section></div>;
}
