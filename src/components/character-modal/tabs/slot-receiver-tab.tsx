"use client";

// =============================================================================
// SlotReceiverTab — generic slot receiver for tabs 4-7
// (Lineage / Upbringing / Manifest / Items).
//
// Per Mashu 2026-07-21: each tab is a SLOT RECEIVER — it doesn't host
// a library picker. Instead, the user slots things from /atelier via
// the context-aware "Slot into [step]" button on library previews.
// batch 8 will wire those buttons; batch 9 will render slotted
// heritages/items as cards with their bundled contents.
//
// For batch 7, this tab shows:
//   1. An empty-state CTA explaining how to slot from /atelier.
//   2. A list of pendingSlots for this tab from the modal store.
//   3. A remove button on each pending slot.
//
// What does NOT live here in 8.1 batch 7:
//   - Capability auto-expand to primitives (batch 10).
//   - Heritage "slot brings primitives + capabilities + effects"
//     expansion (batch 9).
//   - Server-side save (handled in the modal footer Create button).
// =============================================================================

import { useCharacterModal, type CharacterTabId } from "../character-modal-store";
import type { PendingSlot } from "../character-modal-store";

interface SlotReceiverTabProps {
  tabId: CharacterTabId;
  title: string;
  help: string;
  /**
   * Short instruction shown in the empty state. Tells the user to
   * close the modal and slot from /atelier.
   */
  ctaPrimary: string;
  ctaSecondary: string;
}

export function SlotReceiverTab({
  tabId,
  title,
  help,
  ctaPrimary,
  ctaSecondary,
}: SlotReceiverTabProps) {
  const { pendingSlots, removeSlot } = useCharacterModal();
  const slots = pendingSlots[tabId];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center">
          <p className="text-sm font-medium text-foreground">{ctaPrimary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ctaSecondary}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border">
          {slots.map((slot, idx) => (
            <SlotRow
              key={`${slot.kind}-${idx}`}
              slot={slot}
              onRemove={() => removeSlot(tabId, idx)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SlotRow({
  slot,
  onRemove,
}: {
  slot: PendingSlot;
  onRemove: () => void;
}) {
  const label = slotLabel(slot);
  const kindLabel = slotKindLabel(slot);
  return (
    <li className="flex items-center justify-between gap-2 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{kindLabel}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
      >
        Remove
      </button>
    </li>
  );
}

function slotLabel(slot: PendingSlot): string {
  if (slot.kind === "heritage") return slot.name;
  if (slot.kind === "primitive") return slot.name;
  if (slot.kind === "capability") return slot.name;
  if (slot.kind === "effect") return slot.name;
  return slot.name;
}

function slotKindLabel(slot: PendingSlot): string {
  switch (slot.kind) {
    case "heritage":
      return `Heritage · ${slot.heritageKind}`;
    case "primitive":
      return "Primitive";
    case "capability":
      return "Capability";
    case "effect":
      return "Effect";
    case "item":
      return "Item";
  }
}