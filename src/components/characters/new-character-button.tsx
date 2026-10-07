/**
 * Shared entry point for the guided character-creation journey.
 *
 * The Atelier's character modal remains available from the Atelier as a
 * sandbox. Roster and creation-library CTAs use /characters/new so first-time
 * creation has one predictable, mobile-friendly flow.
 */

import Link from "next/link";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";

export interface NewCharacterButtonProps {
  /** Visual variant — "primary" for the top of a page,
   *  "outline" for inline / grid use. */
  variant?: "primary" | "outline";
  label?: string;
}

export function NewCharacterButton({
  variant = "primary",
  label = "Create Character",
}: NewCharacterButtonProps) {
  const base =
    variant === "primary"
      ? "v12-metal-button v12-metal-button--primary"
      : "v12-metal-button";
  return (
    <Link href="/characters/new" className={base}>
      <EntityTypeIcon type="CREATE_CHARACTER"/>
      {label}
    </Link>
  );
}
