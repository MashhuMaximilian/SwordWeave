"use client";

/**
 * NewCharacterButton — Phase 8.2 batch 7 rev 3
 *
 * The "New Character" CTA on /characters (the builds page) and
 * /creations (My Creations). Server-rendered pages can't call
 * hooks, so we isolate the button into this tiny client
 * component which:
 *   1. Opens the character modal in CREATE mode (the FAB
 *      toggle behaviour: open the modal wherever you are).
 *   2. Navigates to /atelier so the user can browse primitives,
 *      capabilities, heritages, items and slot them into the
 *      modal — same flow as editing per Mashu 2026-07-23.
 *
 * The modal pops open via toggle() to match the FAB's behaviour;
 * navigating to /atelier is what the user explicitly asked for
 * ("simple, just navigate to atelier and open the character
 * creation modal empty").
 *
 * Why localStorage isn't needed here (unlike Edit): the modal
 * opens in fresh CREATE mode (no editCharacterId). The atelier
 * client doesn't need any persisted id to bootstrap.
 */

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCharacterModal } from "@/components/character-modal/character-modal-store";

export interface NewCharacterButtonProps {
  /** Visual variant — "primary" for the top of a page,
   *  "outline" for inline / grid use. */
  variant?: "primary" | "outline";
  label?: string;
}

export function NewCharacterButton({
  variant = "primary",
  label = "New Character",
}: NewCharacterButtonProps) {
  const router = useRouter();
  const characterModal = useCharacterModal();
  const base =
    variant === "primary"
      ? "flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      : "flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary";
  return (
    <button
      type="button"
      onClick={() => {
        // Open the modal (no-op if already open) + take the user
        // to /atelier where they can browse + slot.
        characterModal.open();
        const navEvent = new CustomEvent("sw-navigate-away", {
          detail: "/atelier",
          cancelable: true,
        });
        window.dispatchEvent(navEvent);
        if (!navEvent.defaultPrevented) {
          router.push("/atelier");
        }
      }}
      className={base}
    >
      <Plus className="size-4" />
      {label}
    </button>
  );
}