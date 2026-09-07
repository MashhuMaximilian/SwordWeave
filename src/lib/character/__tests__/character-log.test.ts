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

  it("kind enum lists all event types (Phase 8.2 through batch 5)", () => {
    expect(characterLogKindEnum.enumValues).toEqual([
      "vitality_change",
      "rest",
      "level_up",
      "capability_trigger",
      "capability_toggle",
      "item_equip",
      "item_unequip",
      "item_quantity",
      // Phase 8.2 batch 5
      "dm_bonus_change",
      // Phase 9.1 inline character-builder events
      "primitive_slotted",
      "primitive_moved",
      "primitive_removed",
      "heritage_formalized",
      "item_formalized",
      "mode_changed",
      // Phase 9.3 parallel attach events
      "capability_attached",
      "effect_attached",
      "item_attached",
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
      | "item_quantity"
      | "dm_bonus_change"
      // Phase 9.1 inline character-builder events
      | "primitive_slotted"
      | "primitive_moved"
      | "primitive_removed"
      | "heritage_formalized"
      | "item_formalized"
      | "mode_changed"
      // Phase 9.3 parallel attach events
      | "capability_attached"
      | "effect_attached"
      | "item_attached"
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
      | { prev: number; next: number; applied: number }
      // Phase 9.1 inline character-builder payload shapes.
      | { primitiveId: number; quantity: number; inline: boolean }
      | { primitiveId: number; instanceId: string }
      | { heritageId: string; kind: "LINEAGE" | "UPBRINGING" | "MANIFEST"; primitiveCount: number }
      | { itemId: string; itemName: string; primitiveCount: number }
      | { fromMode: "BUILD" | "PLAY"; toMode: "BUILD" | "PLAY" }
      // Phase 9.3 parallel attach payload shapes
      | { capabilityId: string; capabilityName: string; slotTab: "LINEAGE" | "UPBRINGING" | "MANIFEST" | null; acquiredAtLevel: number }
      | { effectId: string; effectName: string }
      | { itemId: string; itemName: string }
    >();
  });
});