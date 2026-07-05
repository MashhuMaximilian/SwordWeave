// Library column for /sandbox/primitives — searchable, category-filterable list
// of all primitives. Click a row to load it into the editor + preview.

"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean;
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
        categoryLabel(p.category).toLowerCase().includes(q)
      );
    });
  }, [primitives, query, activeCategory]);

  return (
    <div className="flex h-full flex-col">
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
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2 text-xs">
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

      <div className="flex-1 min-h-0 overflow-auto">
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
                  <Link
                    href={`/sandbox/primitives?edit=${p.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-3 py-2 text-sm transition-colors hover:bg-accent",
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
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}