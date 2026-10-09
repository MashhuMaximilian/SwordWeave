import { describe, expect, it } from "vitest";
import { shuffleEncounterEntries } from "../groups";
import { appraiseEncounter, type CreatureSummary } from "../model";
const candidates = [
  { id: "a", version: 3, budget: 25, role: "Support" },
  { id: "b", version: 2, budget: 50, role: "Melee" },
  { id: "c", version: 7, budget: 100, role: "Solo" },
];
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
describe("encounter group shuffling", () => {
  it("always fills the requested count without overspending, across budgets and random draws", () => {
    for (let seed = 0; seed < 100; seed++)
      for (const budget of [100, 125, 400, 1000]) {
        const entries = shuffleEncounterEntries(
          candidates,
          budget,
          4,
          seeded(seed),
        );
        expect(entries.reduce((n, e) => n + e.quantity, 0)).toBe(4);
        expect(
          entries.reduce(
            (n, e) =>
              n +
              candidates.find((c) => c.id === e.templateId)!.budget *
                e.quantity,
            0,
          ),
        ).toBeLessThanOrEqual(budget);
        expect(
          new Set(entries.map((e) => `${e.templateId}:${e.version}`)).size,
        ).toBe(entries.length);
        for (const entry of entries)
          expect(entry.version).toBe(
            candidates.find((c) => c.id === entry.templateId)!.version,
          );
      }
  });
  it("returns no suggestion if a complete group cannot fit", () => {
    expect(shuffleEncounterEntries(candidates, 99, 4)).toEqual([]);
    expect(shuffleEncounterEntries([], 100, 4)).toEqual([]);
    expect(
      shuffleEncounterEntries(
        [{ id: "invalid", version: 1, budget: 0 }],
        100,
        4,
      ),
    ).toEqual([]);
  });
  it("combines repeated creatures into quantities while preserving the template version", () => {
    expect(shuffleEncounterEntries(candidates.slice(0, 1), 100, 4)).toEqual([
      { templateId: "a", version: 3, quantity: 4 },
    ]);
  });
  it("produces different groups without mutating the catalogue", () => {
    const original = structuredClone(candidates);
    const options = Array.from({ length: 20 }, (_, i) =>
      JSON.stringify(shuffleEncounterEntries(candidates, 400, 4, seeded(i))),
    );
    expect(new Set(options).size).toBeGreaterThan(1);
    expect(candidates).toEqual(original);
  });
  it("keeps equipment separate and multiplies both budgets by quantity", () => {
    const entries = shuffleEncounterEntries(candidates.slice(0, 1), 100, 4);
    const creatures: CreatureSummary[] = [
      {
        templateId: "a",
        version: 3,
        name: "Support",
        budget: 25,
        itemBu: 7,
        maximum: 13,
      },
    ];
    const result = appraiseEncounter(
      {
        name: "Group",
        note: "",
        partyBu: null,
        partyItemBu: null,
        partySize: null,
        budgetSource: "manual",
        characterIds: [],
        entries,
      },
      creatures,
    );
    expect(result.enemyBu).toBe(100);
    expect(result.enemyItemBu).toBe(28);
    expect(result.enemyTotal).toBe(128);
  });
  it("rejects unsafe or excessive shuffle limits", () => {
    for (const [budget, count] of [
      [0, 4],
      [100, 0],
      [100, 21],
      [100.5, 4],
      [Infinity, 4],
    ])
      expect(() =>
        shuffleEncounterEntries(candidates, budget!, count!),
      ).toThrow();
  });
});

describe('per-creature limits and bosses',()=>{
 it('never exceeds regular per-creature caps, including repeated quantities',()=>{
  for(let seed=0;seed<100;seed++){
   const rows=shuffleEncounterEntries(candidates,50,4,seeded(seed),{mode:'perCreature',bossBudget:null});
   expect(rows.reduce((n,e)=>n+e.quantity,0)).toBe(4);
   for(const row of rows)expect(candidates.find(c=>c.id===row.templateId)!.budget).toBeLessThanOrEqual(50);
  }
 });
 it('includes exactly one separately capped boss within the requested count',()=>{
  for(let seed=0;seed<100;seed++){
   const rows=shuffleEncounterEntries(candidates,25,4,seeded(seed),{mode:'perCreature',bossBudget:100});
   expect(rows[0]).toEqual({templateId:'c',version:7,quantity:1});
   expect(rows.reduce((n,e)=>n+e.quantity,0)).toBe(4);
   expect(rows.slice(1)).toEqual([{templateId:'a',version:3,quantity:3}]);
  }
 });
 it('counts the boss inside a shared total rather than adding its allowance twice',()=>{
  const rows=shuffleEncounterEntries(candidates,175,4,seeded(1),{mode:'total',bossBudget:100});
  expect(rows).toEqual([{templateId:'c',version:7,quantity:1},{templateId:'a',version:3,quantity:3}]);
 });
 it('supports a single boss and rejects a roster with no affordable regular member',()=>{
  expect(shuffleEncounterEntries(candidates,25,1,seeded(1),{mode:'perCreature',bossBudget:100})).toEqual([{templateId:'c',version:7,quantity:1}]);
  expect(shuffleEncounterEntries(candidates.slice(2),25,4,seeded(1),{mode:'perCreature',bossBudget:100})).toEqual([]);
 });
});
