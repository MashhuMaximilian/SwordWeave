"use client";

import { useEffect, useRef } from "react";

/** Keep keyboard navigation within a handheld sheet without opening the keyboard on entry. */
export function useMobileDialogFocus<T extends HTMLElement = HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 1279px)").matches) return;
    const panel = ref.current;
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.querySelector<HTMLButtonElement>('button[aria-label^="Close"]')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || document.querySelector('[data-modal-stack-top="true"]')) return;
      // A new sheet may sit above this one; its own focus scope takes priority.
      if (!panel.contains(document.activeElement)) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => !el.closest('[inert]') && el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
