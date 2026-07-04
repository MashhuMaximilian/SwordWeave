"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Pencil, Search, Eye } from "lucide-react";
import { DetailModal } from "./detail-modal";
import { ToastViewport, useToasts, type ToastVariant } from "@/components/ui/toast";

type SerializedCapability = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  computedBu: number;
  primitiveCount: number;
  primitiveNames: string[];
};

type PrimitiveRef = {
  id: number;
  name: string;
  category: string;
  buCost: number;
};

type PrimitiveLink = {
  primitiveId: number;
  role: string;
  quantity: number;
  primitive: PrimitiveRef | null;
};

type CapabilityDetail = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  metadata: { totalBu?: number } | null;
  primitiveLinks: PrimitiveLink[];
  effectLinks: Array<{ effect: { id: string; name: string } | null }>;
};

type Filters = {
  q: string;
  type: string;
  source: string;
  sort: string;
};

export function LibraryCapabilitiesView({
  capabilities,
  allPrimitives,
  currentFilters,
  allOrigins,
}: {
  capabilities: SerializedCapability[];
  allPrimitives: PrimitiveRef[];
  currentFilters: Filters;
  allOrigins: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentFilters.q);
  const { toasts, showToast, dismissToast } = useToasts();

  // Detail modal state
  const [detailCap, setDetailCap] = useState<CapabilityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams();
    const newFilters: Filters = { ...currentFilters, [key]: value };
    if (newFilters.q) params.set("q", newFilters.q);
    if (newFilters.type !== "ALL") params.set("type", newFilters.type);
    if (newFilters.source !== "ALL") params.set("source", newFilters.source);
    if (newFilters.sort !== "name") params.set("sort", newFilters.sort);
    router.push(`/library/capabilities?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateFilter("q", searchInput);
  }

  async function handleClone(
    capabilityId: string,
    capabilityName: string,
  ) {
    try {
      const res = await fetch(`/api/capabilities/${capabilityId}/clone`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Clone failed.", "error");
        return;
      }
      const variant: ToastVariant = "success";
      showToast(
        `Cloned "${capabilityName}" → "${data.capability?.name ?? "(copy)"}"`,
        variant,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Clone failed.",
        "error",
      );
    }
  }

  async function handleViewDetail(capabilityId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setDetailCap(null);
    try {
      const res = await fetch(`/api/capabilities/${capabilityId}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Failed to load capability.");
        return;
      }
      setDetailCap(data.capability as CapabilityDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setDetailLoading(false);
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
              placeholder="Search by name or description..."
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
              Type:
            </span>
            {["ALL", "ACTIVE", "PASSIVE", "AUGMENT"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateFilter("type", t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.type === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Source:
            </span>
            {["ALL", "PHYSICAL", "MAGICAL", "PSYCHIC"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateFilter("source", s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.source === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Sort:
            </span>
            {[
              { k: "name", label: "Name" },
              { k: "date", label: "Date" },
              { k: "bu", label: "BU" },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => updateFilter("sort", k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  currentFilters.sort === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Capability grid */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {capabilities.length === 0 ? (
          <p className="col-span-full text-center text-sm text-muted-foreground py-12">
            No capabilities match your filters.
          </p>
        ) : (
          capabilities.map((cap) => (
            <article
              key={cap.id}
              className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{cap.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cap.type} - {cap.sourceType}
                    {cap.sourceOrigin ? ` - ${cap.sourceOrigin}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                  {cap.computedBu} BU
                </span>
              </header>

              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {cap.verboseDescription || "(no description)"}
              </p>

              {cap.primitiveNames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cap.primitiveNames.slice(0, 6).map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {name}
                    </span>
                  ))}
                  {cap.primitiveNames.length > 6 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      +{cap.primitiveNames.length - 6} more
                    </span>
                  )}
                </div>
              )}

              <footer className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {cap.primitiveCount} primitives
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewDetail(cap.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary"
                    aria-label={`View details for ${cap.name}`}
                  >
                    <Eye className="size-3.5" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClone(cap.id, cap.name)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
                  >
                    <Copy className="size-3.5" />
                    Clone
                  </button>
                  <Link
                    href={`/sandbox/capabilities?edit=${cap.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                </div>
              </footer>
            </article>
          ))
        )}
      </div>

      {capabilities.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {capabilities.length} capability{capabilities.length === 1 ? "" : "s"}{" "}
          shown. View for full detail; Clone creates your editable copy; Edit
          opens Composer.
        </p>
      )}

      {/* Detail modal */}
      <DetailModal
        isOpen={detailLoading || detailCap !== null || detailError !== null}
        onClose={() => {
          setDetailCap(null);
          setDetailError(null);
          setDetailLoading(false);
        }}
        title={detailCap?.name ?? "Loading..."}
        subtitle={
          detailCap
            ? `${detailCap.type} - ${detailCap.sourceType}${
                detailCap.sourceOrigin ? ` - ${detailCap.sourceOrigin}` : ""
              }`
            : null
        }
        size="lg"
      >
        {detailLoading && (
          <p className="text-sm text-muted-foreground">Loading capability...</p>
        )}
        {detailError && (
          <p className="text-sm text-red-600">Error: {detailError}</p>
        )}
        {detailCap && (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono font-semibold text-primary">
                {detailCap.metadata?.totalBu ?? detailCap.primitiveLinks.reduce(
                  (t, l) => t + (l.primitive?.buCost ?? 0) * l.quantity,
                  0,
                )} BU
              </span>
              <span className="rounded-full bg-secondary px-3 py-1">
                {detailCap.primitiveLinks.length} primitives
              </span>
              {detailCap.effectLinks.length > 0 && (
                <span className="rounded-full bg-secondary px-3 py-1">
                  {detailCap.effectLinks.length} effects
                </span>
              )}
              {detailCap.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-3 py-1"
                >
                  #{t}
                </span>
              ))}
            </div>

            {/* Description */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {detailCap.verboseDescription || "(no description)"}
              </p>
            </div>

            {/* Primitive composition */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Primitive Composition
              </h3>
              {detailCap.primitiveLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No primitives linked.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {detailCap.primitiveLinks.map((link) => (
                    <li
                      key={link.primitiveId}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {link.primitive?.name ?? `Primitive #${link.primitiveId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {link.role}
                          {link.quantity > 1 ? ` × ${link.quantity}` : ""}
                          {link.primitive
                            ? ` - ${link.primitive.category}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {link.primitive
                          ? `${link.primitive.buCost * link.quantity} BU`
                          : "?"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Effects */}
            {detailCap.effectLinks.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Effects
                </h3>
                <ul className="space-y-1 text-sm">
                  {detailCap.effectLinks.map((el, i) => (
                    <li key={el.effect?.id ?? i}>
                      - {el.effect?.name ?? "(unnamed effect)"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  handleClone(detailCap.id, detailCap.name);
                  setDetailCap(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary"
              >
                <Copy className="size-4" />
                Clone
              </button>
              <Link
                href={`/sandbox/capabilities?edit=${detailCap.id}`}
                onClick={() => setDetailCap(null)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="size-4" />
                Edit in Composer
              </Link>
            </div>
          </div>
        )}
      </DetailModal>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}