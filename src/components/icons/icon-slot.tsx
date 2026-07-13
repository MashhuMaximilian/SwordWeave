"use client";

// =============================================================================
// IconSlot — clickable icon preview + "Choose icon" trigger used in entity
// forms. Clicking opens the IconPicker via the modal stack.
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
// =============================================================================

import { Pencil } from "lucide-react";
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

  const handleOpen = () => {
    stack.push({
      key: "icon-picker",
      label: "Icon",
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
        <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-tl from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
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
          {!iconSource && (
            <button
              type="button"
              onClick={handleOpen}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Choose icon →
            </button>
          )}
        </div>
      )}
    </div>
  );
}