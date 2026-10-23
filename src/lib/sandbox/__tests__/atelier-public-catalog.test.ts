import { describe, expect, it } from "vitest";
import { canLoadAtelierHistory, isGuestAtelierPath, restrictAtelierRelations } from "../atelier-public-catalog";

describe("anonymous Atelier boundary", () => {
  it("opens only the Atelier page, leaving adjacent protected and API paths outside the exception", () => {
    expect(isGuestAtelierPath("/atelier")).toBe(true);
    expect(isGuestAtelierPath("/atelier/")).toBe(true);
    for (const path of ["/atelier/admin", "/atelier-private", "/api/atelier", "/api/primitives", "/characters/new", "/sandbox"]) expect(isGuestAtelierPath(path)).toBe(false);
  });
  it("removes invisible children at every relationship depth without changing rules or dates", () => {
    const date = new Date("2026-10-23T00:00:00Z");
    const privatePrimitive = { primitiveId: 2, primitive: { id: 2, name: "PRIVATE SECRET" } };
    const publicPrimitive = { primitiveId: 1, primitive: { id: 1, name: "Public rule" } };
    const capability = { id: "cap", createdAt: date, mechanicalRule: { deeply: { nested: [1, { primitiveId: 999 }] } }, effectLinks: [
      { effectId: "effect", effect: { id: "effect", primitiveLinks: [publicPrimitive, privatePrimitive] } },
      { effectId: "secret", effect: { id: "secret", name: "PRIVATE EFFECT", primitiveLinks: [privatePrimitive] } },
    ] };
    const input = { primitives: [{ id: 1 }], effects: [{ id: "effect", primitiveLinks: [publicPrimitive, privatePrimitive] }], capabilities: [capability], heritage: [{ id: "heritage", capabilityLinks: [{ capabilityId: "cap", capability }, { capabilityId: "private-cap", capability: { id: "private-cap", name: "PRIVATE CAP" } }] }], items: [] };
    const safe = restrictAtelierRelations(input);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain("PRIVATE");
    expect(serialized).toContain("Public rule");
    expect(safe.capabilities[0]).toMatchObject({ createdAt: date, mechanicalRule: capability.mechanicalRule });
    expect(JSON.stringify(input)).toContain("PRIVATE SECRET");
  });
  it("never merges historical payloads for guests or invisible deep-linked rows", () => {
    expect(canLoadAtelierHistory(null, true)).toBe(false);
    expect(canLoadAtelierHistory("owner", false)).toBe(false);
    expect(canLoadAtelierHistory("owner", true)).toBe(true);
  });
});
