import { describe, expect, it, vi } from "vitest";
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("../materialize", () => ({ materializeWorkspace: vi.fn() }));
vi.mock("../read", () => ({ readWorkspace: vi.fn() }));
vi.mock("@/lib/engine/recompute-bu-spent", () => ({ recomputeBuSpent: vi.fn() }));
import { buildFoundationRestore } from "../restore-snapshot";
describe("undo keeps current play state", () => {
  it("restores the character concept and scores without rewinding Vitality or play mode", () => {
    expect(buildFoundationRestore({ name: "Before", attrPhysical: 5, attrMental: 3, attrMagical: 2, currentVitality: 99, mode: "BUILD", currentResource: 20, conditions: [] }))
      .toEqual({ name: "Before", attrPhysical: 5, attrMental: 3, attrMagical: 2 });
  });
  it("restores the portrait and framing together without restoring runtime state", () => {
    const before = { portraitUrl: "/api/icons/blob/before.png", portraitFrame: { x: 12, y: 80, zoom: 0.5 } };
    expect(buildFoundationRestore({ ...before, currentVitality: 99 })).toEqual(before);
  });
  it("never restores ownership, sharing grants or equipment from an old receipt", () => {
    expect(buildFoundationRestore({ userId: "previous-owner", isPublic: true, equipped: true, canEdit: true, level: 10, notes: "Concept" }))
      .toEqual({ level: 10, notes: "Concept" });
  });
});
