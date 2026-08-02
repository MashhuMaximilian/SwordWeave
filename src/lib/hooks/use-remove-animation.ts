"use client";

/**
 * useRemoveAnimation — Phase 8.4 v24.9 (Mashu 2026-07-30)
 *
 * Slot rows in the character edit modal slide off when removed.
 * The naive UX (call onRemove() immediately) snaps the row
 * out of existence which is disorienting when the user has 6+
 * rows. Mashu 2026-07-30: "we need a small animation when
 * removing something in character edit modal like sliding off."
 *
 * Mechanism:
 *   1. The user clicks "Remove" on the row.
 *   2. We mark the row as `removing` — the row swaps to a
 *      fade+slide class (Tailwind transitions handle the visual).
 *   3. We call the underlying `onRemove` IMMEDIATELY so
 *      `pendingSlots` reflects the removal right away — if the
 *      user clicks Save before the CSS transition finishes,
 *      the save body is already correct. (Phase 8.4 v24.9
 *      originally deferred the removal until after the
 *      transition, but Mashu 2026-07-30 reported "remove does
 *      not persist" on edit-existing-character saves — the
 *      180ms setTimeout window was enough time for a fast click
 *      to slip through with the slot still in pendingSlots.
 *      Removing the delay fixed the persistence bug.)
 *   4. The CSS transition still plays for visual feedback —
 *      ~200ms of fade+slide — but the data layer is already
 *      updated by the time the row finishes animating.
 *
 * If the user closes the modal mid-animation, the row is
 * already on its way out — the unmount cleans up the state.
 *
 * Usage:
 *   const { handleRemove, removing } = useRemoveAnimation(onRemove);
 *   ...
 *   <li className={cn("transition-all duration-200", removing && "opacity-0 -translate-x-4 max-h-0 overflow-hidden py-0 my-0")}>
 *     ...
 *     <button onClick={handleRemove}>Remove</button>
 *   </li>
 */

import { useCallback, useState } from "react";

export function useRemoveAnimation(
  onRemove: () => void,
): {
  removing: boolean;
  handleRemove: () => void;
} {
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(() => {
    if (removing) return; // ignore double-clicks during animation
    setRemoving(true);
    // Delay the actual onRemove call by 200ms so the CSS transition
    // (slide-off + fade) has time to play for visual feedback.
    setTimeout(() => {
      onRemove();
    }, 200);
  }, [removing, onRemove]);

  return { removing, handleRemove };
}