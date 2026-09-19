"use client";
import { hasExternalCondition } from "@/lib/character/condition-scope";

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

import { resolveConsequenceConflict } from "@/lib/character/consequences/client-sync";
import { useState } from "react";
import { Plus, Power, Pencil, Trash2, ChevronRight, Bot, X } from "lucide-react";
import {
  useRuntimeConditions,
  type RuntimeCondition,
} from "@/lib/hooks/use-runtime-conditions";
import { PromoteConsequence } from "./promote-consequence";
import { ConditionComposer } from "@/components/characters/condition-composer";
import type { HardModifier } from "@/types/swordweave";
import { MODIFIER_TARGET_SPEC } from "@/lib/primitives/modifier-scope";
import { humanReadableToken } from "@/lib/engine/condition-dictionary";
import { conditionActive } from "@/lib/character/condition-overrides";
import { formatEquationValue } from "@/lib/engine/equation-formatter";
import { parseCondition, conditionToBadges } from "@/lib/primitives/condition";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";

type ConditionModifier = HardModifier;

function humanizeMechanicalDescription(value: string): string {
  return value
    .replace(/when self is when related to/gi, "when the check is related to")
    .replace(/when self is related to/gi, "when the check is related to")
    .replace(/when self is is_([a-z0-9_]+)/gi, (_, token: string) =>
      `when Self is ${token.replaceAll("_", " ")}`,
    )
    .replace(/\bself\b/g, "Self")
    .replace(/\b([a-z]+(?:_[a-z0-9]+)+)\b/gi, (token) =>
      token.replaceAll("_", " "),
    )
    .replace(/\s*\(/g, " (");
}

interface ConditionsDrawerProps {
  characterId: string;
  open: boolean;
  onClose: () => void;
  /**
   * Phase 8.L round 127 (Mashu 2026-08-26): live evaluation
   * of each auto-triggered condition by the engine, computed
   * against the current character state. The drawer uses
   * this to drive the read-only ON/OFF badge instead of the
   * stored `active` flag (which is hardcoded `false` for
   * sheet-auto at creation time and never updated).
   */
  autoEvaluated?: ReadonlyMap<string, { active: boolean; computable: boolean }>;
}

export function ConditionsDrawer({ characterId, open, onClose, autoEvaluated }: ConditionsDrawerProps) {
  const { conditions, hydrated, syncError, update, remove, toggle } =
    useRuntimeConditions(open ? characterId : null);
  const [composerInitial, setComposerInitial] = useState<RuntimeCondition | null>(
    null,
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [resolving,setResolving]=useState<RuntimeCondition|null>(null);
  const [recoveryNote,setRecoveryNote]=useState("");
  const [promoting, setPromoting] = useState<RuntimeCondition | null>(null);

  const openComposer = (initial: RuntimeCondition | null = null) => {
    setComposerInitial(initial);
    setComposerOpen(true);
  };


  if (!open) return null;

  const groups = [
    { key:'manual',title:'Added manually',entries:conditions.filter(c=>c.source==='custom'&&!c.applicationId) },
    { key:'sheet',title:'From sheet',entries:conditions.filter(c=>c.source==='sheet') },
    { key:'automatic',title:'Auto-triggered',entries:conditions.filter(c=>c.source==='sheet-auto') },
    ...[...new Set(conditions.flatMap(c=>c.applicationId?[c.applicationId]:[]))].map(applicationId=>{
      const entries=conditions.filter(c=>c.applicationId===applicationId);
      return {key:applicationId,title:`Action · ${new Date(entries[0]!.createdAt).toLocaleString()}`,entries};
    }),
  ];

  return (
    <>
      {/* Backdrop click-to-close on mobile only — desktop keeps the
          backdrop invisible so the sheet content remains readable. */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <aside
        className="v12-conditions-drawer v12-instrument fixed right-0 top-0 z-40 flex h-full w-full max-w-lg flex-col border-l border-amber-500/30 bg-card shadow-2xl"
        data-character-surface
        aria-label="Consequences drawer"
      >
        <header className="v12-conditions-head v12-section-head flex items-center justify-between border-b border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div>
            <p className="v12-kicker">Right drawer · runtime context</p>
            <h2>Consequences · {conditions.length}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="v12-conditions-close rounded-md p-1 transition-colors hover:bg-amber-500/15"
            aria-label="Close drawer"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="v12-conditions-body flex-1 overflow-y-auto px-4 py-3">
          <button
            type="button"
            onClick={() => openComposer(null)}
            className="v12-conditions-add mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
          >
            <Plus className="size-4" />
            Add consequence
          </button>

          <details className="v12-consequences-about mb-4">
            <summary>
              <span>What are consequences?</span>
              <ChevronRight className="size-3" />
            </summary>
            <p>
              Consequences are the costs, states, and ongoing effects created by
              actions. They can change a roll, limit an option, or remain on the
              character until their recovery is recorded.
            </p>
          </details>

          {syncError && <p role="alert" className="mb-3 text-sm text-destructive">{syncError} Your local changes are retained.<button className="block underline" onClick={() => void resolveConsequenceConflict(characterId, "local")}>Save my local changes against the latest state</button><button className="block underline" onClick={() => void resolveConsequenceConflict(characterId, "server")}>Use synced changes and keep a local backup</button></p>}
          {!hydrated && (
            <p className="text-xs italic text-muted-foreground">Loading…</p>
          )}

          {hydrated && conditions.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              No consequences yet. Use the button above to track a temporary
              state like &quot;poisoned&quot; or &quot;exhausted&quot;.
            </p>
          )}

          {groups.map(group => {
            const entries = group.entries;
            if (!entries.length) return null;
            return (
              <Section key={group.key} title={group.title} count={entries.length}>
                {entries.map(c => (
                  <ConditionCardItem
                    key={c.id}
                    condition={c}
                    active={conditionActive(c, autoEvaluated?.get(c.id))}
                    liveActive={autoEvaluated?.get(c.id)?.active}
                    sourceKind={c.source}
                    onPromote={() => setPromoting(c)}
                    onToggle={() => toggle(c.id, conditionActive(c, autoEvaluated?.get(c.id)))}
                    onReset={typeof c.manualOverride === "boolean" ? () => update(c.id, { manualOverride: undefined }) : undefined}
                    {...(c.source === "custom" ? {
                      onEdit: () => openComposer(c), onRemove: () => remove(c.id),
                      onResolve: () => {setResolving(c);setRecoveryNote(c.recoveryNote??"");},
                    } : {})}
                  />
                ))}
              </Section>
            );
          })}
        </div>

        <footer className="v12-conditions-footer border-t border-border bg-background/50 px-4 py-2 text-xs text-muted-foreground">
          Consequences sync with this character. Rest does not resolve them automatically.
          Resolving records recovery and does not refund vitality.
        </footer>
      </aside>

      {resolving&&<div className="v12-formula-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div role="dialog" aria-modal="true" aria-label="Record recovery" className="v12-formula-modal w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-5"><h2 className="text-xl font-semibold">Resolve {resolving.title}</h2><p>{resolving.recovery||'Record how this consequence was recovered.'}</p><label className="block text-sm">Recovery notes<textarea className="mt-1 w-full rounded border border-border bg-background p-2" value={recoveryNote} onChange={e=>setRecoveryNote(e.target.value)} /></label><p className="text-xs text-muted-foreground">This ends the ongoing effects and records recovery. Previously lost vitality is not refunded.</p><div className="flex gap-2"><button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={()=>{update(resolving.id,{status:'resolved',resolvedAt:Date.now(),active:false,recoveryNote});setResolving(null);}}>Record recovery</button><button className="rounded border border-border px-3 py-2" onClick={()=>setResolving(null)}>Cancel</button></div></div></div>}
      {promoting && <PromoteConsequence characterId={characterId} occurrence={promoting} onClose={() => setPromoting(null)} />}
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
    <div className="v12-condition-group mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="v12-condition-group-toggle mb-2 flex w-full items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
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
      {open && <div className="v12-condition-list space-y-2">{children}</div>}
    </div>
  );
}

export function ConditionCardItem({
  condition, active, onToggle, onEdit, onRemove, onReset, onResolve, onPromote, liveActive, sourceKind,
}: {
  condition: RuntimeCondition;
  active: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onResolve?: () => void;
  onPromote?: () => void;
  onReset?: (() => void) | undefined;
  liveActive?: boolean | undefined;
  sourceKind?: string;
}) {
  const [mechanicsOpen, setMechanicsOpen] = useState(false);
  const { title, description, tags, modifiers, durationTier } = condition;
  const engineWantsOn = liveActive === true && !active;
  const mechanicalDescription = modifiers.length > 0
    ? humanizeMechanicalDescription(mechanicalDescriptionFromModifiers(modifiers))
    : "No mechanical modifier is attached.";
  const durationLabel =
    durationTier === "long_rest"
      ? "Long rest"
      : durationTier === "short_rest"
        ? "Short rest"
        : "Until resolved";

  return (
    <article
      className={`v12-condition-card rounded-md border bg-background p-3 transition-opacity ${
        active
          ? "border-amber-500/40"
          : "border-border opacity-60"
      }`}
    >
      <header className="v12-condition-card-head mb-2 flex items-start justify-between gap-2">
        <span className="v12-condition-medallion" aria-hidden="true"><Power className="size-4" /></span>
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
      </header>

      <button
        type="button"
        className="v12-condition-mechanics-toggle"
        aria-expanded={mechanicsOpen}
        onClick={() => setMechanicsOpen((value) => !value)}
      >
        <span>{mechanicalDescription}</span>
        <ChevronRight className={`size-3 transition-transform ${mechanicsOpen ? "rotate-90" : ""}`} />
      </button>

      <div className="v12-condition-mechanics-panel" hidden={!mechanicsOpen}>
          <div className="v12-condition-runtime-controls">
            <div className="v12-condition-runtime-meta">
              <span>{durationLabel}</span>
              <span>{condition.status === "resolved" ? "Resolved" : active ? "Engaged" : "Inactive"}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {sourceKind === "sheet-auto" && (
                <span
                  data-testid="auto-state"
                  aria-label="Automatically evaluated consequence"
                  title="Calculated from the character state. Manual overrides stay in effect until reset."
                  className="v12-condition-auto-state"
                >
                  <Bot className="size-3" /> Automatic
                </span>
              )}
              {engineWantsOn && (
                <span
                  data-testid="engine-hint"
                  aria-label="Engine wants ON"
                  title="Engine thinks this should be on. Your OFF override is honored until you toggle again."
                  className="v12-condition-engine-hint"
                >
                  Engine wants on
                </span>
              )}
              <button
                type="button"
                onClick={onToggle}
                disabled={condition.status === "resolved"}
                aria-pressed={active}
                aria-label={active ? "Deactivate" : "Activate"}
                title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
                className={`v12-condition-switch ${active ? "is-active" : "is-inactive"}`}
              >
                <Power className="size-3.5" />
                {active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
          <div className="v12-condition-runtime-meta">
            <span>Applied rule</span>
          </div>
          {/* Phase 8.L round 53: per-modifier breakdown — target,
              subtargets, op+value, stacking, triggers when. */}
          <div className="space-y-2">
            {modifiers.map((m, i) => (
              <ModifierSummary key={i} modifier={m} />
            ))}
          </div>
          <div className="v12-condition-supporting-copy">
            {condition.recovery && <p><strong>Recovery:</strong> {condition.recovery}</p>}
            {condition.restrictions?.map((restriction, index) => <p key={index}>{restriction.reason || `Blocks a ${restriction.kind}`}</p>)}
            {condition.applicationSnapshot && condition.applicationSnapshot.vitalityDelta!==0 && <p>Vitality when applied: {condition.applicationSnapshot.vitalityDelta}</p>}
            {condition.recoveryNote && <p>Recovery notes: {condition.recoveryNote}</p>}
            {condition.status === "resolved" && <p>Resolved {condition.resolvedAt ? new Date(condition.resolvedAt).toLocaleString() : ""}</p>}
          </div>
          {tags.length > 0 && (
            <div className="v12-condition-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
          <footer className="v12-condition-actions">
            {condition.promotedPrimitiveId && <a href={`/library/item/PRIMITIVE:${condition.promotedPrimitiveId}`}>Promoted definition</a>}
            {onPromote && !condition.promotedPrimitiveId && <button type="button" onClick={onPromote}>Promote to primitive</button>}
            {onResolve && condition.status !== "resolved" && <button type="button" onClick={onResolve}>Resolve</button>}
            {onReset && <button type="button" onClick={onReset}>{sourceKind === "sheet-auto" ? "Use automatic state" : "Clear override"}</button>}
            {onEdit && <button type="button" onClick={onEdit} aria-label="Edit consequence" title="Edit"><Pencil className="size-3" /> Edit</button>}
            {onRemove && <button type="button" onClick={onRemove} className="is-destructive" aria-label="Delete consequence" title="Delete"><Trash2 className="size-3" /> Delete</button>}
          </footer>
      </div>
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
    <div className="v12-condition-modifier rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px]">
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
      {hasExternalCondition(modifier.condition) && <p className="mt-2 text-muted-foreground">Applies during the action; does not change your sheet totals.</p>}
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
    if (v.kind === "keyword") {
      // Phase 8.L round 131 (Mashu): read text OR value (the
      // composer used to store as \`value\`; the picker writes
      // \`text\`). Both forms are supported.
      const kw = (v as { text?: unknown; value?: unknown }).text ?? v.value;
      if (typeof kw === "string") return `[${kw}]`;
    }
  }
  return formatEquationValue(value);
}

function formatTriggersWhen(
  cond: unknown,
): string {
  if (!cond) return "always";
  try {
    const parsed = parseCondition(cond);
    if (parsed) return conditionToBadges(parsed).map(b => b.axis ? `${b.axis === "actor" ? "Self" : b.axis[0]!.toUpperCase() + b.axis.slice(1)}: ${b.label}` : b.label).join(" ") || "always";
  } catch { /* Legacy leaves are formatted below. */ }
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
        // Phase 8.L round 123 (Mashu): try humanReadableToken
        // first. If it returns the raw token (i.e. unknown
        // shape), strip common prefixes (self:/actor:) so the
        // user at least sees a clean label.
        let label = humanReadableToken(tok);
        if (label === tok && (tok.startsWith("self:") || tok.startsWith("actor:"))) {
          label = tok.replace(/^(self|actor):/, "");
        }
        parts.push(label);
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
  return "Unrecognized condition";
}
