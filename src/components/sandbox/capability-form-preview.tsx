"use client";

// Live preview for the capability being composed in CapabilityForm.

import { Markdown } from "@/components/ui/markdown";

export type CapabilityFormState = {
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string;
  tags: string;
  isPublic: boolean;
};

export type CapabilitySlot = {
  primitiveId: number;
  role: string;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  /**
   * Per-slot notes from the source row. Optional; the form carries them
   * so a "save with no edits" round-trip computes the same content hash
   * as the source's stored hash. Same pattern as EffectFormSlot.
   */
  notes?: string | undefined;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
  };
};

/** Effect summary used by the preview — name + narrative description. */
export type CapabilityEffectRef = {
  id: string;
  name: string;
  narrativeDescription: string;
};

export function CapabilityFormPreview({
  form,
  slots,
  effects,
}: {
  form: CapabilityFormState;
  slots: CapabilitySlot[];
  effects?: CapabilityEffectRef[];
}) {
  const isEmpty =
    !form.name &&
    !form.verboseDescription &&
    slots.length === 0 &&
    (effects?.length ?? 0) === 0;
  const tags = (form.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const totalBu = slots.reduce(
    (sum, slot) => sum + Math.abs(slot.primitive.buCost * slot.quantity),
    0,
  );

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No capability yet
          </p>
          <p className="text-xs text-muted-foreground">
            Fill in the Build panel. The card updates as you type and slot
            primitives.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {form.type} - {form.sourceType}
        </p>
        <h2 className="text-2xl font-semibold leading-tight">
          {form.name || "Unnamed Capability"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {totalBu} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {slots.length} slots
          </span>
          {(effects?.length ?? 0) > 0 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {effects!.length} effects
            </span>
          ) : null}
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

      {form.verboseDescription ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Description
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.verboseDescription}</Markdown>
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
            Primitive slots ({slots.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {slots.map((slot, i) => (
              <li
                key={`${slot.primitiveId}-${i}`}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {slot.primitive.name}
                </span>
                <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  {slot.role}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  ×{slot.quantity}
                </span>
                <span className="shrink-0 font-mono text-xs">
                  {Math.abs(slot.primitive.buCost * slot.quantity)} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(effects?.length ?? 0) > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Effects ({effects!.length})
          </h3>
          <ul className="space-y-2">
            {effects!.map((effect) => (
              <li
                key={effect.id}
                className="rounded-md border border-border bg-card/50 p-3"
              >
                <p className="font-semibold text-foreground">
                  {effect.name}
                </p>
                {effect.narrativeDescription ? (
                  <div className="mt-1.5 rounded border border-border/40 bg-background/40 p-2 text-xs leading-relaxed text-muted-foreground">
                    <Markdown>{effect.narrativeDescription}</Markdown>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}