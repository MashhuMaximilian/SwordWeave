import { describe, expect, it } from "vitest";
import {
  startingPackageKey,
  startingPackageTier,
  suggestStartingPackages,
  type StartingPackagePrimitive,
  type StartingPackageSlot,
} from "../starting-package-suggestions";

const primitive = (id: number, category: string, buCost: number, costTier = "Tier 1"):
  StartingPackagePrimitive => ({ id, name: `Primitive ${id}`, category, buCost, costTier });

const options: Record<StartingPackageSlot, StartingPackagePrimitive[]> = {
  verb: [primitive(1, "VERB_TIER", 4), primitive(2, "VERB_TIER", 8, "Tier 2")],
  range: [primitive(3, "RANGE", 0, "Tier 0"), primitive(4, "RANGE", 4)],
  die: [primitive(5, "INTENSITY_DICE", 0, "Tier 0"), primitive(6, "INTENSITY_DICE", 2)],
  domain: [primitive(7, "DOMAIN", 4), primitive(8, "DOMAIN", 4), primitive(9, "DOMAIN", 4)],
};

describe("suggestStartingPackages", () => {
  it("returns complete, distinct packages within the BU limit", () => {
    const picks = suggestStartingPackages({ options, maxTier: 1, availableBu: 10, seed: 42 });
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((pick) => pick.key)).size).toBe(3);
    for (const pick of picks) {
      expect(pick.items.slice(0, 4).map((item) => item.category)).toEqual(["VERB_TIER", "RANGE", "INTENSITY_DICE", "DOMAIN"]);
      expect(pick.cost).toBeLessThanOrEqual(10);
      expect(pick.cost).toBe(pick.items.reduce((sum, item) => sum + item.buCost, 0));
    }
  });

  it("returns no incomplete or over-budget package", () => {
    expect(suggestStartingPackages({ options, maxTier: 1, availableBu: 7, seed: 1 })).toEqual([]);
    expect(suggestStartingPackages({ options: { ...options, domain: [] }, maxTier: 1, availableBu: 25, seed: 1 })).toEqual([]);
  });

  it("is deterministic per seed and reshuffles when the seed changes", () => {
    const input = { options, maxTier: 1, availableBu: 14 };
    const first = suggestStartingPackages({ ...input, seed: 11 });
    expect(suggestStartingPackages({ ...input, seed: 11 })).toEqual(first);
    const signatures = new Set(Array.from({ length: 32 }, (_, seed) =>
      suggestStartingPackages({ ...input, seed }).map((pick) => pick.key).join("|")));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("excludes saved packages by stable key", () => {
    const input = { options, maxTier: 1, availableBu: 14, seed: 12 };
    const saved = suggestStartingPackages(input)[0]!;
    const next = suggestStartingPackages({ ...input, excludedKeys: [saved.key] });
    expect(next.every((pick) => pick.key !== saved.key)).toBe(true);
    expect(startingPackageKey([...saved.items].reverse())).toBe(saved.key);
  });

  it("uses the selected shuffle budget for additional eligible primitives", () => {
    const expanded: typeof options = {
      verb: [...options.verb, primitive(10, "VERB_TIER", 12, "Tier 3")],
      range: [...options.range, primitive(11, "RANGE", 8, "Tier 3")],
      die: [...options.die, primitive(12, "INTENSITY_DICE", 4, "Tier 2"), primitive(13, "INTENSITY_DICE", 8, "Tier 3")],
      domain: options.domain,
    };
    const narrow = suggestStartingPackages({ options: expanded, maxTier: 3, availableBu: 10, seed: 9 });
    const broad = suggestStartingPackages({ options: expanded, maxTier: 3, availableBu: 31, seed: 9 });
    expect(narrow).toHaveLength(3);
    expect(broad).toHaveLength(3);
    expect(narrow.every((pick) => pick.cost <= 10)).toBe(true);
    expect(broad.every((pick) => pick.cost <= 31 && pick.cost >= 26 && pick.items.length > 4)).toBe(true);
    expect(broad.some((pick) => pick.items.filter((item) => item.category === "VERB_TIER").length > 1)).toBe(true);
    expect(broad.some((pick) => pick.items.filter((item) => item.category === "RANGE").length > 1)).toBe(true);
    expect(broad.some((pick) => pick.items.filter((item) => item.category === "INTENSITY_DICE").length > 1)).toBe(true);
    expect(broad.some((pick) => pick.items.filter((item) => item.category === "DOMAIN").length > 1)).toBe(true);
    expect(new Set(broad.map((pick) => pick.key)).size).toBe(3);
  });

  it("can buy higher tiers at level one when the BU allowance covers them", () => {
    const expanded: typeof options = {
      ...options,
      verb: [...options.verb, primitive(10, "VERB_TIER", 12, "Tier 3")],
      domain: [...options.domain, primitive(14, "DOMAIN", 12, "Tier 3")],
    };
    const low = suggestStartingPackages({ options: expanded, maxTier: 1, availableBu: 31, seed: 4 });
    const high = suggestStartingPackages({ options: expanded, maxTier: 3, availableBu: 31, seed: 4 });
    expect(low.some((pick) => pick.items.some((item) => startingPackageTier(item) === 3))).toBe(true);
    expect(high.some((pick) => pick.items.some((item) => startingPackageTier(item) === 3))).toBe(true);
  });

  it("shuffles all four access families and includes community and system options", () => {
    const mixed: typeof options = {
      verb: [primitive(101, "VERB_TIER", 4), { ...primitive(102, "VERB_TIER", 12, "Tier IV"), sourceOrigin: "user:alex" }],
      range: [primitive(103, "RANGE", 0, "Tier 0"), { ...primitive(104, "RANGE", 8, "Tier 3"), sourceOrigin: "user:alex" }],
      die: [primitive(105, "INTENSITY_DICE", 0, "Tier 0"), { ...primitive(106, "INTENSITY_DICE", 4, "Tier 2"), sourceOrigin: "user:alex" }],
      domain: [primitive(107, "DOMAIN", 4), { ...primitive(108, "DOMAIN", 4), sourceOrigin: "user:alex" }],
    };
    const seen = new Map<StartingPackageSlot, Set<number>>([
      ["verb", new Set()], ["range", new Set()], ["die", new Set()], ["domain", new Set()],
    ]);
    const origins = new Set<string>();
    for (let seed = 0; seed < 24; seed++) {
      const picks = suggestStartingPackages({ options: mixed, maxTier: 1, availableBu: 28, seed });
      expect(picks).toHaveLength(3);
      for (let index = 0; index < 4; index++) {
        expect(new Set(picks.map((pick) => pick.items[index]!.id)).size).toBeGreaterThan(1);
      }
      for (const pick of picks) {
        expect(pick.cost).toBeLessThanOrEqual(28);
        (["verb", "range", "die", "domain"] as const).forEach((slot, index) => seen.get(slot)!.add(pick.items[index]!.id));
        pick.items.forEach((item) => origins.add(item.sourceOrigin?.startsWith("user:") ? "community" : "system"));
      }
    }
    expect([...seen.values()].every((ids) => ids.size === 2)).toBe(true);
    expect(origins).toEqual(new Set(["system", "community"]));
  });

  it("handles a larger mixed-origin catalog without dropping domains", () => {
    const large: typeof options = {
      verb: Array.from({ length: 4 }, (_, index) => primitive(1000 + index, "VERB_TIER", 4 + index * 4, `Tier ${index + 1}`)),
      range: Array.from({ length: 5 }, (_, index) => primitive(1010 + index, "RANGE", index * 4, `Tier ${index}`)),
      die: Array.from({ length: 5 }, (_, index) => primitive(1020 + index, "INTENSITY_DICE", index * 2, `Tier ${index}`)),
      domain: Array.from({ length: 100 }, (_, index) => ({
        ...primitive(1030 + index, "DOMAIN", 4 + (index % 4) * 2),
        sourceOrigin: index % 2 ? "user:creator" : "system:canonical",
      })),
    };
    const picks = suggestStartingPackages({ options: large, availableBu: 28, seed: 30 });
    expect(picks).toHaveLength(3);
    expect(picks.every((pick) => pick.cost <= 28 && pick.items.length >= 4)).toBe(true);
    expect(suggestStartingPackages({ options: large, availableBu: 28, seed: 30 })).toEqual(picks);
  });
});
