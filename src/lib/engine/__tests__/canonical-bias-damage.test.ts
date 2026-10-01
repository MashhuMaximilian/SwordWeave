import { describe, expect, it } from "vitest";
import type { HardModifier, JsonValue } from "@/types/swordweave";
import type { ConditionContext } from "../condition-evaluator";
import { resolveDamage } from "../damage-resolver";
import { resolveModifiers, type ResolvedCharacterInput, type ResolvedPrimitiveSlot } from "../resolve-modifiers";

const context: ConditionContext = {
  character: {
    vitality: 12, vitalityMax: 12, saveDc: 10, blockValue: 0,
    attributes: { physical: 2, mental: 0, magical: 0 },
    practices: {} as ConditionContext["character"]["practices"],
    proficiencies: new Set(), flags: new Set(), custom: {},
  },
};
const asleep = { kind: "preset", presetKey: "actor-prone", customTags: [] } as const;
const input: ResolvedCharacterInput = { characterId: "bias-test", level: 1, pb: 2, proficientAttribute: null, attributes: { physical: 2, mental: 0, magical: 0 }, slots: [], conditionContext: context };
function slot(id: number, modifier: HardModifier, overrides: Partial<ResolvedPrimitiveSlot> = {}): ResolvedPrimitiveSlot {
  return { primitiveId: id, name: `Rule ${id}`, category: "TEST", hardModifiers: [modifier], isMirrored: false, isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", originHeritageId: null, originCapabilityId: null, originEffectId: null, ...overrides };
}
const bias = (operation: "grant" | "revoke", value: JsonValue = { kind: "behavior", name: "advantage" }): HardModifier => ({ kind: "modify", target: "skill_practice_check", operation, value, metadata: { targetScope: { layer: "PRACTICE", values: ["PROWESS"] } } });
const score = slot(1, { kind: "modify", target: "skill_practice_check.prowess", operation: "add", value: 7 });

describe("canonical bias is separate from numeric checks", () => {
  it("grants/revokes typed and legacy bias without clearing a scoped numeric score", () => {
    const result = resolveModifiers({ ...input, slots: [score, slot(2, bias("grant")), slot(3, bias("revoke", { kind: "keyword", text: "[Advantage]" }))] });
    expect(result.totals["skill_practice_check.prowess"]).toBe(7);
    expect(result.totals["behavior.advantage.skill_practice_check.prowess"]).toBe(0);
    expect(result.byTarget["behavior.advantage.skill_practice_check.prowess"]?.map(c => c.value)).toEqual([1, -1]);
    expect(result.byTarget["behavior.advantage.skill_practice_check.fieldcraft"]).toBeUndefined();
  });
  it("suppresses inactive and inhibited bias while retaining its trace", () => {
    const result = resolveModifiers({ ...input, slots: [score, slot(2, { ...bias("grant"), condition: asleep }), slot(3, bias("grant"), { isToggledOff: true })] });
    expect(result.totals["skill_practice_check.prowess"]).toBe(7);
    expect(result.totals["behavior.advantage.skill_practice_check.prowess"]).toBe(0);
    expect(result.byTarget["behavior.advantage.skill_practice_check.prowess"]?.map(c => c.value)).toEqual([0, 0]);
  });
  it("mirrors grant/revoke and respects per-modifier mirror opt-out", () => {
    const result = resolveModifiers({ ...input, slots: [score, slot(2, bias("revoke"), { isMirrored: true }), slot(3, { ...bias("grant"), metadata: { ...bias("grant").metadata, mirror: { optedOut: true } } }, { isMirrored: true })] });
    expect(result.totals["skill_practice_check.prowess"]).toBe(7);
    expect(result.totals["behavior.advantage.skill_practice_check.prowess"]).toBe(2);
  });
  it("resolves legacy colon and canonical flight flags without activating an inactive grant", () => {
    const legacy = slot(2, { kind: "modify", target: "behavior:fly_speed", operation: "grant", value: 1 });
    const flight = slot(3, { kind: "modify", target: "behavior", operation: "grant", value: 1, metadata: { behaviorName: "flight" }, condition: asleep });
    const result = resolveModifiers({ ...input, slots: [legacy, flight] });
    expect(result.behaviorVariables["fly_speed"]).toBe(1);
    expect(result.behaviorVariables["flight"]).toBe(0);
  });
});

function damage(modifier: Record<string, unknown>, overrides: Record<string, unknown> = {}, conditionContext?: ConditionContext) {
  return resolveDamage({ amount: 11, type: "FIRE", ...(conditionContext ? { conditionContext } : {}), primitiveLinks: [{ primitive: { id: 1, name: "Fire resistance", hardModifiers: [modifier] }, ...overrides }] });
}
const resistance = { target: "damage_modifier", metadata: { scopeName: "fire" }, operation: "multiply", value: { kind: "number", value: 0.5 } };
describe("canonical damage multipliers", () => {
  it("uses typed numbers and named scopes, preserving fractional multipliers until final damage", () => {
    expect(damage(resistance)).toMatchObject({ multiplier: 0.5, final: 6 });
    expect(damage({ ...resistance, metadata: { scopeName: "cold" } }).final).toBe(11);
    expect(damage({ ...resistance, metadata: { targetScope: { values: ["fire", "cold"] } } }).final).toBe(6);
  });
  it("retains dotted/split legacy targets, mirror reciprocal and opt-out", () => {
    expect(damage({ targetAxis: "damage_modifier", targetKey: "fire", operation: "multiply", value: 0.5 }).final).toBe(6);
    expect(damage(resistance, { isMirrored: true }).final).toBe(22);
    expect(damage({ ...resistance, metadata: { scopeName: "fire", mirror: { optedOut: true } } }, { isMirrored: true }).final).toBe(6);
  });
  it("supports exact legacy resistance grants without mistaking type access for resistance", () => {
    expect(damage({ target: "damage_type", operation: "grant", metadata: { scopeName: "fire" }, value: { kind: "keyword", text: "resistance" } }).final).toBe(6);
    expect(damage({ target: "damage_type", operation: "grant", metadata: { scopeName: "fire" }, value: { kind: "keyword", text: "fire" } }).final).toBe(11);
  });
  it("does not apply inactive, unknown-context, or inhibited damage modifiers", () => {
    expect(damage({ ...resistance, condition: asleep }, {}, context).final).toBe(11);
    expect(damage({ ...resistance, condition: asleep }).final).toBe(11);
    expect(damage(resistance, { isToggledOff: true }).final).toBe(11);
    const prone = { ...context, character: { ...context.character, flags: new Set(["is_prone"]) } };
    expect(damage({ ...resistance, condition: asleep }, {}, prone).final).toBe(6);
  });
  it("never turns invalid, absent, or negative numeric tokens into immunity", () => {
    for (const value of [null, "", { kind: "keyword", text: "fire" }, { kind: "number", value: -1 }]) expect(damage({ ...resistance, value }).final).toBe(11);
    expect(damage({ ...resistance, value: { kind: "number", value: 0 } }).final).toBe(0);
  });
});
