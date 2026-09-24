"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): BUILD/PLAY mode banner for /characters/[id].
 *
 * Shows the current mode (BUILD vs PLAY) as a chip, plus a button to
 * toggle. In BUILD mode, an inline hint reminds the user that the
 * accordions have build affordances ("+ Add primitive", "Formalize as
 * heritage", etc.). In PLAY mode, a "Edit build" CTA flips back.
 *
 * Why a banner (not a tab):
 *   The user wanted minimal chrome — the sheet is the same page in
 *   both modes; only the accordion affordances differ. The banner is
 *   the single source of truth for which mode the page is in.
 */

import { useCallback, useEffect, useState } from "react";
import { Hammer, Loader2, ShieldCheck } from "lucide-react";

export type SheetMode = "BUILD" | "PLAY";

interface BuildModeBannerProps {
  characterId: string;
  initialMode: SheetMode;
  /** Optional: which tab to focus the user on (used by /characters/new). */
  defaultTab?: string;
  permission?: "OWNER" | "EDITOR" | "SUGGESTER" | "VIEWER" | undefined;
}

export function BuildModeBanner({
  characterId,
  initialMode,
  permission = "VIEWER",
}: BuildModeBannerProps) {
  const [mode, setMode] = useState<SheetMode>(initialMode);
  const isPending = false;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMode(initialMode), [initialMode]);
  const toggle = useCallback(() => {
    if (permission === "VIEWER") return;
    const next: SheetMode = mode === "BUILD" ? "PLAY" : "BUILD";
    setError(null);
    setMode(next);
    window.dispatchEvent(new CustomEvent("sw-character-build-mode", { detail: { characterId, mode: next } }));
  }, [characterId, mode, permission]);

  if (permission === "VIEWER") return null;

  if (mode === "BUILD") {
    return (
      <div data-mode="BUILD" className="v12-character-mode-panel is-build flex flex-row items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Hammer className="size-5" aria-hidden />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {permission === "SUGGESTER" ? "Proposing changes" : "Character edit mode"}
            </p>
            <p className="hidden text-xs leading-5 text-muted-foreground sm:block sm:text-sm">
              Create pieces in the workspace, reuse pieces on this character,
              or add from the Library. Select pieces to group them. Switch
              back to Play when you’re ready.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40 sm:self-auto"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Back to Play
        </button>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 sm:basis-full"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-mode="PLAY" className="v12-character-mode-panel is-play flex flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            Play mode
          </p>
          <p className="hidden text-xs leading-5 text-muted-foreground sm:block sm:text-sm">
            Trigger capabilities, manage availability, and track consequences.
            Switch to edit mode to change your character’s pieces and bundles.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-md border border-primary/50 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {permission === "SUGGESTER" ? "Suggest changes" : "Open edit mode"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 sm:basis-full"
        >
          {error}
        </p>
      )}
    </div>
  );
}
