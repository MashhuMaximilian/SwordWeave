"use client";

// =============================================================================
// EntityPreview — THE unified preview for every SwordWeave entity, rendered
// identically in My Creations, Library, the Atelier sandbox library, and the
// Atelier build-modal preview tab.
//
// variant:
//   "read"  — full surface (header + sections + engagement footer w/ like /
//             fork / version history). Used by library, creations, sandbox.
//   "build" — same body, but the action footer is replaced by Save + Reset
//             (the build modal owns those) and engagement controls are hidden.
//
// The body is a single source of truth. No more per-surface drift: the
// modifiers render as structured cards with a color-coded OperationBadge,
// the "When:" condition line (AND/OR pills), and a MirrorPanel that shows
// the inverse operation. The legacy `mirrorVector` string is intentionally
// NOT displayed.
// =============================================================================

import { type ReactNode } from "react";
import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { ChevronRight, History, Link2 } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  OperationBadge,
  Section,
  VersionChip,
  VisibilityPill,
  ConditionLine,
  MirrorPanel,
  opLabel,
  mirrorSummary,
  PreviewActions,
  type PreviewActionProps,
  type PreviewSubLink,
  type PreviewCallbacks,
} from "./preview-shared";
export type { PreviewActionProps } from "./preview-shared";
import {
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
  type SandboxTemplateRow,
  type SandboxItemRow,
  libraryCompositeId,
} from "@/components/library/library-item-preview";

// Prettify a stored modifier value. The primitive form persists values in a
// compact syntax like `behavior:/240/[ft]` (target : value : unit). Render it
// humanly as `240 ft` so the preview reads cleanly instead of dumping the raw
// string. Falls back to the raw value for anything it doesn't recognise.
function prettifyModifierValue(raw: string): string {
  const trimmed = raw.trim();
  // Pattern: <target>:/<value>/[<unit>]  e.g. behavior:/240/[ft]
  // Tolerant of stray whitespace (some stored values are
  // `behavior:/240/ [ft]` with a space before the unit bracket).
  const m = /^[^:]+:\s*\/([^/]+)\/\s*(?:\[([^\]]*)\])?\s*$/.exec(trimmed);
  if (m) {
    const value = m[1]?.trim() ?? "";
    const unit = m[2]?.trim() ?? "";
    return unit ? `${value} ${unit}` : value;
  }
  return trimmed;
}

export type EntityPreviewVariant = "read" | "build";

export type EntityPreviewOwner = {
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  isOwner: boolean;
  /** Profile page URL (e.g. /u/username). When set, the author name +
   *  avatar become a link to the profile. */
  profileHref?: string | null;
  /** Optional "Source: <origin>" pill rendered on the right of the
   *  owner row. Carries the same value as the build-edit "Source
   *  origin" field (world, book, setting). */
  sourceOrigin?: string | null;
};

export type EntityPreviewActions = {
  onEdit?: () => void;
  onDelete?: () => void;
  openSourceHref?: string;
  versionHistoryHref?: string;
};

export interface EntityPreviewProps {
  item: SandboxPreviewItem;
  variant?: EntityPreviewVariant;
  callbacks?: PreviewCallbacks | undefined;
  /**
   * Ownership + author metadata. When provided, the preview shows the
   * owner ("by @user") with avatar, and — if `isOwner` — the
   * owner highlight. Keeps the action bar identical across every
   * surface (creations, library, sandbox, atelier).
   */
  owner?: EntityPreviewOwner | undefined;
  /**
   * Action bar (Edit / Open source / Version history / Delete). Every
   * preview surface renders the SAME row in the SAME order so the modal
   * looks identical regardless of where it was opened from.
   */
  actions?: EntityPreviewActions;
  /**
   * Full set of action-bar props (Edit / Source / Versions / Delete /
   * visibility). When provided, THE SAME shared `PreviewActions` bar is
   * rendered as in My Creations — guaranteeing identical layout/order
   * across every surface. Prefer passing `actions` (the higher-level
   * object) over the deprecated individual fields below.
   */
  actionBar?: PreviewActionProps | undefined;
  /** build variant only: Save / Reset handlers + labels. */
  onSave?: () => void;
  onReset?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  isDirty?: boolean;
  /**
   * Live build draft modifiers (primitive form). When provided AND the
   * item is a primitive, the modifier cards render from this (richer:
   * equations, scope, structured conditions) instead of the stored
   * `row.hardModifiers`. Keeps the build-modal preview identical to the
   * library one while still showing the live draft.
   */
  buildModifiers?: Array<Record<string, unknown>>;
}

// ---- per-kind section label ------------------------------------------------

function sectionLabel(item: SandboxPreviewItem): string {
  switch (item.kind) {
    case "primitive":
      return "Primitive";
    case "effect":
      return "Effect";
    case "capability":
      return `Capability · ${item.row.type}`;
    case "heritage":
      return `Template · ${item.row.kind}`;
    case "item":
      return `Item · ${item.row.itemType}`;
  }
}

// ---- icon header tile -------------------------------------------------------

function IconTile({ row }: { row: { iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string; fallback: string } }) {
  if (row.iconSource) {
    return (
      <IconDisplay
        iconSource={row.iconSource as "GAME_ICONS" | "UPLOAD"}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        size={40}
        className="shrink-0 rounded-md border border-border"
        alt=""
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      {row.fallback}
    </div>
  );
}

// ---- composed-entity drill-down list (primitives/effects/caps/items) -------

function ComposedList({
  title,
  items,
  onSubLink,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    meta?: ReactNode;
    bu: number;
    versionNumber?: number | null | undefined;
    subText?: ReactNode;
    note?: string | null;
  }>;
  onSubLink?: (link: PreviewSubLink) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Section heading={title}>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((it) => (
          <li
            key={it.id}
            role={onSubLink ? "button" : undefined}
            tabIndex={onSubLink ? 0 : undefined}
            onClick={
              onSubLink
                ? () =>
                    onSubLink({
                      targetType: "PRIMITIVE",
                      targetId: it.id,
                      label: it.name,
                    })
                : undefined
            }
            onKeyDown={
              onSubLink
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSubLink!({ targetType: "PRIMITIVE", targetId: it.id, label: it.name });
                    }
                  }
                : undefined
            }
            className={onSubLink ? "flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-accent/40 cursor-pointer" : "flex items-center justify-between gap-2 p-2.5 text-sm"}
          >
            <div className="min-w-0 flex-1 truncate text-left">
              <VersionChip versionNumber={it.versionNumber} />
              <span className="font-semibold text-foreground hover:underline">{it.name}</span>
              {it.subText ? <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{it.subText}</div> : null}
              {it.note ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.note}</div> : null}
            </div>
            <span className="shrink-0 font-mono text-xs text-foreground">{it.bu} BU</span>
            {onSubLink ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- primitive modifier cards ----------------------------------------------

function ModifierCards({
  row,
  buildModifiers,
}: {
  row: SandboxPrimitiveRow;
  buildModifiers?: Array<Record<string, unknown>> | undefined;
}) {
  // Live build draft (from the primitive form) carries the rich ModifierDraft
  // shape: target, operation, value, valueKind, operands (for equations),
  // targetValues / freeTextNarrowFocus (scope), v1Condition, stacking. The
  // stored SandboxPrimitiveRow.hardModifiers is the legacy v1 shape
  // {operation,target,value,condition,stacking}. We render both through one
  // card so the library preview and the build-modal preview are identical.
  type Card = {
    op: string;
    target: string;
    valueLine: React.ReactNode;
    stacking: string;
    condition?: unknown;
    scope?: React.ReactNode;
  };

  const cards: Card[] = (buildModifiers ?? (row.hardModifiers as Array<Record<string, unknown>> | undefined) ?? []).map((m, i): Card => {
    const op = String(m["operation"] ?? "add");
    const target = String(m["target"] ?? "")
      .split(".")
      .pop() ?? String(m["target"] ?? "");
    const stacking = String(m["stacking"] ?? "stack");

    // Rich draft value rendering (equation / text / number) — mirrors the
    // build-modal's modifierBlock.
    let valueLine: React.ReactNode;
    const valueKind = m["valueKind"] as string | undefined;
    const operands = m["operands"] as Array<Record<string, unknown>> | undefined;
    if (valueKind === "equation" && Array.isArray(operands)) {
      const eqText = operands
        .map((o) => String(o["text"] ?? o["value"] ?? ""))
        .join(" ");
      valueLine = (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
          {eqText || "(empty)"}
        </code>
      );
    } else if (valueKind === "text") {
      valueLine = (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
          {`"${String(m["value"] ?? "")}"`}
        </code>
      );
    } else {
      const raw =
        m["value"] === undefined || m["value"] === null
          ? null
          : m["value"];
      const v = typeof raw === "number"
        ? String(raw)
        : raw === null
          ? "0"
          : prettifyModifierValue(String(raw));
      valueLine = (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{v}</code>
      );
    }

    // Scope (targetValues / freeTextNarrowFocus) — only present in the draft.
    const tv = (m["targetValues"] as string[] | undefined) ?? [];
    const narrow = String(m["freeTextNarrowFocus"] ?? "");
    let scope: React.ReactNode = null;
    if (tv.length > 0 || narrow.length > 0) {
      scope = (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Scope:</span>
          {tv.length > 0
            ? tv.map((v) => (
                <span key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  {v}
                </span>
              ))
            : (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-amber-700 dark:text-amber-400">any</span>
            )}
          {narrow ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono italic">{narrow}</span>
          ) : null}
        </div>
      );
    }

    // The condition prop is passed as-is; the shared parseCondition
    // (inside ConditionLine) understands every stored shape: legacy
    // {key,operator,value}, v1 {kind:"preset"|"tags"|"compound"|
    // "narrative"}, and the build-form {pills,operators,narrative}.
    const condition = m["condition"];

    return { op, target, valueLine, stacking, scope, condition };
  });

  if (cards.length === 0) return null;
  return (
    <Section heading="Modifier">
      <ul className="rounded-md border">
        {cards.map((c, i) => {
          const op = c.op as Parameters<typeof OperationBadge>[0]["op"];
          const mirror = mirrorSummary(op);
          return (
            <li key={i} className="space-y-1 border-b border-border p-2 text-sm last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-mono text-xs font-semibold">{c.target}</span>
                <OperationBadge op={op} />
                {c.valueLine}
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                  {c.stacking}
                </span>
              </div>
              {c.scope}
              <ConditionLine
                condition={c.condition}
              />
              <p className={`text-[10px] leading-relaxed ${mirror.mirrorable ? "text-cyan-700 dark:text-cyan-300" : "text-muted-foreground"}`}>
                {mirror.mirrorable ? "📊 " : "🔒 "}
                {mirror.label}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---- main -------------------------------------------------------------------

export function EntityPreview({
  item,
  variant = "read",
  callbacks,
  onSave,
  onReset,
  saveLabel = "Save changes",
  resetLabel = "Reset",
  isDirty = false,
  buildModifiers,
  owner,
  actions,
  actionBar,
}: EntityPreviewProps) {
  const stack = useModalStack();
  const onSubLink = (link: PreviewSubLink) => {
    if (callbacks?.onSubLinkClick) {
      callbacks.onSubLinkClick(link);
      return;
    }
    if (!stack.canPush) return;
    const url = `/library/item/${link.targetType}:${link.targetId}`;
    stack.push({
      key: `sublink:${link.targetType}:${link.targetId}`,
      label: link.label,
      category: link.targetType,
      content: (
        <div className="space-y-3 p-1">
          <p className="text-sm text-muted-foreground">{link.label} — full details open in a new modal.</p>
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

  const body = (() => {
    switch (item.kind) {
      case "primitive":
        return <PrimitiveBody row={item.row} onSubLink={onSubLink} buildModifiers={buildModifiers} />;
      case "effect":
        return <EffectBody row={item.row} onSubLink={onSubLink} />;
      case "capability":
        return <CapabilityBody row={item.row} onSubLink={onSubLink} />;
      case "heritage":
        return <TemplateBody row={item.row} onSubLink={onSubLink} />;
      case "item":
        return <ItemBody row={item.row} onSubLink={onSubLink} />;
    }
  })();

  // Derive owner from engagement when the caller didn't pass `owner`
  // explicitly. In the Atelier + library previews the engagement snapshot
  // always carries author info, so this guarantees the author line shows
  // (clickable → profile) even when the `owner` prop is omitted.
  //
  // `sourceOrigin` is pulled from `item.row.sourceOrigin` so the "Source:
  // <origin>" pill in the owner row always reflects the same value the
  // build-edit form uses — Phase 9 round-3.
  const rowSourceOrigin =
    "row" in item && item.row && typeof item.row === "object" && "sourceOrigin" in item.row
      ? (item.row as { sourceOrigin?: string | null }).sourceOrigin ?? null
      : null;
  // Phase 9 round 5 (post-feedback): the admin mask now also fires
  // when the row's sourceOrigin === "system" — the legacy stock
  // corpus has dirty user_ids (stamped with the current user's
  // clerk id during unrelated edits) so authorIsAdmin doesn't fire
  // for those rows. The sourceOrigin column is the only honest
  // signal that the row belongs to the corpus. Audit trail
  // (authorId) is still set so internal tooling can trace edits.
  const eng = callbacks?.engagement;
  const isAdminAuthor = eng?.authorIsAdmin === true;
  const isLegacySystemRow = rowSourceOrigin === "system";
  const maskAuthor =
    isAdminAuthor ||
    isLegacySystemRow ||
    !eng?.authorUsername;
  const effectiveAuthorUsername = maskAuthor ? null : eng?.authorUsername;

  const resolvedOwner: EntityPreviewOwner | undefined =
    owner
      ? { ...owner, sourceOrigin: owner.sourceOrigin ?? rowSourceOrigin }
      : effectiveAuthorUsername
      ? {
          authorId: eng?.authorId ?? null,
          authorUsername: effectiveAuthorUsername,
          authorDisplayName: effectiveAuthorUsername,
          authorAvatarUrl: null,
          isOwner:
            !!eng?.authorId &&
            eng.authorId === eng?.currentUserInternalId,
          profileHref: `/u/${effectiveAuthorUsername}`,
          sourceOrigin: rowSourceOrigin,
        }
      : callbacks?.engagement // engagement exists but no author username (or admin author)
      ? {
          authorId: null,
          authorUsername: null,
          authorDisplayName: null,
          authorAvatarUrl: null,
          isOwner: false,
          profileHref: null,
          sourceOrigin: rowSourceOrigin,
        }
      : rowSourceOrigin
      ? {
          authorId: null,
          authorUsername: null,
          authorDisplayName: null,
          authorAvatarUrl: null,
          isOwner: false,
          profileHref: null,
          sourceOrigin: rowSourceOrigin,
        }
      : undefined;

  const footer =
    variant === "build"
      ? onSave || onReset
        ? (
          <div className="mt-2 flex items-center gap-2 border-t border-border px-1 pb-4 pt-4">
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saveLabel}
              </button>
            ) : null}
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                {resetLabel}
              </button>
            ) : null}
          </div>
        )
        : null
      : (
        <>

          {callbacks?.engagement ? <PreviewFooter callbacks={callbacks} item={item} /> : null}
          {actionBar ? <PreviewActions {...actionBar} /> : null}
        </>
      );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {body}
        {/* OwnerBar MOVED OUT of the body area — it now lives between the
            scrollable content and the footer (just above the like bar)
            so the entity name + creator tag sit immediately above the
            engagement metrics. Phase 9 user-feedback: 'you need to move
            the user in preview to be lower not above the picture, low,
            above the like for bar'. */}
      </div>
      {resolvedOwner ? <OwnerBar owner={resolvedOwner} /> : null}
      {footer}
    </div>
  );
}
// ---- owner + action bars (identical across every surface) -----------------

function OwnerBar({ owner }: { owner: NonNullable<EntityPreviewProps["owner"]> }) {
  // Phase 9 user-feedback: when there's no Clerk user attached (system-
  // authored content like the stock "Verb Access Tier I" or "Domain of
  // Storm" primitives) render "by System" instead of returning null —
  // the user wants to see the creator tag even when it's the system, not
  // a hidden gap.
  const hasAuthor =
    !!owner.authorUsername || !!owner.authorDisplayName;
  const display = hasAuthor
    ? owner.authorDisplayName || owner.authorUsername || "unknown"
    : "System";
  // Profile usernames are handles (e.g. "mashu"). If a Clerk-style ID
  // ever slips in, don't render it as the handle — show the display name
  // and only build a profile link from a real-looking username.
  const isId = !!owner.authorUsername && /^user_|usr_/i.test(owner.authorUsername);
  const handle = !hasAuthor ? null : isId ? null : owner.authorUsername;
  const profileHref = handle ? `/u/${handle}` : null;
  // Generated avatar fallback when no uploaded picture exists. For system
  // entries we use a neutral seed so the avatar is consistent across
  // every system-authored row (instead of "unknown" / random initials).
  const fallbackAvatar = hasAuthor
    ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(display)}&backgroundType=gradientLinear&radius=50`
    : `https://api.dicebear.com/9.x/initials/svg?seed=SwordWeave%20System&backgroundType=gradientLinear&radius=50`;
  const avatar = owner.authorAvatarUrl || fallbackAvatar;
  const inner = (
    <>
      <img src={avatar} alt="" className="size-5 rounded-full" />
      <span>
        by{" "}
        <span className="font-semibold text-foreground">{display}</span>
        {handle ? <span className="ml-1 text-muted-foreground">@{handle}</span> : null}
      </span>
      {owner.isOwner ? (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
          you
        </span>
      ) : null}
    </>
  );
  return (
    // Phase 9 round-3: `pt-2` adds a touch of breathing room above the
    // owner row so it doesn't visually hug the body content (user:
    // 'User is good just a bit of more padding top'). When sourceOrigin
    // is set, a small "Source: <origin>" pill renders on the right so
    // the user can see which world/book the entity comes from at a
    // glance — same data as the build-edit "Source origin" field.
    // Phase 9 round-11: user reported 'in preview in atelier we need
    // just a bit of margin top above where the creator is. The border
    // top or whatever that is is too close to the thing above it'.
    // pt-2 → pt-4 for one more breath between the body content and
    // the creator tag.
    <div className="flex items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
      {profileHref ? (
        <a href={profileHref} className="flex items-center gap-2 hover:underline">
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-2">{inner}</div>
      )}
      {owner.sourceOrigin ? (
        <span
          className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground"
          title={owner.sourceOrigin}
        >
          Source: {owner.sourceOrigin}
        </span>
      ) : null}
    </div>
  );
}

// ---- footer (read variant) --------------------------------------------------

function PreviewFooter({
  callbacks,
  item,
}: {
  callbacks: PreviewCallbacks;
  item: SandboxPreviewItem;
}) {
  const eng = callbacks.engagement!;
  const { targetType, targetId } = engagementKeys(item);
  return (
    <footer className="mt-2 space-y-4 px-1 pb-6 pt-4">
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
        sandboxPath={callbacks.sandboxPath}
        onFork={callbacks.onFork}
      />
    </footer>
  );
}

function engagementKeys(item: SandboxPreviewItem): {
  targetType:
    | "PRIMITIVE"
    | "EFFECT"
    | "CAPABILITY"
    | "ITEM"
    | "LINEAGE_TEMPLATE"
    | "UPBRINGING_TEMPLATE"
    | "MANIFEST_TEMPLATE";
  targetId: string;
} {
  switch (item.kind) {
    case "primitive":
      return { targetType: "PRIMITIVE", targetId: String(item.row.id) };
    case "capability":
      return { targetType: "CAPABILITY", targetId: item.row.id };
    case "heritage":
      return {
        targetType:
          item.row.kind === "LINEAGE"
            ? "LINEAGE_TEMPLATE"
            : item.row.kind === "UPBRINGING"
              ? "UPBRINGING_TEMPLATE"
              : "MANIFEST_TEMPLATE",
        targetId: item.row.id,
      };
    case "item":
      return { targetType: "ITEM", targetId: item.row.id };
    case "effect":
      return { targetType: "EFFECT", targetId: item.row.id };
  }
}

// ---- per-kind bodies --------------------------------------------------------

function PrimitiveBody({
  row,
  onSubLink,
  buildModifiers,
}: {
  row: SandboxPrimitiveRow;
  onSubLink: (link: PreviewSubLink) => void;
  buildModifiers?: Array<Record<string, unknown>> | undefined;
}) {
  return (
    <div className="space-y-4">
      <Header
        fallback="PRI"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={row.category}
        chips={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{row.buCost} BU</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.costTier}</span>
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
      />
      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      ) : null}
      {row.mechanicalOutputText ? (
        <Section heading="Mechanical output">
          <div className="rounded-md border border-border bg-green-500/15 p-3 font-mono text-xs leading-5 text-foreground [&_p]:mb-2 [&_p]:text-xs [&_p]:leading-5 [&_ul]:text-xs [&_ul]:leading-5">
            <Markdown>{row.mechanicalOutputText}</Markdown>
          </div>
        </Section>
      ) : null}
      {row.narrativeRule ? (
        <Section heading="Narrative rule">
          <Markdown>{row.narrativeRule}</Markdown>
        </Section>
      ) : null}
      <ModifierCards row={row} buildModifiers={buildModifiers} />
      {row.isMirrorable ? (
        <MirrorPanel
          op={"add" as Parameters<typeof MirrorPanel>[0]["op"]}
          buCredit={row.mirrorBuCredit}
          notes={row.mirrorEligibilityNotes}
        />
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
  const totalBu = row.primitiveLinks.reduce((s, l) => s + Math.abs(l.primitive.buCost * l.quantity), 0);
  return (
    <div className="space-y-5">
      <Header
        fallback="EFF"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label="Effect"
        chips={
          <>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
            {row.sourceOrigin ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium uppercase tracking-wide text-secondary-foreground">{row.sourceOrigin}</span> : null}
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
      />
      {row.narrativeDescription ? (
        <Section heading="Narrative description">
          <div className="rounded-md border border-border/60 bg-background/40 p-3 text-sm leading-7 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_strong]:text-foreground [&_em]:italic">
            <Markdown>{row.narrativeDescription}</Markdown>
          </div>
        </Section>
      ) : null}
      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium">{tag}</span>
            ))}
          </div>
        </Section>
      ) : null}
      <ComposedList
        title={`Composed primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: Math.abs(l.primitive.buCost * l.quantity),
          versionNumber: l.versionNumber,
          subText: <span>{l.primitive.category}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>,
        }))}
      />
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
  const totalBu = row.primitiveLinks.reduce((s, l) => s + Math.abs(l.primitive.buCost * l.quantity), 0);
  return (
    <div className="space-y-4">
      <Header
        fallback="CAP"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={`${row.type} · ${row.sourceType}`}
        chips={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.sourceOrigin ?? "—"}</span>
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
      />
      {row.verboseDescription ? (
        <Section heading="Description">
          <Markdown>{row.verboseDescription}</Markdown>
        </Section>
      ) : null}
      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        </Section>
      ) : null}
      <ComposedList
        title={`Composed primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l, i) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: Math.abs(l.primitive.buCost * l.quantity),
          versionNumber: l.versionNumber,
          subText: (
            <>
              <span>{l.primitive.category}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">{l.role.replace(/_/g, " ")}</span>
              {l.quantity > 1 ? <span>× {l.quantity}</span> : null}
              {l.slotLabel ? <span className="italic">"{l.slotLabel}"</span> : null}
            </>
          ),
        }))}
      />
      <ComposedList
        title={`Composed effects (${row.effectLinks.length})`}
        items={row.effectLinks.map((l) => ({
          id: l.effectId,
          name: l.effect.name,
          bu: (l.effect.primitiveLinks ?? []).reduce((s, x) => s + Math.abs(x.primitive.buCost * x.quantity), 0),
          versionNumber: l.versionNumber,
          note: l.effect.narrativeDescription ?? null,
          subText: l.slotLabel ? <span className="italic">"{l.slotLabel}"</span> : undefined,
        }))}
      />
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
  const primitiveBu = row.primitiveLinks.reduce((s, l) => s + l.primitive.buCost, 0);
  return (
    <div className="space-y-4">
      <Header
        fallback="TPL"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={row.kind}
        chips={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{primitiveBu} BU</span>
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
      />
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
      <ComposedList
        title={`Bundled primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: l.primitive.buCost,
          versionNumber: l.versionNumber,
        }))}
      />
      <ComposedList
        title={`Bundled capabilities (${row.capabilityLinks.length})`}
        items={row.capabilityLinks.map((l) => ({
          id: l.capability.id,
          name: l.capability.name,
          bu: (l.capability.primitiveLinks ?? []).reduce((s, x) => s + Math.abs(x.primitive.buCost), 0),
          versionNumber: l.versionNumber,
        }))}
      />
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
  const primitiveBu = row.primitiveLinks.reduce((s, l) => s + l.primitive.buCost, 0);
  const totalBu = row.buCost + primitiveBu;
  return (
    <div className="space-y-4">
      <Header
        fallback="ITM"
        iconSource={row.iconSource}
        iconKey={row.iconKey}
        iconUrl={row.iconUrl}
        iconColor={row.iconColor}
        label={row.itemType}
        chips={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{totalBu} BU</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${rarityClass(row.rarity)}`}>{row.rarity}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Slot {row.slotCost}</span>
            {row.isTwoHanded ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Two-handed</span> : null}
            {row.isConsumable ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Consumable</span> : null}
            {row.actsAsFocus ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Focus</span> : null}
            {row.sourceOrigin ? <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{row.sourceOrigin}</span> : null}
            <VisibilityPill isPublic={row.isPublic} />
          </>
        }
      />
      {row.description ? (
        <Section heading="Description">
          <Markdown>{row.description}</Markdown>
        </Section>
      ) : null}
      {row.tags.length > 0 ? (
        <Section heading="Tags">
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        </Section>
      ) : null}
      <ComposedList
        title={`Item-augment primitives (${row.primitiveLinks.length})`}
        onSubLink={onSubLink}
        items={row.primitiveLinks.map((l) => ({
          id: String(l.primitive.id),
          name: l.primitive.name,
          bu: l.primitive.buCost,
          versionNumber: l.versionNumber,
        }))}
      />
      <ComposedList
        title={`Composed effects (${row.effectLinks.length})`}
        onSubLink={onSubLink}
        items={row.effectLinks.map((l) => ({
          id: l.effectId,
          name: l.effect.name,
          bu: (l.effect.primitiveLinks ?? []).reduce((s, x) => s + Math.abs(x.primitive.buCost * x.quantity), 0),
          versionNumber: l.versionNumber,
          note: l.effect.narrativeDescription ?? null,
        }))}
      />
      <ComposedList
        title={`Composed capabilities (${row.capabilityLinks.length})`}
        onSubLink={onSubLink}
        items={row.capabilityLinks.map((l) => ({
          id: l.capabilityId,
          name: l.capability.name,
          bu: (l.capability.primitiveLinks ?? []).reduce((s, x) => s + Math.abs(x.primitive.buCost), 0),
          versionNumber: l.versionNumber,
        }))}
      />
    </div>
  );
}

// ---- shared header ----------------------------------------------------------

function Header({
  fallback,
  iconSource,
  iconKey,
  iconUrl,
  iconColor,
  label,
  chips,
}: {
  fallback: string;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
  label: string;
  chips: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <IconTile
        row={{ iconSource, iconKey, iconUrl, iconColor, fallback }}
      />
      <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="flex flex-wrap items-center gap-2">{chips}</span>
      </div>
    </div>
  );
}

function rarityClass(rarity: string): string {
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
