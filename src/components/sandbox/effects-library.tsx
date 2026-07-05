"use client";

// Library column for /sandbox/effects.
// - Filter bar is collapsible (per user feedback).
// - Each row is clickable → opens a preview modal in the Library column.
// - "Edit" / "Fork" button navigates to ?edit=<id> to load into Build.

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type EffectRow = {
  id: string;
  name: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

function totalBu(row: EffectRow): number {
  return row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost * link.quantity,
    0,
  );
}

export function EffectsLibrary({
  effects,
  editingEffectId,
}: {
  effects: EffectRow[];
  editingEffectId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [publicOnly, setPublicOnly] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return effects.filter((effect) => {
      if (publicOnly && !effect.isPublic) return false;
      if (!q) return true;
      return (
        effect.name.toLowerCase().includes(q) ||
        (effect.sourceOrigin ?? "").toLowerCase().includes(q) ||
        effect.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [effects, query, publicOnly]);

  const previewRow = useMemo(
    () => effects.find((e) => e.id === previewId) ?? null,
    [effects, previewId],
  );

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
            placeholder="Search effects…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <span>Filters</span>
          {filtersOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
        {filtersOpen ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={publicOnly}
              onChange={(e) => setPublicOnly(e.target.checked)}
              className="size-3.5"
            />
            Public only
          </label>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No effects match.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((e) => {
              const bu = totalBu(e);
              const isEditing = e.id === editingEffectId;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewId(e.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{e.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {bu} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{e.primitiveLinks.length} primitives</span>
                      <span>·</span>
                      <span>{e.isPublic ? "Public" : "Draft"}</span>
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
              Effect
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
              {previewRow.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
                {totalBu(previewRow)} BU
              </span>
              {previewRow.sourceOrigin ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                  {previewRow.sourceOrigin}
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
            </div>
            {previewRow.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {previewRow.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {previewRow.primitiveLinks.length > 0 ? (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Slotted primitives ({previewRow.primitiveLinks.length})
                </h3>
                <ul className="divide-y divide-border rounded-md border">
                  {previewRow.primitiveLinks.map((link) => (
                    <li
                      key={link.primitiveId}
                      className="flex items-center justify-between gap-2 p-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {link.primitive.name} x{link.quantity}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {link.primitive.buCost * link.quantity} BU
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/sandbox/effects?edit=${previewRow.id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setPreviewId(null)}
              >
                {previewRow.isPublic ? "Edit" : "Load"}
              </Link>
              <Link
                href={`/sandbox/effects?edit=${previewRow.id}`}
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