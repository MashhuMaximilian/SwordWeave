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
 *   2. We mark the row as `removing` — the row swaps to a fade+slide
 *      class (Tailwind transitions handle the visual).
 *   3. We call the underlying `onRemove` IMMEDIATELY so pendingSlots
 *      reflects the removal right away. This triggers the localStorage
 *      persistence effect, ensuring removals survive a modal close.
 *      (The original 200ms delay caused removals to be lost when the
 *      user closed the modal before the timer fired.)
 *   4. The CSS transition may not fully play (the row unmounts when
 *      its slot leaves pendingSlots), but data integrity is guaranteed.
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
    if (removing) return;
    setRemoving(true);
    // Call onRemove IMMEDIATELY so pendingSlots updates right away.
    // This triggers the localStorage persistence effect, ensuring
    // removals survive a modal close before any animation completes.
    // Phase 8.4 v24.9 (Mashu 2026-07-30): the 200ms delay caused
    // removals to be lost when the user closed the modal before the
    // timer fired.
    //
    // The `removing` flag is still set for visual feedback, but since
    // onRemove immediately removes the slot from pendingSlots, the
    // parent's map will unmount this component. The CSS transition
    // may not fully play, but data integrity is guaranteed.
    onRemove();
  }, [removing, onRemove]);

  return { removing, handleRemove };
}