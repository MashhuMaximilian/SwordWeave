"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Search, Eye } from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import { ToastViewport, useToasts } from "@/components/ui/toast";

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
  const [searchInput, setSearchInput] = useState(currentFilters.q);
  const { toasts, showToast, dismissToast } = useToasts();

  const [detailEffect, setDetailEffect] = useState<EffectRow | null>(null);

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
    try {
      const res = await fetch(`/api/effects/${effectId}/clone`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Clone failed.", "error");
        return;
      }
      showToast(
        `Cloned "${effectName}" → "${data.effect?.name ?? "(copy)"}"`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Clone failed.",
        "error",
      );
    }
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
              className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
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
              <div className="mt-4 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDetailEffect(effect)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:border-primary"
                  aria-label={`View details for ${effect.name}`}
                >
                  <Eye className="size-3.5" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => handleClone(effect.id, effect.name)}
                  disabled={isPending}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
                >
                  <Copy className="size-3.5" />
                  Clone
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Detail modal */}
      <DetailModal
        isOpen={detailEffect !== null}
        onClose={() => setDetailEffect(null)}
        title={detailEffect?.name ?? ""}
        subtitle={detailEffect?.sourceOrigin ?? null}
        size="md"
      >
        {detailEffect && (
          <div className="space-y-5">
            {detailEffect.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {detailEffect.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-secondary px-3 py-1"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {detailEffect.narrativeDescription || "(no description)"}
              </p>
            </div>

            <div className="flex gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  handleClone(detailEffect.id, detailEffect.name);
                  setDetailEffect(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary"
              >
                <Copy className="size-4" />
                Clone
              </button>
            </div>
          </div>
        )}
      </DetailModal>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}