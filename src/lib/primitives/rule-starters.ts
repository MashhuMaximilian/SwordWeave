import type { ModifierOperation } from "@/types/swordweave";
import { serializeValueField, type ValueToken, type ValueType } from "@/types/modifier";
import type { ModifierTarget } from "./modifier-scope";

/** Authoring examples, not priced products. All use existing resolver axes. */
export interface RuleStarter {
  id: string;
  label: string;
  example: string;
  target: ModifierTarget;
  operation: ModifierOperation;
  scopes?: string[];
  name?: string;
  token: ValueToken;
}

export const RULE_STARTERS: readonly RuleStarter[] = [
  { id: "advantage", label: "Advantage", example: "Grant advantage on Awareness.", target: "skill_practice_check", operation: "grant", scopes: ["AWARENESS"], token: { kind: "keyword", text: "advantage" } },
  { id: "disadvantage", label: "Disadvantage", example: "Grant disadvantage on attack rolls.", target: "action_roll", operation: "grant", scopes: ["ATTACK_ROLL"], token: { kind: "keyword", text: "disadvantage" } },
  { id: "flight", label: "Grant a feature", example: "Grant flight to self. Set its speed separately.", target: "behavior", operation: "grant", name: "flight", token: { kind: "number", value: 1 } },
  { id: "flight-speed", label: "Movement speed", example: "Set flying speed to 120 ft.", target: "speed", operation: "set", scopes: ["FLYING_SPEED"], token: { kind: "number", value: 120 } },
  { id: "resistance", label: "Resistance", example: "Take half damage from fire.", target: "damage_modifier", operation: "multiply", name: "fire", token: { kind: "number", value: 0.5 } },
  { id: "vulnerability", label: "Vulnerability", example: "Take double damage from fire.", target: "damage_modifier", operation: "multiply", name: "fire", token: { kind: "number", value: 2 } },
  { id: "immunity", label: "Immunity", example: "Take no damage from fire.", target: "damage_modifier", operation: "multiply", name: "fire", token: { kind: "number", value: 0 } },
  { id: "training", label: "Practice training", example: "Grant proficiency in Fieldcraft.", target: "skill_practice_check", operation: "grant", scopes: ["FIELDCRAFT"], token: { kind: "derived", which: "pb" } },
  { id: "roll", label: "Roll bonus", example: "Add +2 to attack rolls.", target: "action_roll", operation: "add", scopes: ["ATTACK_ROLL"], token: { kind: "number", value: 2 } },
  { id: "state", label: "State or permission", example: "Grant invisible to self; Revoke removes it.", target: "behavior", operation: "grant", name: "invisible", token: { kind: "number", value: 1 } },
  { id: "resource", label: "Named resource", example: "Set focus points to 3.", target: "behavior", operation: "set", name: "focus_points", token: { kind: "number", value: 3 } },
];

export function ruleStarterPatch(starter: RuleStarter) {
  const valueKind: ValueType = starter.token.kind === "keyword" || starter.token.kind === "behavior" ? "text" : "number";
  return {
    target: starter.target,
    operation: starter.operation,
    targetValues: [...(starter.scopes ?? [])],
    freeTextNarrowFocus: starter.name ?? "",
    tokens: [starter.token],
    operands: [],
    valueKind,
    value: String(serializeValueField([starter.token])[0] ?? ""),
  };
}
