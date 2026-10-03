import { describe, expect, it } from "vitest";
import { EMPTY_QUICKBUILD, quickbuildCost, shuffleQuickbuild, type QuickbuildCatalog, type QuickbuildHeritage } from "../quickbuild";
const heritage = (kind: QuickbuildHeritage["kind"], cost: number, id: number): QuickbuildHeritage => ({ id: String(id), name: String(id), kind, cost, description: null, imageUrl: null, defaultSize: null, primitiveLinks: [{ primitiveId: id, isMirrored: false }], capabilityLinks: [] });
const rows = [heritage("LINEAGE", 33, 1), heritage("LINEAGE", 20, 2), heritage("UPBRINGING", 25, 3), heritage("UPBRINGING", 10, 4), heritage("MANIFEST", 25, 5), heritage("MANIFEST", 11, 6)];
const catalog: QuickbuildCatalog = { heritages: rows, primitives: rows.map(h => ({ id: Number(h.id), buCost: h.cost, mirrorBuCredit: h.cost })) };
describe("Heritage shuffle BU limits", () => {
  it("allows an individual override above the shared per-heritage cap", () => {
    const pick = shuffleQuickbuild(catalog, 100, EMPTY_QUICKBUILD, [], [], undefined, () => 0, Infinity, { mode: "each", bu: 25, overrides: { LINEAGE: 33 } });
    expect(pick).toEqual({ LINEAGE: "1", UPBRINGING: "3", MANIFEST: "5" });
  });
  it("respects both the total limit and a lineage override", () => {
    const pick = shuffleQuickbuild(catalog, 100, EMPTY_QUICKBUILD, [], [], undefined, () => 0, Infinity, { mode: "total", bu: 54, overrides: { LINEAGE: 33 } });
    expect(pick).toEqual({ LINEAGE: "1", UPBRINGING: "4", MANIFEST: "6" });
    expect(quickbuildCost(catalog, pick).netCost).toBe(54);
  });
  it("never uses shuffle limits to exceed the character's available budget", () => {
    const pick = shuffleQuickbuild(catalog, 25, EMPTY_QUICKBUILD, [], [], undefined, () => 0, Infinity, { mode: "each", bu: 100, overrides: { LINEAGE: 100 } });
    expect(quickbuildCost(catalog, pick).netCost).toBeLessThanOrEqual(25);
  });
  it("keeps other heritages when rerolling one within its own cap", () => {
    const current = { LINEAGE: "1", UPBRINGING: "4", MANIFEST: "6" };
    const pick = shuffleQuickbuild(catalog, 100, current, [], [], "LINEAGE", () => 0, Infinity, { mode: "total", bu: 54, overrides: { LINEAGE: 20 } });
    expect(pick).toEqual({ ...current, LINEAGE: "2" });
  });
  it("counts shared primitives once against a total limit", () => {
    const shared = { ...catalog, heritages: [rows[1]!, { ...rows[3]!, primitiveLinks: rows[1]!.primitiveLinks, cost: 20 }] };
    const pick = shuffleQuickbuild(shared, 25, EMPTY_QUICKBUILD, [], [], undefined, () => 0, Infinity, { mode: "total", bu: 20, overrides: {} });
    expect(pick.LINEAGE).toBe("2"); expect(pick.UPBRINGING).toBe("4");
    expect(quickbuildCost(shared, pick).netCost).toBe(20);
  });
});
