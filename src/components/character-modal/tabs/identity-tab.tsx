"use client";

// =============================================================================
// IdentityTab — Tab 1 of the 7-tab character modal.
//
// Fields:
//   - name        (required, the character's display name)
//   - portraitUrl (optional, URL to portrait image)
//   - size        (TINY | SMALL | MEDIUM | LARGE | HUGE | GARGANTUAN)
//   - notes       (optional, freeform)
//
// Persistence: localStorage key
//   swordweave:character-modal:draft:identity
// Cleared on successful create (TabbedCharacterForm's onCreated).
// =============================================================================

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "swordweave:character-modal:draft:identity";
const SIZES = ["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const;

type IdentityState = {
  name: string;
  portraitUrl: string;
  size: (typeof SIZES)[number];
  notes: string;
};

const EMPTY: IdentityState = {
  name: "",
  portraitUrl: "",
  size: "MEDIUM",
  notes: "",
};

function load(): IdentityState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<IdentityState>;
    return {
      ...EMPTY,
      ...parsed,
      size: (SIZES as readonly string[]).includes(parsed.size ?? "")
        ? (parsed.size as IdentityState["size"])
        : "MEDIUM",
    };
  } catch {
    return EMPTY;
  }
}

export function IdentityTab() {
  const [state, setState] = useState<IdentityState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  // Debounced write to localStorage.
  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, hydrated]);

  const setField = useCallback(
    <K extends keyof IdentityState>(key: K, value: IdentityState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Identity</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Who is this character? Name them, pick a size, drop a portrait.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Name <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          value={state.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Vex the Quick"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          autoFocus
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Size</span>
          <select
            value={state.size}
            onChange={(e) =>
              setField("size", e.target.value as IdentityState["size"])
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Portrait URL
          </span>
          <input
            type="url"
            value={state.portraitUrl}
            onChange={(e) => setField("portraitUrl", e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      {state.portraitUrl ? (
        <div className="overflow-hidden rounded-md border border-border">
          <img
            src={state.portraitUrl}
            alt={state.name ? `${state.name} portrait` : "Character portrait"}
            className="max-h-40 w-full object-cover"
          />
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea
          value={state.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={4}
          placeholder="Anything you want to remember about this character."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </label>
    </div>
  );
}

export const IDENTITY_EMPTY = EMPTY;
export const IDENTITY_STORAGE_KEY = STORAGE_KEY;
export type { IdentityState };