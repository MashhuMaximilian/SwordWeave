"use client";

// Library column for /sandbox/primitives.
// - Filter bar is collapsible (user reported it was eating vertical space).
// - Each row is clickable → opens a preview modal in the Library column.
// - "Edit" button in modal → navigates to ?edit=<id> to load into Build.
// - "Fork" → also navigates to ?edit=<id> (saving creates a private copy).
//
// The Library column also doubles as a quick visual inventory of what's
// available before the user starts composing.

import Link from "next/link";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean;
  mechanicalOutputText?: string | null;
  narrativeRule?: string | null;
  costTier?: string | null;
  isMirrorable?: boolean;
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function PrimitivesLibrary({
  primitives,
  editingPrimitiveId,
}: {
  primitives: PrimitiveRow[];
  editingPrimitiveId: number | null;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of primitives) set.add(p.category);
    return ["ALL", ...Array.from(set).sort()];
  }, [primitives]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return primitives.filter((p) => {
      const catOk = activeCategory === "ALL" || p.category === activeCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        categoryLabel(p.category).toLowerCase().includes(q) ||
        (p.mechanicalOutputText ?? "").toLowerCase().includes(q)
      );
    });
  }, [primitives, query, activeCategory]);

  const previewRow = useMemo(
    () => primitives.find((p) => p.id === previewId) ?? null,
    [primitives, previewId],
  );

  // Close preview with Escape key.
  useEffect(() => {
    if (!previewId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search primitives…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <span>
            Filters{" "}
            {activeCategory !== "ALL" ? `· ${categoryLabel(activeCategory)}` : ""}
          </span>
          {filtersOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
        {filtersOpen ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((cat) => {
              const count =
                cat === "ALL"
                  ? primitives.length
                  : primitives.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium transition-colors",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {cat === "ALL" ? "All" : categoryLabel(cat)} ({count})
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No primitives match.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((p) => {
              const isEditing = p.id === editingPrimitiveId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewId(p.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {p.buCost} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{categoryLabel(p.category)}</span>
                      <span>·</span>
                      <span>{p.isPublic ? "Public" : "Draft"}</span>
                      {p.isMirrorable ? (
                        <>
                          <span>·</span>
                          <span>Mirrorable</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {previewRow ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-full w-full max-w-md overflow-auto rounded-md border border-border bg-card p-5 shadow-xl">
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {categoryLabel(previewRow.category)}
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
              {previewRow.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
                {previewRow.buCost} BU
              </span>
              {previewRow.costTier ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                  {previewRow.costTier}
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  previewRow.isPublic
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {previewRow.isPublic ? "Public" : "Draft"}
              </span>
              {previewRow.isMirrorable ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                  Mirrorable
                </span>
              ) : null}
            </div>
            {previewRow.mechanicalOutputText ? (
              <section className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Mechanical output
                </h3>
                <p className="text-sm leading-6 text-foreground">
                  {previewRow.mechanicalOutputText}
                </p>
              </section>
            ) : null}
            {previewRow.narrativeRule ? (
              <section className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Narrative rule
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {previewRow.narrativeRule}
                </p>
              </section>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/sandbox/primitives?edit=${previewRow.id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setPreviewId(null)}
              >
                {previewRow.isPublic ? "Edit" : "Load"}
              </Link>
              <Link
                href={`/sandbox/primitives?edit=${previewRow.id}`}
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
                onClick={() => setPreviewId(null)}
              >
                Fork to my account
              </Link>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}