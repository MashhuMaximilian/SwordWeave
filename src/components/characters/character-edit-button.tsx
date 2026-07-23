"use client";

/**
 * CharacterEditButton — Phase 8.2 batch 7 rev 2
 *
 * The "Edit" button that appears next to each character on /characters
 * (the list page) and inside the character sheet header. Server-rendered
 * cards can't call hooks, so we isolate the button into this tiny client
 * component.
 *
 * On click:
 *   1. Calls openForEdit(characterId) which writes the id to localStorage
 *      (key: swordweave:character-modal:pending-edit-id).
 *   2. Navigates to /atelier.
 *
 * The atelier's client reads the localStorage entry on mount, calls
 * openForEditFromStore() to do the actual fetch + seed, and clears
 * the entry. The user lands on /atelier with the modal pre-filled
 * for editing — exactly the same flow as the Mona Lisa FAB, but
 * the FAB pops the modal on the current page while Edit navigates
 * to /atelier first because that's where slotting happens.
 *
 * Per Mashu 2026-07-23: localStorage, NOT URL params — because the
 * atelier URL is already in flux with build/fork/load params.
 */

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useCharacterModal } from "@/components/character-modal/character-modal-store";

export interface CharacterEditButtonProps {
  characterId: string;
  className?: string;
  title?: string;
}

export function CharacterEditButton({
  characterId,
  className,
  title = "Edit in the atelier's character builder modal",
}: CharacterEditButtonProps) {
  const router = useRouter();
  const { openForEdit } = useCharacterModal();
  return (
    <button
      type="button"
      onClick={() => {
        void openForEdit(characterId);
        router.push("/atelier");
      }}
      className={
        className ??
        "flex items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
      }
      title={title}
    >
      <Pencil className="size-3.5" />
      Edit
    </button>
  );
}