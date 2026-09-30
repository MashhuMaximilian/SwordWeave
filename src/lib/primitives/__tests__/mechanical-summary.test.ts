import { describe, expect, it } from "vitest";
import { collectMechanicalSummary } from "../mechanical-summary";

const primitive = { name: "Metal", mechanicalOutputText: "Grant [metal] domain access." };
const primitiveLinks = [{ primitive, quantity: 2 }];

describe("composite preview mechanical summary", () => {
  it("includes direct and transitive grants and retains shared rules across distinct branches", () => {
    const row = { name: "Heritage", primitiveLinks, capabilityLinks: [{ capability: {
      name: "Pulse", primitiveLinks, effectLinks: [{ effect: { name: "Echo", primitiveLinks } }],
    } }] };
    const rules = collectMechanicalSummary(row);
    expect(rules).toHaveLength(3);
    expect(rules.map(rule => rule.path)).toEqual(["Heritage › Metal", "Heritage › Pulse › Metal", "Heritage › Pulse › Echo › Metal"]);
    expect(rules.every(rule => rule.mechanical && rule.quantity === 2)).toBe(true);
  });
  it("reads legacy effect relations with primitives on the link", () => {
    expect(collectMechanicalSummary({ effectLinks: [{ effect: { name: "Echo" }, primitiveLinks }] })[0]?.text).toBe(primitive.mechanicalOutputText);
  });
  it("uses a short narrative fallback with its own semantic role", () => {
    const rules = collectMechanicalSummary({ primitiveLinks: [{ primitive: { narrativeRule: Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ") } }] });
    expect(rules[0]?.mechanical).toBe(false);
    expect(rules[0]?.text.split(" ")).toHaveLength(30);
    expect(rules[0]?.text.endsWith("…")).toBe(true);
  });
  it("stops cyclic composition and tolerates missing relations", () => {
    const row: { primitiveLinks: typeof primitiveLinks; capabilityLinks: unknown[] } = { primitiveLinks, capabilityLinks: [] };
    row.capabilityLinks.push({ capability: row }, null, { capability: null });
    expect(collectMechanicalSummary(row)).toHaveLength(1);
    expect(collectMechanicalSummary(null)).toEqual([]);
  });
  it("flips variable operations but respects explicit mirror opt-out", () => {
    const modifier = { kind: "modify", operation: "add", target: "max_vitality", value: 5 };
    const rules = collectMechanicalSummary({ primitiveLinks: [
      { isMirrored: true, primitive: { hardModifiers: [modifier] } },
      { isMirrored: true, primitive: { hardModifiers: [{ ...modifier, metadata: { mirror: { optedOut: true } } }] } },
    ] });
    expect(rules[0]?.text).toContain("Subtract");
    expect(rules[1]?.text).toContain("Add");
  });
  it("marks mirrored paths and multiplies nested slot quantities", () => {
    const rules = collectMechanicalSummary({ effectLinks: [{ quantity: 3, isMirrored: true, effect: { primitiveLinks } }] });
    expect(rules[0]).toMatchObject({ mirrored: true, quantity: 6 });
  });
});
