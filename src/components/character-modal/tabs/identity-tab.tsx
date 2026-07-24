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
// === Phase 8.1 fix-up: controlled when state/onChange provided ===
// Originally this tab owned its state and persisted via localStorage.
// Parent (TabbedCharacterForm) now owns the state for the same reason
// as AttributesTab — the modal's footer reads from parent state, so
// the tab's local state was orphaned from the rest of the modal.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useCharacterModal } from "../character-modal-store";

const STORAGE_KEY = "swordweave:character-modal:draft:identity";
const SIZES = ["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const;

export type IdentityState = {
  name: string;
  portraitUrl: string;
  size: (typeof SIZES)[number];
  notes: string;
};

export const IDENTITY_EMPTY: IdentityState = {
  name: "",
  portraitUrl: "",
  size: "MEDIUM",
  notes: "",
};

export const IDENTITY_STORAGE_KEY = STORAGE_KEY;

function load(): IdentityState {
  if (typeof window === "undefined") return IDENTITY_EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return IDENTITY_EMPTY;
    const parsed = JSON.parse(raw) as Partial<IdentityState>;
    return {
      ...IDENTITY_EMPTY,
      ...parsed,
      size: (SIZES as readonly string[]).includes(parsed.size ?? "")
        ? (parsed.size as IdentityState["size"])
        : "MEDIUM",
    };
  } catch {
    return IDENTITY_EMPTY;
  }
}

interface IdentityTabProps {
  state?: IdentityState;
  onChange?: (next: IdentityState) => void;
}

export function IdentityTab({ state: controlled, onChange }: IdentityTabProps = {}) {
  const { setDirty } = useCharacterModal();
  const [internal, setInternal] = useState<IdentityState>(IDENTITY_EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const isControlled = controlled !== undefined && onChange !== undefined;
  const state = isControlled ? (controlled as IdentityState) : internal;

  useEffect(() => {
    setInternal(load());
    setHydrated(true);
  }, []);

  // Debounced write to localStorage — only when uncontrolled. When
  // controlled, the parent owns persistence.
  useEffect(() => {
    if (isControlled || !hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(internal));
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [internal, hydrated, isControlled]);

  const setField = useCallback(
    <K extends keyof IdentityState>(key: K, value: IdentityState[K]) => {
      const next = { ...state, [key]: value };
      if (isControlled) {
        onChange!(next);
      } else {
        setInternal(next);
      }
      // Mark as dirty when user edits form fields
      setDirty(true);
    },
    [state, isControlled, onChange, setDirty],
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