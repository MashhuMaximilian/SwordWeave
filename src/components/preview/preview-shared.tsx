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
    <section>
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
      {notes ? (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{notes}</p>
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
            {b.label}
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
// Layout (matches creations):
//   - 3-col grid: Edit · Source · Versions  (each equal visual weight;
//     predictable tap targets on mobile — the user asked for desktop AND
//     mobile to match).
//   - optional 4th primary action (e.g. Atelier's "Load into build") rendered
//     as a full-width primary button above the grid.
//   - full-width Delete below the grid (only when `deletable`), with a
//     canDelete gate + confirm dialog. When not deletable, a hint to set
//     visibility to Private is shown instead (mirrors creations' rule).
// =============================================================================

import { useState } from "react";
import { Pencil, ExternalLink, History, Trash2 } from "lucide-react";
import {
  VisibilitySelect,
  visibilityLabel,
  type Visibility,
} from "@/components/library/visibility-select";

export type PreviewActionProps = {
  /** Primary CTA shown as a full-width button above the grid (e.g. Load into build). */
  primary?: { label: string; onClick?: () => void; href?: string };
  /** Optional secondary primary CTA (e.g. Slot into build) shown full-width
   *  above the grid, after `primary`. */
  primarySecondary?: { label: string; onClick?: () => void; href?: string };
  /** Optional 4th grid button rendered on the SAME row as Edit/Source/Versions
   *  (e.g. "Load into build"). When present the grid becomes 4 columns and
   *  the row is pinned to the bottom of the modal. */
  loadIntoBuild?: { label: string; onClick?: () => void };
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

export function PreviewActions(props: PreviewActionProps) {
  const {
    primary,
    primarySecondary,
    loadIntoBuild,
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

      {primary ? (
        primary.href ? (
          <a
            href={primary.href}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {primary.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={primary.onClick}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {primary.label}
          </button>
        )
      ) : null}

      {primarySecondary ? (
        primarySecondary.href ? (
          <a
            href={primarySecondary.href}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {primarySecondary.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={primarySecondary.onClick}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {primarySecondary.label}
          </button>
        )
      ) : null}

      <div className={`flex gap-1.5 pt-3`}>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary px-1.5 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Pencil className="size-3.5 shrink-0" />
            <span className="truncate">Edit</span>
          </button>
        ) : null}
        {openSourceHref ? (
          <a
            href={openSourceHref}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            <span className="truncate">Source</span>
          </a>
        ) : null}
        {versionHistoryHref ? (
          <a
            href={versionHistoryHref}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <History className="size-3.5 shrink-0" />
            <span className="truncate">Versions</span>
          </a>
        ) : null}
        {loadIntoBuild ? (
          <button
            type="button"
            onClick={loadIntoBuild.onClick}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-primary bg-primary/10 px-1.5 py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <span className="truncate">{loadIntoBuild.label}</span>
          </button>
        ) : null}
      </div>

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
