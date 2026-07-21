"use client";

// =============================================================================
// TabbedCharacterForm — placeholder for the 7-tab character creation
// modal (Phase 8.1 batch 6 + 7).
//
// Batch 6: this file replaces the legacy stepped-wizard-mode.tsx
// import. The old CharacterWizard (800 lines, 5-step linear flow) was
// deleted along with /sandbox/characters/page.tsx. This stub renders
// a "in progress" panel so the FAB still opens the modal cleanly
// without runtime errors.
//
// Batch 7: replaces this stub with the actual tabbed UI (identity /
// backstory / attributes / lineage / upbringing / manifest / items)
// wired to useCharacterModal's activeStep + pendingSlots.
//
// Batch 8: library "Slot into [step]" buttons on /atelier previews
// will call queueSlot() to push entries into pendingSlots.
// =============================================================================

import { useEffect } from "react";
import { useCharacterModal, CHARACTER_TABS } from "./character-modal-store";

export function TabbedCharacterForm() {
  const { setDirty, activeStep } = useCharacterModal();

  // Mark dirty while the form is mounted. The modal's "Unsaved" badge
  // and the FAB dot read this. On unmount (modal close), the flag
  // stays true until resetDraft() — matches the legacy behavior from
  // batch 3 so the dot persists mid-session.
  useEffect(() => {
    setDirty(true);
  }, [setDirty]);

  return (
    <div className="space-y-4 p-2">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Character creation — coming online
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The new 7-tab modal lands in batch 7. The legacy 5-step
          wizard has been removed. Your modal state and any in-progress
          content survive (activeStep persists across opens).
        </p>
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Tabs planned</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {CHARACTER_TABS.map((tab) => (
            <li key={tab}>
              <span className="font-medium">{tab}</span>
              {tab === activeStep ? (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  Current
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        <p className="font-medium">Migration in progress</p>
        <p className="mt-1">
          Your existing /sandbox/characters page is gone. The Character
          FAB on /atelier is now the only entry point. The new tabbed
          modal will replace this placeholder in batch 7.
        </p>
      </div>
    </div>
  );
}