/**
 * Volatility validator tests (Phase 4.5).
 *
 * BU Market canon, Tier-Matched Volatility Ceiling:
 *   Levels 1-4  → max -8 BU
 *   Levels 5-10 → max -12 BU
 *   Levels 11-15 → max -16 BU
 *   Levels 16+  → max -24 BU
 *
 * These tests verify the validateMirrorSet() function — which is the API-layer
 * gate that rejects requests exceeding the ceiling — using a stub for the DB
 * so we can exercise the pure logic without hitting Postgres.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB client so we don't hit Postgres
vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

// Mock the schema imports (the validator only needs the table refs for inArray)
vi.mock("@/db/schema", () => ({
  primitives: { id: "primitives.id", name: "primitives.name", category: "primitives.category", buCost: "primitives.buCost", isMirrorable: "primitives.isMirrorable", mirrorBuCredit: "primitives.mirrorBuCredit" },
  characterPrimitives: { primitiveId: "character_primitives.primitiveId", characterId: "character_primitives.characterId", isMirrored: "character_primitives.isMirrored" },
}));

import { validateMirrorSet } from "../volatility";
import { db } from "@/db/client";

const mockSelect = db.select as unknown as ReturnType<typeof vi.fn>;

function mockPrimitives(rows: Array<{
  id: number;
  name: string;
  isMirrorable: boolean;
  mirrorBuCredit: number;
}>) {
  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  }));
}

describe("validateMirrorSet — BU Market volatility ceiling", () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it("allows mirror set at exactly the ceiling (L1, -4 BU)", async () => {
    mockPrimitives([
      { id: 1, name: "Vital Penalty", isMirrorable: true, mirrorBuCredit: 4 },
    ]);
    const result = await validateMirrorSet(1, [1], [1]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rating).toBe(4);
      expect(result.ceiling).toBe(4);
      expect(result.bracket).toBe("L1-L4");
    }
  });

  it("rejects mirror set that exceeds ceiling (L1, attempting -8 BU)", async () => {
    mockPrimitives([
      { id: 1, name: "Penalty A", isMirrorable: true, mirrorBuCredit: 4 },
      { id: 2, name: "Penalty B", isMirrorable: true, mirrorBuCredit: 4 },
    ]);
    const result = await validateMirrorSet(1, [1, 2], [1, 2]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.ceiling).toBe(4);
      expect(result.rating).toBe(8);
      expect(result.status).toBe(422);
      expect(result.offendingPrimitiveId).toBe(2);
      expect(result.offendingPrimitiveName).toBe("Penalty B");
      expect(result.error).toMatch(/exceeding level 1 ceiling of 4 BU/);
    }
  });

  it("allows larger mirror sets at higher levels (L5 ceiling is -8 BU)", async () => {
    mockPrimitives([
      { id: 1, name: "Penalty A", isMirrorable: true, mirrorBuCredit: 4 },
      { id: 2, name: "Penalty B", isMirrorable: true, mirrorBuCredit: 4 },
    ]);
    const result = await validateMirrorSet(5, [1, 2], [1, 2]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rating).toBe(8);
      expect(result.ceiling).toBe(8);
      expect(result.bracket).toBe("L5-L8");
    }
  });

  it("rejects non-mirrorable primitive flagged as mirror", async () => {
    mockPrimitives([
      { id: 1, name: "Cantrip License", isMirrorable: false, mirrorBuCredit: 0 },
    ]);
    const result = await validateMirrorSet(1, [1], [1]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not flagged as mirrorable/);
      expect(result.offendingPrimitiveId).toBe(1);
    }
  });

  it("rejects when primitive id is missing from catalog", async () => {
    mockPrimitives([]); // nothing in DB
    const result = await validateMirrorSet(1, [999], [999]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not found in catalog/);
      expect(result.offendingPrimitiveId).toBe(999);
    }
  });

  it("L11 ceiling is -12 BU (Tier IV access)", async () => {
    mockPrimitives([
      { id: 1, name: "Penalty A", isMirrorable: true, mirrorBuCredit: 6 },
      { id: 2, name: "Penalty B", isMirrorable: true, mirrorBuCredit: 6 },
    ]);
    const result = await validateMirrorSet(11, [1, 2], [1, 2]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rating).toBe(12);
      expect(result.ceiling).toBe(12);
      expect(result.bracket).toBe("L9-L12");
    }
  });

  it("L17 ceiling is -20 BU (Apex bracket)", async () => {
    mockPrimitives([
      { id: 1, name: "Penalty A", isMirrorable: true, mirrorBuCredit: 5 },
      { id: 2, name: "Penalty B", isMirrorable: true, mirrorBuCredit: 5 },
      { id: 3, name: "Penalty C", isMirrorable: true, mirrorBuCredit: 5 },
      { id: 4, name: "Penalty D", isMirrorable: true, mirrorBuCredit: 5 },
    ]);
    const result = await validateMirrorSet(17, [1, 2, 3, 4], [1, 2, 3, 4]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rating).toBe(20);
      expect(result.ceiling).toBe(20);
      expect(result.bracket).toBe("L17-L20");
    }
  });

  it("empty mirror set is trivially allowed", async () => {
    const result = await validateMirrorSet(1, [], []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rating).toBe(0);
    }
  });
});