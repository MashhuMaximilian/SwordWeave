"use client";

// Grammar Library column.
// Shows primitives + effects + capabilities. Default filter depends on current
// Build mode: Primitive shows primitives only; Effect shows primitives+effects;
// Capability shows all three.

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { GrammarBuildMode } from "./grammar-sandbox-client";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean;
  mechanicalOutputText?: string | null;
};

type EffectRow = {
  id: string;
  name: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    primitive: { id: number; name: string; buCost: number };
  }>;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; buCost: number };
  }>;
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function totalBu(rows: Array<{ buCost: number; quantity?: number }>): number;
function totalBu(
  rows: Array<{
    primitive?: { buCost: number };
    primitiveId: number;
    quantity?: number;
  }>,
): number;
function totalBu(
  rows: Array<{ buCost?: number; quantity?: number; primitive?: { buCost: number } }>,
): number {
  return rows.reduce((sum, r) => {
    const cost = r.buCost ?? r.primitive?.buCost ?? 0;
    return sum + cost * (r.quantity ?? 1);
  }, 0);
}

function defaultFiltersForBuild(build: GrammarBuildMode): {
  primitives: boolean;
  effects: boolean;
  capabilities: boolean;
} {
  if (build === "primitive") {
    return { primitives: true, effects: false, capabilities: false };
  }
  if (build === "effect") {
    return { primitives: true, effects: true, capabilities: false };
  }
  return { primitives: true, effects: true, capabilities: true };
}

type PreviewItem =
  | { kind: "primitive"; row: PrimitiveRow }
  | { kind: "effect"; row: EffectRow }
  | { kind: "capability"; row: CapabilityRow };

export function GrammarLibrary({
  build,
  primitives,
  effects,
  capabilities,
  editingKey,
  onSelect,
}: {
  build: GrammarBuildMode;
  primitives: PrimitiveRow[];
  effects: EffectRow[];
  capabilities: CapabilityRow[];
  editingKey: string | null;
  onSelect: (
    kind: "primitive" | "effect" | "capability",
    id: string | number,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterState, setFilterState] = useState(defaultFiltersForBuild(build));
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  // When build mode changes, reset filter chips to the smart default.
  useEffect(() => {
    setFilterState(defaultFiltersForBuild(build));
  }, [build]);

  const matchesQuery = (haystack: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return haystack.toLowerCase().includes(q);
  };

  const filteredPrimitives = useMemo(() => {
    if (!filterState.primitives) return [];
    return primitives.filter((p) =>
      matchesQuery(
        [p.name, p.category, p.mechanicalOutputText ?? ""].join(" "),
      ),
    );
  }, [primitives, query, filterState.primitives]);

  const filteredEffects = useMemo(() => {
    if (!filterState.effects) return [];
    return effects.filter((e) =>
      matchesQuery([e.name, e.sourceOrigin ?? "", e.tags.join(", ")].join(" ")),
    );
  }, [effects, query, filterState.effects]);

  const filteredCapabilities = useMemo(() => {
    if (!filterState.capabilities) return [];
    return capabilities.filter((c) =>
      matchesQuery([c.name, c.type, c.sourceType].join(" ")),
    );
  }, [capabilities, query, filterState.capabilities]);

  // Close preview on Escape.
  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  function toggleFilter(key: keyof typeof filterState) {
    setFilterState((s) => ({ ...s, [key]: !s[key] }));
  }

  const total =
    filteredPrimitives.length +
    filteredEffects.length +
    filteredCapabilities.length;

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search grammar…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <span>
            Filters
            {!filterState.primitives ||
            !filterState.effects ||
            !filterState.capabilities
              ? " · subset"
              : ""}
          </span>
          {filtersOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
        {filtersOpen ? (
          <div className="mt-2 flex flex-wrap gap-1">
            <FilterChip
              active={filterState.primitives}
              onClick={() => toggleFilter("primitives")}
              label="Primitives"
              count={primitives.length}
            />
            <FilterChip
              active={filterState.effects}
              onClick={() => toggleFilter("effects")}
              label="Effects"
              count={effects.length}
            />
            <FilterChip
              active={filterState.capabilities}
              onClick={() => toggleFilter("capabilities")}
              label="Capabilities"
              count={capabilities.length}
            />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {total === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No entries match.
          </p>
        ) : (
          <ul className="divide-y">
            {filteredPrimitives.map((p) => {
              const key = `primitive:${p.id}`;
              const isEditing = editingKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPreview({ kind: "primitive", row: p })}
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
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Primitive
                      </span>
                      <span>{categoryLabel(p.category)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredEffects.map((e) => {
              const key = `effect:${e.id}`;
              const isEditing = editingKey === key;
              const bu = totalBu(e.primitiveLinks);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPreview({ kind: "effect", row: e })}
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
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Effect
                      </span>
                      <span>{e.primitiveLinks.length} primitives</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredCapabilities.map((c) => {
              const key = `capability:${c.id}`;
              const isEditing = editingKey === key;
              const bu = totalBu(c.primitiveLinks);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() =>
                      setPreview({ kind: "capability", row: c })
                    }
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {bu} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Capability
                      </span>
                      <span>
                        {c.type} · {c.sourceType}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview ? <PreviewModal item={preview} onClose={() => setPreview(null)} onUse={() => {
        if (preview.kind === "primitive") onSelect("primitive", preview.row.id);
        else if (preview.kind === "effect") onSelect("effect", preview.row.id);
        else onSelect("capability", preview.row.id);
        setPreview(null);
      }} /> : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2 py-0.5 font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label} ({count})
    </button>
  );
}

function PreviewModal({
  item,
  onClose,
  onUse,
}: {
  item: PreviewItem;
  onClose: () => void;
  onUse: () => void;
}) {
  const kindLabel =
    item.kind === "primitive"
      ? "Primitive"
      : item.kind === "effect"
        ? "Effect"
        : "Capability";

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-full w-full max-w-md overflow-auto rounded-md border border-border bg-card p-5 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Close preview"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {kindLabel}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">
          {item.row.name}
        </h2>

        {item.kind === "primitive" ? (
          <PrimitivePreviewBody row={item.row} />
        ) : item.kind === "effect" ? (
          <EffectPreviewBody row={item.row} />
        ) : (
          <CapabilityPreviewBody row={item.row} />
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Load into Build
          </button>
          {item.kind !== "primitive" ? (
            <Link
              href={`/library/item/${
                item.kind === "effect"
                  ? `EFFECT:${item.row.id}`
                  : `CAPABILITY:${item.row.id}`
              }`}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
              onClick={onClose}
            >
              View in Library
            </Link>
          ) : (
            <Link
              href={`/library/item/PRIMITIVE:${item.row.id}`}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
              onClick={onClose}
            >
              View in Library
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PrimitivePreviewBody({ row }: { row: PrimitiveRow }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {row.buCost} BU
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {categoryLabel(row.category)}
        </span>
      </div>
      {row.mechanicalOutputText ? (
        <section className="mt-4">
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Mechanical output
          </h3>
          <p className="text-sm leading-6 text-foreground">
            {row.mechanicalOutputText}
          </p>
        </section>
      ) : null}
    </>
  );
}

function EffectPreviewBody({ row }: { row: EffectRow }) {
  const bu = totalBu(row.primitiveLinks);
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {bu} BU
        </span>
        {row.sourceOrigin ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.sourceOrigin}
          </span>
        ) : null}
      </div>
      {row.primitiveLinks.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Slotted primitives ({row.primitiveLinks.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {row.primitiveLinks.map((link) => (
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
    </>
  );
}

function CapabilityPreviewBody({ row }: { row: CapabilityRow }) {
  const bu = totalBu(row.primitiveLinks);
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {bu} BU
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.type}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.sourceType}
        </span>
      </div>
      {row.primitiveLinks.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Primitive slots ({row.primitiveLinks.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {row.primitiveLinks.map((link, i) => (
              <li
                key={`${link.primitiveId}-${i}`}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {link.primitive.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}