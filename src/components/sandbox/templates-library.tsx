// Library column for /sandbox/templates — searchable, filterable list of all
// templates grouped by kind. Click a row to load it into the editor + preview.

"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PrimitiveRow = {
  id: number;
  name: string;
  buCost: number;
};

type TemplateRow = {
  id: string;
  kind: string;
  name: string;
  isPublic: boolean;
  primitiveLinks: Array<{ primitive: PrimitiveRow }>;
};

type GroupedTemplates = {
  RACE: TemplateRow[];
  BACKGROUND: TemplateRow[];
  ARCHETYPE: TemplateRow[];
};

function kindLabel(kind: string): string {
  if (kind === "RACE") return "Races";
  if (kind === "BACKGROUND") return "Backgrounds";
  if (kind === "ARCHETYPE") return "Archetypes";
  return kind;
}

function buTotal(row: TemplateRow): number {
  return row.primitiveLinks.reduce(
    (sum, link) => sum + (link.primitive?.buCost ?? 0),
    0,
  );
}

export function TemplatesLibrary({
  templates,
  editingTemplateId,
}: {
  templates: TemplateRow[];
  editingTemplateId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<"ALL" | "RACE" | "BACKGROUND" | "ARCHETYPE">(
    "ALL",
  );

  const grouped = useMemo<GroupedTemplates>(() => {
    const result: GroupedTemplates = { RACE: [], BACKGROUND: [], ARCHETYPE: [] };
    for (const t of templates) {
      if (t.kind === "RACE" || t.kind === "BACKGROUND" || t.kind === "ARCHETYPE") {
        result[t.kind].push(t);
      }
    }
    return result;
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool: TemplateRow[] =
      activeKind === "ALL"
        ? [...grouped.RACE, ...grouped.BACKGROUND, ...grouped.ARCHETYPE]
        : grouped[activeKind];
    if (!q) return pool;
    return pool.filter((t) => t.name.toLowerCase().includes(q));
  }, [grouped, activeKind, query]);

  const kindCounts = {
    RACE: grouped.RACE.length,
    BACKGROUND: grouped.BACKGROUND.length,
    ARCHETYPE: grouped.ARCHETYPE.length,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search input */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Kind filter pills */}
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 text-xs">
        {(
          [
            { key: "ALL", label: "All", count: templates.length },
            { key: "RACE", label: "Races", count: kindCounts.RACE },
            { key: "BACKGROUND", label: "Backgrounds", count: kindCounts.BACKGROUND },
            { key: "ARCHETYPE", label: "Archetypes", count: kindCounts.ARCHETYPE },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setActiveKind(opt.key)}
            className={cn(
              "rounded-full px-2 py-0.5 font-medium transition-colors",
              activeKind === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>

      {/* Scrollable template list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No templates match.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => {
              const isEditing = t.id === editingTemplateId;
              return (
                <li key={t.id}>
                  <Link
                    href={`/sandbox/templates?edit=${t.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-3 py-2 text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {buTotal(t)} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{kindLabel(t.kind).replace(/s$/, "")}</span>
                      <span>·</span>
                      <span>{t.primitiveLinks.length} primitive{t.primitiveLinks.length === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{t.isPublic ? "Public" : "Draft"}</span>
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