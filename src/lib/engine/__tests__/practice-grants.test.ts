import { describe, expect, it } from "vitest";
import {
  resolveModifiers,
  type ResolvedPrimitiveSlot,
} from "../resolve-modifiers";
import { grantedKeyword } from "../practice-grants";
import { aggregateCharacterSheet } from "../sheet";
import type { HardModifier } from "@/types/swordweave";
const target = "skill_practice_check.awareness";
const grant = (
  id: number,
  keyword: string,
  legacy = false,
): ResolvedPrimitiveSlot => ({
  primitiveId: id,
  name: `Piece ${id}`,
  category: "SHEET_AUGMENT",
  isMirrored: false,
  isMirrorable: false,
  mirrorVector: null,
  originCapabilityId: null,
  originHeritageId: null,
  originEffectId: null,
  hardModifiers: [
    {
      kind: "modify",
      target: "skill_practice_check",
      operation: "grant",
      value: legacy
        ? { kind: "keyword", value: keyword }
        : { kind: "keyword", text: keyword },
      metadata: { targetScope: { layer: "practice", values: ["AWARENESS"] } },
    } as HardModifier,
  ],
});
const resolve = (
  slots: ResolvedPrimitiveSlot[],
  proficientAttribute: "mental" | null = "mental",
) =>
  resolveModifiers({
    characterId: "test",
    level: 9,
    pb: 4,
    attributes: { physical: 3, mental: 4, magical: 3 },
    proficientAttribute,
    slots,
  });
describe("practice proficiency grants", () => {
  it("adds one extra PB to an already proficient practice", () => {
    const result = resolve([grant(1, "expertise")]);
    expect(result.totals[target]).toBe(4);
    expect(result.byTarget[target]?.[0]?.value).toBe(4);
    expect(4 + 4 + result.totals[target]!).toBe(12);
  });
  it("requires proficiency and ignores inactive grants", () => {
    expect(resolve([grant(1, "expertise")], null).totals[target] ?? 0).toBe(0);
    expect(
      resolve([{ ...grant(1, "expertise"), isToggledOff: true }]).totals[
        target
      ] ?? 0,
    ).toBe(0);
  });
  it.each([false, true])(
    "resolves separate proficiency and expertise regardless of order (%s)",
    (reverse) => {
      const pieces = [grant(1, "proficiency"), grant(2, "expertise")];
      if (reverse) pieces.reverse();
      expect(resolve(pieces, null).totals[target]).toBe(8);
    },
  );
  it("does not add proficiency twice or stack repeated expertise grants", () => {
    expect(
      resolve([
        grant(1, "proficiency"),
        grant(2, "expertise"),
        grant(3, "expertise"),
      ]).totals[target],
    ).toBe(4);
  });
  it("adds expertise alongside an ordinary numeric practice bonus", () => {
    const numeric = {
      ...grant(2, "proficiency"),
      hardModifiers: [
        {
          kind: "modify",
          target: "skill_practice_check",
          operation: "add",
          value: 2,
          metadata: {
            targetScope: { layer: "practice", values: ["AWARENESS"] },
          },
        } as HardModifier,
      ],
    };
    expect(resolve([numeric, grant(1, "expertise")]).totals[target]).toBe(6);
  });
  it("reads current and legacy keyword labels", () => {
    expect(grantedKeyword({ kind: "keyword", text: "[expertise]" })).toBe(
      "expertise",
    );
    expect(grantedKeyword({ kind: "keyword", value: "proficiency" })).toBe(
      "proficiency",
    );
    expect(resolve([grant(1, "expertise", true)]).totals[target]).toBe(4);
  });
  it("keeps server sheet math aligned with the live resolver", () => {
    const piece = grant(1, "expertise");
    const sheet = aggregateCharacterSheet({
      level: 9,
      attrPhysical: 3,
      attrMental: 4,
      attrMagical: 3,
      attrProficient: "MENTAL",
      practiceSlices: {},
      startingBu: 25,
      buSpent: 0,
      dmBonusBu: 0,
      currentVitality: 12,
      size: "MEDIUM",
      capabilityLinks: [],
      itemLinks: [],
      primitiveLinks: [
        {
          primitiveId: 1,
          source: "UPBRINGING",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 1,
            name: piece.name,
            category: piece.category,
            buCost: 1,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: piece.hardModifiers,
          },
        },
      ],
    });
    expect(sheet.practices.find((p) => p.practice === "awareness")?.total).toBe(
      12,
    );
  });
});
