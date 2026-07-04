"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Search } from "lucide-react";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorBuCredit: number;
};

type Filters = { q: string; category: string; mirror: string };

export function LibraryPrimitivesView({
  rows,
  currentFilters,
  allCategories,
}: {
  rows: PrimitiveRow[];
  currentFilters: Filters;
  allCategories: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [searchInput, setSearchInput] = useState(currentFilters.q);

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams();
    const newFilters: Filters = { ...currentFilters, [key]: value };
    if (newFilters.q) params.set("q", newFilters.q);
    if (newFilters.category !== "ALL") params.set("category", newFilters.category);
    if (newFilters.mirror !== "ALL") params.set("mirror", newFilters.mirror);
    router.push(`/library/primitives?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateFilter("q", searchInput);
  }

  async function handleClone(primitiveId: number, primitiveName: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/primitives/${primitiveId}/clone`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error ?? "Clone failed.");
          return;
        }
        setMessage(`Cloned "${primitiveName}" -> "${data.primitive.name}"`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unknown error.");
      }
    });
  }

  function categoryLabel(c: string) {
    return c
      .split("_")
      .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
      .join(" ");
  }

  // Group by category
  const byCategory = new Map<string, PrimitiveRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mt-6 rounded-md border border-border bg-card p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search primitives..."
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Category:
            </span>
            <button
              type="button"
              onClick={() => updateFilter("category", "ALL")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                currentFilters.category === "ALL"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => updateFilter("category", cat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.category === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Mirror:
            </span>
            {[
              { k: "ALL", label: "Any" },
              { k: "yes", label: "Mirrorable" },
              { k: "no", label: "Not mirrorable" },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => updateFilter("mirror", k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.mirror === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </div>

      {/* Grouped grid */}
      <div className="mt-6 space-y-8">
        {Array.from(byCategory.entries()).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No primitives match your filters.
          </p>
        ) : (
          Array.from(byCategory.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-xl font-semibold">
                {categoryLabel(category)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium">{p.name}</h3>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {p.buCost} BU
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.costTier}
                    </p>
                    {p.narrativeRule && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {p.narrativeRule}
                      </p>
                    )}
                    {p.isMirrorable && (
                      <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                        Mirrorable ({p.mirrorBuCredit} BU credit)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleClone(p.id, p.name)}
                      disabled={isPending}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
                    >
                      <Copy className="size-3.5" />
                      Clone
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}