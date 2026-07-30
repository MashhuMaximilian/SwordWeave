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
 *      fade+collapse class (Tailwind transitions handle the
 *      visual).
 *   3. We wait `duration` ms for the animation to play.
 *   4. We call the underlying `onRemove` to drop the row
 *      from `pendingSlots`.
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
  durationMs = 180,
): {
  removing: boolean;
  handleRemove: () => void;
} {
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(() => {
    if (removing) return; // ignore double-clicks during animation
    setRemoving(true);
    // Defer the actual removal until after the CSS transition
    // completes. setTimeout matches the duration we pass to the
    // Tailwind `duration-200` class on the row.
    window.setTimeout(() => {
      onRemove();
    }, durationMs);
  }, [removing, onRemove, durationMs]);

  return { removing, handleRemove };
}