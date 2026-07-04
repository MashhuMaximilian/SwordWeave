"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Search } from "lucide-react";

type EffectRow = {
  id: string;
  name: string;
  sourceOrigin: string | null;
  narrativeDescription: string;
  tags: string[];
};

type Filters = { q: string; tag: string };

export function LibraryEffectsView({
  effects,
  currentFilters,
  allTags,
}: {
  effects: EffectRow[];
  currentFilters: Filters;
  allTags: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [searchInput, setSearchInput] = useState(currentFilters.q);

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams();
    const newFilters: Filters = { ...currentFilters, [key]: value };
    if (newFilters.q) params.set("q", newFilters.q);
    if (newFilters.tag !== "ALL") params.set("tag", newFilters.tag);
    router.push(`/library/effects?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateFilter("q", searchInput);
  }

  async function handleClone(effectId: string, effectName: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/effects/${effectId}/clone`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error ?? "Clone failed.");
          return;
        }
        setMessage(`Cloned "${effectName}" -> "${data.effect.name}"`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unknown error.");
      }
    });
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
              placeholder="Search effects..."
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

        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Tags:
            </span>
            <button
              type="button"
              onClick={() => updateFilter("tag", "ALL")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                currentFilters.tag === "ALL"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => updateFilter("tag", tag)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.tag === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </div>

      {/* Effect grid */}
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {effects.length === 0 ? (
          <p className="col-span-full text-center text-sm text-muted-foreground py-12">
            No effects match your filters.
          </p>
        ) : (
          effects.map((effect) => (
            <article
              key={effect.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <h3 className="font-semibold">{effect.name}</h3>
              {effect.sourceOrigin && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Source: {effect.sourceOrigin}
                </p>
              )}
              {effect.narrativeDescription && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {effect.narrativeDescription}
                </p>
              )}
              {effect.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {effect.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleClone(effect.id, effect.name)}
                disabled={isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
              >
                <Copy className="size-3.5" />
                Clone
              </button>
            </article>
          ))
        )}
      </div>
    </>
  );
}