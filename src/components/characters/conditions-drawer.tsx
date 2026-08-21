"use client";

/**
 * conditions-drawer.tsx — Phase 8.L round 48 (Mashu 2026-08-14)
 *
 * Right-side drawer showing all Play Session Scratchpad conditions
 * for the current character. Two sections:
 *  - "Conditions" — user-authored free-form conditions
 *  - "From sheet" — pre-authored conditions from the character
 *    sheet (capabilities, effects) that the user can engage
 *    quickly. Read-only — editing goes to the source entity.
 *
 * Per Mashu R48:
 *  - Triggered by an edge button (right edge, always-on)
 *  - NOT in the bottom drawer — separate panel
 *  - Each card shows: title, description, modifier preview,
 *    duration badge, active/inactive toggle, edit, delete
 *  - Conditions do NOT auto-clear on rest
 *  - Storage is localStorage (per R48 Q-D)
 */

import { useState } from "react";
import { X, Plus, Power, Pencil, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import {
  useRuntimeConditions,
  type RuntimeCondition,
} from "@/lib/hooks/use-runtime-conditions";
import { ConditionComposer } from "@/components/characters/condition-composer";
import type { HardModifier } from "@/types/swordweave";
import { MODIFIER_TARGET_SPEC } from "@/lib/primitives/modifier-scope";

type ConditionModifier = HardModifier;

interface ConditionsDrawerProps {
  characterId: string;
  open: boolean;
  onClose: () => void;
}

export function ConditionsDrawer({ characterId, open, onClose }: ConditionsDrawerProps) {
  const { conditions, hydrated, create, update, remove, toggle } =
    useRuntimeConditions(open ? characterId : null);
  const [composerInitial, setComposerInitial] = useState<RuntimeCondition | null>(
    null,
  );
  const [composerOpen, setComposerOpen] = useState(false);

  const openComposer = (initial: RuntimeCondition | null = null) => {
    setComposerInitial(initial);
    setComposerOpen(true);
  };

  const closeComposer = () => setComposerOpen(false);

  if (!open) return null;

  const customConditions = conditions.filter((c) => c.source === "custom");
  const sheetConditions = conditions.filter((c) => c.source === "sheet");

  return (
    <>
      {/* Backdrop click-to-close on mobile only — desktop keeps the
          backdrop invisible so the sheet content remains readable. */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-amber-500/30 bg-card shadow-2xl"
        aria-label="Conditions drawer"
      >
        <header className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="size-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Conditions ({conditions.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-amber-500/15"
            aria-label="Close drawer"
          >
            <ChevronRight className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <button
            type="button"
            onClick={() => openComposer(null)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
          >
            <Plus className="size-4" />
            Add condition
          </button>

          {!hydrated && (
            <p className="text-xs italic text-muted-foreground">Loading…</p>
          )}

          {hydrated && conditions.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              No conditions yet. Use the button above to track a temporary
              state like "poisoned" or "exhausted".
            </p>
          )}

          {customConditions.length > 0 && (
            <Section title="Conditions">
              {customConditions.map((c) => (
                <ConditionCardItem
                  key={c.id}
                  condition={c}
                  onToggle={() => toggle(c.id)}
                  onEdit={() => openComposer(c)}
                  onRemove={() => remove(c.id)}
                />
              ))}
            </Section>
          )}

          {sheetConditions.length > 0 && (
            <Section title="From sheet">
              {sheetConditions.map((c) => (
                <ConditionCardItem
                  key={c.id}
                  condition={c}
                  onToggle={() => toggle(c.id)}
                  onEdit={() => openComposer(c)}
                  // Phase 8.L round 68: sheet conditions are
                  // toggleable now (the user wanted to engage/
                  // inhibit primitive triggers). Remove is still
                  // disallowed because the sheet entry will be
                  // re-created on next render by the scanner.
                  onRemove={() => undefined}
                />
              ))}
            </Section>
          )}
        </div>

        <footer className="border-t border-border bg-background/50 px-4 py-2 text-[10px] text-muted-foreground">
          Conditions persist locally and don't auto-clear on rest. Press the X
          to remove.
        </footer>
      </aside>

      {composerOpen && (
        <ConditionComposer
          characterId={characterId}
          initial={composerInitial}
          onClose={() => setComposerOpen(false)}
        />
      )}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ConditionCardItem({
  condition,
  onToggle,
  onEdit,
  onRemove,
  readOnly,
}: {
  condition: RuntimeCondition;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const { active, title, description, tags, modifiers, durationTier } = condition;
  const durationLabel =
    durationTier === "long_rest"
      ? "Long rest"
      : durationTier === "short_rest"
        ? "Short rest"
        : "Manual";

  return (
    <article
      className={`rounded-md border bg-background p-3 transition-opacity ${
        active
          ? "border-amber-500/40"
          : "border-border opacity-60"
      }`}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h4>
          {description && (
            <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={active ? "Deactivate" : "Activate"}
          title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            active
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          <Power className="inline size-3" />
          {active ? "On" : "Off"}
        </button>
      </header>

      {/* Phase 8.L round 53: per-modifier breakdown — target,
          subtargets, op+value, stacking, triggers when. */}
      <div className="space-y-2">
        {modifiers.map((m, i) => (
          <ModifierSummary key={i} modifier={m} />
        ))}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <footer className="mt-2 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <span>{durationLabel}</span>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 transition-colors hover:bg-secondary/40"
              aria-label="Edit condition"
              title="Edit"
            >
              <Pencil className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
            aria-label="Delete condition"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </footer>
    </article>
  );
}

/**
 * Format a single modifier for display in the drawer card.
 * Shows: Target, Sub-targets, Op + value, Stacking, Triggers when.
 */
function ModifierSummary({ modifier }: { modifier: ConditionModifier }) {
  const target = String(modifier.target ?? "attribute");
  const spec =
    MODIFIER_TARGET_SPEC[target as keyof typeof MODIFIER_TARGET_SPEC];
  const targetLabel = spec?.label ?? target;

  // Resolve sub-targets from metadata.targetScope.values
  const scope = (modifier.metadata as { targetScope?: { values?: string[] } } | null)
    ?.targetScope;
  const values = (scope?.values ?? []).map((v) => String(v));
  const subTargets =
    values.length > 0
      ? values
          .map((v) => {
            const optLabels = spec?.optionLabels ?? {};
            return optLabels[v] ?? v.toLowerCase();
          })
          .join(", ")
      : target === "attribute"
        ? "any attribute"
        : "any";

  // Operation + value
  const op = modifier.operation ?? "add";
  const opGlyph: Record<string, string> = {
    add: "+",
    subtract: "−",
    set: "=",
    multiply: "×",
    divide: "÷",
    min: "⌊",
    max: "⌈",
    grant: "grant",
    revoke: "revoke",
  };
  const valueStr = formatValue(modifier.value);
  const opAndValue = `${opGlyph[op] ?? op}${valueStr}`;

  // Stacking
  const stacking = (modifier.stacking ?? "stack").toString();

  // Triggers when
  const cond = modifier.condition as
    | { key?: string; operator?: string; value?: string | number | boolean }
    | undefined;
  const triggersWhen = formatTriggersWhen(cond);

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-amber-700 dark:text-amber-300">
          {targetLabel}
        </span>
        <span className="text-muted-foreground italic">→ {subTargets}</span>
        <span className="ml-auto font-mono font-semibold text-amber-700 dark:text-amber-300">
          {opAndValue}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        <span>
          <span className="font-semibold uppercase">Stack:</span> {stacking}
        </span>
        <span className="text-border">·</span>
        <span>
          <span className="font-semibold uppercase">When:</span> {triggersWhen}
        </span>
      </div>
    </div>
  );
}

function formatValue(value: ConditionModifier["value"]): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  // Object tokens — show a friendly summary
  if (typeof value === "object") {
    const v = value as { kind?: string; value?: unknown };
    if (v.kind === "number" && typeof v.value === "number") {
      return String(v.value);
    }
    if (v.kind === "keyword" && typeof v.value === "string") {
      return `[${v.value}]`;
    }
  }
  return JSON.stringify(value);
}

function formatTriggersWhen(
  cond: { key?: string; operator?: string; value?: string | number | boolean } | undefined,
): string {
  if (!cond || (!cond.key && !cond.value)) return "always";
  const op = cond.operator ?? "equals";
  const valueStr = typeof cond.value === "string" ? cond.value : String(cond.value ?? "");
  const key = cond.key ?? "";
  // Compact operator label
  const opLabel: Record<string, string> = {
    equals: "=",
    "not-equals": "≠",
    "greater-than": ">",
    "greater-than-or-equal": "≥",
    "less-than": "<",
    "less-than-or-equal": "≤",
    includes: "includes",
    exists: "exists",
  };
  return `${key} ${opLabel[op] ?? op} ${valueStr}`.trim();
}