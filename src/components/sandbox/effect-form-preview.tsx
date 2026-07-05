"use client";

// Live preview for the effect being composed in EffectForm.
// Reads the current form state + slotted primitives and renders a read-only card.
// Empty state when no fields are filled in.

import { Markdown } from "@/components/ui/markdown";

export type EffectFormState = {
  name: string;
  narrativeDescription: string;
  sourceOrigin: string;
  tags: string;
  isPublic: boolean;
};

export type SlottedPrimitive = {
  primitiveId: number;
  quantity: number;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
  };
};

export function EffectFormPreview({
  form,
  slots,
}: {
  form: EffectFormState;
  slots: SlottedPrimitive[];
}) {
  const isEmpty =
    !form.name &&
    !form.narrativeDescription &&
    slots.length === 0;

  const tags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const totalBu = slots.reduce(
    (sum, slot) => sum + slot.primitive.buCost * slot.quantity,
    0,
  );

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No effect yet
          </p>
          <p className="text-xs text-muted-foreground">
            Start typing in the Build panel. The card updates as you go.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reusable State Package
        </p>
        <h2 className="text-2xl font-semibold leading-tight">
          {form.name || "Unnamed Effect"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {totalBu} BU
          </span>
          {form.sourceOrigin ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {form.sourceOrigin}
            </span>
          ) : null}
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

      {form.narrativeDescription ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Narrative rule
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.narrativeDescription}</Markdown>
          </div>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-border bg-background px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {slots.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Slotted primitives ({slots.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {slots.map((slot) => (
              <li
                key={slot.primitiveId}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {slot.primitive.name} x{slot.quantity}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {slot.primitive.buCost * slot.quantity} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}