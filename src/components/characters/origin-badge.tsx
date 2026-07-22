"use client";

// =============================================================================
// OriginBadge — Phase 8.1 batch 13.1
//
// Renders a small text badge showing where a primitive / capability came
// from when it was bundled via a heritage → capability → effect chain.
// Per Mashu 2026-07-22: "technically you only buy primitives.
// Capabilities are ways to compile those primitives for easy access.
// Thus primitives in capabilities and effects inside capabilities
// have to be shown in ch sheet and builder. And calculated properly."
//
// The badge surfaces the container chain so the player can see at a
// glance "this primitive came from capability 'Fireball' which I got
// via lineage 'Elf'".
//
// Pure presentational. The container names are passed in by the parent
// (which has access to the heritage/capability/effect metadata); the
// badge itself doesn't do its own DB lookup.
// =============================================================================

import { Layers } from "lucide-react";

export interface OriginBadgeProps {
  /** Display labels for the chain, most-specific first. */
  chain: Array<{ kind: "heritage" | "capability" | "effect"; name: string }>;
  /** Optional override for the source tab. */
  source?: string | null;
}

export function OriginBadge({ chain, source }: OriginBadgeProps) {
  if (chain.length === 0) return null;
  const tail = chain.map((c) => c.name).join(" → ");
  const tooltip = chain.map((c) => `${c.kind}: ${c.name}`).join("\n");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
      title={tooltip + (source ? `\nsource: ${source}` : "")}
      aria-label={`Origin: ${tail}`}
    >
      <Layers className="size-3" aria-hidden="true" />
      <span className="truncate">{tail}</span>
    </span>
  );
}