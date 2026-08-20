// Test for use-sheet-conditions hook
import { describe, it, expect } from "vitest";

// Mirror the relevant scan logic for testing without React
function isConditionEffective(condition: unknown): boolean {
  if (!condition) return false;
  if (typeof condition !== "object" || condition === null) return false;
  const c = condition as { kind?: string; tokens?: readonly string[] };
  if (c.kind === "narrative") return true;
  if (Array.isArray(c.tokens)) {
    return c.tokens.some(
      (tok) => tok.startsWith("target:") || tok.startsWith("scene:"),
    );
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
});
