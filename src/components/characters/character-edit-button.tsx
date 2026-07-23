"use client";

/**
 * CharacterEditButton — Phase 8.2 batch 7
 *
 * The "Edit" button that appears next to each character on /characters
 * (the list page). Server-rendered cards can't call hooks, so we
 * isolate the button into this tiny client component which calls
 * the modal store's openForEdit() with the character's id.
 *
 * Once the modal is open, the user is taken through the standard
 * edit flow: fetch → seed the modal → edit fields + slot changes →
 * save via PATCH /api/characters/[id]. See character-modal-store
 * for the full lifecycle.
 */

import { Pencil } from "lucide-react";
import { useCharacterModal } from "@/components/character-modal/character-modal-store";

export interface CharacterEditButtonProps {
  characterId: string;
  className?: string;
}

export function CharacterEditButton({
  characterId,
  className,
}: CharacterEditButtonProps) {
  const { openForEdit } = useCharacterModal();
  return (
    <button
      type="button"
      onClick={() => void openForEdit(characterId)}
      className={
        className ??
        "flex items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
      }
      title="Open the character builder modal pre-filled with this character"
    >
      <Pencil className="size-3.5" />
      Edit
    </button>
  );
}