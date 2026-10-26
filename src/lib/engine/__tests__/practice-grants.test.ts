import { describe, expect, it } from "vitest";
import {
  resolveModifiers,
  type ResolvedPrimitiveSlot,
} from "../resolve-modifiers";
import { grantedKeyword, resolvePracticeGrants } from "../practice-grants";
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
  const training = (slots: ResolvedPrimitiveSlot[], attribute: "mental" | null = "mental", key = target) => {
    const r = resolve(slots, attribute);
    return resolvePracticeGrants(key, r.byTarget[key] ?? [], 4, attribute).training;
  };
  it("exports scoped active training, with expertise requiring proficiency", () => {
    expect(training([grant(1, "expertise")])).toBe(2);
    expect(training([grant(1, "expertise")], null)).toBe(0);
    expect(training([grant(1, "proficiency")], null)).toBe(1);
    expect(training([grant(1, "expertise")], null, "skill_practice_check.reason")).toBe(0);
    expect(training([{...grant(1, "expertise"), isToggledOff: true}])).toBe(1);
    expect(training([{...grant(1, "proficiency"), isToggledOff: true}], null)).toBe(0);
    expect(training([{...grant(1, "expertise"), isMirrored: true, isMirrorable: true, mirrorVector: "VARIABLE_VECTOR"}])).toBe(1);
  });
  it("recognizes active legacy additive PB expertise without changing its arithmetic", () => {
    const piece = {...grant(1, "proficiency"), name: "Expertise Awareness",
      hardModifiers: [{...grant(1, "proficiency").hardModifiers[0]!, operation: "add",
        value: {kind: "derived", which: "pb"}} as HardModifier]};
    expect(training([piece])).toBe(2);
    expect(resolve([piece]).totals[target]).toBe(4);
    expect(training([piece], null)).toBe(0);
    expect(training([{...piece,isToggledOff:true}])).toBe(1);
    expect(training([{...piece,isMirrored:true,isMirrorable:true,mirrorVector:"VARIABLE_VECTOR"}])).toBe(1);
    const plain = {...piece,hardModifiers:[{...piece.hardModifiers[0]!,value:4} as HardModifier]};
    expect(training([plain],null)).toBe(0);
  });
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
  it("keeps equation bonuses in the exported sheet and its provenance", () => {
    const sheet=aggregateCharacterSheet({level:9,attrPhysical:3,attrMental:4,attrMagical:3,
      attrProficient:"MENTAL",practiceSlices:{},startingBu:25,buSpent:0,dmBonusBu:0,
      currentVitality:12,size:"MEDIUM",capabilityLinks:[],itemLinks:[],primitiveLinks:[{
        primitiveId:9,source:"UPBRINGING",acquiredAtLevel:1,isMirrored:false,primitive:{
          id:9,name:"Equation bonus",category:"SHEET_AUGMENT",buCost:1,isMirrorable:false,mirrorBuCredit:0,
          hardModifiers:[{kind:"modify",target:"skill_practice_check",operation:"add",
            value:{kind:"equation",operands:[{kind:"derived",which:"pb"},{kind:"number",value:2}]},
            metadata:{targetScope:{layer:"PRACTICE",values:["AWARENESS"]}}}],
        }}]});
    expect(sheet.practices.find(p=>p.practice==="awareness")).toMatchObject({total:14,training:1,
      primitiveContributions:[{primitiveId:9,bonus:6}]});
    expect(sheet.practices.find(p=>p.practice==="reason")).toMatchObject({total:8,training:1});
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
    expect(sheet.practices.find((p) => p.practice === "awareness")).toMatchObject({total:12,training:2});
  });
});
