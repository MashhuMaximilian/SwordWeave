import { describe, expect, it } from "vitest";
import type { PendingSlotsByTab } from "../character-modal-store";
import type { PendingSlot } from "../character-modal-store";
import { pendingSlotsDiffer } from "../draft-comparison";

function emptySlots(): PendingSlotsByTab {
  return {
    identity: [],
    backstory: [],
    attributes: [],
    lineage: [],
    upbringing: [],
    manifest: [],
    items: [],
  };
}

describe("pendingSlotsDiffer", () => {
  it("marks a capability added after edit-mode seeding as a change", () => {
    const baseline = emptySlots();
    const current = emptySlots();
    current.manifest = [
      {
        kind: "capability",
        capabilityId: "cap-new",
        tab: "manifest",
        name: "New capability",
        slotId: "transient-slot",
      },
    ];

    expect(pendingSlotsDiffer(current, baseline)).toBe(true);
  });

  it("ignores regenerated transient slot IDs", () => {
    const baseline = emptySlots();
    const current = emptySlots();
    const savedSlot: PendingSlot = {
      kind: "capability",
      capabilityId: "cap-existing",
      tab: "manifest",
      name: "Existing capability",
      slotId: "seed-slot",
    };
    baseline.manifest = [savedSlot];
    current.manifest = [
      { ...savedSlot, slotId: "new-ui-slot" },
    ];

    expect(pendingSlotsDiffer(current, baseline)).toBe(false);
  });
});
