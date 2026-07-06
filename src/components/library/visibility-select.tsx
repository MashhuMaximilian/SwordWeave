"use client";

// =============================================================================
// VisibilitySelect — 3-chip selector for visibility tier.
//
// Used in:
//   - My Creations preview (CRUD on existing rows).
//   - Build forms (publish flow: when saving, the user picks Private /
//     Followers / Public instead of a simple isPublic checkbox).
//
// Posts to /api/creations/visibility on change.
//
// Compact mode = 3 horizontal chips with icons only (no text). Default
// mode = 3 vertical chips with icon + label. Compact fits in the form
// chrome where vertical space is tight.
// =============================================================================

import { useState, useTransition } from "react";
import { Eye, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type Visibility = "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC";

export const VISIBILITY_OPTIONS: Array<{
  key: Visibility;
  label: string;
  icon: typeof Lock;
  hint: string;
}> = [
  { key: "PRIVATE", label: "Private", icon: Lock, hint: "Only you" },
  {
    key: "FOLLOWERS_ONLY",
    label: "Followers",
    icon: Users,
    hint: "You + your followers",
  },
  { key: "PUBLIC", label: "Public", icon: Eye, hint: "Everyone" },
];

export function visibilityLabel(vis: Visibility | null | undefined): string {
  if (vis === "FOLLOWERS_ONLY") return "Followers only";
  if (vis === "PUBLIC") return "Public";
  return "Private";
}

export function VisibilitySelect({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(next: Visibility) {
    if (next === value) return;
    setError(null);
    startTransition(() => {
      try {
        onChange(next);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to update visibility",
        );
      }
    });
  }

  if (compact) {
    return (
      <div
        className="grid grid-cols-3 gap-1"
        title="Who can see this entry"
        data-testid="visibility-select-compact"
      >
        {VISIBILITY_OPTIONS.map((opt) => {
          const active = value === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleClick(opt.key)}
              disabled={disabled || pending}
              aria-pressed={active}
              aria-label={opt.label}
              title={opt.hint}
              data-visibility-key={opt.key}
              className={cn(
                "flex h-9 items-center justify-center gap-1 rounded-md border text-xs font-medium transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                (disabled || pending) && "opacity-60",
              )}
            >
              <Icon className="size-3.5" />
              <span>{opt.label}</span>
            </button>
          );
        })}
        {error ? (
          <p className="col-span-3 text-[10px] text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Visibility
        </p>
        {pending ? (
          <span className="text-[10px] text-muted-foreground">saving…</span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {VISIBILITY_OPTIONS.map((opt) => {
          const active = value === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleClick(opt.key)}
              disabled={disabled || pending}
              aria-pressed={active}
              title={opt.hint}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] font-medium transition-all",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                (disabled || pending) && "opacity-60",
              )}
            >
              <Icon className="size-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-[10px] text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
