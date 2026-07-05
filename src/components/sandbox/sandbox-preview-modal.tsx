"use client";

// =============================================================================
// SandboxPreviewModal — full-content preview modal for sandbox library rows.
//
// Renders the complete entity data when a user clicks a row in the sandbox
// left column. Replaces the previous "View in Library" CTA with full
// inline rendering of every field the row carries.
//
// Supports primitives, effects, capabilities, templates, and items.
// Each entity type has its own body renderer.
//
// The modal is dismissable via:
// - Close button (X)
// - Esc key
// - Backdrop click
// Body scroll lock while open.
// =============================================================================

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Entity types ----------------------------------------------------------

export type SandboxPrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean;
  costTier: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers?: unknown;
};

export type SandboxEffectRow = {
  id: string;
  name: string;
  narrativeDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export type SandboxCapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    role: string;
    quantity: number;
    sortOrder: number;
    slotLabel: string | null;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export type SandboxTemplateRow = {
  id: string;
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
  name: string;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: {
      id: string;
      name: string;
      type: string;
    };
  }>;
};

export type SandboxItemRow = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export type SandboxPreviewItem =
  | { kind: "primitive"; row: SandboxPrimitiveRow }
  | { kind: "effect"; row: SandboxEffectRow }
  | { kind: "capability"; row: SandboxCapabilityRow }
  | { kind: "template"; row: SandboxTemplateRow }
  | { kind: "item"; row: SandboxItemRow };

interface SandboxPreviewModalProps {
  item: SandboxPreviewItem | null;
  onClose: () => void;
  /**
   * Label of the primary action button. Defaults to "Load into Build".
   * Set to null to hide the action button entirely (e.g. for read-only previews).
   */
  primaryActionLabel?: string | null;
  onPrimaryAction?: () => void;
}

// ---- Modal shell -----------------------------------------------------------

export function SandboxPreviewModal({
  item,
  onClose,
  primaryActionLabel = "Load into Build",
  onPrimaryAction,
}: SandboxPreviewModalProps) {
  useEffect(() => {
    if (!item) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", handler);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sandbox-preview-title"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {kindHeading(item)}
            </p>
            <h2
              id="sandbox-preview-title"
              className="mt-1 truncate text-2xl font-semibold leading-tight"
            >
              {item.row.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 hover:bg-accent"
            aria-label="Close preview"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {item.kind === "primitive" ? (
            <PrimitiveBody row={item.row} />
          ) : item.kind === "effect" ? (
            <EffectBody row={item.row} />
          ) : item.kind === "capability" ? (
            <CapabilityBody row={item.row} />
          ) : item.kind === "template" ? (
            <TemplateBody row={item.row} />
          ) : (
            <ItemBody row={item.row} />
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Close
          </button>
          {primaryActionLabel !== null && onPrimaryAction ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

// ---- Body renderers --------------------------------------------------------

function PrimitiveBody({ row }: { row: SandboxPrimitiveRow }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {row.buCost} BU
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.category}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.costTier}
        </span>
        {row.isPublic ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
            Public
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Private
          </span>
        )}
      </div>

      {row.mechanicalOutputText ? (
        <Section heading="Mechanical output">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.mechanicalOutputText}
          </p>
        </Section>
      ) : null}

      {row.narrativeRule ? (
        <Section heading="Narrative rule">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.narrativeRule}
          </p>
        </Section>
      ) : null}

      {row.isMirrorable ? (
        <Section heading="Mirror">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
                {row.mirrorVector}
              </span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
                {row.mirrorBuCredit} BU credit
              </span>
            </div>
            {row.mirrorEligibilityNotes ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {row.mirrorEligibilityNotes}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {Array.isArray(row.hardModifiers) && row.hardModifiers.length > 0 ? (
        <Section heading={`Hard modifiers (${row.hardModifiers.length})`}>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
            {JSON.stringify(row.hardModifiers, null, 2)}
          </pre>
        </Section>
      ) : null}
    </div>
  );
}

function EffectBody({ row }: { row: SandboxEffectRow }) {
  const totalBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost * link.quantity,
    0,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {totalBu} BU
        </span>
        {row.sourceOrigin ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.sourceOrigin}
          </span>
        ) : null}
        {row.isPublic ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
            Public
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Private
          </span>
        )}
      </div>

      {row.narrativeDescription ? (
        <Section heading="Narrative description">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.narrativeDescription}
          </p>
        </Section>
      ) : null}

      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <Section heading={`Slotted primitives (${row.primitiveLinks.length})`}>
          <SlotPrimitiveList links={row.primitiveLinks} />
        </Section>
      ) : null}
    </div>
  );
}

function CapabilityBody({ row }: { row: SandboxCapabilityRow }) {
  const totalBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost * link.quantity,
    0,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {totalBu} BU
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.type}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.sourceType}
        </span>
        {row.sourceOrigin ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.sourceOrigin}
          </span>
        ) : null}
        {row.isPublic ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
            Public
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Private
          </span>
        )}
      </div>

      {row.verboseDescription ? (
        <Section heading="Description">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.verboseDescription}
          </p>
        </Section>
      ) : null}

      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <Section heading={`Primitive slots (${row.primitiveLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link, i) => (
              <li
                key={`${link.primitiveId}-${i}`}
                className="flex items-start gap-2 p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{link.primitive.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {link.primitive.category}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                      {link.role}
                    </span>
                    {link.quantity > 1 ? (
                      <span>× {link.quantity}</span>
                    ) : null}
                    {link.slotLabel ? (
                      <span className="italic">"{link.slotLabel}"</span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost * link.quantity} BU
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function TemplateBody({ row }: { row: SandboxTemplateRow }) {
  const primitiveBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost,
    0,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {primitiveBu} BU
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.kind}
        </span>
        {row.isPublic ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
            Public
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Private
          </span>
        )}
      </div>

      {row.description ? (
        <Section heading="Description">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.description}
          </p>
        </Section>
      ) : null}

      {row.suggestedTraits ? (
        <Section heading="Suggested traits">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.suggestedTraits}
          </p>
        </Section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <Section heading={`Bundled primitives (${row.primitiveLinks.length})`}>
          <SlotPrimitiveList links={row.primitiveLinks} />
        </Section>
      ) : null}

      {row.capabilityLinks.length > 0 ? (
        <Section heading={`Capabilities (${row.capabilityLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.capabilityLinks.map((link) => (
              <li
                key={link.capabilityId}
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
        </Section>
      ) : null}
    </div>
  );
}

function ItemBody({ row }: { row: SandboxItemRow }) {
  const primitiveBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost,
    0,
  );
  const totalBu = row.buCost + primitiveBu;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
          {totalBu} BU
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            rarityClassName(row.rarity),
          )}
        >
          {row.rarity}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          {row.itemType}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
          Slot {row.slotCost}
        </span>
        {row.isTwoHanded ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Two-handed
          </span>
        ) : null}
        {row.isConsumable ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Consumable
          </span>
        ) : null}
        {row.actsAsFocus ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Focus
          </span>
        ) : null}
        {row.sourceOrigin ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.sourceOrigin}
          </span>
        ) : null}
        {row.isPublic ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
            Public
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Private
          </span>
        )}
      </div>

      {row.description ? (
        <Section heading="Description">
          <p className="whitespace-pre-line text-sm leading-6 text-foreground">
            {row.description}
          </p>
        </Section>
      ) : null}

      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <Section heading={`Item-augment primitives (${row.primitiveLinks.length})`}>
          <SlotPrimitiveList links={row.primitiveLinks} />
        </Section>
      ) : null}
    </div>
  );
}

// ---- Shared helpers --------------------------------------------------------

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      {children}
    </section>
  );
}

function SlotPrimitiveList({
  links,
}: {
  links: Array<{
    primitiveId: number;
    quantity?: number;
    primitive: { name: string; category: string; buCost: number };
  }>;
}) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {links.map((link, i) => (
        <li
          key={`${link.primitiveId}-${i}`}
          className="flex items-center justify-between gap-2 p-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium">{link.primitive.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {link.primitive.category}
            </span>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {link.primitive.buCost * (link.quantity ?? 1)} BU
            {(link.quantity ?? 1) > 1 ? ` × ${link.quantity}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function kindHeading(item: SandboxPreviewItem): string {
  switch (item.kind) {
    case "primitive":
      return "Primitive";
    case "effect":
      return "Effect";
    case "capability":
      return `Capability · ${item.row.type}`;
    case "template":
      return `Template · ${item.row.kind}`;
    case "item":
      return `Item · ${item.row.itemType}`;
  }
}

function rarityClassName(rarity: string): string {
  switch (rarity) {
    case "COMMON":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "UNCOMMON":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "RARE":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "EPIC":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "LEGENDARY":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "bg-secondary";
  }
}