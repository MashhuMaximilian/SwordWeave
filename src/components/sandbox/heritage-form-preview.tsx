"use client";

// Live preview for the template being composed in HeritageForm.

import { Markdown } from "@/components/ui/markdown";
import { dispatchOpenPreview } from "@/lib/sandbox/slot-events";

export type HeritageFormState = {
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  imageUrl: string;
  description: string;
  suggestedTraits: string;
  isPublic: boolean;
  // Phase 8 rev 10: heritage parity — items/capabilities/effects already
  // carry `tags` and `sourceOrigin`; heritage was the last holdout.
  // Stored as a comma-separated string in the form (matches the
  // item-form pattern at item-form.tsx:643) and split on submit.
  sourceOrigin: string;
  tags: string;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type TemplateSlot = {
  id: number | string;
  name: string;
  category: string;
  buCost: number;
};

function kindLabel(kind: string): string {
  if (kind === "LINEAGE") return "Lineage";
  if (kind === "UPBRINGING") return "Upbringing";
  if (kind === "MANIFEST") return "Manifest";
  return kind;
}

function expectedCategory(kind: string): string {
  if (kind === "LINEAGE") return "HERITAGE_AUGMENT";
  if (kind === "UPBRINGING") return "BACKGROUND_AUGMENT";
  if (kind === "MANIFEST") return "CHARACTER_SHEET_AUGMENT";
  return "";
}

export function HeritageFormPreview({
  form,
  primitives,
  capabilities,
}: {
  form: HeritageFormState;
  primitives: TemplateSlot[];
  capabilities: TemplateSlot[];
}) {
  const isEmpty = !form.name && primitives.length === 0 && capabilities.length === 0;
  const totalBu = primitives.reduce((sum, p) => sum + p.buCost, 0);

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No template yet
          </p>
          <p className="text-xs text-muted-foreground">
            Pick a kind, name it, slot in primitives. The card updates as you
            build.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {kindLabel(form.kind)} Template
        </p>
        <h2 className="text-base font-semibold leading-tight text-foreground">
          {form.name || "Unnamed Template"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {totalBu} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {primitives.length} primitive{primitives.length === 1 ? "" : "s"}
          </span>
          {capabilities.length > 0 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {capabilities.length} capabilit
              {capabilities.length === 1 ? "y" : "ies"}
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

      {form.imageUrl ? (
        <img
          src={form.imageUrl}
          alt={form.name}
          className="w-full max-w-md rounded-md border"
        />
      ) : null}

      {form.description ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Description
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.description}</Markdown>
          </div>
        </section>
      ) : null}

      {form.suggestedTraits ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Suggested traits
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.suggestedTraits}</Markdown>
          </div>
        </section>
      ) : null}

      {primitives.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Bundled primitives ({primitives.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {primitives.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    dispatchOpenPreview({
                      targetType: "PRIMITIVE",
                      targetId: String(p.id),
                      label: p.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                  title={`Open ${p.name} in preview`}
                >
                  {p.name}
                </button>
                <span className="shrink-0 font-mono text-[10px] text-foreground">
                  {p.buCost} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {capabilities.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Bundled capabilities ({capabilities.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {capabilities.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    dispatchOpenPreview({
                      targetType: "CAPABILITY",
                      targetId: String(c.id),
                      label: c.name,
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                  title={`Open ${c.name} in preview`}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}