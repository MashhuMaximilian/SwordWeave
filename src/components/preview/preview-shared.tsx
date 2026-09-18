"use client";

// =============================================================================
// preview-shared — building blocks for the unified EntityPreview.
//
// These are the canonical, shared renderers so the SAME preview looks
// identical in: My Creations, Library, Atelier (sandbox library), and the
// Atelier build-modal preview tab. No more "why does it look different in
// different places" — one component, one set of primitives.
//
// The ModifierCard / ConditionLine / MirrorPanel logic is lifted from the
// build-modal *FormPreview family (which already rendered primitives
// well) and made type-agnostic so the library can reuse it.
// =============================================================================

import { Fragment, type ReactElement, type ReactNode } from "react";
import { OP_SPECS, type ModifierOperation } from "@/types/modifier";

// =============================================================================
// Shared preview callback + sub-link types. Declared here (a cycle-free
// module) so both `entity-preview` and `library-item-preview` import them
// from one place — previously they were defined in `library-item-preview`
// and re-imported by `entity-preview`, creating a circular type dependency
// that broke under exactOptionalPropertyTypes.
// =============================================================================

export interface PreviewEngagement {
  likes: number;
  dislikes: number;
  forks: number;
  userReaction: "LIKE" | "DISLIKE" | null;
  authorId: string | null;
  authorUsername: string | null;
  /**
   * Phase 9 follow-up: when true, the OwnerBar masks the author to
   * "by System" instead of "@username". Hoisted through the engagement
   * payload so the OwnerBar doesn't have to look up the user again.
   */
  authorIsAdmin: boolean | null;
  currentUserInternalId: string | null;
}

export interface PreviewSubLink {
  targetType: "PRIMITIVE" | "CAPABILITY" | "EFFECT" | "ITEM";
  targetId: string;
  label: string;
}

export interface PreviewCallbacks {
  onSubLinkClick?: (link: PreviewSubLink) => void;
  engagement?: PreviewEngagement;
  versionHistoryHref?: string;
  openSourceHref?: string;
  sandboxPath?: string;
  onFork?: ((targetType: string, targetId: string) => void) | undefined;
}

// ---- Section ----------------------------------------------------------------

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section data-preview-section={heading.toLowerCase().replaceAll(" ", "-")}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      {children}
    </section>
  );
}

// ---- VisibilityPill ----------------------------------------------------------

export function VisibilityPill({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
      Public
    </span>
  ) : (
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
      Draft
    </span>
  );
}

// ---- VersionChip -------------------------------------------------------------

export function VersionChip({
  versionNumber,
}: {
  versionNumber?: number | null | undefined;
}) {
  if (versionNumber == null) return null;
  return (
    <span
      className="mr-1.5 inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title={`Latest published version v${versionNumber}`}
    >
      v{versionNumber}
    </span>
  );
}

// ---- OperationBadge ---------------------------------------------------------
//
// Pretty, color-coded operation token. Replaces the bare `JSON.stringify`
// value dump and the monochrome `op` string. Every op gets a glyph + color
// so a modifier reads as a real expression at a glance:
//   Add = green +, Subtract = red −, Multiply = amber ×, Divide = blue ÷,
//   Set = slate =, Min = teal ⌊, Max = teal ⌈, Grant = violet ▲, Revoke = violet ▼

const OP_GLYPH: Record<ModifierOperation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  set: "=",
  min: "⌊",
  max: "⌈",
  grant: "▲",
  revoke: "▼",
};

const OP_CLASS: Record<ModifierOperation, string> = {
  add: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  subtract: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  multiply: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  divide: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  set: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  min: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  max: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  grant: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  revoke: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

export function operationGlyph(op: ModifierOperation): string {
  return OP_GLYPH[op] ?? "+";
}

export function OperationBadge({ op }: { op: ModifierOperation }) {
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-xs font-bold ${OP_CLASS[op] ?? OP_CLASS.add}`}
      title={op}
    >
      {OP_GLYPH[op] ?? op}
    </span>
  );
}

export function opLabel(op: ModifierOperation): string {
  return op.charAt(0).toUpperCase() + op.slice(1);
}

// Short mirror hint for a single modifier card: "→ SUBTRACT" when the op
// mirrors, or "locked" when it doesn't. Derived from OP_SPECS so it is
// always in sync with the actual mirror math.
export function mirrorSummary(op: ModifierOperation): { mirrorable: boolean; label: string } {
  const spec = OP_SPECS[op];
  if (!spec?.mirrorable || !spec.mirrorOp) {
    return { mirrorable: false, label: "Not mirrorable" };
  }
  const target = opLabel(spec.mirrorOp);
  const kind = spec.mirrorFlipsSign
    ? "(sign flip)"
    : spec.mirrorInvertsValue
      ? "(value inversion)"
      : "(op flip)";
  return { mirrorable: true, label: `→ ${target} ${kind}` };
}

// ---- MirrorPanel ------------------------------------------------------------
//
// Issue #2: the mirror section must show the OPERATION that this mirrors
// INTO (e.g. Add mirrors to SUBTRACT). Derives from OP_SPECS so it is
// always correct. The legacy `mirrorVector` string is intentionally NOT
// shown — it is kept only in the DB for content-hash stability.
//   - mirrorable op  -> "Mirrors to SUBTRACT" (+ sign-flip / inversion note)
//   - Set To / non-mirrorable -> "Not mirrorable"
//
// Round 12: notes are also filtered to drop the legacy
// "Mirrorable - VARIABLE_VECTOR" line that some seeded system
// primitives had stored in mirrorEligibilityNotes. The proper
// mirror UI above already conveys the same information (and more
// — it shows the actual inverse operation + sign-flip behaviour).
// The legacy text was left over from the pre-OP_SPECS era when the
// preview had no structured mirror UI. (User: 'we need to deter
// mirrorable - variable vector since we have a proper mirroring
// just above it'.)
export function MirrorPanel({
  op,
  buCredit,
  notes,
}: {
  op: ModifierOperation;
  buCredit?: number | null;
  notes?: string | null;
}) {
  const spec = OP_SPECS[op];
  const mirrorable = Boolean(spec?.mirrorable) && Boolean(spec?.mirrorOp);
  // Strip the legacy "Mirrorable - VARIABLE_VECTOR" / "Mirrorable:
  // VARIABLE_VECTOR" / "Mirrorable — VARIABLE_VECTOR" line from
  // notes. Accepts common separators (-, :, —). Case-insensitive.
  const cleanedNotes = notes
    ? notes
        .split(/\r?\n/)
        .filter(
          (line) =>
            !/^\s*mirrorable\s*[-:—]\s*(standard_only|variable_vector|structural_fault|cost_instability)\s*$/i.test(
              line,
            ),
        )
        .join("\n")
        .trim()
    : null;
  return (
    <Section heading="Mirror">
      {mirrorable ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Mirrors to</span>
            <OperationBadge op={spec.mirrorOp as ModifierOperation} />
            <span className="font-semibold">{opLabel(spec.mirrorOp as ModifierOperation)}</span>
            {typeof buCredit === "number" && buCredit > 0 ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
                {buCredit} BU credit
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {spec.mirrorFlipsSign
              ? "Sign flip — the value is negated in mirrored contexts."
              : spec.mirrorInvertsValue
                ? "Value inversion — the value becomes its reciprocal in mirrored contexts."
                : "Operator flips; the value stays the same."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not mirrorable.</p>
      )}
      {cleanedNotes ? (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{cleanedNotes}</p>
      ) : null}
    </Section>
  );
}

// ---- ConditionLine ----------------------------------------------------------
// ---- ConditionLine ----------------------------------------------------------
//
// Issue #3 (conditions/triggers): a single, pretty renderer for the
// "When:" trigger chain, reused by BOTH the library preview and the
// build-modal preview so conditions look identical everywhere.
//
// Uses the canonical `parseCondition` + `conditionToBadges` from the
// primitives lib, which understands every stored shape: legacy
// {key,operator,value}, v1 {kind:"preset"|"tags"|"compound"|"narrative"},
// and the build-modal's {pills, operators, narrative} v1 shape. Renders
// preset/tag pills + narrative as a clean "When:" line. For the structured
// pills/operators shape (from the build form), AND/OR connectors are
// shown between pills.

import {
  parseCondition,
  conditionToBadges,
} from "@/lib/primitives/condition";

// Build-form v1 condition shape (the live-draft {pills, operators, narrative}).
type V1Pill = { readonly category: string; readonly label: string };
type V1Condition = {
  readonly pills?: readonly V1Pill[];
  readonly operators?: readonly ("AND" | "OR")[];
  readonly narrative?: string;
};

export function ConditionLine({
  condition,
}: {
  /** Any stored condition shape OR the build-form's ConditionAuthoring. */
  condition?: unknown;
}): ReactElement | null {
  // 1. Build-form v1 shape: { pills: [{category,label}], operators: [AND|OR], narrative }.
  const v1 = condition as Partial<V1Condition> | undefined;
  if (v1 && "pills" in v1 && Array.isArray(v1.pills) && v1.pills.length > 0) {
    const pills = v1.pills as V1Pill[];
    const operators = v1.operators ?? [];
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">When:</span>
        {pills.map((pill, i) => (
          <Fragment key={`pill-${i}-${pill.label}`}>
            {i > 0 ? (
              <span
                className={`rounded px-1.5 py-0.5 font-mono font-bold ${
                  operators[i - 1] === "AND"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                }`}
              >
                {operators[i - 1] ?? "OR"}
              </span>
            ) : null}
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-violet-700 dark:text-violet-300">
              [{pill.category}]
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {pill.category} {pill.label.toLowerCase().replace(/_/g, " ")}
            </span>
          </Fragment>
        ))}
        {v1.narrative ? (
          <span className="rounded bg-muted px-1.5 py-0.5 italic text-muted-foreground">{v1.narrative}</span>
        ) : null}
      </div>
    );
  }

  // 2. Canonical stored shapes via the shared parser (legacy triple,
  // {kind:"preset"|"tags"|"compound"|"narrative"}).
  const parsed = parseCondition(condition);
  if (!parsed) return null;
  const badges = conditionToBadges(parsed);
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">When:</span>
      {badges.map((b, i) => {
        if (b.kind === "narrative") {
          return (
            <span key={`n-${i}`} className="rounded bg-muted px-1.5 py-0.5 italic text-muted-foreground">
              {b.label}
            </span>
          );
        }
        const isOperator = /^(AND|OR)$/i.test(b.label);
        if (isOperator) {
          return (
            <span
              key={`op-${i}`}
              className={`rounded px-1.5 py-0.5 font-mono font-bold ${
                b.label.toUpperCase() === "AND"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
              }`}
            >
              {b.label.toUpperCase()}
            </span>
          );
        }
        return (
          <span
            key={`b-${i}`}
            className={`rounded px-1.5 py-0.5 font-mono ${
              b.kind === "preset"
                ? "border border-primary/40 bg-primary/10 text-primary"
                : "border border-border bg-muted/50 text-muted-foreground"
            }`}
          >
            {b.axis && <span className="mr-1 font-semibold">{b.axis === "actor" ? "Self" : b.axis[0]!.toUpperCase() + b.axis.slice(1)}:</span>}{b.label}
          </span>
        );
      })}
    </div>
  );
}

// =============================================================================
// PreviewActions — THE shared action bar used by EVERY preview surface
// (My Creations, Library, Atelier sandbox, build modal). Identical structure
// and order everywhere, so a preview looks the same regardless of where it
// was opened from. Lifted verbatim from the My Creations preview so the two
// implementations converge on one component.
//
// Layout:
//   - destination cards explain where an entry will go before the user acts;
//   - compact Edit · Source · Fork map · Versions reference controls;
//   - full-width Delete below the grid (only when `deletable`), with a
//     canDelete gate + confirm dialog. When not deletable, a hint to set
//     visibility to Private is shown instead (mirrors creations' rule).
// =============================================================================

import { useState } from "react";
import { Pencil, PencilLine, ExternalLink, History, Trash2 } from "lucide-react";
import { FabThemeIcon } from "@/components/layout/fab-theme-icon";
import { useIsDark } from "@/lib/hooks/use-is-dark";
import {
  VisibilitySelect,
  visibilityLabel,
  type Visibility,
} from "@/components/library/visibility-select";

type PreviewDestinationAction = {
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
};

export type PreviewActionProps = {
  /** Legacy primary CTA used by a few standalone preview shells. */
  primary?: PreviewDestinationAction;
  /** Inserts this entry into the draft already open in the middle workspace. */
  primarySecondary?: PreviewDestinationAction;
  /** Sends an entry to the persistent secondary build session. */
  buildModal?: PreviewDestinationAction;
  /**
   * Phase 8.1 batch 8: optional tertiary CTA (e.g. "Slot into Lineage").
   * Context-aware: label changes based on the character modal's
   * activeStep. Only shown when provided.
   */
  primaryTertiary?: PreviewDestinationAction;
  /** Replaces the current draft in the visible middle workspace. */
  workspace?: PreviewDestinationAction;
  /** Optional read-only lineage control. Kept in the shared action row so
   *  Atelier and Library expose the same navigation without replacing any
   *  existing edit, source, version, slot, or load action. */
  forkMap?: ReactNode;
  onEdit?: () => void;
  openSourceHref?: string;
  versionHistoryHref?: string;
  onDelete?: () => void;
  /** Show the Delete button at all. */
  deletable?: boolean;
  /** Only true when the item is PRIVATE (nothing published). Gates deletion. */
  canDelete?: boolean;
  /** Current visibility — drives the canDelete hint + the optional select. */
  visibility?: Visibility;
  onVisibilityChange?: (vis: Visibility) => void;
};

function DestinationAction({
  action,
  destination,
  emphasis = false,
}: {
  action: PreviewDestinationAction;
  destination: "workspace" | "active-build" | "persistent-build" | "character" | "primary";
  emphasis?: boolean;
}) {
  const dark = useIsDark();
  const destinationIcon = destination === "character" ? (
    <FabThemeIcon iconKey="delapouite/mona-lisa" dark={dark} />
  ) : destination === "persistent-build" || destination === "active-build" ? (
    <FabThemeIcon iconKey="lorc/anvil-impact" dark={dark} />
  ) : (
    <PencilLine className="size-4 shrink-0" aria-hidden="true" />
  );
  const content = (
    <>
      <span className="v12-preview-destination-title">
        {destinationIcon}
        <span className="text-sm font-semibold leading-tight">{action.label}</span>
      </span>
      {action.description || (action.disabled && action.title) ? (
        <span className="text-[11px] leading-snug text-muted-foreground">
          {action.description ?? action.title}
        </span>
      ) : null}
    </>
  );
  const className = [
    "v12-preview-destination-action flex min-h-14 w-full flex-col items-start justify-center gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
    emphasis
      ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
      : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background",
  ].join(" ");

  if (action.href) {
    return (
      <a
        href={action.href}
        title={action.title}
        data-preview-action={destination}
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title}
      data-preview-action={destination}
      className={className}
    >
      {content}
    </button>
  );
}

export function PreviewActions(props: PreviewActionProps) {
  const {
    primary,
    primarySecondary,
    buildModal,
    primaryTertiary,
    workspace,
    forkMap,
    onEdit,
    openSourceHref,
    versionHistoryHref,
    onDelete,
    deletable,
    canDelete,
    visibility,
    onVisibilityChange,
  } = props;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const hasDestinationActions = Boolean(
    workspace || primary || primarySecondary || buildModal || primaryTertiary,
  );
  const hasReferenceActions = Boolean(
    onEdit || openSourceHref || forkMap || versionHistoryHref,
  );

  async function handleConfirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-10 space-y-3 border-t border-border bg-card px-1 pb-3 pt-3">
      {onVisibilityChange && visibility ? (
        <VisibilitySelect
          value={visibility}
          onChange={(next) => onVisibilityChange(next)}
        />
      ) : null}

      {hasDestinationActions ? (
        <section
          className="v12-preview-action-group space-y-2"
          data-preview-action-group="destinations"
          aria-label="Use this entry"
        >
          <div className="px-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              Use this entry
            </h3>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Choose where you want it to go.
            </p>
          </div>
          <div className="v12-preview-destination-grid grid gap-2 sm:grid-cols-2">
            {workspace ? <DestinationAction action={workspace} destination="workspace" emphasis /> : null}
            {primarySecondary ? <DestinationAction action={primarySecondary} destination="active-build" /> : null}
            {buildModal ? <DestinationAction action={buildModal} destination="persistent-build" /> : null}
            {primaryTertiary ? <DestinationAction action={primaryTertiary} destination="character" /> : null}
            {primary ? <DestinationAction action={primary} destination="primary" emphasis={!workspace} /> : null}
          </div>
        </section>
      ) : null}

      {hasReferenceActions ? (
        <div className="v12-preview-action-group flex gap-1.5 pt-2" data-preview-action-group="reference">
          {onEdit ? (
            <button type="button" onClick={onEdit} className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary px-1.5 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <Pencil className="size-3.5 shrink-0" />
              <span className="truncate">Edit</span>
            </button>
          ) : null}
          {openSourceHref ? (
            <a href={openSourceHref} className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">Source</span>
            </a>
          ) : null}
          {forkMap}
          {versionHistoryHref ? (
            <a href={versionHistoryHref} className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
              <History className="size-3.5 shrink-0" />
              <span className="truncate">Versions</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {deletable ? (
        canDelete ? (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-500/50 px-3 py-2 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-border bg-card/30 px-3 py-2 text-center text-[10px] text-muted-foreground">
            Set visibility to <span className="font-semibold">Private</span> to enable deletion
          </p>
        )
      ) : null}

      {deleteError ? (
        <p className="text-xs text-rose-400" role="alert">
          {deleteError}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <header className="border-b border-border px-4 py-3">
              <h4 className="text-sm font-semibold">Delete this creation?</h4>
            </header>
            <div className="space-y-3 p-4 text-sm">
              <p>This cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
