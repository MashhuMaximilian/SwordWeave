"use client";

// Live preview for the primitive being composed in PrimitiveForm.
// Reads the current form state and renders a read-only PrimitivePreview card.
// Empty state when no fields are filled in.

import { Markdown } from "@/components/ui/markdown";
import type { HardModifier } from "@/types/swordweave";
import { legacyConditionProjection } from "@/lib/primitives/condition";
import { renderEquation, type Operand } from "@/types/modifier";

type ModifierDraft = {
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
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

function categoryLabel(category: string): string {
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
  const targetShort = target.split(".").pop() ?? target;
  const op = modifier.operation;

  // Equation rendering for equation mode.
  let valueLine: React.ReactElement;
  if (modifier.valueKind === "equation" && Array.isArray(modifier.operands)) {
    const eqText = renderEquation(modifier.operands as Operand[]);
    valueLine = (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {eqText || "(empty)"}
      </code>
    );
  } else if (modifier.valueKind === "text") {
    valueLine = (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
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
  const tv = modifier.targetValues ?? [];
  const narrow = modifier.freeTextNarrowFocus ?? "";
  const scopeLine: React.ReactElement | null =
    tv.length > 0 || narrow.length > 0 ? (
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Scope: {tv.length > 0 ? tv.join(", ") : "any"}
        {narrow ? ` · "${narrow}"` : ""}
      </p>
    ) : null;

  // Condition line.
  const condMode = modifier.conditionMode ?? "always";
  const condLine: React.ReactElement | null =
    condMode === "custom" ? (
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        When: {modifier.conditionKey ?? "?"} {modifier.conditionOperator ?? "?"}{" "}
        {modifier.conditionValue ?? ""}
      </p>
    ) : null;

  // Mirrorability (per-op, derived from OP_SPECS).
  const mirrorable = isOpMirrorable(op);

  return (
    <li
      key={modifier.id}
      className="space-y-1 border-b border-border p-2 text-sm last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          {targetShort} <span className="text-primary">{op}</span> {valueLine}
        </code>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
          {modifier.stacking ?? "stack"}
        </span>
      </div>
      {scopeLine}
      {condLine}
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {mirrorable
          ? "📊 Mirrorable (variable)"
          : "🏛 Permission-locked (not mirrorable)"}
      </p>
    </li>
  );
}

/**
 * Re-derive op mirrorability at the preview site (so the
 * preview doesn't have to import OP_SPECS directly).
 * Matches the form's `effectiveMirrorable`.
 */
function isOpMirrorable(op: string): boolean {
  return op !== "set";
}

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

  const buCredit = form.isMirrorable ? Number(form.mirrorBuCredit) || 0 : 0;
  const vector = form.isMirrorable ? form.mirrorVector : null;

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {categoryLabel(form.category)}
        </p>
        <h2 className="text-base font-semibold leading-tight text-foreground">
          {form.name || "Unnamed Primitive"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {buCost} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {form.costTier}
          </span>
          <span
            className={
              "rounded-full px-2 py-0.5 font-medium " +
              (form.isPublic
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
            }
          >
            {form.isPublic ? "Public" : "Draft"}
          </span>
        </div>
      </header>

      {form.mechanicalOutputText ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Mechanical output
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.mechanicalOutputText}</Markdown>
          </div>
        </section>
      ) : null}

      {form.narrativeRule ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Narrative rule
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.narrativeRule}</Markdown>
          </div>
        </section>
      ) : null}

      {modifiers.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Modifiers ({modifiers.length})
          </h3>
          <ul className="rounded-md border">
            {modifiers.map((modifier) => modifierBlock(modifier))}
          </ul>
        </section>
      ) : null}

      {form.isMirrorable ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Mirror
          </h3>
          <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
            <dt className="text-xs text-muted-foreground">Vector</dt>
            <dd>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {vector ?? "—"}
              </code>
            </dd>
            <dt className="text-xs text-muted-foreground">BU credit</dt>
            <dd>
              <span className="font-mono text-xs">{buCredit} BU</span>
            </dd>
          </dl>
          {form.mirrorEligibilityNotes ? (
            <div className="prose prose-invert prose-sm mt-2 max-w-none break-words text-sm leading-7">
              <Markdown>{form.mirrorEligibilityNotes}</Markdown>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
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