import { describe, expect, it } from "vitest";
import { monsterDefinitionSchema, type MonsterReference } from "../model";
import { resolveGuestMonster, shuffleGuestMonster, type GuestMonsterCatalog } from "../guest-preview";

const base = monsterDefinitionSchema.parse({ name: "Guest sentinel", budget: 25, attributes: { physical: 3, mental: 0, magical: 0 } });
const ref = (kind: MonsterReference["kind"], id: string, extra: Partial<MonsterReference> = {}): MonsterReference => ({ kind, id, quantity: 1, isMirrored: false, versionId: null, ...extra });
const catalog: GuestMonsterCatalog = {
  primitives: [
    { id: 1, name: "Tough", category: "METRIC", buCost: 4, isMirrorable: true, mechanicalOutputText: "Add 5 Vitality.", hardModifiers: [{ kind: "modify", target: "max_vitality", operation: "add", value: 5, stacking: "stack" }] },
    { id: 2, name: "Swift", category: "METRIC", buCost: 8, hardModifiers: [] },
    { id: 3, name: "Too costly", buCost: 40, hardModifiers: [] },
  ],
  effects: [{ id: "ward", name: "Ward", primitiveLinks: [{ primitiveId: 1, quantity: 2 }] }],
  capabilities: [{ id: "shield", name: "Shield", buCost: 8, effectLinks: [{ effectId: "ward" }] }],
  items: [{ id: "coat", name: "Coat", primitiveLinks: [{ primitiveId: 1 }] }],
};

describe("anonymous monster experiments", () => {
  it("uses canonical public rules through nested packages, sharing ownership but separating equipment", () => {
    const prepared = resolveGuestMonster({ ...base, references: [ref("CAPABILITY", "shield"), ref("PRIMITIVE", "1"), ref("ITEM", "coat")] }, catalog);
    expect(prepared.sheet).toMatchObject({ spent: 8, itemBu: 4, maximum: 28 });
    expect(prepared.slots.map(slot => [slot.quantity, slot.item])).toEqual([[2, false], [1, true]]);
    expect(prepared.slots[0]!.mechanicalDescription).toBe("Add 5 Vitality.");
    expect(prepared.definition.componentPins).toHaveLength(4);
    expect(prepared.slots[0]!.supplyKeys).toHaveLength(2);
  });

  it("resolves nested mirror cancellation and weakness credit without raising the foundation", () => {
    const mirrored = { ...catalog, effects: [{ id: "ward", name: "Ward", primitiveLinks: [{ primitiveId: 1, isMirrored: true }] }] };
    const weakness = resolveGuestMonster({ ...base, references: [ref("EFFECT", "ward")] }, mirrored);
    expect(weakness.sheet).toMatchObject({ rank: 1, spent: 0, mirrorCredit: 4, availableBudget: 29 });
    const cancelled = resolveGuestMonster({ ...base, references: [ref("EFFECT", "ward", { isMirrored: true })] }, mirrored);
    expect(cancelled.sheet).toMatchObject({ spent: 4, mirrorCredit: 0, maximum: 18 });
  });

  it("does not trust inline fragments, fetch unavailable components, or relabel old pins", () => {
    const unavailable = { ...catalog, effects: [{ id: "hidden", primitiveLinks: [{ primitiveId: 99, primitive: { id: 99, name: "Private", buCost: 0 } }] }] };
    expect(() => resolveGuestMonster({ ...base, references: [ref("EFFECT", "hidden")] }, unavailable)).toThrow(/unavailable/);
    expect(() => resolveGuestMonster({ ...base, references: [ref("PRIMITIVE", "1", { versionId: "old-private-version" })] }, catalog)).toThrow(/version is unavailable/);
    expect(() => resolveGuestMonster({ ...base, references: [ref("PRIMITIVE", "3")] }, catalog)).toThrow(/exceeds/);
  });

  it("rejects cycles and oversized instance expansion", () => {
    const cyclic = { ...catalog, effects: [{ id: "loop", effectLinks: [{ effectId: "loop" }] }] };
    expect(() => resolveGuestMonster({ ...base, references: [ref("EFFECT", "loop")] }, cyclic)).toThrow(/Cyclic/);
    expect(() => resolveGuestMonster({ ...base, references: [ref("PRIMITIVE", "1", { quantity: 10_001 })] }, catalog)).toThrow(/10,000/);
  });

  it("shuffles locally within budget while retaining locked and equipment references", () => {
    const original = { ...base, references: [ref("PRIMITIVE", "1"), ref("ITEM", "coat")] };
    const prepared = shuffleGuestMonster(original, catalog, ["reference:0"], { shuffleKinds: ["PRIMITIVE"], shuffleBudget: 12, random: () => .5 });
    expect(prepared.definition.references).toEqual([...original.references, ref("PRIMITIVE", "2")]);
    expect(prepared.sheet).toMatchObject({ spent: 12, itemBu: 4 });
    expect(original.references).toHaveLength(2);
    expect(() => shuffleGuestMonster(original, catalog, ["reference:0"], { shuffleBudget: 2 })).toThrow(/Kept components/);
  });
});
