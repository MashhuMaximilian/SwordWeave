// Read-only primitive card used in the SandboxLayout Preview column.
// Mirrors the structure of /library/item/PRIMITIVE:<id> detail page but
// stripped of engagement and authorship metadata.

import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";
import type { HardModifier } from "@/types/swordweave";
import {
  OP_SPECS,
  type ModifierOperation,
} from "@/types/modifier";

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
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
  /**
   * Phase 7.5 v4: optional modifier list. When present,
   * each modifier is rendered with its op, target, and
   * mirrorability. The pre-existing primitives built before
   * this field was added carry undefined — those rows
   * just skip the modifier block.
   */
  modifiers?: readonly HardModifier[];
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Phase 7.5 v4: human-readable mirror description for a
 * modifier op. "Add" mirrors to "Subtract" (sign flip),
 * "Multiply" mirrors to "Divide" (value inversion), "Set To"
 * is permission-locked (not mirrorable), etc.
 *
 * This is what the user sees in the source/build preview so
 * they know what the modifier does when invoked in a
 * mirrored context.
 */
export function mirrorDescription(op: ModifierOperation): {
  readonly mirrorable: boolean;
  readonly summary: string;
} {
  const spec = OP_SPECS[op];
  if (!spec.mirrorable || !spec.mirrorOp) {
    return {
      mirrorable: false,
      summary: `Permission-locked — ${op} does not mirror. The effect is one-directional regardless of polarity.`,
    };
  }
  const target = spec.mirrorOp;
  if (spec.mirrorFlipsSign) {
    return {
      mirrorable: true,
      summary: `Mirrors to ${target} (sign flip) — the value is negated in mirrored contexts.`,
    };
  }
  if (spec.mirrorInvertsValue) {
    return {
      mirrorable: true,
      summary: `Mirrors to ${target} (value inversion) — the value becomes its reciprocal in mirrored contexts.`,
    };
  }
  return {
    mirrorable: true,
    summary: `Mirrors to ${target} — the operator flips; the value stays the same.`,
  };
}

export function PrimitivePreview({ row }: { row: PrimitiveRow }) {
  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        {/* Phase 8: entity icon above the title. Falls back to nothing
            when no icon is set so the layout doesn't shift. */}
        {row.iconSource ? (
          <IconDisplay
            iconSource={row.iconSource as "GAME_ICONS" | "UPLOAD"}
            iconKey={row.iconKey}
            iconUrl={row.iconUrl}
            iconColor={row.iconColor}
            size={56}
            className="rounded-md border border-border"
            alt={row.name}
          />
        ) : null}
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

      {row.modifiers && row.modifiers.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Modifiers ({row.modifiers.length})
          </h3>
          <ul className="space-y-1.5 rounded-md border border-border p-2">
            {row.modifiers.map((m, idx) => {
              // Operation may be a string from the database —
              // cast through the OP_SPECS dictionary to get
              // the typed spec. Unknown ops fall through to
              // "not mirrorable" so the preview doesn't crash
              // on legacy data.
              const opKey = String(m.operation) as ModifierOperation;
              const spec = OP_SPECS[opKey];
              const targetShort = String(m.target).split(".").pop() ?? String(m.target);
              const valueText = (() => {
                if (typeof m.value === "number") return String(m.value);
                if (typeof m.value === "boolean") return m.value ? "true" : "false";
                if (m.value === undefined || m.value === null) return "0";
                return String(m.value);
              })();
              const mirror = mirrorDescription(opKey);
              return (
                <li
                  key={`mod-${idx}`}
                  className="rounded border border-border/60 bg-card/50 p-2 text-xs"
                >
                  <div className="flex items-baseline justify-between gap-2 font-mono">
                    <span>
                      <span className="text-muted-foreground">{targetShort}</span>{" "}
                      <span className="font-semibold text-primary">
                        {opKey}
                      </span>{" "}
                      <span>{valueText}</span>
                    </span>
                    <span
                      className={
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide " +
                        (mirror.mirrorable
                          ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300")
                      }
                    >
                      {mirror.mirrorable ? "📊 Mirrorable" : "🔒 Locked"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {mirror.summary}
                  </p>
                </li>
              );
            })}
          </ul>
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