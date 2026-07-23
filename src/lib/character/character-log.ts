/**
 * character-log.ts — Phase 8.2 batch 1
 *
 * Append-only runtime event log for characters. The sheet's history
 * panel reads from this so players can reconstruct what happened
 * between sessions ("I took 30 damage last session... did I heal
 * any of it back?").
 *
 * Convention: app code only ever INSERTS. Updates and deletes are
 * not part of the API. Cascade on character delete cleans the log
 * automatically.
 *
 * Event payload shapes (JSONB):
 *   vitality_change  : { delta: number, prev: number, next: number, source: "manual"|"long_rest"|"short_rest" }
 *   rest             : { restType: "long"|"short", vitalityRestored: number }
 *   level_up         : { prevLevel: number, newLevel: number, buAwarded: number, dmBonusAwarded: number }
 *   capability_trigger: { capabilityId: string, capabilityName: string }
 *   capability_toggle : { capabilityId: string, capabilityName: string, active: boolean }
 *   item_equip       : { itemId: string, itemName: string }
 *   item_unequip     : { itemId: string, itemName: string }
 *
 * Call sites (added in subsequent batches):
 *   - 8.2.2 vitality tracker / rest buttons
 *   - 8.2.4 capability trigger / toggle / item equip
 *   - 8.2.5 history panel reader
 */

import { db } from "@/db/client";
import { characterLog, type CharacterLogKind } from "@/db/schema/characters";

export interface VitalityChangePayload {
  delta: number;
  prev: number;
  next: number;
  source: "manual" | "long_rest" | "short_rest";
}

export interface RestPayload {
  restType: "long" | "short";
  vitalityRestored: number;
}

export interface LevelUpPayload {
  prevLevel: number;
  newLevel: number;
  buAwarded: number;
  dmBonusAwarded: number;
}

export interface CapabilityTogglePayload {
  capabilityId: string;
  capabilityName: string;
  active: boolean;
}

export interface CapabilityTriggerPayload {
  capabilityId: string;
  capabilityName: string;
}

export interface ItemEquipPayload {
  itemId: string;
  itemName: string;
  /**
   * Optional human-readable note (e.g. "no-op (already in target state)"
   * when the equip toggle was idempotent). Visible in the History tab.
   */
  note?: string;
}

export interface ItemUnequipPayload {
  itemId: string;
  itemName: string;
  /**
   * Optional human-readable note (e.g. "no-op (already in target state)"
   * when the unequip toggle was idempotent). Visible in the History tab.
   */
  note?: string;
}

export type CharacterLogPayload =
  | VitalityChangePayload
  | RestPayload
  | LevelUpPayload
  | CapabilityTogglePayload
  | CapabilityTriggerPayload
  | ItemEquipPayload
  | ItemUnequipPayload;

/**
 * Append an event to the character's log. Fire-and-forget — errors
 * are swallowed and logged so a logging failure never blocks the
 * primary action (e.g. a vitality change still applies even if the
 * log insert fails). The primary action returns its own error
 * separately.
 */
export async function appendCharacterLog(
  characterId: string,
  kind: CharacterLogKind,
  payload: CharacterLogPayload,
): Promise<void> {
  try {
    await db.insert(characterLog).values({
      characterId,
      kind,
      payload,
    });
  } catch (err) {
    // Don't let logging failures break the user's primary action.
    // Surface to the server console so devs can see it during
    // development but don't propagate to the caller.
    console.error(
      `[character-log] failed to append ${kind} for ${characterId}:`,
      err,
    );
  }
}