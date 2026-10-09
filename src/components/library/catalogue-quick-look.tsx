"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import "./catalogue-layout.css";

/** Lightweight authored details only; full resolvers are loaded by the preview. */
export function CatalogueQuickLook({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  function cancelClose() {
    if (timer.current) clearTimeout(timer.current);
  }
  function closeSoon() {
    cancelClose();
    timer.current = setTimeout(() => setPosition(null), 160);
  }
  function open() {
    cancelClose();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(380, window.innerWidth - 24);
    const roomBelow = window.innerHeight - rect.bottom;
    setPosition({
      width,
      left: Math.max(
        12,
        Math.min(rect.right - width, window.innerWidth - width - 12),
      ),
      top:
        roomBelow > 260
          ? rect.bottom + 6
          : Math.max(12, rect.top - Math.min(300, window.innerHeight - 24) - 6),
    });
  }
  useEffect(() => {
    if (!position) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setPosition(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setPosition(null);
        trigger.current?.focus();
      }
    };
    const scroll = () => setPosition(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", scroll);
    };
  }, [position]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="sw-catalogue-quick-look"
        aria-label={`Quick details for ${name}`}
        aria-expanded={!!position}
        aria-controls={position ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={closeSoon}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) open();
        }}
        onBlur={closeSoon}
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
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
            <strong>{name}</strong>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
