"use client";

// Live preview for the primitive being composed in PrimitiveForm.
// Reads the current form state and renders a read-only PrimitivePreview card.
// Empty state when no fields are filled in.

import { Fragment } from "react";
import { Markdown } from "@/components/ui/markdown";
import { EntityPreview } from "@/components/preview/entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { HardModifier } from "@/types/swordweave";
import { legacyConditionProjection } from "@/lib/primitives/condition";
import {
  renderEquation,
  type ModifierOperation,
  type Operand,
} from "@/types/modifier";
import { mirrorDescription } from "./primitive-preview";

export type ModifierDraft = {
  id: string;
  target: string;
  operation: string;
  value: string;
  valueKind: "number" | "text" | "boolean" | "dice" | "equation";
  // Phase 7.5 v4: optional fields the preview uses to render
  // the equation/condition/stacking summary in full. These are
  // also present on the form's ModifierDraft; the preview reads
  // them when present, falls back to the legacy summary when
  // missing (older rows don't carry them).
  operands?: Operand[];
  targetValues?: string[];
  freeTextNarrowFocus?: string;
  conditionMode?: "always" | "custom";
  conditionKey?: string;
  conditionOperator?: string;
  conditionValue?: string;
  v1Condition?: unknown;
  stacking?: string;
};

export type PrimitiveFormState = {
  name: string;
  category: string;
  isPublic: boolean;
  costTier: string;
  buCost: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: string;
  mirrorEligibilityNotes: string;
  /** Comma-separated world/book origin (e.g. "Forgotten Realms"). */
  sourceOrigin: string;
  /** Comma-separated free-form tags. */
  tags: string;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

function categoryLabel(category: string | undefined | null): string {
  if (!category) return "";
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function parseValue(value: string, valueKind: ModifierDraft["valueKind"]): unknown {
  if (valueKind === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }
  if (valueKind === "boolean") {
    return value === "true";
  }
  return value;
}

function modifierSummary(modifier: ModifierDraft): string {
  const target = String(modifier.target).split(".").pop();
  const op = modifier.operation;
  const val =
    modifier.valueKind === "text" ? `"${modifier.value}"` : modifier.value;
  return `${target} ${op} ${val}`;
}

/**
 * Render a modifier as a structured card with all the
 * fields the user composed — target, scope, operation,
 * equation/value, condition, stacking, mirrorability.
 * v4: replaces the old flat "target op value" line with
 * a multi-row block that surfaces everything the form
 * captured, including equation rendering and target
 * scope checkboxes.
 */
function modifierBlock(modifier: ModifierDraft): React.ReactElement {
  const target = String(modifier.target);
  // Mashu: "I don't want skill_practice_check, just practice
  // (the name I chose from the list)." The target field
  // stores fully-qualified target IDs like
  // "skill_practice_check.awareness" — for display, the
  // first segment is the *target kind* (the axis), and the
  // rest is the value. We want to show just the value, e.g.
  // "awareness", not "skill_practice_check.awareness".
  const targetParts = target.split(".");
  // If the second segment exists and isn't a number/UUID,
  // it's the user-chosen value (e.g. "awareness" or
  // "fire"). If not, fall back to the full target.
  const targetShort =
    targetParts.length > 1 && /^[a-z][a-z0-9_-]*$/i.test(targetParts[1] ?? "")
      ? (targetParts[1] ?? target)
      : target;
  const op = modifier.operation;

  // Equation rendering for equation mode. Mashu: "I'd like
  // to see the whole equation there." Render the full
  // equation text (with operator symbols) on its own line
  // when the value kind is equation, not just a placeholder.
  let valueLine: React.ReactElement;
  let valueLine2: React.ReactElement | null = null;
  if (modifier.valueKind === "equation" && Array.isArray(modifier.operands)) {
    const eqText = renderEquation(modifier.operands as Operand[]);
    // Mashu: "the skill_practice_check and add would be in
    // one row, scope below and then equation or value on
    // one row or more." So the equation goes on its own
    // line(s), with the value/expression displayed
    // monospace.
    valueLine = (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
        {eqText || "(empty)"}
      </code>
    );
    // If the equation has 4+ operands, also show a wrapped
    // version for readability (Mashu: "on one row or more").
    if ((modifier.operands as Operand[]).length > 3) {
      valueLine2 = (
        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
          {eqText}
        </p>
      );
    }
  } else if (modifier.valueKind === "text") {
    valueLine = (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
        {`"${modifier.value}"`}
      </code>
    );
  } else {
    valueLine = (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {modifier.value || "0"}
      </code>
    );
  }

  // Target scope (targetValues or freeTextNarrowFocus).
  // Mashu: "scope below" — scope renders on its own line
  // beneath the target/op/value row. Rendered as chips so
  // it reads naturally: "Scope: melee, ranged" rather than
  // a comma-joined string.
  const tv = modifier.targetValues ?? [];
  const narrow = modifier.freeTextNarrowFocus ?? "";
  const scopeLine: React.ReactElement | null =
    tv.length > 0 || narrow.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          Scope:
        </span>
        {tv.length > 0 ? (
          tv.map((v) => (
            <span
              key={v}
              className="rounded bg-muted px-1.5 py-0.5 font-mono"
            >
              {v}
            </span>
          ))
        ) : (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-amber-700 dark:text-amber-400">
            any
          </span>
        )}
        {narrow ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono italic">
            "{narrow}"
          </span>
        ) : null}
      </div>
    ) : null;

  // Condition line — rendered from the v1
  // ConditionAuthoring (pills + operators) when present.
  // Mashu: "we need to also add conditions or/and
  // between them just displaying as text is not good.
  // Should be just triggers when: [self] (self is
  // prone) OR [target] [target is prone] AND [scene]
  // [scene is dim] or something as an example."
  //
  // The v1 condition has:
  //   pills: [{ category, label }, ...]   (ordered)
  //   operators: ("AND" | "OR")[]         (length = pills.length - 1)
  //   categories: selected categories    (used for the [scope] chip)
  //   narrative: free-text fallback
  //
  // Render as: "When: [actor] prone OR [target] prone AND [scene] dim"
  // Each pill is a chip with its category prefix. Operators between
  // pills are uppercased AND/OR chips.
  //
  // Fallback to the legacy triple (conditionKey/Operator/Value)
  // if v1Condition is absent or unparseable. The "equals" word
  // the user saw in the screenshot is the legacy operator —
  // it's a fallback from the old shape, not the intended UI.
  const condLine: React.ReactElement | null =
    renderConditionLine(modifier);

  // Mirrorability (per-op, derived from OP_SPECS). Mashu:
  // "Also I need to see what mirrors so in mirror we'd
  // have mirrors to subtract." Use the existing
  // mirrorDescription() helper from primitive-preview.tsx
  // — it produces "Mirrors to subtract (sign flip)..."
  // strings.
  const mirror = mirrorDescription(op as ModifierOperation);

  return (
    <li
      key={modifier.id}
      className="space-y-1 border-b border-border p-2 text-sm last:border-b-0"
    >
      {/* Row 1: target + op + value (the "equation" or
          scalar). Mashu: "the skill_practice_check and
          add would be in one row." Note: targetShort
          is just "awareness" (not the full target id). */}
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="font-mono text-xs font-semibold">
          {targetShort}
        </span>
        <span className="font-mono text-xs text-primary">{op}</span>
        {valueLine}
        <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
          {modifier.stacking ?? "stack"}
        </span>
      </div>
      {/* Optional wrapped second line for long equations. */}
      {valueLine2}
      {/* Scope below the row. */}
      {scopeLine}
      {/* Condition below scope. */}
      {condLine}
      {/* Mirror info — explicit "mirrors to X" label so the
          user can see the inverse op at a glance. Mashu: "in
          mirror we'd have mirrors to subtract". */}
      <p className="text-[10px] text-muted-foreground">
        {mirror.mirrorable ? "📊 " : "🏛 "}
        {mirror.summary}
      </p>
    </li>
  );
}

/**
 * Re-derive op mirrorability at the preview site (so the
 * preview doesn't have to import OP_SPECS directly).
 * Matches the form's `effectiveMirrorable`.
 *
 * Phase 7.5 v4-rev: replaced by mirrorDescription() from
 * primitive-preview.tsx, which gives the same boolean AND
 * a human-readable "mirrors to X (sign flip)" summary.
 * Mashu: "Also I need to see what mirrors so in mirror
 * we'd have mirrors to subtract."
 */

export function PrimitiveFormPreview({
  form,
  modifiers,
}: {
  form: PrimitiveFormState;
  modifiers: ModifierDraft[];
}) {
  const buCost = Number(form.buCost) || 0;
  const isEmpty =
    !form.name &&
    !form.mechanicalOutputText &&
    !form.narrativeRule &&
    modifiers.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No primitive yet
          </p>
          <p className="text-xs text-muted-foreground">
            Start typing in the Build panel. The card updates as you go.
          </p>
        </div>
      </div>
    );
  }

  // Unified preview: render the SAME EntityPreview used by the library /
  // creations / atelier modals. The build-modal variant hides the
  // engagement footer (Save/Reset live in the form chrome) and shows the
  // live draft modifiers. This guarantees the preview looks identical
  // everywhere — and drops the raw `mirrorVector` string display.
  const item: SandboxPreviewItem = {
    kind: "primitive",
    row: {
      id: -1,
      name: form.name || "Unnamed Primitive",
      category: form.category,
      buCost,
      isPublic: form.isPublic,
      costTier: form.costTier,
      mechanicalOutputText: form.mechanicalOutputText,
      narrativeRule: form.narrativeRule,
      isMirrorable: form.isMirrorable,
      mirrorVector: form.mirrorVector,
      mirrorBuCredit: form.isMirrorable ? Number(form.mirrorBuCredit) || 0 : 0,
      mirrorEligibilityNotes: form.mirrorEligibilityNotes,
      sourceOrigin: form.sourceOrigin || null,
      tags: typeof form.tags === "string"
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      hardModifiers: [],
      iconSource: form.iconSource,
      iconKey: form.iconKey,
      iconUrl: form.iconUrl,
      iconColor: form.iconColor,
    },
  };
  return (
    <EntityPreview
      item={item}
      variant="build"
      buildModifiers={modifiers as Array<Record<string, unknown>>}
    />
  );
}

// Helper: convert a primitive's stored hardModifiers back into ModifierDraft[].
// Used when loading from ?edit= so the form can render pre-existing modifiers.
export function modifiersFromHardModifiers(stored: unknown): ModifierDraft[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (m): m is HardModifier =>
        Boolean(m) &&
        typeof m === "object" &&
        (m as Record<string, unknown>)["kind"] === "modify",
    )
    .map((modifier, index) => {
      const valueKind: ModifierDraft["valueKind"] =
        typeof modifier.value === "boolean"
          ? "boolean"
          : typeof modifier.value === "number"
            ? "number"
            : "text";
      const value =
        modifier.value === undefined || modifier.value === null
          ? ""
          : typeof modifier.value === "string"
            ? modifier.value
            : String(modifier.value);
      // Phase-7-Q-B: condition may now be legacy {key, operator, value}
      // OR v1 {kind: "preset"|"narrative"|"tags", ...}. Project both
      // shapes back into the legacy triple for the ModifierDraft
      // cache. The picker reads v1Condition on load (via v1Condition
      // field); this projection only feeds the legacy fields that
      // round-trip to the new shape via buildCondition when saved.
      const raw = modifier.condition;
      const legacyProjection = legacyConditionProjection(raw);
      return {
        id: `modifier-${index + 1}`,
        target: modifier.target,
        operation: modifier.operation,
        value,
        valueKind,
        conditionMode: raw ? "custom" : "always",
        conditionKey: legacyProjection.key,
        conditionOperator: legacyProjection.operator,
        conditionValue: legacyProjection.value,
        stacking: modifier.stacking ?? "stack",
      };
    });
}

// =============================================================================
// renderConditionLine — render the "When: …" row in the preview block.
//
// Reads `modifier.v1Condition` (a ConditionAuthoring) and renders the
// structured trigger chain: pills interleaved with AND/OR chips,
// each pill prefixed with a [scope] chip from the pill's category.
// Falls back to the legacy triple (conditionKey/Operator/Value) when
// v1Condition is missing or unparseable — older rows that haven't been
// migrated yet.
//
// Mashu (round 3): "In preview the conditions AND and OR are not
// properly pulled in. They are weird and that 'equals' is probably
// fallback from the old ways of doing things."
//
// Example output (matching Mashu's spec):
//   When: [actor] prone OR [target] prone AND [scene] dim
// =============================================================================

// v1Condition is typed as `unknown` in ModifierDraft (it's optional
// and could be in any of the legacy shapes during the migration
// window). We narrow with a runtime shape check below.
type V1ConditionShape = {
  readonly categories?: readonly string[];
  readonly pills?: readonly { readonly category: string; readonly label: string }[];
  readonly operators?: readonly ("AND" | "OR")[];
  readonly narrative?: string;
};

function isV1ConditionShape(value: unknown): value is V1ConditionShape {
  return (
    value !== null &&
    typeof value === "object" &&
    ("pills" in value || "narrative" in value || "categories" in value)
  );
}

function renderConditionLine(
  modifier: ModifierDraft,
): React.ReactElement | null {
  const mode = modifier.conditionMode ?? "always";
  if (mode === "always") return null;

  // 1. Try v1 condition first (the new structured shape).
  if (
    "v1Condition" in modifier &&
    modifier.v1Condition !== null &&
    modifier.v1Condition !== undefined &&
    isV1ConditionShape(modifier.v1Condition)
  ) {
    const v1 = modifier.v1Condition as V1ConditionShape;
    const pills = v1.pills ?? [];
    const operators = v1.operators ?? [];
    const narrative = v1.narrative ?? "";

    if (pills.length === 0 && narrative.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          When:
        </span>
        {pills.length > 0 ? (
          pills.map((pill, i) => (
            <Fragment key={`pill-${i}-${pill.label}`}>
              {/* Operator BEFORE the pill at index > 0 */}
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
          ))
        ) : null}
        {narrative ? (
          <span className="rounded bg-muted px-1.5 py-0.5 italic text-muted-foreground">
            {narrative}
          </span>
        ) : null}
      </div>
    );
  }

  // 2. Legacy fallback — the user is editing with the old
  // single-condition triple. We render the components as chips
  // so they at least look structured, but the AND/OR is implicit
  // (single condition = always true together).
  if (modifier.conditionKey || modifier.conditionValue) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          When:
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {modifier.conditionKey || "?"}
        </span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
          {modifier.conditionOperator || "?"}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {modifier.conditionValue || ""}
        </span>
        <span className="ml-1 text-[9px] italic text-muted-foreground">
          (legacy)
        </span>
      </div>
    );
  }

  return null;
}