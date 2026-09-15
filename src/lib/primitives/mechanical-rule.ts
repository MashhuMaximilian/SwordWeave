import { renderEquation, tokenLabel, type Operand, type ValueToken } from "@/types/modifier";
import { conditionToBadges, parseCondition } from "./condition";
import type { HardModifier } from "@/types/swordweave";

export type MechanicalRuleFamily =
  | "DOMAIN_ACCESS"
  | "VERB_ACCESS"
  | "STRUCTURE"
  | "RANGE"
  | "TARGETING"
  | "DICE"
  | "DURATION"
  | "ATTRIBUTE_INCREMENT"
  | "DEFENSIVE_SAVE"
  | "PRACTICE_PROFICIENCY"
  | "UNIVERSAL_MODIFIER"
  | "DESCRIPTIVE"
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

export const AUTHORABLE_COMPOSITION_FAMILIES = [
  "DOMAIN_ACCESS",
  "VERB_ACCESS",
  "STRUCTURE",
  "RANGE",
  "TARGETING",
  "DICE",
  "DURATION",
] as const satisfies readonly MechanicalRuleFamily[];

export type AuthorableCompositionFamily = (typeof AUTHORABLE_COMPOSITION_FAMILIES)[number];

function display(value: unknown): string {
  if (Array.isArray(value)) return renderEquation(value as Operand[]);
  if (value && typeof value === "object" && "kind" in value) {
    return tokenLabel(value as ValueToken);
  }
  return String(value ?? "").trim();
}

function modifierValue(value: unknown): string {
  if (value && typeof value === "object" && "kind" in value) {
    const token = value as ValueToken;
    return token.kind === "keyword" ? token.text : tokenLabel(token);
  }
  return display(value);
}

function title(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function naturalList(values: string[]): string {
  if (values.length < 2) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function readableTarget(value: string): string {
  const labels: Record<string, string> = {
    save_dc: "Save DC",
    skill_practice_check: "Practice checks",
    action_roll: "Action rolls",
    carry_capacity: "Carry Capacity",
    equip_slot: "Equipment Slots",
  };
  return labels[value] ?? title(value);
}

function conditionText(value: unknown): string {
  try {
    const badges = conditionToBadges(parseCondition(value));
    const words = badges.map((badge) => {
      if (badge.kind === "tag" && /^(AND|OR)$/i.test(badge.label)) return badge.label.toLowerCase();
      const axis = badge.axis === "target" ? "the target is " : badge.axis === "scene" ? "the scene is " : badge.axis ? "self is " : "";
      return `${axis}${badge.label.toLowerCase()}`;
    });
    return words.join(" ");
  } catch {
    return "";
  }
}

function withCondition(sentence: string, condition?: string): string {
  const base = sentence.replace(/[.\s]+$/, "");
  return `${base}${condition?.trim() ? ` when ${condition.trim()}` : ""}.`;
}

/** Human-facing output for the same structured rule the resolver stores. */
export function renderMechanicalRule(rule: CanonicalMechanicalRule): string {
  if (rule.family === "DESCRIPTIVE") return "";
  if (rule.family === "DOCUMENTED") {
    const sentence = Object.entries(rule.bindings ?? {}).reduce(
      (text, [key, value]) => text.replaceAll(`[${key}]`, display(value)),
      String(rule.text ?? "").trim(),
    );
    return sentence && !/[.!?]$/.test(sentence) ? `${sentence}.` : sentence;
  }
  const bindings = rule.bindings ?? {};
  if (rule.family === "DOMAIN_ACCESS") {
    const domain = (display(bindings["domain"]) || "domain").toLowerCase();
    const verb = rule.operation === "revoke" ? "Revoke" : "Grant";
    const preposition = rule.operation === "revoke" ? "from" : "to";
    return withCondition(`${verb} [${domain}] domain access${rule.recipient === "TARGET" ? ` ${preposition} target` : ""}`, rule.conditionText);
  }
  if (rule.family === "VERB_ACCESS") {
    const tier = display(bindings["tier"]) || "verb tier";
    const verb = rule.operation === "revoke" ? "Revoke" : "Grant";
    const preposition = rule.operation === "revoke" ? "from" : "to";
    return withCondition(`${verb} [${tier}] verb access${rule.recipient === "TARGET" ? ` ${preposition} target` : ""}`, rule.conditionText);
  }
  if (rule.family === "STRUCTURE") {
    return withCondition(`Apply through a [${display(bindings["structure"]) || "structure"}]`, rule.conditionText);
  }
  if (rule.family === "RANGE") {
    return withCondition(`Set maximum range to ${display(bindings["range"]) || "range"}`, rule.conditionText);
  }
  if (rule.family === "TARGETING") {
    return withCondition(`Target [${display(bindings["targeting"]) || "target"}]`, rule.conditionText);
  }
  if (rule.family === "DICE") {
    return withCondition(`Unlock [${display(bindings["dice"]) || "die"}] damage or healing output`, rule.conditionText);
  }
  if (rule.family === "DURATION") {
    return withCondition(`Set duration to ${display(bindings["duration"]) || "duration"}`, rule.conditionText);
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
          : operation === "subtract"
            ? `Subtract ${value} from ${target}${recipient}`
            : operation === "multiply"
              ? `Multiply ${target} by ${value}${recipient}`
              : operation === "divide"
                ? `Divide ${target} by ${value}${recipient}`
                : `Add ${!value.startsWith("-") && !value.startsWith("+") ? "+" : ""}${value} to ${target}${recipient}`;
  return withCondition(body, rule.conditionText);
}

/** Accept only the typed composition shapes exposed by primitive authoring. */
export function parseAuthorableCompositionRule(input: unknown): CanonicalMechanicalRule | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Record<string, unknown>;
  if (!(AUTHORABLE_COMPOSITION_FAMILIES as readonly unknown[]).includes(candidate["family"])) return null;
  const family = candidate["family"] as AuthorableCompositionFamily;
  const keyByFamily: Record<AuthorableCompositionFamily, string> = {
    DOMAIN_ACCESS: "domain",
    VERB_ACCESS: "tier",
    STRUCTURE: "structure",
    RANGE: "range",
    TARGETING: "targeting",
    DICE: "dice",
    DURATION: "duration",
  };
  const rawBindings = candidate["bindings"];
  if (!rawBindings || typeof rawBindings !== "object" || Array.isArray(rawBindings)) return null;
  const value = String((rawBindings as Record<string, unknown>)[keyByFamily[family]] ?? "").trim();
  if (!value) return null;
  const operation = candidate["operation"] === "revoke" ? "revoke" : "grant";
  const recipient = candidate["recipient"] === "TARGET" ? "TARGET" : "SELF";
  return {
    family,
    ...(family === "DOMAIN_ACCESS" || family === "VERB_ACCESS" ? { operation, recipient } : {}),
    bindings: { [keyByFamily[family]]: value },
  };
}

export function mechanicalRuleFromModifier(modifier: HardModifier): CanonicalMechanicalRule {
  const metadata = (modifier.metadata ?? {}) as Record<string, unknown>;
  const scope = (metadata["targetScope"] ?? {}) as { values?: unknown[] };
  const targetValues = Array.isArray(scope.values) ? scope.values.map(String) : [];
  return {
    family: "GENERIC",
    operation: modifier.operation,
    target: targetValues.length ? naturalList(targetValues.map(title)) : readableTarget(modifier.target),
    value: modifier.value,
    recipient: String(metadata["recipient"] ?? "SELF").toUpperCase() as "SELF" | "TARGET" | "SCENE",
    conditionText: conditionText(modifier.condition),
  };
}

/** The stored modifier is the mechanic. This is the single display projection. */
export function mechanicalDescriptionFromModifiers(modifiers: readonly HardModifier[] | null | undefined): string {
  if (!modifiers?.length) return "";
  return modifiers
    .map((modifier) => {
      const rule = mechanicalRuleFromModifier(modifier);
      rule.value = modifierValue(modifier.value);
      return renderMechanicalRule(rule);
    })
    .filter(Boolean)
    .join(" ");
}

export function renderStoredMechanicalRule(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const rule = input as CanonicalMechanicalRule;
  if (!rule.family) return "";
  return renderMechanicalRule(rule);
}
