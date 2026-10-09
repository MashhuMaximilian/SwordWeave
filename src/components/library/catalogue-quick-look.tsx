"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import "./catalogue-layout.css";
import { createHoldPreview } from "@/lib/catalogue/hold-preview";

/** Authored details: hover/focus the row, or hold it on a touch screen. A normal tap still opens the full preview. */
export function CatalogueQuickLook({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPosition(null), 180);
  }, [cancelClose]);

  useEffect(() => {
    const row = anchor.current?.closest<HTMLElement>(
      "[data-preview-trigger], [data-catalogue-row]",
    );
    if (!row) return;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelOpen = () => {
      if (openTimer) clearTimeout(openTimer);
    };
    const open = () => {
      cancelOpen();
      cancelClose();
      const rect = row.getBoundingClientRect();
      const width = Math.min(420, window.innerWidth - 24);
      const height = Math.min(400, window.innerHeight - 24);
      const beside = window.innerWidth - rect.right > width + 20;
      setPosition({
        width,
        left: beside
          ? rect.right + 8
          : Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: beside
          ? Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))
          : rect.bottom + height + 20 < window.innerHeight
            ? rect.bottom + 8
            : Math.max(12, rect.top - height - 8),
      });
    };
    // Independent actions (bookmark, add, quantity…) never summon or consume a preview.
    const independent = (target: EventTarget | null) => {
      const control =
        target instanceof Element
          ? target.closest("button, input, select, textarea, a")
          : null;
      return (
        !!control &&
        control !== row &&
        !control.matches(
          "[data-quick-look-opener], [aria-label^='Preview '], .sw-encounter-catalogue-opener",
        )
      );
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "touch") {
        cancelClose();
        openTimer = setTimeout(open, 350);
      }
    };
    const hold = createHoldPreview(open, () => setPosition(null));
    const leave = (event?: PointerEvent) => {
      if (event?.pointerType === "touch") return;
      cancelOpen();
      closeSoon();
    };
    const down = (e: PointerEvent) => {
      cancelOpen();
      if (e.pointerType === "touch" && !independent(e.target))
        hold.start(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") hold.move(e.clientX, e.clientY);
    };
    const up = () => {
      cancelOpen();
      hold.end();
    };
    const cancel = () => {
      cancelOpen();
      hold.cancel();
    };
    const click = (e: MouseEvent) => {
      if (hold.consumeClick()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else setPosition(null);
    };
    const context = (e: Event) => {
      if (hold.active) e.preventDefault();
    };
    const focus = (e: FocusEvent) => {
      if (
        !independent(e.target) &&
        e.target instanceof Element &&
        e.target.matches(":focus-visible")
      )
        openTimer = setTimeout(open, 350);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !independent(event.target) &&
        ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        cancelOpen();
        openTimer = setTimeout(open, 350);
      }
    };
    const blur = (e: FocusEvent) => {
      if (
        !row.contains(e.relatedTarget as Node) &&
        !panel.current?.contains(e.relatedTarget as Node)
      )
        leave();
    };
    row.addEventListener("pointerenter", enter);
    row.addEventListener("pointerleave", leave);
    row.addEventListener("pointerdown", down);
    row.addEventListener("pointermove", move);
    row.addEventListener("pointerup", up);
    row.addEventListener("pointercancel", cancel);
    row.addEventListener("click", click, true);
    row.addEventListener("contextmenu", context);
    row.addEventListener("keydown", keyboard);
    row.addEventListener("focusin", focus);
    row.addEventListener("focusout", blur);
    return () => {
      cancelOpen();
      cancelClose();
      hold.cancel();
      row.removeEventListener("pointerenter", enter);
      row.removeEventListener("pointerleave", leave);
      row.removeEventListener("pointerdown", down);
      row.removeEventListener("pointermove", move);
      row.removeEventListener("pointerup", up);
      row.removeEventListener("pointercancel", cancel);
      row.removeEventListener("click", click, true);
      row.removeEventListener("contextmenu", context);
      row.removeEventListener("keydown", keyboard);
      row.removeEventListener("focusin", focus);
      row.removeEventListener("focusout", blur);
    };
  }, [cancelClose, closeSoon]);
  useEffect(() => {
    if (!position) return;
    const row = anchor.current?.closest<HTMLElement>(
      "[data-preview-trigger], [data-catalogue-row]",
    );
    const dismiss = (event: Event) => {
      if (
        !row?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setPosition(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setPosition(null);
        if (panel.current?.contains(document.activeElement)) row?.focus();
      }
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) setPosition(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", scroll);
    };
  }, [position]);
  return (
    <>
      <span ref={anchor} hidden />
      {position &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="region"
            aria-label={`Quick details for ${name}`}
            className="sw-catalogue-peek"
            style={position}
            onMouseEnter={cancelClose}
            onMouseLeave={closeSoon}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="sw-catalogue-peek-close"
              aria-label="Close quick details"
              onClick={() => setPosition(null)}
            >
              <X size={17} />
            </button>
            <strong>{name}</strong>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
