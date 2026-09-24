import { describe, expect, it } from "vitest";
import { drawDiscoverySuggestions, incrementalDiscoveryCost, discoverySetCost, normalizeDiscoveryText, rankDiscoveryCandidates, type DiscoveryCandidate, type DiscoveryRequest } from "../matching";

const make = (id: number, overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  key: `primitive:${id}`, kind: "primitive", name: `Option ${id}`, description: "", mechanicalDescription: "", tags: [], family: "", structuredRules: "", origin: "system", cost: 4, versionNumber: 1, ...overrides,
});
const request: DiscoveryRequest = { query: "", intent: "surprise", budget: 25, debtAvailable: 8, kinds: ["primitive"] };

describe("purposeful discovery", () => {
  it("finds a paraphrase across narrative and mechanical language without requiring title words", () => {
    const result = rankDiscoveryCandidates([
      make(1, { name: "Quiet aegis", mechanicalDescription: "Grant resistance to arcane damage." }),
      make(2, { name: "Bulwark", mechanicalDescription: "Grant armor against physical attacks." }),
      make(3, { name: "Spellbook", description: "Records magical subjects." }),
    ], { ...request, query: "hard to hurt with spells" });
    expect(result.map((item) => item.key)).toEqual(["primitive:1"]);
    expect(result[0]?.evidence).toBe("mechanics");
  });

  it("labels name-only evidence without pretending the actual mechanic supports the idea", () => {
    const result = rankDiscoveryCandidates([make(1, { name: "Arcane shield", mechanicalDescription: "Add 1 to swim speed." })], { ...request, query: "resist magic" });
    expect(result[0]?.evidence).toBe("description");
    expect(result[0]?.reason).toContain("Check the rule");
  });

  it("searches tags, family, structured modifiers, and nested mechanical summaries", () => {
    const result = rankDiscoveryCandidates([
      make(1, { tags: ["forest"] }),
      make(2, { family: "Forest access" }),
      make(3, { structuredRules: '{"target":"forest"}' }),
      make(4, { kind: "capability", key: "capability:4", mechanicalDescription: "Nested piece: forest command" }),
    ], { ...request, query: "forest", kinds: ["primitive", "capability"] });
    expect(result).toHaveLength(4);
  });

  it("normalizes accents and minor typos", () => {
    expect(normalizeDiscoveryText("Éther—WALK_speed")).toBe("ether walk speed");
    expect(rankDiscoveryCandidates([make(1, { tags: ["Tracking"] })], { ...request, query: "trackin" })).toHaveLength(1);
  });

  it("includes community and high-tier options constrained only by allowance", () => {
    const result = rankDiscoveryCandidates([
      make(1, { name: "Verb tier IV", cost: 16 }),
      make(2, { origin: "community", cost: 25 }),
      make(3, { cost: 26 }),
      make(4, { cost: NaN }),
    ], request);
    expect(result.map((item) => item.key).sort()).toEqual(["primitive:1", "primitive:2"]);
  });

  it("uses available debt for mirrors and never mistakes an ordinary cost for eligibility", () => {
    const result = rankDiscoveryCandidates([
      make(1, { cost: 50, mirrorCredit: 4 }),
      make(2, { mirrorCredit: 9 }),
      make(3),
    ], { ...request, intent: "weakness", budget: 0 });
    expect(result.map((item) => item.key)).toEqual(["primitive:1"]);
    expect(result[0]?.mirrored).toBe(true);
  });

  it("respects compatible kinds and already supplied keys", () => {
    expect(rankDiscoveryCandidates([make(1), make(2, { kind: "item", key: "item:2" })], { ...request, excludedKeys: ["primitive:1"] })).toEqual([]);
  });
});

describe("shuffle and comparison", () => {
  const pool = Array.from({ length: 12 }, (_, index) => ({ key: `primitive:${index}` }));
  it("never repeats kept candidates and replaces all three shown suggestions", () => {
    const result = drawDiscoverySuggestions(pool, ["primitive:0", "primitive:1"], ["primitive:2", "primitive:3", "primitive:4"], ["primitive:2", "primitive:3", "primitive:4"], () => 0.5);
    expect(result).toHaveLength(3);
    expect(result.every((item) => !["primitive:0", "primitive:1", "primitive:2", "primitive:3", "primitive:4"].includes(item.key))).toBe(true);
  });
  it("visits the full eligible pool before recycling", () => {
    const seen: string[] = [];
    let previous: string[] = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      const next = drawDiscoverySuggestions(pool, [], seen, previous, () => 0.5).map((item) => item.key);
      expect(next.every((key) => !seen.includes(key))).toBe(true);
      seen.push(...next); previous = next;
    }
    expect(new Set(seen).size).toBe(12);
  });
  it("honestly returns fewer than three when only two unkept choices exist", () => {
    const result = drawDiscoverySuggestions(pool, pool.slice(0, 10).map((item) => item.key), [], [], () => 0.5);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.key)).size).toBe(2);
  });
  it("does not return duplicate entity rows", () => {
    expect(drawDiscoverySuggestions([pool[0]!, pool[0]!, pool[1]!], [], [], [])).toHaveLength(2);
  });
});


describe("active draft cost discovery", () => {
  const bundle = make(30, { key: "capability:30", kind: "capability", cost: 12, primitiveCosts: [{key:"primitive:1",cost:4},{key:"primitive:2",cost:8}] });
  it("lets a bundle fit by accounting for a rule already supplied to the character", () => {
    const result = rankDiscoveryCandidates([bundle], {...request, kinds:["capability"], budget:8, suppliedPrimitiveKeys:["primitive:1"]});
    expect(result[0]?.cost).toBe(8);
    expect(result[0]?.libraryCost).toBe(12);
  });
  it("does not discount an extra direct purchase or guess costs for unknown compositions", () => {
    expect(incrementalDiscoveryCost(make(1), new Set(["primitive:1"])).cost).toBe(4);
    expect(incrementalDiscoveryCost(make(9,{kind:"capability",key:"capability:9",cost:20}),new Set(["primitive:1"])).cost).toBe(20);
  });
  it("discounts a supplied leaf only once when the composition references it twice", () => {
    const candidate = {...bundle,primitiveCosts:[{key:"primitive:1" as const,cost:4},{key:"primitive:1" as const,cost:4}]};
    expect(incrementalDiscoveryCost(candidate,new Set(["primitive:1"])).cost).toBe(8);
  });
  it("does not consume character BU for item-only supply", () => {
    expect(incrementalDiscoveryCost(bundle,new Set(),true).cost).toBe(0);
  });
  it("estimates a set with shared rules and tracks drawback credit separately", () => {
    const candidates = rankDiscoveryCandidates([bundle, make(31,{kind:"capability",key:"capability:31",cost:8,primitiveCosts:[{key:"primitive:2",cost:8}]})],{...request,kinds:["capability"]});
    const drawback = rankDiscoveryCandidates([make(32,{mirrorCredit:4})],{...request,intent:"weakness"})[0]!;
    expect(discoverySetCost([...candidates,drawback])).toEqual({cost:12,credit:4});
  });
});
