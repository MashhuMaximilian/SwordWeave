// Library column for /sandbox/capabilities — searchable, type-filterable list.

"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PrimitiveLink = { primitive: { buCost: number } };
type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  isPublic: boolean;
  primitiveLinks: PrimitiveLink[];
};

function totalBu(row: CapabilityRow): number {
  return row.primitiveLinks.reduce(
    (sum, link) => sum + (link.primitive?.buCost ?? 0),
    0,
  );
}

export function CapabilitiesLibrary({
  capabilities,
  editingCapabilityId,
}: {
  capabilities: CapabilityRow[];
  editingCapabilityId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<string>("ALL");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const c of capabilities) set.add(c.type);
    return ["ALL", ...Array.from(set).sort()];
  }, [capabilities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capabilities.filter((c) => {
      const typeOk = activeType === "ALL" || c.type === activeType;
      if (!typeOk) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
    });
  }, [capabilities, query, activeType]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search capabilities…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2 text-xs">
        {types.map((type) => {
          const count =
            type === "ALL"
              ? capabilities.length
              : capabilities.filter((c) => c.type === type).length;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              className={cn(
                "rounded-full px-2 py-0.5 font-medium transition-colors",
                activeType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {type === "ALL" ? "All" : type} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No capabilities match.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => {
              const isEditing = c.id === editingCapabilityId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/sandbox/capabilities?edit=${c.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-3 py-2 text-sm transition-colors hover:bg-accent",
                      isEditing && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {totalBu(c)} BU
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{c.type}</span>
                      <span>·</span>
                      <span>{c.primitiveLinks.length} slot{c.primitiveLinks.length === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{c.isPublic ? "Public" : "Draft"}</span>
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