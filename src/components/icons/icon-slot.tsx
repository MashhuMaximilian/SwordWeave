"use client";

// =============================================================================
// IconSlot — clickable icon preview + an always-visible "Change" button used
// in entity forms. Clicking either opens the IconPicker via the modal stack.
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
// This makes it easy to wire into the existing form state and persist
// via the same dispatch-save pipeline as everything else.
//
// Why an always-visible "Change" button (Phase 9):
//   The previous UX had two affordances:
//     (1) The icon tile itself — clickable, with a pencil overlay that
//         fades in on hover.
//     (2) A "Choose icon →" link — visible ONLY when no icon was set.
//   Users with an existing icon (the common case post-backfill) had only
//   affordance (1). On desktop (hover) it works fine — the pencil appears
//   and the tooltip "Change <label>" cues the click. On touch / mobile /
//   screen-readers, there is no hover state, and the click target is just
//   a picture with no visible text. Result: the user reports "no button
//   to change icon".
//   Fix: always render a small "Change" button next to the icon. The
//   click target is now explicit text, which works on every input mode
//   (mouse, touch, keyboard, screen reader) and matches the visual
//   language of the rest of the form (every field has a label, every
//   field has a clear edit affordance).
// =============================================================================

import { Pencil } from "lucide-react";
import { useId } from "react";
import { IconDisplay, type IconSource } from "./icon-display";
import { IconPicker } from "./icon-picker";
import { useModalStack } from "@/components/ui/modal-stack";

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
  const stack = useModalStack();
  // Phase 9: unique key per slot. Previously every IconSlot pushed the
  // literal "icon-picker" key, which collided when two slots on the
  // same page both opened (e.g. a fork source + a fork target). React
  // logs a duplicate-key warning and silently drops one of the modals.
  // useId() gives each IconSlot a stable, distinct, SSR-safe key.
  const slotId = useId();

  const handleOpen = () => {
    // Phase 9: small breadcrumb so the user can tell which icon slot
    // the modal belongs to when multiple are open. The label is the
    // field's human-readable name (e.g. "Build icon", "Icon").
    stack.push({
      key: `icon-picker-${slotId}`,
      label,
      content: (
        <IconPicker
          currentSource={iconSource ?? null}
          currentKey={iconKey ?? null}
          currentUrl={iconUrl ?? null}
          currentColor={iconColor ?? "#ffffff"}
          onSelect={(next) => {
            // Normalize the picker's compact shape (source/key/url/color)
            // to the form's explicit-field shape (iconSource/iconKey/...).
            onChange({
              iconSource: next.source,
              iconKey: next.key,
              iconUrl: next.url,
              iconColor: next.color,
            });
          }}
        />
      ),
    });
  };

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
          {/* Phase 9: always-visible "Change" button. Sits where the
              "Choose icon →" link used to be, but always renders (not
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
    </div>
  );
}
