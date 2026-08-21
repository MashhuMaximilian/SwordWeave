"use client";

/**
 * condition-composer.tsx — Phase 8.L round 52 (Mashu 2026-08-14)
 *
 * Modal for creating or editing a Play Session Scratchpad
 * condition. Per Mashu R48:
 *
 *  - Title (required, e.g. "Poisoned")
 *  - Description (optional, e.g. "Stung by giant spider")
 *  - Tags (multi-tag free-form chips)
 *  - Modifiers (list, EXACT same UI as primitive composer)
 *  - Duration tier: long_rest | short_rest | manual
 *
 * Round 52 (L52): the modifier card now uses the shared
 * `ModifierBuilder` component from
 * src/components/workshops/modifier-builder.tsx — the
 * SAME component the primitive composer uses. This
 * gives the condition composer:
 *   - Target / Change / Value / Stacking / Triggers when
 *     sections (all 5 — matches primitive composer 1:1)
 *   - TokenChipStack + EquationPicker for value
 *   - ConditionPicker for Triggers when
 *   - Chirality/Mirror swap card
 *
 * Conditions are stored in localStorage via use-runtime-conditions.
 * They do NOT clear on long/short rest (Mashu explicit in R48).
 */

import { useState, useMemo } from "react";
import { X, Plus } from "lucide-react";
import type { HardModifier } from "@/types/swordweave";
import {
  MODIFIER_TARGETS,
  MODIFIER_TARGET_SPEC,
  scopeForSelection,
} from "@/lib/primitives/modifier-scope";
import { type ModifierTarget } from "@/lib/primitives/modifier-scope";
import {
  conditionAuthoringFromLegacy,
} from "@/components/sandbox/condition-picker";
import {
  ModifierBuilder,
  blankModifierDraft,
  type ModifierDraft,
} from "@/components/workshops/modifier-builder";
import {
  type RuntimeCondition,
  type DurationTier,
  notifyConditionsChanged,
} from "@/lib/hooks/use-runtime-conditions";

interface ConditionComposerProps {
  characterId: string;
  initial?: RuntimeCondition | null;
  onClose: () => void;
}

export function ConditionComposer({
  characterId,
  initial,
  onClose,
}: ConditionComposerProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagsInput, setTagsInput] = useState(
    (initial?.tags ?? []).join(", "),
  );
  const [durationTier, setDurationTier] = useState<DurationTier>(
    initial?.durationTier ?? "manual",
  );
  const [modifiers, setModifiers] = useState<ModifierDraft[]>(() => {
    if (initial?.modifiers && initial.modifiers.length > 0) {
      return initial.modifiers.map((hm, i) => {
        // Phase 8.L round 52: rebuild v1Condition from saved
        // HardModifier.condition. The legacy modifier format
        // is {key, operator, value} (HardModifierCondition).
        const cond = hm.condition as
          | { key?: string; operator?: string; value?: unknown }
          | undefined;
        const v1Condition = cond
          ? conditionAuthoringFromLegacy(
              cond.key ?? "",
              cond.operator ?? "equals",
              typeof cond.value === "string" ? cond.value : "",
            )
          : blankModifierDraft(`modifier-${i + 1}`).v1Condition;
        const targetValues = Array.isArray(
          (hm.metadata as { targetScope?: { values?: string[] } } | null)
            ?.targetScope?.values,
        )
          ? ((hm.metadata as { targetScope?: { values?: string[] } }).targetScope!.values!)
          : [];

        // Phase 8.L round 57: reconstruct the chip stack from ANY
        // value shape. Previously the composer only handled plain
        // numbers and dropped typed tokens (derived / keyword),
        // equations, and tags on edit, so the user saw an empty
        // value field.
        let tokens: Array<{ kind: string; [k: string]: unknown }> = [];
        let operands: unknown[] = [];
        let valueKind: ModifierDraft["valueKind"] = "number";
        let valueStr: string = "";
        const eqTag: string | undefined = undefined;
        if (typeof hm.value === "number") {
          tokens = [{ kind: "number", value: hm.value }];
          valueStr = String(hm.value);
          valueKind = "number";
        } else if (typeof hm.value === "string") {
          const n = Number(hm.value);
          tokens = Number.isFinite(n)
            ? [{ kind: "number", value: n }]
            : [{ kind: "keyword", value: hm.value }];
          valueStr = hm.value;
          valueKind = "number";
        } else if (hm.value && typeof hm.value === "object") {
          const v = hm.value as { kind?: string; which?: string; value?: unknown; operands?: unknown[]; tag?: string; name?: string; hint?: string };
          if (v.kind === "equation" && Array.isArray(v.operands)) {
            operands = v.operands as never[];
            valueKind = "equation";
          } else if (v.kind === "derived") {
            tokens = [{ kind: "derived", which: v.which ?? "pb" }];
            valueKind = "text";
          } else if (v.kind === "runtime") {
            tokens = [{ kind: "runtime", name: v.name ?? "" }];
            valueKind = "text";
          } else if (v.kind === "keyword") {
            tokens = [{ kind: "keyword", value: v.value ?? "" }];
            valueKind = "text";
          } else if (v.kind === "dice" || v.kind === "roll") {
            tokens = [v as never];
            valueKind = "text";
          } else if (v.kind === "number" || typeof v.value === "number") {
            tokens = [{ kind: "number", value: Number(v.value ?? 0) }];
            valueKind = "number";
          }
          // Tag (e.g. fire) is preserved in metadata — the
          // composer reads it from hm.metadata?.tag if needed.
        }

        // Phase 8.L round 69: read behaviorName from metadata for
        // ALL free-text targets (save_dc, attack_bonus, etc.) —
        // not just 'behavior'. Previously save_dc modifiers lost
        // the sub-target attribute when re-edited.
        const behaviorName =
          typeof hm.metadata?.["behaviorName"] === "string"
            ? (hm.metadata["behaviorName"] as string)
            : typeof hm.metadata?.["freeTextNarrowFocus"] === "string"
              ? (hm.metadata["freeTextNarrowFocus"] as string)
              : "";
        return {
          id: `modifier-${i + 1}`,
          target: (hm.target as ModifierTarget) ?? "attribute",
          operation: (hm.operation || "add") as ModifierDraft["operation"],
          tokens: tokens as never,
          value: valueStr,
          valueKind,
          operands: operands as never,
          targetValues,
          granularity: "broad",
          freeTextNarrowFocus: behaviorName,
          conditionMode: cond && (cond.key || cond.value) ? "custom" : "always",
          conditionKey: cond?.key ?? "",
          conditionOperator: (cond?.operator as ModifierDraft["conditionOperator"] | undefined) ?? "equals",
          conditionValue: typeof cond?.value === "string" ? cond.value : "",
          stacking: (hm.stacking as ModifierDraft["stacking"]) ?? "stack",
          v1Condition,
        };
      });
    }
    return [blankModifierDraft("modifier-1")];
  });

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  // ---------------------------------------------------------------------
  // ModifierBuilder callbacks
  // ---------------------------------------------------------------------
  const updateModifier = (id: string, patch: Partial<ModifierDraft>) => {
    setModifiers((mods) =>
      mods.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const toggleTargetValue = (id: string, opt: string, checked: boolean) => {
    setModifiers((mods) =>
      mods.map((m) => {
        if (m.id !== id) return m;
        const has = m.targetValues.includes(opt);
        if (checked && !has) {
          return { ...m, targetValues: [...m.targetValues, opt] };
        }
        if (!checked && has) {
          return {
            ...m,
            targetValues: m.targetValues.filter((v) => v !== opt),
          };
        }
        return m;
      }),
    );
  };

  const removeModifier = (id: string) => {
    setModifiers((mods) => mods.filter((m) => m.id !== id));
  };

  const addModifier = () => {
    const newId = `modifier-${modifiers.length + 1}`;
    setModifiers((mods) => [...mods, blankModifierDraft(newId)]);
  };

  /**
   * Mirror action: swap the modifier's operation to its chiral
   * pair (Add ↔ Subtract, Multiply ↔ Divide, Min ↔ Max, etc).
   * For Set To: no-op (not mirrorable).
   */
  const mirrorModifier = (id: string) => {
    const mirrorOps: Partial<Record<ModifierDraft["operation"], ModifierDraft["operation"]>> = {
      add: "subtract",
      subtract: "add",
      multiply: "divide",
      divide: "multiply",
      min: "max",
      max: "min",
      grant: "revoke",
      revoke: "grant",
    };
    setModifiers((mods) =>
      mods.map((m) => {
        if (m.id !== id) return m;
        const mirrorOp = mirrorOps[m.operation];
        if (!mirrorOp) return m;
        return { ...m, operation: mirrorOp };
      }),
    );
  };

  // ---------------------------------------------------------------------
  // Convert a single ModifierDraft's value -> the storage shape
  // the engine understands. Round-trips typed tokens and equations
  // (Phase 8.L round 69).
  // ---------------------------------------------------------------------
  const buildHardModifierValue = (
    modifier: ModifierDraft,
  ): HardModifier["value"] => {
    // Equation form: operands[] exists. Wrap in { kind: "equation",
    // operands: [...] }. Engine's equation-resolver (L62) reads
    // both canonical (Operand) and sweep formats.
    if (modifier.valueKind === "equation" && Array.isArray(modifier.operands) && modifier.operands.length > 0) {
      return { kind: "equation", operands: modifier.operands } as never;
    }
    // Single-token forms: derived, keyword, dice, roll, number.
    // Token list takes precedence over the string value field.
    if (Array.isArray(modifier.tokens) && modifier.tokens.length > 0) {
      const t = modifier.tokens[0] as { kind?: string; which?: string; value?: unknown; tag?: string; faces?: number; count?: number };
      if (t.kind === "derived") {
        return { kind: "derived", which: (t.which ?? "pb") as never } as never;
      }
      if (t.kind === "keyword") {
        return { kind: "keyword", text: String(t.value ?? modifier.value) } as never;
      }
      if (t.kind === "number") {
        const n = Number(t.value);
        if (Number.isFinite(n)) return n;
      }
      if (t.kind === "dice" || t.kind === "roll") {
        return { kind: t.kind, ...t } as never;
      }
      if (t.kind === "tag") {
        return { kind: "keyword", text: String(t.tag ?? t.value ?? "") } as never;
      }
    }
    // Fallback: plain number from the string input.
    const numericValue = Number(modifier.value);
    if (Number.isFinite(numericValue)) return numericValue;
    // Last resort: keyword with the raw text (e.g. "/pb/"). Engine
    // reads { kind: "keyword", text } via the equation-resolver.
    if (modifier.value && modifier.value.trim().length > 0) {
      return { kind: "keyword", text: modifier.value.trim() } as never;
    }
    return modifier.value;
  };

  // ---------------------------------------------------------------------
  // Convert ModifierDraft[] -> HardModifier[] for storage
  // ---------------------------------------------------------------------
  const buildHardModifiers = (): HardModifier[] => {
    return modifiers.map((modifier) => {
      const targetForScope = (
        MODIFIER_TARGETS as readonly string[]
      ).includes(modifier.target)
        ? (modifier.target as ModifierTarget)
        : ("attribute" as ModifierTarget);
      const { target: canonicalTarget, metadata: scopeMetadata } =
        scopeForSelection({
          target: targetForScope,
          targetValues: modifier.targetValues,
          granularity: null,
          freeTextNarrowFocus: modifier.freeTextNarrowFocus,
        });
      // Phase 8.L round 69: preserve typed tokens / equations on
      // save. Previously the composer only saved plain numbers or
      // the raw string, dropping the typed-token shape. The engine
      // can read all of these now (L62 equation-resolver dual
      // format), so we round-trip the user's chosen shape.
      const value: HardModifier["value"] = buildHardModifierValue(modifier);

      const hardModifierCondition =
        modifier.conditionMode === "custom" &&
        (modifier.conditionKey || modifier.conditionValue)
          ? {
              key: modifier.conditionKey,
              operator: modifier.conditionOperator,
              value: modifier.conditionValue,
            }
          : undefined;

      // Phase 8.L round 55: include stacking rule (the ModifierBuilder
      // exposes it; previously the condition composer dropped it on
      // save, so the engine always defaulted to "stack"). Stacking
      // modes: stack / highest-only / lowest-only / unique-by-primitive
      // / unique-by-target / replace.
      //
      // Phase 8.L round 76: save behaviorName for free-text
      // targets (currently 'behavior' is the only one).
      // save_dc is widget:none (ONE global Save DC, no
      // sub-target). Attack bonus lives under action_roll's
      // Attack Roll sub-target. Per Mashu R76 there is no
      // per-attribute save_dc / attack_bonus — there's ONE
      // save DC and ONE attack bonus (scales with whichever
      // attribute the character is proficient in).
      const spec = MODIFIER_TARGET_SPEC[canonicalTarget as never] as
        | { widget?: string }
        | undefined;
      const isFreeTextTarget = spec?.widget === "free-text";
      const freeTextKey = modifier.freeTextNarrowFocus.trim();
      const behaviorMetadata =
        isFreeTextTarget && freeTextKey
          ? {
              behaviorName: freeTextKey,
              freeTextNarrowFocus: freeTextKey,
            }
          : canonicalTarget === "behavior" && freeTextKey
            ? {
                behaviorName: freeTextKey,
                freeTextNarrowFocus: freeTextKey,
              }
            : {};
      const hardMod = {
        kind: "modify" as const,
        target: canonicalTarget,
        operation: modifier.operation,
        value,
        stacking: modifier.stacking,
        ...(scopeMetadata
          ? {
              metadata: {
                ...scopeMetadata,
                ...behaviorMetadata,
              } as unknown as Record<string, HardModifier["value"]>,
            }
          : Object.keys(behaviorMetadata).length > 0
            ? { metadata: behaviorMetadata as unknown as Record<string, HardModifier["value"]> }
            : {}),
        ...(hardModifierCondition ? { condition: hardModifierCondition } : {}),
      } as HardModifier;
      return hardMod;
    });
  };

  const save = () => {
    if (!title.trim()) return;
    const hardMods = buildHardModifiers();
    if (initial) {
      const updated: RuntimeCondition = {
        ...initial,
        title: title.trim(),
        description: description.trim(),
        tags,
        modifiers: hardMods,
        durationTier,
      };
      const key = `sw:cond:${characterId}:${initial.id}`;
      try {
        window.localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        // ignore quota errors
      }
      notifyConditionsChanged();
    } else {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newCond: RuntimeCondition = {
        id,
        title: title.trim(),
        description: description.trim(),
        tags,
        modifiers: hardMods,
        durationTier,
        active: true,
        createdAt: Date.now(),
        source: "custom",
      };
      const key = `sw:cond:${characterId}:${id}`;
      try {
        window.localStorage.setItem(key, JSON.stringify(newCond));
      } catch {
        // ignore
      }
      notifyConditionsChanged();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-amber-500/40 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 transition-colors hover:bg-muted"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {initial ? "Edit condition" : "Add condition"}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Runtime conditions are tracked locally. They don't auto-clear on
          rest — press X in the drawer to remove them.
        </p>

        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Title
            <input
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Poisoned"
              autoFocus
            />
          </label>

          <label className="block text-sm font-medium">
            Description (optional)
            <input
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Stung by giant spider"
            />
          </label>

          <label className="block text-sm font-medium">
            Tags (comma-separated)
            <input
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="poison, beast, save_vs_fortitude"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Duration</legend>
            <div className="flex gap-2">
              {(
                [
                  ["long_rest", "Long rest"],
                  ["short_rest", "Short rest"],
                  ["manual", "Manual toggle"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors ${
                    durationTier === value
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="duration"
                    className="sr-only"
                    checked={durationTier === value}
                    onChange={() => setDurationTier(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Modifiers</h3>
              <button
                type="button"
                onClick={addModifier}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-secondary/30"
              >
                <Plus className="size-3" />
                Add modifier
              </button>
            </div>
            {modifiers.map((modifier, index) => (
              <ModifierBuilder
                key={modifier.id}
                modifier={modifier}
                index={index}
                onUpdate={updateModifier}
                onRemove={removeModifier}
                onMirror={mirrorModifier}
                onToggleTargetValue={toggleTargetValue}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-secondary/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="h-9 rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {initial ? "Save" : "Add condition"}
          </button>
        </div>
      </div>
    </div>
  );
}
