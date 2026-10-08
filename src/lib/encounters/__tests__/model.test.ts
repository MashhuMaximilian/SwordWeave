import { describe, it, expect } from "vitest";
import {
  appraiseEncounter,
  encounterDefinitionSchema,
  runMutationSchema,
} from "../model";
import { systemBestiary } from "@/lib/monsters/catalogue/system-bestiary";
const id = "00000000-0000-4000-8000-000000000001";
describe("encounter budgets and authored safety", () => {
  it("counts chosen base BU and separate equipment once per creature", () => {
    const d = encounterDefinitionSchema.parse({
      name: "Bridge",
      partyBu: 100,
      partyItemBu: 20,
      entries: [{ templateId: id, version: 1, quantity: 3 }],
    });
    expect(
      appraiseEncounter(d, [
        {
          templateId: id,
          version: 1,
          name: "Guard",
          budget: 25,
          itemBu: 5,
          maximum: 40,
        },
      ]),
    ).toMatchObject({
      enemyBu: 75,
      enemyItemBu: 15,
      enemyTotal: 90,
      partyTotal: 120,
      difference: -30,
      ratio: 0.75,
      count: 3,
    });
  });
  it("allows unknown party budgets without inventing difficulty", () => {
    const d = encounterDefinitionSchema.parse({ name: "Scene" });
    expect(appraiseEncounter(d, [])).toMatchObject({
      partyTotal: null,
      ratio: null,
      difference: null,
    });
  });
  it("does not mistake missing equipment budget for zero", () => {
    const d = encounterDefinitionSchema.parse({ name: "Scene", partyBu: 25 });
    expect(appraiseEncounter(d, []).partyTotal).toBeNull();
  });
  it("hides comparisons when a pinned creature is unavailable", () => {
    const d = encounterDefinitionSchema.parse({
      name: "Scene",
      partyBu: 25,
      partyItemBu: 0,
      entries: [{ templateId: id, version: 1, quantity: 1 }],
    });
    expect(appraiseEncounter(d, [])).toMatchObject({
      missing: true,
      difference: null,
      ratio: null,
    });
  });
  it("rejects duplicates, unsafe values and oversized run requests", () => {
    expect(
      encounterDefinitionSchema.safeParse({
        name: "Scene",
        partyBu: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
    expect(
      encounterDefinitionSchema.safeParse({
        name: "Scene",
        entries: [
          { templateId: id, version: 1, quantity: 200 },
          { templateId: id, version: 2, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("keeps metadata distinct from mechanics and includes 100 original recipes", () => {
    expect(systemBestiary).toHaveLength(100);
    expect(new Set(systemBestiary.map((r) => r.key)).size).toBe(100);
    expect(new Set(systemBestiary.map((r) => r.environment)).size).toBe(10);
    expect(
      systemBestiary.every(
        (r) => r.concept && r.tactics && r.ability && r.trait,
      ),
    ).toBe(true);
  });
});
describe("encounter markers have a separate validator", () => {
  const parse = (field: string, value: unknown) =>
    runMutationSchema.safeParse({
      opId: id,
      baseRevision: 0,
      changes: [{ field, value }],
    });
  it("accepts the SwordWeave rhythm and rejects initiative", () => {
    expect(parse("phase", "Council").success).toBe(true);
    expect(parse("phase", "Heavy").success).toBe(true);
    expect(parse("phase", "Initiative").success).toBe(false);
  });
  it("rejects gameplay fields and malformed intent objects", () => {
    expect(parse("currentVitality", 10).success).toBe(false);
    expect(
      parse(`actor:${id}`, { intent: "Rush", track: "Fast", resolved: false })
        .success,
    ).toBe(true);
    expect(
      parse(`actor:${id}`, {
        intent: "Rush",
        track: "Fast",
        resolved: false,
        damage: 99,
      }).success,
    ).toBe(false);
    expect(parse("round", 0).success).toBe(false);
  });
});
