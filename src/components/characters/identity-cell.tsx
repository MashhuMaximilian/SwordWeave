"use client";

/**
 * IdentityCell — compact cell for the identity strip.
 *
 * Phase 8.4 v11 (Mashu 2026-07-28): extracted from
 * bottom-sticky-bar.tsx into its own file so it can be
 * reused by the SheetIdentityHeader's expanded panel
 * (where the identity card now lives, per the user's
 * annotated screenshot).
 */

export interface IdentityCellProps {
  readonly label: string;
  readonly value: string;
  readonly note?: string | null;
  readonly tone?: "default" | "ok" | "bad";
}

export function IdentityCell({
  label,
  value,
  note,
  tone = "default",
}: IdentityCellProps) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-medium ${
          tone === "ok"
            ? "text-green-600 dark:text-green-400"
            : tone === "bad"
              ? "text-destructive"
              : ""
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}