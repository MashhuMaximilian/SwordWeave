"use client";

// Live preview for the primitive being composed in PrimitiveForm.
// Reads the current form state and renders a read-only PrimitivePreview card.
// Empty state when no fields are filled in.

import { Markdown } from "@/components/ui/markdown";
import type { HardModifier } from "@/types/swordweave";

type ModifierDraft = {
  id: string;
  target: string;
  operation: string;
  value: string;
  valueKind: "number" | "text" | "boolean";
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator: string;
  conditionValue: string;
  stacking: string;
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
          <ul className="divide-y divide-border rounded-md border">
            {modifiers.map((modifier) => (
              <li
                key={modifier.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {modifierSummary(modifier)}
                </code>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {modifier.stacking}
                </span>
              </li>
            ))}
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
      return {
        id: `modifier-${index + 1}`,
        target: modifier.target,
        operation: modifier.operation,
        value,
        valueKind,
        conditionMode: modifier.condition ? "custom" : "always",
        conditionKey: modifier.condition?.key ?? "",
        conditionOperator: modifier.condition?.operator ?? "equals",
        conditionValue:
          modifier.condition?.value === undefined ||
          modifier.condition?.value === null
            ? ""
            : typeof modifier.condition.value === "string"
              ? modifier.condition.value
              : String(modifier.condition.value),
        stacking: modifier.stacking ?? "stack",
      };
    });
}