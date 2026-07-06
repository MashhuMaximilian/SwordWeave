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
// in either context. When the caller provides engagement data + onSubLink
// callbacks, the preview is interactive (likes, forks, clickable primitive
// links, version history). Without them, the preview is read-only.
// =============================================================================

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { ChevronRight, History, Link2 } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";

// ---- Entity types (mirrored from sandbox-preview-modal.tsx) ----------------

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

// ---- Engagement shape (optional) -------------------------------------------

export interface PreviewEngagement {
  likes: number;
  dislikes: number;
  forks: number;
  userReaction: "LIKE" | "DISLIKE" | null;
  authorId: string | null;
  authorUsername: string | null;
  currentUserInternalId: string | null;
}

// ---- Sub-link callbacks (optional) -----------------------------------------

/** Payload describing a sub-entity (primitive/capability) that was clicked
 *  inside the preview. The caller decides what to do — typically push a
 *  modal-stack entry so the navigation stays inside the open modal. */
export interface PreviewSubLink {
  targetType: "PRIMITIVE" | "CAPABILITY";
  targetId: string;
  label: string;
}

export interface PreviewCallbacks {
  /** Called when the user clicks a primitive / capability inside the
   *  composed-entities list. If unset, links fall back to plain <a> tags
   *  that navigate to /library/item/<TYPE>:<id>. */
  onSubLinkClick?: (link: PreviewSubLink) => void;
  /** Current engagement snapshot — when set, the preview shows like/fork
   *  controls, follow button, and the version-history link. */
  engagement?: PreviewEngagement;
  /** Optional version-history URL (defaults to /library/item/<TYPE>:<id>/versions). */
  versionHistoryHref?: string;
  /** Optional "Open source page" URL. When set, the preview footer
   *  shows this link next to the version-history link on the same row. */
  openSourceHref?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

export function previewHeadingLabel(item: SandboxPreviewItem): string {
  return sectionLabel(item);
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

// -----------------------------------------------------------------------------
// Hook: handles sub-link clicks. If the caller registered onSubLinkClick,
// push a new modal stack entry; otherwise return null and the caller should
// use a plain <a>.
// -----------------------------------------------------------------------------

function useSubLinkClick(cb: PreviewCallbacks["onSubLinkClick"]) {
  const stack = useModalStack();
  return useMemo(() => {
    return (link: PreviewSubLink) => {
      if (cb) {
        cb(link);
        return;
      }
      if (!stack.canPush) return;
      // Default: open a breadcrumb modal pointing at the canonical library
      // page for the sub-entity. We don't have a full preview body here, so
      // we link out instead — the canonical library page is the only place
      // with the full engagement UI.
      const url = `/library/item/${link.targetType}:${link.targetId}`;
      stack.push({
        key: `sublink:${link.targetType}:${link.targetId}`,
        label: link.label,
        category: link.targetType,
        content: (
          <div className="space-y-3 p-1">
            <p className="text-sm text-muted-foreground">
              {link.label} — full details open in a new modal. Tap below to
              navigate to the canonical library page.
            </p>
            <a
              href={url}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Link2 className="size-3.5" />
              Open in library
            </a>
          </div>
        ),
      });
    };
  }, [cb, stack]);
}

// -----------------------------------------------------------------------------
// Footer — engagement + version history. Rendered when callbacks are present.
// -----------------------------------------------------------------------------

function PreviewFooter({
  callbacks,
  targetType,
  targetId,
}: {
  item: SandboxPreviewItem;
  callbacks: PreviewCallbacks;
  targetType:
    | "PRIMITIVE"
    | "CAPABILITY"
    | "CHARACTER"
    | "ITEM"
    | "RACE_TEMPLATE"
    | "BACKGROUND_TEMPLATE"
    | "ARCHETYPE_TEMPLATE";
  targetId: string;
}) {
  const eng = callbacks.engagement;
  if (!eng) return null;

  const historyHref =
    callbacks.versionHistoryHref ??
    `/library/item/${targetType}:${targetId}/versions`;

  return (
    <footer className="mt-2 space-y-3 border-t border-border pt-3">
      <LikeForkBar
        targetType={targetType}
        targetId={targetId}
        initialLikes={eng.likes}
        initialDislikes={eng.dislikes}
        initialForks={eng.forks}
        initialUserReaction={eng.userReaction}
        authorId={eng.authorId}
        authorUsername={eng.authorUsername}
        currentUserId={eng.currentUserInternalId}
        compact
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Open source page is opt-in via callbacks. The sandbox preview
            bodies (grammar-library / blueprint-library) pass it; the
            /library/browse preview renders its own link elsewhere. */}
        {callbacks.openSourceHref ? (
          <a
            href={callbacks.openSourceHref}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Open source page →
          </a>
        ) : (
          <span />
        )}
        <a
          href={historyHref}
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="size-3.5" />
          Version history →
        </a>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Map SandboxPreviewItem -> (engagementTargetType, engagementTargetId, historyKey)
// -----------------------------------------------------------------------------

function engagementKeys(item: SandboxPreviewItem): {
  targetType:
    | "PRIMITIVE"
    | "CAPABILITY"
    | "ITEM"
    | "RACE_TEMPLATE"
    | "BACKGROUND_TEMPLATE"
    | "ARCHETYPE_TEMPLATE"
    | "EFFECT";
  targetId: string;
} {
  switch (item.kind) {
    case "primitive":
      return { targetType: "PRIMITIVE", targetId: String(item.row.id) };
    case "capability":
      return { targetType: "CAPABILITY", targetId: item.row.id };
    case "template":
      return {
        targetType:
          item.row.kind === "RACE"
            ? "RACE_TEMPLATE"
            : item.row.kind === "BACKGROUND"
              ? "BACKGROUND_TEMPLATE"
              : "ARCHETYPE_TEMPLATE",
        targetId: item.row.id,
      };
    case "item":
      return { targetType: "ITEM", targetId: item.row.id };
    case "effect":
      return { targetType: "EFFECT", targetId: item.row.id };
  }
}

// -----------------------------------------------------------------------------
// Main entry
// -----------------------------------------------------------------------------

export function LibraryItemPreview({
  item,
  callbacks,
}: {
  item: SandboxPreviewItem;
  callbacks?: PreviewCallbacks;
}) {
  const onSubLink = useSubLinkClick(callbacks?.onSubLinkClick);
  const { targetType, targetId } = engagementKeys(item);
  const body = (() => {
    switch (item.kind) {
      case "primitive":
        return <PrimitiveBody row={item.row} onSubLink={onSubLink} />;
      case "effect":
        return <EffectBody row={item.row} onSubLink={onSubLink} />;
      case "capability":
        return <CapabilityBody row={item.row} onSubLink={onSubLink} />;
      case "template":
        return <TemplateBody row={item.row} onSubLink={onSubLink} />;
      case "item":
        return <ItemBody row={item.row} onSubLink={onSubLink} />;
    }
  })();
  return (
    <div className="space-y-4">
      {body}
      {callbacks?.engagement && item.kind !== "effect" ? (
        <PreviewFooter
          item={item}
          callbacks={callbacks}
          targetType={targetType as Exclude<typeof targetType, "EFFECT">}
          targetId={targetId}
        />
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Body renderers
// -----------------------------------------------------------------------------

function PrimitiveBody({
  row,
  onSubLink,
}: {
  row: SandboxPrimitiveRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  return (
    <div className="space-y-4">
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

function EffectBody({
  row,
  onSubLink,
}: {
  row: SandboxEffectRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const totalBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost * link.quantity,
    0,
  );
  return (
    <div className="space-y-4">
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
        <Section heading={`Composed primitives (${row.primitiveLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link) => (
              <li
                key={link.primitiveId}
                className="flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSubLink({
                      targetType: "PRIMITIVE",
                      targetId: String(link.primitive.id),
                      label: link.primitive.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="font-semibold text-cyan-400 hover:underline">
                    {link.primitive.name}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {link.primitive.category}
                  </span>
                </button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost * link.quantity} BU
                  {link.quantity > 1 ? ` ×${link.quantity}` : ""}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function CapabilityBody({
  row,
  onSubLink,
}: {
  row: SandboxCapabilityRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const totalBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost * link.quantity,
    0,
  );
  return (
    <div className="space-y-4">
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
        <Section heading={`Composed primitives (${row.primitiveLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.primitiveLinks.map((link, i) => (
              <li
                key={`${link.primitiveId}-${i}`}
                className="flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSubLink({
                      targetType: "PRIMITIVE",
                      targetId: String(link.primitive.id),
                      label: link.primitive.name,
                    })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="font-semibold text-cyan-400 hover:underline">
                    {link.primitive.name}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{link.primitive.category}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                      {link.role.replace(/_/g, " ")}
                    </span>
                    {link.quantity > 1 ? <span>× {link.quantity}</span> : null}
                    {link.slotLabel ? (
                      <span className="italic">"{link.slotLabel}"</span>
                    ) : null}
                  </div>
                </button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost * link.quantity} BU
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function TemplateBody({
  row,
  onSubLink,
}: {
  row: SandboxTemplateRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const primitiveBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost,
    0,
  );
  return (
    <div className="space-y-4">
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
              <li
                key={link.primitiveId}
                className="flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSubLink({
                      targetType: "PRIMITIVE",
                      targetId: String(link.primitive.id),
                      label: link.primitive.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="font-semibold text-cyan-400 hover:underline">
                    {link.primitive.name}
                  </span>
                </button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost} BU
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {row.capabilityLinks.length > 0 ? (
        <Section heading={`Bundled capabilities (${row.capabilityLinks.length})`}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {row.capabilityLinks.map((link) => (
              <li
                key={link.capabilityId}
                className="flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSubLink({
                      targetType: "CAPABILITY",
                      targetId: link.capability.id,
                      label: link.capability.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="font-semibold text-cyan-400 hover:underline">
                    {link.capability.name}
                  </span>
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {link.capability.type}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function ItemBody({
  row,
  onSubLink,
}: {
  row: SandboxItemRow;
  onSubLink: (link: PreviewSubLink) => void;
}) {
  const primitiveBu = row.primitiveLinks.reduce(
    (sum, link) => sum + link.primitive.buCost,
    0,
  );
  const totalBu = row.buCost + primitiveBu;
  return (
    <div className="space-y-4">
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
              <li
                key={link.primitiveId}
                className="flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSubLink({
                      targetType: "PRIMITIVE",
                      targetId: String(link.primitive.id),
                      label: link.primitive.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="font-semibold text-cyan-400 hover:underline">
                    {link.primitive.name}
                  </span>
                </button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {link.primitive.buCost} BU
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
