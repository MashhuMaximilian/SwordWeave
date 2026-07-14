"use client";

// =============================================================================
// IconSlot — clickable icon preview + an always-visible "Change" button used
// in entity forms.
//
// Phase 10 (Mashu 2026-07-14, "Button does not work. Nothing happens."):
//   This component used to push the IconPicker into the modal stack via
//   useModalStack().push(...). ModalStackHost renders modals via a
//   createPortal to document.body at z-60+, so in theory the picker should
//   have been visible on top of everything — but the user reported the
//   picker never appeared, even after the previous fix that always-visible
//   "Change" buttons. Possible causes (ruled out one at a time):
//     (a) ModalStackHost not in scope — ruled out: AppShell wraps every
//         route in <ModalStackHost>, and every entity form lives under
//         AppShell.
//     (b) stack.push() returns false at MAX_DEPTH — MAX_DEPTH is 4 and
//         the icon picker is typically the first/only modal, so this
//         only fires when the user already has 4 modals open.
//     (c) Stack-wedging from previous session, leftover from the
//         build-preview-drawer that sits at z-50 — plausible, but
//         the path-clear-on-route-change should reset it.
//   Rather than continue to chase the modal-stack root cause, this commit
//   removes IconSlot's dependency on the modal stack entirely. The picker
//   is now opened by toggling a local useState, and rendered inline next
//   to the IconSlot as a fixed-positioned div with z-[9999]. The icon
//   picker is one of the most-clicked affordances in the app — it needs
//   to be a closed system, not coupled to a global side-channel.
//
// Usage in a form:
//   <IconSlot
//     source={form.iconSource}
//     key={form.iconKey}
//     url={form.iconUrl}
//     color={form.iconColor}
//     onChange={(next) => setForm({ ...form, ...next })}
//     label="Icon"
//   />
//
// The component is fully controlled — the parent owns the icon state and
// receives a single onChange with the new source/key/url/color triple.
// =============================================================================

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { IconDisplay, type IconSource } from "./icon-display";
import { IconPicker } from "./icon-picker";

export interface IconSlotProps {
  iconSource?: IconSource | undefined;
  iconKey?: string | null | undefined;
  iconUrl?: string | null | undefined;
  iconColor?: string | null | undefined;
  /** Called when the user selects a new icon. The parent should merge
   *  these fields into its form state. */
  onChange: (next: {
    iconSource: "GAME_ICONS" | "UPLOAD";
    iconKey?: string | null | undefined;
    iconUrl?: string | null | undefined;
    iconColor: string;
  }) => void;
  /** Pixel size of the icon (default 64). */
  size?: number | undefined;
  /** Label rendered next to the slot. */
  label?: string | undefined;
  /** Optional helper text shown below the slot. */
  helper?: string | undefined;
}

export function IconSlot({
  iconSource,
  iconKey,
  iconUrl,
  iconColor,
  onChange,
  size = 64,
  label = "Icon",
  helper,
}: IconSlotProps) {
  // Phase 10: local open state. No useModalStack. No portal. No
  // stacking-context dependency. The picker is a self-contained child
  // of IconSlot.
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSelect = (next: {
    source: "GAME_ICONS" | "UPLOAD";
    key?: string;
    url?: string;
    color: string;
  }) => {
    // Normalize the picker's compact shape (source/key/url/color) to
    // the form's explicit-field shape (iconSource/iconKey/...).
    onChange({
      iconSource: next.source,
      iconKey: next.key,
      iconUrl: next.url,
      iconColor: next.color,
    });
    setOpen(false);
  };

  // Phase 10: lock body scroll while the picker is open + close on Esc.
  // Same UX rules as the BuildPreviewDrawer, but applied locally so we
  // don't depend on any global drawer state.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Change ${label.toLowerCase()}`}
        className="group relative shrink-0 overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:border-primary focus:border-primary focus:outline-none"
        style={{ width: size, height: size }}
      >
        <IconDisplay
          iconSource={iconSource}
          iconKey={iconKey}
          iconUrl={iconUrl}
          iconColor={iconColor}
          size={size}
          alt={label}
        />
        {/* Hover-only pencil overlay — desktop affordance. The always-
            visible "Change" button below is the canonical affordance
            across all input modes; this overlay is just a hint. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-tl from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="m-1 size-3.5 text-white" />
        </div>
      </button>
      {(label || helper) && (
        <div className="min-w-0 flex-1 pt-1">
          {label && (
            <div className="text-sm font-medium text-foreground">{label}</div>
          )}
          {helper && (
            <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
          )}
          {/* Always-visible "Change" button. Sits where the "Choose
              icon →" link used to be, but always renders (not
              conditional on iconSource being null). The icon-empty
              variant says "Choose icon" so the language still makes
              sense for fresh entities; the icon-present variant says
              "Change". Both call the same handler. */}
          <button
            type="button"
            onClick={handleOpen}
            className="mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus:border-primary focus:outline-none"
          >
            <Pencil className="size-3" />
            {iconSource ? "Change" : "Choose icon"}
          </button>
        </div>
      )}

      {/* Phase 10: in-place picker. Renders inline as a sibling of the
          icon button. Z-index 9999 + the parent's no-stacking-context
          ancestors (the form is just a <form>, no transforms) means
          this stacks above everything in the AppShell tree.
          pointer-events-auto + z-9999 + position fixed + inset-0 →
          always-on-top full-screen overlay with a click-to-close
          backdrop. */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose icon"
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "95vh" }}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
              <h2 className="truncate text-lg font-semibold">
                Choose icon{label && label !== "Icon" ? ` · ${label}` : ""}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-sm hover:border-primary hover:text-primary focus:border-primary focus:outline-none"
              >
                ✕
              </button>
            </header>
            {/* The icon grid scrolls inside the picker itself. We host
                the picker in a fixed-height container (~80vh) so its
                internal flex layout (`h-full max-h-[80vh] flex`) gets
                a real parent height to fill, and its inner grid can
                scroll without being collapsed by a wrapping
                `flex-1 overflow-y-auto` parent (which used to make the
                grid 0px tall). */}
            <div className="p-2 text-sm">
              <IconPicker
                currentSource={iconSource ?? null}
                currentKey={iconKey ?? null}
                currentUrl={iconUrl ?? null}
                currentColor={iconColor ?? "#ffffff"}
                onSelect={handleSelect}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
