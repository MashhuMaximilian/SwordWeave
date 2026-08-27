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
import { humanReadableToken } from "@/lib/engine/condition-dictionary";

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
  // Phase 8.L round 120 (Mashu 2026-08-26): conditions whose
  // source is "sheet-auto" are engine-evaluated (HP thresholds,
  // proficiencies, predicates). They live in a separate
  // read-only section so the user can SEE what's currently
  // engaged without being able to override the engine.
  const autoTriggeredConditions = conditions.filter(
    (c) => c.source === "sheet-auto",
  );

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
            <Section title="Conditions" count={customConditions.length}>
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
            <Section title="From sheet" count={sheetConditions.length}>
              {sheetConditions.map((c) => (
                <ConditionCardItem
                  key={c.id}
                  condition={c}
                  onToggle={() => toggle(c.id)}
                  // Phase 8.L round 119 (Mashu 2026-08-26): sheet
                  // conditions are read-only — the user can
                  // ONLY toggle engage/inhibit. Editing or deleting
                  // doesn't make sense because the source entity
                  // (primitive / effect) owns the modifier.
                  readOnly
                />
              ))}
            </Section>
          )}

          {/* Phase 8.L round 120 (Mashu 2026-08-26):
              auto-triggered conditions — those whose predicate
              is COMPUTABLE by the engine (HP thresholds,
              proficiencies, predicates like is_tracking). They
              can't be manually toggled — the engine decides
              Engaged/Inhibited based on character state. We
              surface them here as read-only so the user knows
              why a primitive is or isn't currently active. */}
          {autoTriggeredConditions.length > 0 && (
            <Section title="Auto-triggered" count={autoTriggeredConditions.length}>
              {autoTriggeredConditions.map((c) => (
                <ConditionCardItem
                  key={c.id}
                  condition={c}
                  onToggle={() => undefined}
                  readOnly
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
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <ChevronRight
            className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
          {title}
          {typeof count === "number" && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
              {count}
            </span>
          )}
        </span>
      </button>
      {open && <div className="space-y-2">{children}</div>}
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
  onEdit?: () => void;
  onRemove?: () => void;
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
        {onToggle && (
          // Phase 8.L round 122 (Mashu 2026-08-26): when
          // onToggle is provided (sheet / custom conditions)
          // we render a real toggle button. For auto-triggered
          // conditions (no onToggle) we render NOTHING — the
          // card's opacity already indicates active/inactive,
          // and a hidden on/off button would be misleading.
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
        )}
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
          {!readOnly && onEdit && (
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
          {!readOnly && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
              aria-label="Delete condition"
              title="Delete"
            >
              <Trash2 className="size-3" />
            </button>
          )}
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
  cond: unknown,
): string {
  if (!cond) return "always";
  // Phase 8.L round 122 (Mashu 2026-08-26): the condition
  // object can be a compound (kind + tokens), a leaf
  // (key/operator/value), or a stat| token. Previously the
  // function only handled the leaf shape, so anything else
  // fell through to "always" — misleading. Now we branch
  // on shape.
  if (typeof cond !== "object" || cond === null) return "always";
  const c = cond as Record<string, unknown>;
  // Compound: AND/OR of multiple pills.
  if (c["kind"] === "compound") {
    const tokens = Array.isArray(c["tokens"]) ? c["tokens"] : [];
    const parts: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = String(tokens[i] ?? "");
      if (i % 2 === 0) {
        // pill token — pipe through humanReadableToken for
        // friendly output (e.g. "actor-below-half-hp" →
        // "HP below 50%", "is_tracking" → "is_tracking").
        parts.push(humanReadableToken(tok));
      } else {
        // connector (AND / OR)
        parts.push(String(tok).toUpperCase());
      }
    }
    return parts.join(" ");
  }
  // Leaf: { key, operator, value }
  if (typeof c["key"] === "string" || c["value"] !== undefined) {
    const op = (c["operator"] as string) ?? "equals";
    const valueStr =
      typeof c["value"] === "string"
        ? c["value"]
        : String(c["value"] ?? "");
    const key = (c["key"] as string) ?? "";
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
  // stat| token or other — best-effort stringification
  return String(cond);
}