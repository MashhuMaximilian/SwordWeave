// Read-only capability card used in the SandboxLayout Preview column.

import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
};

type CapabilityPrimitiveLink = {
  primitiveId: number;
  role: string;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  primitive: PrimitiveRow;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string | null;
  tags: string[] | null;
  isPublic: boolean;
  primitiveLinks: CapabilityPrimitiveLink[];
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

function totalBu(row: CapabilityRow): number {
  return row.primitiveLinks.reduce(
    (sum, link) => sum + (link.primitive?.buCost ?? 0) * link.quantity,
    0,
  );
}

export function CapabilityPreview({ row }: { row: CapabilityRow }) {
  const bu = totalBu(row);
  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        {/* Phase 8: entity icon above the title. Falls back to nothing
            when no icon is set so the layout doesn't shift. */}
        {row.iconSource ? (
          <IconDisplay
            iconSource={row.iconSource as "GAME_ICONS" | "UPLOAD"}
            iconKey={row.iconKey}
            iconUrl={row.iconUrl}
            iconColor={row.iconColor}
            size={56}
            className="rounded-md border border-border"
            alt={row.name}
          />
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {row.type} Capability
        </p>
        <h2 className="text-2xl font-semibold leading-tight">{row.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {bu} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.sourceType}
          </span>
          {row.tags && row.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {row.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
          <span
            className={
              "rounded-full px-2 py-0.5 font-medium " +
              (row.isPublic
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
            }
          >
            {row.isPublic ? "Public" : "Draft"}
          </span>
        </div>
      </header>

      {row.verboseDescription ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Description
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{row.verboseDescription}</Markdown>
          </div>
        </section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Composition ({row.primitiveLinks.length} slot
            {row.primitiveLinks.length === 1 ? "" : "s"})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {row.primitiveLinks
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((link) => (
                <li
                  key={`${row.id}-${link.primitiveId}-${link.role}`}
                  className="flex items-center justify-between gap-2 p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {link.primitive.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {link.role}
                      {link.slotLabel ? ` · ${link.slotLabel}` : ""}
                      {link.quantity > 1 ? ` · ×${link.quantity}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {(link.primitive.buCost ?? 0) * link.quantity} BU
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function CapabilityPreviewEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          No capability selected
        </p>
        <p className="text-xs text-muted-foreground">
          Pick a capability from the Library to preview it here, or build a
          new one in the Build tab.
        </p>
      </div>
    </div>
  );
}