"use client";

// =============================================================================
// BackstoryTab — Tab 2 of the 7-tab character modal.
//
// Four freeform fields per the screenshot spec (Mashu 2026-07-21):
//   - Origin & History      (where from, what happened)
//   - Motivation & Goals    (what drives them, what they want)
//   - Ties & Allies         (people who matter)
//   - Flaw & Conflict       (internal/external friction)
//
// === Phase 8.1 fix-up: controlled when state/onChange provided ===
// Same lift as IdentityTab and AttributesTab.
// =============================================================================

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "swordweave:character-modal:draft:backstory";

export type BackstoryState = {
  origin: string;
  motivation: string;
  ties: string;
  flaw: string;
};

export const BACKSTORY_EMPTY: BackstoryState = {
  origin: "",
  motivation: "",
  ties: "",
  flaw: "",
};

export const BACKSTORY_STORAGE_KEY = STORAGE_KEY;

function load(): BackstoryState {
  if (typeof window === "undefined") return BACKSTORY_EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return BACKSTORY_EMPTY;
    return { ...BACKSTORY_EMPTY, ...(JSON.parse(raw) as Partial<BackstoryState>) };
  } catch {
    return BACKSTORY_EMPTY;
  }
}

const FIELDS: Array<{
  key: keyof BackstoryState;
  label: string;
  help: string;
  placeholder: string;
}> = [
  {
    key: "origin",
    label: "Origin & History",
    help: "Where from, what happened. Family, birthplace, defining events.",
    placeholder: "A fisher's child from a coastal village, drafted into the war after the raid…",
  },
  {
    key: "motivation",
    label: "Motivation & Goals",
    help: "What drives them. What they want right now.",
    placeholder: "Find the officer who burned the village. Make him answer for it.",
  },
  {
    key: "ties",
    label: "Ties & Allies",
    help: "People who matter. Friends, rivals, family.",
    placeholder: "Old mentor Mira. The dockmaster who hid them. Their surviving sibling.",
  },
  {
    key: "flaw",
    label: "Flaw & Conflict",
    help: "Internal or external friction. What gets in their way.",
    placeholder: "Drinks to forget. Trusts no one in uniform. Won't break a promise even when they should.",
  },
];

interface BackstoryTabProps {
  state?: BackstoryState;
  onChange?: (next: BackstoryState) => void;
}

export function BackstoryTab({
  state: controlled,
  onChange,
}: BackstoryTabProps = {}) {
  const [internal, setInternal] = useState<BackstoryState>(BACKSTORY_EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const isControlled = controlled !== undefined && onChange !== undefined;
  const state = isControlled ? (controlled as BackstoryState) : internal;

  useEffect(() => {
    setInternal(load());
    setHydrated(true);
  }, []);

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
    <K extends keyof BackstoryState>(key: K, value: BackstoryState[K]) => {
      const next = { ...state, [key]: value };
      if (isControlled) {
        onChange!(next);
      } else {
        setInternal(next);
      }
    },
    [state, isControlled, onChange],
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
        <h3 className="text-base font-semibold text-foreground">Backstory</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Freeform notes. None of these fields affect game math — they
          exist so you (and your DM) can remember who this character is.
        </p>
      </div>

      {FIELDS.map((field) => (
        <label key={field.key} className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {field.label}
          </span>
          <span className="block text-[11px] text-muted-foreground/80">
            {field.help}
          </span>
          <textarea
            value={state[field.key]}
            onChange={(e) => setField(field.key, e.target.value)}
            rows={3}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>
      ))}
    </div>
  );
}