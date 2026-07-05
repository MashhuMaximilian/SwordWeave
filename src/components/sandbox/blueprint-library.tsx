"use client";

// Blueprint Library column.
// Shows templates + items. Default filter depends on current Build mode:
// Template shows templates + items; Item shows the same; Monster shows the same.

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { BlueprintBuildMode } from "./blueprint-sandbox-client";

type TemplateRow = {
  id: string;
  name: string;
  kind: string;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; buCost: number };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: { id: string; name: string };
  }>;
};

type ItemRow = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; buCost: number };
  }>;
};

function totalBu(rows: Array<{ primitive: { buCost: number } }>): number {
  return rows.reduce((sum, r) => sum + r.primitive.buCost, 0);
}

function kindLabel(kind: string): string {
  if (kind === "RACE") return "Race";
  if (kind === "BACKGROUND") return "Background";
  if (kind === "ARCHETYPE") return "Archetype";
  return kind;
}

type PreviewItem =
  | { kind: "template"; row: TemplateRow }
  | { kind: "item"; row: ItemRow };

export function BlueprintLibrary({
  build,
  templates,
  items,
  editingKey,
  onSelect,
}: {
  build: BlueprintBuildMode;
  templates: TemplateRow[];
  items: ItemRow[];
  editingKey: string | null;
  onSelect: (
    kind: "template" | "item",
    id: string,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Blueprint shows everything by default. Users can filter if they want to.
  const [filterTemplates, setFilterTemplates] = useState(true);
  const [filterItems, setFilterItems] = useState(true);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const matchesQuery = (haystack: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return haystack.toLowerCase().includes(q);
  };

  const filteredTemplates = useMemo(() => {
    if (!filterTemplates) return [];
    return templates.filter((t) => matchesQuery(t.name));
  }, [templates, query, filterTemplates]);

  const filteredItems = useMemo(() => {
    if (!filterItems) return [];
    return items.filter((i) =>
      matchesQuery([i.name, i.itemType, i.rarity].join(" ")),
    );
  }, [items, query, filterItems]);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const total = filteredTemplates.length + filteredItems.length;

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blueprints…"
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
          <div className="mt-2 flex flex-wrap gap-1">
            <FilterChip
              active={filterTemplates}
              onClick={() => setFilterTemplates((v) => !v)}
              label="Templates"
              count={templates.length}
            />
            <FilterChip
              active={filterItems}
              onClick={() => setFilterItems((v) => !v)}
              label="Items"
              count={items.length}
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
            {filteredTemplates.map((t) => {
              const key = `template:${t.id}`;
              const isEditing = editingKey === key;
              const bu = totalBu(t.primitiveLinks);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPreview({ kind: "template", row: t })}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {bu} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Template
                      </span>
                      <span>{kindLabel(t.kind)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredItems.map((i) => {
              const key = `item:${i.id}`;
              const isEditing = editingKey === key;
              const bu = i.buCost + totalBu(i.primitiveLinks);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPreview({ kind: "item", row: i })}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{i.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {bu} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Item
                      </span>
                      <span>
                        {i.itemType} · {i.rarity}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview ? (
        <PreviewModal
          item={preview}
          onClose={() => setPreview(null)}
          onUse={() => {
            if (preview.kind === "template") onSelect("template", preview.row.id);
            else onSelect("item", preview.row.id);
            setPreview(null);
          }}
        />
      ) : null}
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
  const libraryPath =
    item.kind === "template"
      ? `/library/item/TEMPLATE:${item.row.id}`
      : `/library/item/ITEM:${item.row.id}`;

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
          {item.kind === "template"
            ? `${kindLabel(item.row.kind)} Template`
            : `${item.row.itemType} Item`}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">
          {item.row.name}
        </h2>

        {item.kind === "template" ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
                {totalBu(item.row.primitiveLinks)} BU
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                {item.row.primitiveLinks.length} primitives
              </span>
              {item.row.capabilityLinks.length > 0 ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                  {item.row.capabilityLinks.length} capabilities
                </span>
              ) : null}
            </div>
            {item.row.primitiveLinks.length > 0 ? (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Bundled primitives
                </h3>
                <ul className="divide-y divide-border rounded-md border">
                  {item.row.primitiveLinks.map((link) => (
                    <li
                      key={link.primitiveId}
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
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
                {item.row.buCost + totalBu(item.row.primitiveLinks)} BU
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                {item.row.rarity}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                Slot {item.row.buCost}
              </span>
            </div>
            {item.row.primitiveLinks.length > 0 ? (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Item-augment primitives
                </h3>
                <ul className="divide-y divide-border rounded-md border">
                  {item.row.primitiveLinks.map((link) => (
                    <li
                      key={link.primitiveId}
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
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Load into Build
          </button>
          <Link
            href={libraryPath}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
            onClick={onClose}
          >
            View in Library
          </Link>
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