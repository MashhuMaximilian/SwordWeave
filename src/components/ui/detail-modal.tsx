"use client";

import { createPortal } from "react-dom";

import { useEffect, useId } from "react";
import { InstrumentDialogFrame } from "@/components/ui/instrument-dialog";

/**
 * Canonical modal component for library preview, sheet breakdowns,
 * and any other detail-on-demand UI.
 *
 * Features:
 * - Four size variants (sm/md/lg/xl)
 * - Mobile-first bottom sheet styling (rounded-t-2xl on small screens)
 * - Body scroll lock while open
 * - Escape key + backdrop click to close
 * - Sticky header with optional subtitle
 * - Accessible: role=dialog, aria-modal, aria-labelledby
 */

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function DetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: DetailModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
    return undefined;
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const titleId = useId();
  if (!isOpen || typeof document === "undefined") return null;

  const sizeClass =
    size === "xl" ? "max-w-[1400px]" : size === "sm" ? "max-w-md" : size === "lg" ? "max-w-4xl" : "max-w-2xl";

  return createPortal(
    <div
      className="v12-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <InstrumentDialogFrame
        title={title}
        {...(subtitle !== undefined ? { subtitle } : {})}
        kicker="Character instrument"
        titleId={titleId}
        onClose={onClose}
        className={`${sizeClass} max-h-[95dvh]`}
        bodyClassName="px-4 py-4 sm:px-5"
      >
        {children}
      </InstrumentDialogFrame>
    </div>, document.body
  );
}
