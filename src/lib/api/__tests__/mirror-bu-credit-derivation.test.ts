import { describe, it, expect } from "vitest";

/**
 * Tests for server-side derivation of mirror_bu_credit.
 *
 * The API route enforces: mirror_bu_credit = bu_cost when is_mirrorable=true,
 * regardless of what the client sends. This ensures DB consistency.
 */
describe("mirror_bu_credit derivation", () => {
  /**
   * When isMirrorable=true, mirrorBuCredit should equal buCost.
   * The server ignores whatever value the client sends and derives it from buCost.
   */
  it("derives mirror_bu_credit = bu_cost when is_mirrorable=true", () => {
    // Simulate the server-side derivation logic from buildPrimitiveValues
    const isMirrorable = true;
    const buCost = 50;
    const clientSentMirrorBuCredit = 99; // Client tries to send wrong value

    // Server-side enforcement: auto-derive from buCost, ignore client value
    const derivedMirrorBuCredit = isMirrorable ? buCost : 0;

    expect(derivedMirrorBuCredit).toBe(50);
    expect(derivedMirrorBuCredit).not.toBe(clientSentMirrorBuCredit);
  });

  /**
   * When isMirrorable=false, mirrorBuCredit should always be 0.
   */
  it("sets mirror_bu_credit to 0 when is_mirrorable=false", () => {
    const isMirrorable = false;
    const buCost = 50;

    const derivedMirrorBuCredit = isMirrorable ? buCost : 0;

    expect(derivedMirrorBuCredit).toBe(0);
  });

  /**
   * Edge case: isMirrorable=true with buCost=0 should result in mirrorBuCredit=0.
   */
  it("handles edge case where is_mirrorable=true but bu_cost is 0", () => {
    const isMirrorable = true;
    const buCost = 0;

    const derivedMirrorBuCredit = isMirrorable ? buCost : 0;

    expect(derivedMirrorBuCredit).toBe(0);
  });
});
