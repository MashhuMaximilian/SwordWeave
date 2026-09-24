import { describe, expect, it } from "vitest";
import { chooseMirrorSuggestions, eligibleMirrorCandidates, mirrorConsequence } from "../mirror-suggestions";

const candidate = (id: number, changes: Record<string, unknown> = {}) => ({
  id, name: `Primitive ${id}`, category: "SHEET_AUGMENT", costTier: "Tier 4",
  sourceOrigin: id % 2 ? "system" : "user:someone",
  isMirrorable: true, mirrorBuCredit: 4, buCost: 4, mirrorVector: "VARIABLE_VECTOR",
  hardModifiers: [{ kind: "modify", target: "load", operation: "subtract", value: 2 }], ...changes,
});

describe("mirror suggestions", () => {
  it("uses every affordable primitive with an actual mirror operation, regardless of tier, category, or origin", () => {
    const rows = [
      candidate(1), candidate(2, { category: "ITEM_AUGMENT" }),
      candidate(3, { costTier: "Tier 5", sourceOrigin: "user:someone" }),
      candidate(4, { isMirrorable: false }), candidate(5, { mirrorBuCredit: 9 }),
      candidate(6, { mirrorBuCredit: 0 }),
      candidate(7, { hardModifiers: [{ kind: "modify", target: "behavior", operation: "set", value: "stable" }] }),
      candidate(8, { hardModifiers: [] }),
      candidate(9, { hardModifiers: [{ kind: "modify", target: "load", operation: "subtract", value: 2, metadata: { mirror: { optedOut: true } } }] }),
    ];
    expect(eligibleMirrorCandidates(rows, 4).map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("describes a mirrored subtract modifier as the actual increase in Load", () => {
    expect(mirrorConsequence(candidate(1))).toBe("Mirrored effect: add 2 to Load.");
  });

  it("describes a mirrored add modifier as a decrease", () => {
    expect(mirrorConsequence(candidate(1, { hardModifiers: [
      { kind: "modify", target: "max_vitality", operation: "add", value: 5 },
    ] }))).toBe("Mirrored effect: subtract 5 from Max Vitality.");
  });

  it("fills three suggestions outside kept and previous choices when enough are available", () => {
    const rows = Array.from({ length: 20 }, (_, index) => candidate(index + 1));
    const kept = [1, 2];
    const previous = [3, 4, 5];
    const result = chooseMirrorSuggestions(rows, "Aster", 1, kept, previous);
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).not.toContain(1);
    expect(result.map((item) => item.id)).not.toContain(2);
    expect(result.map((item) => item.id).some((id) => previous.includes(id))).toBe(false);
  });

  it("keeps considered choices out even when fewer than three other choices exist", () => {
    const rows = [candidate(1), candidate(2), candidate(3)];
    expect(chooseMirrorSuggestions(rows, "Aster", 2, [1, 2]).map((item) => item.id)).toEqual([3]);
  });

  it("does not collapse distinct community forks that share a name", () => {
    const rows = [candidate(1, { name: "Edge" }), candidate(2, { name: "Edge (fork)" }), candidate(3)];
    expect(chooseMirrorSuggestions(rows, "Aster", 0)).toHaveLength(3);
  });

  it("draws the entire available pool over successive reshuffles", () => {
    const rows = Array.from({ length: 24 }, (_, index) => candidate(index + 1));
    const seen = new Set<number>();
    let previous: number[] = [];
    for (let seed = 0; seed < 100; seed++) {
      previous = chooseMirrorSuggestions(rows, "Aster", seed, [], previous).map((item) => item.id);
      previous.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(rows.length);
  });
});
