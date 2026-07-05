// Read-only primitive card used in the SandboxLayout Preview column.
// Mirrors the structure of /library/item/PRIMITIVE:<id> detail page but
// stripped of engagement and authorship metadata.

import { Markdown } from "@/components/ui/markdown";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  isPublic: boolean;
  isMirrorable: boolean;
  mirrorVector: string | null;
  mirrorBuCredit: number | null;
  mirrorEligibilityNotes: string | null;
  mechanicalOutputText: string;
  narrativeRule: string;
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function PrimitivePreview({ row }: { row: PrimitiveRow }) {
  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {categoryLabel(row.category)}
        </p>
        <h2 className="text-2xl font-semibold leading-tight">{row.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {row.buCost} BU
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {row.costTier}
          </span>
          <span
            className={
              "rounded-full px-2 py-0.5 font-medium " +
              (row.isPublic
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
            }
          >
            {row.isPublic ? "Public" : "Draft"}
          </span>
        </div>
      </header>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
          Mechanical output
        </h3>
        <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
          <Markdown>{row.mechanicalOutputText}</Markdown>
        </div>
      </section>

      {row.narrativeRule ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Narrative rule
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{row.narrativeRule}</Markdown>
          </div>
        </section>
      ) : null}

      {row.isMirrorable ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Mirror
          </h3>
          <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
            <dt className="text-xs text-muted-foreground">Vector</dt>
            <dd>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {row.mirrorVector ?? "—"}
              </code>
            </dd>
            <dt className="text-xs text-muted-foreground">BU credit</dt>
            <dd>
              <span className="font-mono text-xs">
                {row.mirrorBuCredit ?? 0} BU
              </span>
            </dd>
          </dl>
          {row.mirrorEligibilityNotes ? (
            <div className="prose prose-invert prose-sm mt-2 max-w-none break-words text-sm leading-7">
              <Markdown>{row.mirrorEligibilityNotes}</Markdown>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function PrimitivePreviewEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          No primitive selected
        </p>
        <p className="text-xs text-muted-foreground">
          Pick a primitive from the Library to preview it here, or create a
          new one in the Build tab.
        </p>
      </div>
    </div>
  );
}