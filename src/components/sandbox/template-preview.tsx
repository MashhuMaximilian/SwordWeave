// Read-only template card used in the SandboxLayout Preview column.
// Same visual language as /library/item/[id] TemplateDetail, but stripped
// of engagement (likes/forks), authorship metadata, and edit affordances —
// this is a pure preview, not a destination page.

import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
};

type TemplateRow = {
  id: string;
  kind: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  primitiveLinks: Array<{ primitiveId: number; primitive: PrimitiveRow }>;
  capabilityLinks?: Array<{ capabilityId: string; capability: CapabilityRow }>;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

function kindLabel(kind: string): string {
  if (kind === "RACE") return "Lineage";
  if (kind === "BACKGROUND") return "Upbringing";
  if (kind === "ARCHETYPE") return "Manifest";
  return kind;
}

function totalBu(row: TemplateRow): number {
  return row.primitiveLinks.reduce(
    (sum, link) => sum + (link.primitive?.buCost ?? 0),
    0,
  );
}

export function TemplatePreview({ row }: { row: TemplateRow }) {
  const bu = totalBu(row);
  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        {/* Phase 8: entity icon above the title. */}
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
          {kindLabel(row.kind)} Template
        </p>
        <h2 className="text-2xl font-semibold leading-tight">{row.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {bu} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.primitiveLinks.length} primitive
            {row.primitiveLinks.length === 1 ? "" : "s"}
          </span>
          {row.capabilityLinks && row.capabilityLinks.length > 0 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {row.capabilityLinks.length} capabilit
              {row.capabilityLinks.length === 1 ? "y" : "ies"}
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

      {row.imageUrl ? (
        <img
          src={row.imageUrl}
          alt={row.name}
          className="w-full max-w-md rounded-md border"
        />
      ) : null}

      {row.description ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Description
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{row.description}</Markdown>
          </div>
        </section>
      ) : null}

      {row.suggestedTraits ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Suggested traits
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{row.suggestedTraits}</Markdown>
          </div>
        </section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Bundled primitives ({row.primitiveLinks.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {row.primitiveLinks.map((link) => (
              <li
                key={`${row.id}-${link.primitiveId}`}
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

      {row.capabilityLinks && row.capabilityLinks.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Bundled capabilities ({row.capabilityLinks.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {row.capabilityLinks.map((link) => (
              <li
                key={`${row.id}-${link.capabilityId}`}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {link.capability.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {link.capability.type}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function TemplatePreviewEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          No template selected
        </p>
        <p className="text-xs text-muted-foreground">
          Pick a template from the Library to preview it here, or create a new
          one in the Build tab.
        </p>
      </div>
    </div>
  );
}