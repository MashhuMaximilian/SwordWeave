"use client";

// =============================================================================
// CharacterListTabs — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Client wrapper that owns the tab state (My / Shared with me /
// Public library) and renders the matching content panel. All three
// data sets are loaded server-side in parallel and passed in as
// props — switching tabs is a pure-React re-render, no refetch.
//
// Why a client component:
// - URL state for tab (?tab=shared or ?tab=public) needs a router
//   hook to keep the back button working.
// - We could have done this as three separate routes (/characters,
//   /characters/shared, /characters/public) but the three are all
//   variations on "my characters" — single page is more honest.
//
// Active tab default: 'mine'. Counts are shown next to each tab
// label so users can see at a glance which tabs have content.
// =============================================================================

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { SharedCharacterCard } from "@/components/characters/shared-character-card";
import { PublicCharacterCard } from "@/components/characters/public-character-card";
import type { SharedCharacterRow } from "@/lib/character/list-shared-characters";
import type { LibraryItem } from "@/lib/publishing/library-query";

export type CharacterTab = "mine" | "shared" | "public";

interface CharacterListTabsProps {
  /** Server-rendered My Characters grid (unchanged from before). */
  mineContent: React.ReactNode;
  /** Server-rendered Shared-with-me rows (already joined to granter info). */
  sharedRows: SharedCharacterRow[];
  /** Server-rendered Public-library LibraryItems (CHARACTER type). */
  publicItems: LibraryItem[];
  /** Initial active tab from URL (?tab=shared etc). */
  initialTab?: CharacterTab;
  /** Server-rendered empty state for My Characters (so we don't
   *  show the empty state on other tabs). */
  mineEmptyState: React.ReactNode;
}

export function CharacterListTabs({
  mineContent,
  sharedRows,
  publicItems,
  initialTab = "mine",
  mineEmptyState,
}: CharacterListTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: CharacterTab = (() => {
    const t = searchParams?.get("tab");
    if (t === "shared" || t === "public" || t === "mine") return t;
    return initialTab;
  })();

  const setTab = useCallback(
    (tab: CharacterTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (tab === "mine") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="v12-roster-tabs-shell">
      <TabStrip
        active={activeTab}
        counts={{
          mine: null, // unknown until server renders
          shared: sharedRows.length,
          public: publicItems.length,
        }}
        onChange={setTab}
      />

      <div className="v12-roster-tab-content">
        {activeTab === "mine" && (
          <div>
            {mineContent ?? mineEmptyState}
          </div>
        )}
        {activeTab === "shared" && (
          <SharedGrid rows={sharedRows} />
        )}
        {activeTab === "public" && (
          <PublicGrid items={publicItems} />
        )}
      </div>
    </div>
  );
}

interface TabStripProps {
  active: CharacterTab;
  counts: { mine: number | null; shared: number; public: number };
  onChange: (next: CharacterTab) => void;
}

function TabStrip({ active, counts, onChange }: TabStripProps) {
  const tabs: Array<{ id: CharacterTab; label: string; count: number | null }> = [
    { id: "mine", label: "My Characters", count: counts.mine },
    { id: "shared", label: "Shared with me", count: counts.shared },
    { id: "public", label: "Public library", count: counts.public },
  ];

  return (
    <div
      role="tablist"
      aria-label="Character list views"
      className="v12-roster-tabs"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "v12-roster-tab",
              isActive ? "is-active" : "",
            )}
          >
            {t.label}
            {t.count !== null && (
              <span
                className={cn(
                  "v12-roster-count",
                  isActive ? "is-active" : "",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SharedGrid({ rows }: { rows: SharedCharacterRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="v12-roster-empty">
        <h2 className="text-2xl font-semibold">No characters shared with you yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          When someone shares a character with you, it shows up here. (Part C
          adds the invite-by-username flow on the character sheet.)
        </p>
      </div>
    );
  }
  return (
    <div className="v12-roster-grid">
      {rows.map((row) => (
        <SharedCharacterCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function PublicGrid({ items }: { items: LibraryItem[] }) {
  if (items.length === 0) {
    return (
      <div className="v12-roster-empty">
        <h2 className="text-2xl font-semibold">No public characters yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The codex is empty. Make one of your own characters public from the
          sheet header to seed it.
        </p>
      </div>
    );
  }
  return (
    <div className="v12-roster-grid">
      {items.map((item) => (
        <PublicCharacterCard key={item.id} item={item} />
      ))}
    </div>
  );
}
