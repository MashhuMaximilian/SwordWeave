// Test for use-sheet-conditions hook
import { describe, it, expect } from "vitest";

// Mirror the relevant scan logic for testing without React
function isKnownFlag(label: string): boolean {
  if (label.startsWith("proficient_in(")) return true;
  if (label.startsWith("not_proficient_in(")) return true;
  if (label.startsWith("proficient_in_attribute(")) return true;
  if (label.startsWith("not_proficient_in_attribute(")) return true;
  if (label === "proficient_in(all_practices)") return true;
  if (label === "not_proficient_in(all_practices)") return true;
  if (label === "proficient_in(all_saves)") return true;
  if (label === "not_proficient_in(all_saves)") return true;
  if (label === "proficient") return true;
  if (label === "not_proficient") return true;
  const KNOWN = new Set([
    "is_prone", "is_stunned", "is_bleeding", "is_frightened",
    "is_blinded", "is_charmed", "is_grappled", "is_restrained",
    "is_sick", "is_wounded", "is_damaged_last_round",
    "has_stance", "unconscious", "prone", "stunned", "bleeding",
    "frightened", "blinded", "charmed", "grappled", "restrained",
    "sick", "wounded",
  ]);
  return KNOWN.has(label);
}

function isManualTriggerToken(token: string): boolean {
  const sep = token.indexOf(":");
  if (sep < 0) return false;
  const axis = token.slice(0, sep);
  const payload = token.slice(sep + 1);
  if (payload.startsWith("stat|")) return false;
  if (axis === "target" || axis === "scene") return true;
  if (axis !== "self" && axis !== "actor") return false;
  return !isKnownFlag(payload);
}

function isConditionEffective(condition: unknown): boolean {
  if (!condition) return false;
  if (typeof condition !== "object" || condition === null) return false;
  const c = condition as { kind?: string; tokens?: readonly string[] };
  if (c.kind === "narrative") return true;
  if (Array.isArray(c.tokens)) {
    const pillTokens = c.tokens.filter((_t, i) => i % 2 === 0);
    return pillTokens.some((t) => isManualTriggerToken(t));
  }
  return false;
}

function scanPrimitivesForConditions(
  primitives: ReadonlyArray<{
    primitiveId: number;
    primitive: { id: number; name: string; hardModifiers: ReadonlyArray<Record<string, unknown>> };
  }>,
): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  for (const link of primitives) {
    const mods = link.primitive.hardModifiers ?? [];
    mods.forEach((mod, idx) => {
      const condition = mod["condition"];
      if (!condition) return;
      if (!isConditionEffective(condition)) return;
      out.push({
        id: `sheet-primitive-${link.primitiveId}-${idx}`,
        title: link.primitive.name,
      });
    });
  }
  return out;
}

describe("use-sheet-conditions scanner", () => {
  it("doesn't create sheet conditions for primitives without conditions", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 1,
        primitive: {
          id: 1,
          name: "Plain Buff",
          hardModifiers: [
            { kind: "modify", target: "attribute.physical", operation: "add", value: 5 },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it("doesn't create sheet conditions for computable conditions (HP-based)", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 1,
        primitive: {
          id: 1,
          name: "Iron Will",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 5,
              condition: {
                kind: "compound",
                tokens: ["self:stat|vitality_pct|<|0.5"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it("creates sheet conditions for narrative triggers", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 1,
        primitive: {
          id: 1,
          name: "Hunter Bonus",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 3,
              condition: {
                kind: "narrative",
                description: "tracking an animal",
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Hunter Bonus");
    expect(result[0]?.id).toBe("sheet-primitive-1-0");
  });

  it("creates sheet conditions for target-scoped conditions", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 1,
        primitive: {
          id: 1,
          name: "Backstab",
          hardModifiers: [
            {
              kind: "modify",
              target: "attack_bonus",
              operation: "add",
              value: 4,
              condition: {
                kind: "compound",
                tokens: ["target:state|surprised|equals|true"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Backstab");
  });

  it("makes ids idempotent", () => {
    const primitives = [
      {
        primitiveId: 42,
        primitive: {
          id: 42,
          name: "Test",
          hardModifiers: [
            {
              kind: "modify",
              condition: { kind: "narrative" },
            },
          ],
        },
      },
    ];
    const first = scanPrimitivesForConditions(primitives);
    const second = scanPrimitivesForConditions(primitives);
    expect(first[0]?.id).toBe(second[0]?.id);
  });

  it("creates sheet conditions for self:is_tracking (manually-toggled flag)", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 14103,
        primitive: {
          id: 14103,
          name: "Hunter Bonus",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 3,
              condition: {
                kind: "compound",
                tokens: ["self:is_tracking"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Hunter Bonus");
  });

  it("creates sheet conditions for compound with OR'd manual trigger", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 15519,
        primitive: {
          id: 15519,
          name: "Reason AND Compound",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 3,
              condition: {
                kind: "compound",
                tokens: ["self:is_tracking", "OR", "self:not_proficient"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("creates sheet conditions for compound with AND'd manual trigger", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 15520,
        primitive: {
          id: 15520,
          name: "Knowledge Mixed",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 2,
              condition: {
                kind: "compound",
                tokens: ["self:not_proficient_in(all_practices)", "AND", "self:actor-prone"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("does NOT create sheet conditions for known status flags", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 1,
        primitive: {
          id: 1,
          name: "Test",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 2,
              condition: {
                kind: "compound",
                tokens: ["self:is_prone"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it("does NOT create sheet conditions for stat-based conditions", () => {
    const result = scanPrimitivesForConditions([
      {
        primitiveId: 14102,
        primitive: {
          id: 14102,
          name: "Iron Will",
          hardModifiers: [
            {
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: 5,
              condition: {
                kind: "compound",
                tokens: ["self:stat|vitality_pct|<|0.5"],
              },
            },
          ],
        },
      },
    ]);
    expect(result).toHaveLength(0);
  });

describe("use-sheet-conditions dedup guard timing", () => {
  it("dedupRan is set ONLY AFTER successful dedup", () => {
    // Simulating the hook's effect logic:
    // 1. First render: conditions=[] → dedupRan stays false
    // 2. Refresh: conditions=[many] → dedup runs → dedupRan=true
    let dedupRan = false;
    const seen: Array<{ conditions: number; dedupRan: boolean; deduped: number }> = [];

    const render = (conditions: ReadonlyArray<unknown>) => {
      if (dedupRan) return;
      const sheetConds = conditions.filter((c) => {
        const cc = c as { source?: string };
        return cc.source === "sheet";
      });
      if (sheetConds.length === 0) return;
      // Simulate dedup with 99% removal rate
      const removed = sheetConds.length - 1;
      seen.push({ conditions: conditions.length, dedupRan, deduped: removed });
      if (removed > 0) dedupRan = true;
    };

    render([]);
    render(Array.from({ length: 7094 }, (_, i) => ({ source: "sheet", id: `uuid-${i}` })));
    render(Array.from({ length: 3 }, (_, i) => ({ source: "sheet", id: `kept-${i}` })));
    render(Array.from({ length: 3 }, (_, i) => ({ source: "sheet", id: `kept-${i}` })));

    expect(seen.length).toBe(1);
    expect(seen[0]?.conditions).toBe(7094);
    expect(seen[0]?.deduped).toBe(7093);
    expect(dedupRan).toBe(true);
  });

  it("does NOT mark dedupRan if there's nothing to dedup", () => {
    let dedupRan = false;
    const render = (conditions: ReadonlyArray<unknown>) => {
      if (dedupRan) return;
      const sheetConds = conditions.filter((c) => {
        const cc = c as { source?: string };
        return cc.source === "sheet";
      });
      if (sheetConds.length === 0) return;
      const removed = sheetConds.length - 1; // simulate
      if (removed > 0) dedupRan = true;
    };

    render([]); // empty
    render([{ source: "custom" }, { source: "custom" }]); // no sheet
    expect(dedupRan).toBe(false);
  });
});
});