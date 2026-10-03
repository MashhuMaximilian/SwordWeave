import { describe, expect, it } from "vitest";
import { collectMechanicalSummary } from "../mechanical-summary";

const primitive = { id: 1, name: "Metal", mechanicalOutputText: "Grant [metal] domain access." };
const primitiveLinks = [{ primitive, quantity: 2 }];

describe("composite preview mechanical summary", () => {
  it("shows a shared purchased primitive once across direct, capability and effect paths", () => {
    const row = { name: "Heritage", primitiveLinks, capabilityLinks: [{ capability: {
      name: "Pulse", primitiveLinks, effectLinks: [{ effect: { name: "Echo", primitiveLinks } }],
    } }] };
    const rules = collectMechanicalSummary(row);
    expect(rules).toHaveLength(1);
    expect(rules.map(rule => rule.path)).toEqual(["Heritage › Metal"]);
    expect(rules.every(rule => rule.mechanical && rule.quantity === 2)).toBe(true);
  });
  it("retains distinct primitive identities even when their descriptions match", () => {
    const rules = collectMechanicalSummary({ primitiveLinks: [
      { primitive: { ...primitive, id: 1 } },
      { primitive: { ...primitive, id: 2 } },
    ] });
    expect(rules).toHaveLength(2);
  });
  it("uses link identity when preview primitive objects omit their id", () => {
    const withoutId = { name: primitive.name, mechanicalOutputText: primitive.mechanicalOutputText };
    const rules = collectMechanicalSummary({ primitiveLinks: [{ primitiveId: 4, primitive: withoutId }],
      capabilityLinks: [{ capability: { primitiveLinks: [{ primitiveId: 4, primitive: { ...withoutId } }] } }] });
    expect(rules).toHaveLength(1);
  });
  it("keeps the normal and mirrored version of one primitive as separate rules", () => {
    const rules = collectMechanicalSummary({ primitiveLinks: [
      { primitive }, { primitive, isMirrored: true },
      { primitive: { ...primitive }, isMirrored: true },
    ] });
    expect(rules.map(rule => rule.mirrored)).toEqual([false, true]);
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
  it("treats descriptive primitives as narrative even when legacy output copy is populated", () => {
    const rules = collectMechanicalSummary({ primitiveLinks: [{ primitive: { id: 55, mechanicalRule: { family: "DESCRIPTIVE" }, mechanicalOutputText: "Seek an impression from an old object.", narrativeRule: "Seek an impression from an old object." } }] });
    expect(rules[0]).toMatchObject({ mechanical: false, text: "Seek an impression from an old object." });
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
