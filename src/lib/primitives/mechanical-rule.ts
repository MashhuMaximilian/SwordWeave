import { renderEquation, tokenLabel, type Operand, type ValueToken } from "@/types/modifier";
import type { HardModifier } from "@/types/swordweave";

export type MechanicalRuleFamily =
  | "DOMAIN_ACCESS"
  | "ATTRIBUTE_INCREMENT"
  | "DEFENSIVE_SAVE"
  | "PRACTICE_PROFICIENCY"
  | "UNIVERSAL_MODIFIER"
  | "DOCUMENTED"
  | "GENERIC";

export interface CanonicalMechanicalRule {
  family: MechanicalRuleFamily;
  operation?: string;
  target?: string;
  value?: unknown;
  recipient?: "SELF" | "TARGET" | "SCENE";
  bindings?: Record<string, string | number | boolean | null>;
  conditionText?: string;
  text?: string;
}

function display(value: unknown): string {
  if (Array.isArray(value)) return renderEquation(value as Operand[]);
  if (value && typeof value === "object" && "kind" in value) {
    return tokenLabel(value as ValueToken);
  }
  return String(value ?? "").trim();
}

function title(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function withCondition(sentence: string, condition?: string): string {
  const base = sentence.replace(/[.\s]+$/, "");
  return `${base}${condition?.trim() ? ` when ${condition.trim()}` : ""}.`;
}

/** Human-facing output for the same structured rule the resolver stores. */
export function renderMechanicalRule(rule: CanonicalMechanicalRule): string {
  if (rule.family === "DOCUMENTED") {
    const sentence = String(rule.text ?? "").trim();
    return sentence && !/[.!?]$/.test(sentence) ? `${sentence}.` : sentence;
  }
  const bindings = rule.bindings ?? {};
  if (rule.family === "DOMAIN_ACCESS") {
    const domain = display(bindings["domain"] ?? "domain").toLowerCase();
    return withCondition(`Grant [${domain}] domain access`, rule.conditionText);
  }
  if (rule.family === "ATTRIBUTE_INCREMENT") {
    const attribute = bindings["attribute"] ? title(String(bindings["attribute"])) : "[Core Attribute]";
    return withCondition(`Add +${display(rule.value ?? 1)} to ${attribute}`, rule.conditionText);
  }
  if (rule.family === "DEFENSIVE_SAVE") {
    const attribute = bindings["attribute"] ? title(String(bindings["attribute"])) : "[Attribute]";
    return withCondition(`Grant saving throw proficiency in ${attribute}`, rule.conditionText);
  }
  if (rule.family === "PRACTICE_PROFICIENCY") {
    const practice = bindings["practice"] ? title(String(bindings["practice"])) : "[Practice]";
    return withCondition(`Grant proficiency in ${practice}`, rule.conditionText);
  }

  const target = display(rule.target || bindings["target"] || "[target]");
  const value = display(rule.value ?? bindings["value"] ?? "[value]");
  const operation = rule.operation ?? "add";
  const recipient = rule.recipient && rule.recipient !== "SELF" ? ` for ${title(rule.recipient)}` : "";
  const body = operation === "grant"
    ? `Grant ${value} to ${target}${recipient}`
    : operation === "revoke"
      ? `Revoke ${value} from ${target}${recipient}`
      : operation === "set"
        ? `Set ${target} to exactly ${value}${recipient}`
        : operation === "min" || operation === "max"
          ? `Set ${target} to ${operation === "min" ? "minimum" : "maximum"} ${value}${recipient}`
          : `${operation === "subtract" ? "Subtract" : operation === "multiply" ? "Multiply" : operation === "divide" ? "Divide" : "Add"} ${operation === "add" && !value.startsWith("-") && !value.startsWith("+") ? "+" : ""}${value} ${operation === "multiply" || operation === "divide" ? "with" : "to"} ${target}${recipient}`;
  return withCondition(body, rule.conditionText);
}

export function mechanicalRuleFromModifier(modifier: HardModifier): CanonicalMechanicalRule {
  const metadata = (modifier.metadata ?? {}) as Record<string, unknown>;
  const scope = (metadata["targetScope"] ?? {}) as { values?: unknown[] };
  const targetValues = Array.isArray(scope.values) ? scope.values.map(String) : [];
  const condition = modifier.condition as { text?: unknown; narrative?: unknown } | undefined;
  return {
    family: "GENERIC",
    operation: modifier.operation,
    target: targetValues.length ? targetValues.map(title).join(" / ") : modifier.target,
    value: modifier.value,
    recipient: String(metadata["recipient"] ?? "SELF").toUpperCase() as "SELF" | "TARGET" | "SCENE",
    conditionText: String(condition?.text ?? condition?.narrative ?? "").trim(),
  };
}

export function renderStoredMechanicalRule(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const rule = input as CanonicalMechanicalRule;
  if (!rule.family) return "";
  return renderMechanicalRule(rule);
}
