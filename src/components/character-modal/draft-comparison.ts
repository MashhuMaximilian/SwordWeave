import {
  CHARACTER_TABS,
  type PendingSlotsByTab,
} from "./character-modal-store";

/** Compare saved character composition while ignoring transient UI slot IDs. */
export function pendingSlotsDiffer(
  current: PendingSlotsByTab,
  baseline: PendingSlotsByTab,
): boolean {
  for (const tab of CHARACTER_TABS) {
    const currentSlots = current[tab] ?? [];
    const baselineSlots = baseline[tab] ?? [];
    if (currentSlots.length !== baselineSlots.length) return true;

    for (let index = 0; index < currentSlots.length; index += 1) {
      const currentSlot = { ...currentSlots[index] } as Record<string, unknown>;
      const baselineSlot = { ...baselineSlots[index] } as Record<string, unknown>;
      delete currentSlot["slotId"];
      delete baselineSlot["slotId"];
      if (JSON.stringify(currentSlot) !== JSON.stringify(baselineSlot)) {
        return true;
      }
    }
  }
  return false;
}
