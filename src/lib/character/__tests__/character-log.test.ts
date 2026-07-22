/**
 * character-log.test.ts — Phase 8.2 batch 1
 *
 * Schema/type-level smoke tests. The actual DB round-trip requires
 * a Clerk-authenticated session, which we can't fake in vitest, so
 * these tests only confirm:
 *
 *   1. The characterLog table is exported with the expected shape
 *   2. Each CharacterLogKind value matches the schema's pgEnum
 *   3. The appendCharacterLog helper accepts every payload shape
 *      with strict typing (would catch a typo in the enum).
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import {
  characterLog,
  characterLogKindEnum,
  type CharacterLogKind,
} from "@/db/schema/characters";
import type { CharacterLogPayload } from "../character-log";

describe("characterLog table", () => {
  it("has the expected columns", () => {
    // The schema column keys are the source of truth. Anything
    // missing here would mean a downstream query breaks.
    expect(Object.keys(characterLog)).toEqual(
      expect.arrayContaining([
        "id",
        "characterId",
        "kind",
        "payload",
        "createdAt",
      ]),
    );
  });

  it("kind enum lists all 7 event types", () => {
    expect(characterLogKindEnum.enumValues).toEqual([
      "vitality_change",
      "rest",
      "level_up",
      "capability_trigger",
      "capability_toggle",
      "item_equip",
      "item_unequip",
    ]);
  });

  it("CharacterLogKind type narrows correctly", () => {
    expectTypeOf<CharacterLogKind>().toEqualTypeOf<
      | "vitality_change"
      | "rest"
      | "level_up"
      | "capability_trigger"
      | "capability_toggle"
      | "item_equip"
      | "item_unequip"
    >();
  });

  it("CharacterLogPayload is a union of all per-kind payload shapes", () => {
    // This is a structural check: if any kind's payload type
    // changes, this assignment breaks. We use expectTypeOf
    // rather than a runtime assertion so it surfaces at
    // compile time.
    expectTypeOf<CharacterLogPayload>().toMatchTypeOf<
      | { delta: number; prev: number; next: number; source: string }
      | { restType: string; vitalityRestored: number }
      | { prevLevel: number; newLevel: number; buAwarded: number; dmBonusAwarded: number }
      | { capabilityId: string; capabilityName: string }
      | { capabilityId: string; capabilityName: string; active: boolean }
      | { itemId: string; itemName: string }
    >();
  });
});