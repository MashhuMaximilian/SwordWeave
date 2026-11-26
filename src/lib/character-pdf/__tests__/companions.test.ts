import { describe, expect, it, vi } from "vitest";
import type { ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { monsterDefinitionSchema } from "@/lib/monsters/model";
import type { MonsterSlot } from "@/lib/monsters/resolve";

const mocks = vi.hoisted(() => ({ list: vi.fn(), definition: vi.fn(), composition: vi.fn() }));
vi.mock("@/lib/character/companions", () => ({ listOwnerCharacterCompanionCopies: mocks.list }));
vi.mock("@/lib/monsters/copy-definition", () => ({ monsterCopyDefinition: mocks.definition }));
vi.mock("@/lib/monsters/composition", () => ({ resolveMonsterComposition: mocks.composition }));
import { createCharacterPdfCompanion, loadCharacterPdfCompanions } from "../companions";

const definition = monsterDefinitionSchema.parse({ name: "Scout", budget: 25, attributes: { physical: 3, mental: 0, magical: 0 } });
const copy = { id: "first", name: "Fern", templateId: "scout-template", templateVersion: 2, templateVersionId: "pinned-scout", currentVitality: 13 };
const consequence: ConsequenceOccurrence = { id: "leg", title: "Splintered leg", description: "Move with **care**.", durationTier: "short_rest",
  tags: [], modifiers: [], active: true, createdAt: 1, source: "custom", status: "active" };

describe("companion PDF data", () => {
  it("projects saved active consequences and resolved figures without raw override records", () => {
    const value = createCharacterPdfCompanion(copy, definition, [], { baselineVitality: 22, currentVitality: 3,
      "consequence:leg": consequence, "consequence:healed": { ...consequence, id: "healed", title: "Healed", status: "resolved" },
      "consequence:disabled": { ...consequence, id: "disabled", title: "Disabled", manualOverride: false } });
    expect(value).toMatchObject({ name: "Fern", templateName: "Scout", templateVersion: 2, vitality: { current: 3, max: 22 },
      consequences: [{ title: "Splintered leg", description: "Move with **care**.", duration: "Until short rest" }] });
    expect(value).not.toHaveProperty("overrides");
    expect(value).not.toHaveProperty("id");
    expect(value.consequences).toHaveLength(1);
  });

  it("matches the play sheet's automatic conditions at the saved Vitality", () => {
    const slot: MonsterSlot = { primitiveId: 1, name: "Cornered", category: "METRIC", isMirrored: false, isMirrorable: true,
      mirrorVector: null, originHeritageId: null, originEffectId: null, originCapabilityId: null, buCost: 4, quantity: 1, dependencyKey: "p1", item: false,
      hardModifiers: [{ kind: "modify", target: "attack_bonus", operation: "add", value: 2, stacking: "stack",
        condition: { kind: "preset", presetKey: "actor-below-half-hp", customTags: [] } }] };
    const low = createCharacterPdfCompanion(copy, definition, [slot], { currentVitality: 2 });
    const full = createCharacterPdfCompanion(copy, definition, [slot], {});
    expect(low.attackBonus).toBe(full.attackBonus + 2);
    expect(low.consequences[0]?.title).toBe("Cornered condition");
    expect(full.consequences).toHaveLength(0);
  });

  it("loads shared pinned rules once and retains each copy's separate state and attachment order", async () => {
    mocks.list.mockResolvedValue([{ copy, overrides: { currentVitality: 3, "consequence:leg": consequence } },
      { copy: { ...copy, id: "second", name: "Stone", currentVitality: 8 }, overrides: null }]);
    mocks.definition.mockResolvedValue({ ...definition, componentPins: [], imageUrl: "/art/monsters/scout.webp",
      portraitFrame: { x: 37, y: 49, zoom: 1.4 } });
    mocks.composition.mockResolvedValue([]);
    const values = await loadCharacterPdfCompanions("character", "clerk-owner");
    expect(mocks.list).toHaveBeenCalledWith("character", "clerk-owner");
    expect(mocks.definition).toHaveBeenCalledTimes(1);
    expect(mocks.composition).toHaveBeenCalledWith(expect.objectContaining({ name: "Scout" }), "clerk-owner", undefined,
      { trustedPinnedComposition: true });
    expect(values.map(value => [value.name, value.vitality.current, value.consequences.length])).toEqual([
      ["Fern", 3, 1], ["Stone", 8, 0],
    ]);
    for (const value of values) expect(value).toMatchObject({ portraitKey: "pinned-scout", portraitUrl: "/art/monsters/scout.webp",
      portraitFrame: { x: 37, y: 49, zoom: 1.4 } });
  });
});
