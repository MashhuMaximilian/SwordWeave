"use client";

// =============================================================================
// LibraryItemPreview — full-content preview for any library entity
// (primitive, effect, capability, template, item).
//
// Renders the canonical, fully-detailed view used in both the sandbox left
// column's modal stack AND the library's row click. The previous version of
// the sandbox used a stripped-down body that didn't show BU totals, didn't
// render markdown, and had dead (non-clickable) primitive links — this is
// the unified replacement.
//
// Can be rendered:
//   - Standalone via <SandboxPreviewModal> (own chrome + close + actions)
//   - Inline inside a ModalStack (chrome provided by the stack)
//
// The body is plain React — no side-effects, no chrome — so it can be reused
// in either context.
// =============================================================================

import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

// ---- Entity types (mirrored from sandbox-preview-modal.tsx) ----------------
//
// We re-declare the types here (rather than importing) so the preview is
// usable from any context without forcing a transitive dep on the modal
// shell. Keep these in sync with sandbox-preview-modal.tsx.

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

// ---- Helpers ---------------------------------------------------------------

/**
 * Resolve a clickable URL for an entity reference. The canonical detail
 * page lives at /library/item/[id] and expects a composite
 * `<TYPE>:<id>` string. We link primitives, capabilities, templates,
 * and items through that route; effects currently don't have a
 * per-item detail page so we deep-link into the library browse with a
 * name search instead.
 */
function primitiveHref(primitiveId: number | string): string {
  return `/library/item/PRIMITIVE:${primitiveId}`;
}

function capabilityHref(capabilityId: string): string {
  return `/library/item/CAPABILITY:${capabilityId}`;
}

function sectionLabel(item: SandboxPreviewItem): string {
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

function VisibilityPill({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
      Public
    </span>
  ) : (
    <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
      Private
    </span>
  );
}

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

function PrimitiveLinkRow({
  primitive,
  quantity = 1,
  extra,
}: {
  primitive: { id: number; name: string; category: string; buCost: number };
  quantity?: number;
  extra?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 p-2 text-sm">
      <div className="min-w-0 flex-1">
        <a
          href={primitiveHref(primitive.id)}
          className="font-medium text-cyan-400 underline-offset-2 hover:underline"
        >
          {primitive.name}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{primitive.category}</span>
          {extra}
        </div>
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {primitive.buCost * quantity} BU
        {quantity > 1 ? ` × ${quantity}` : ""}
      </span>
    </li>
  );
}

// ---- Main entry: dispatches to the right body ------------------------------

export function LibraryItemPreview({ item }: { item: SandboxPreviewItem }) {
  switch (item.kind) {
    case "primitive":
      return <PrimitiveBody row={item.row} />;
    case "effect":
      return <EffectBody row={item.row} />;
    case "capability":
      return <CapabilityBody row={item.row} />;
    case "template":
      return <TemplateBody row={item.row} />;
    case "item":
      return <ItemBody row={item.row} />;
  }
}

/** Header label for the preview, exposed for callers that wrap it. */
export function previewHeadingLabel(item: SandboxPreviewItem): string {
  return sectionLabel(item);
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
        <VisibilityPill isPublic={row.isPublic} />
      </div>

      {row.mechanicalOutputText ? (
        <Section heading="Mechanical output">
          <Markdown>{row.mechanicalOutputText}</Markdown>
        </Section>
      ) : null}

      {row.narrativeRule ? (
        <Section heading="Narrative rule">
          <Markdown>{row.narrativeRule}</Markdown>
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
        <VisibilityPill isPublic={row.isPublic} />
      </div>

      {row.narrativeDescription ? (
        <Section heading="Narrative description">
          <Markdown>{row.narrativeDescription}</Markdown>
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
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => (
              <PrimitiveLinkRow
                key={link.primitiveId}
                primitive={link.primitive}
                quantity={link.quantity}
              />
            ))}
          </ul>
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
        <VisibilityPill isPublic={row.isPublic} />
      </div>

      {row.verboseDescription ? (
        <Section heading="Description">
          <Markdown>{row.verboseDescription}</Markdown>
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
                  <a
                    href={primitiveHref(link.primitive.id)}
                    className="font-medium text-cyan-400 underline-offset-2 hover:underline"
                  >
                    {link.primitive.name}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{link.primitive.category}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                      {link.role}
                    </span>
                    {link.quantity > 1 ? <span>× {link.quantity}</span> : null}
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
        <VisibilityPill isPublic={row.isPublic} />
      </div>

      {row.description ? (
        <Section heading="Description">
          <Markdown>{row.description}</Markdown>
        </Section>
      ) : null}

      {row.suggestedTraits ? (
        <Section heading="Suggested traits">
          <Markdown>{row.suggestedTraits}</Markdown>
        </Section>
      ) : null}

      {row.primitiveLinks.length > 0 ? (
        <Section heading={`Bundled primitives (${row.primitiveLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => (
              <PrimitiveLinkRow
                key={link.primitiveId}
                primitive={link.primitive}
              />
            ))}
          </ul>
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
                <a
                  href={capabilityHref(link.capability.id)}
                  className="min-w-0 flex-1 truncate font-medium text-cyan-400 underline-offset-2 hover:underline"
                >
                  {link.capability.name}
                </a>
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
        <VisibilityPill isPublic={row.isPublic} />
      </div>

      {row.description ? (
        <Section heading="Description">
          <Markdown>{row.description}</Markdown>
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
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => (
              <PrimitiveLinkRow
                key={link.primitiveId}
                primitive={link.primitive}
              />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
