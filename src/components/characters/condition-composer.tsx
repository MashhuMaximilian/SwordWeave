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

        // Compute the value for the chip stack. The chip stack
        // expects ValueToken[]; for simple numeric modifiers we
        // synthesize a single number token.
        const valueNum = typeof hm.value === "number" ? hm.value : null;
        const tokens = valueNum !== null
          ? [{ kind: "number" as const, value: valueNum }]
          : [];

        return {
          id: `modifier-${i + 1}`,
          target: (hm.target as ModifierTarget) ?? "attribute",
          operation: (hm.operation || "add") as ModifierDraft["operation"],
          tokens,
          value: String(hm.value ?? ""),
          valueKind: "number" as ModifierDraft["valueKind"],
          operands: [],
          targetValues,
          granularity: "broad",
          freeTextNarrowFocus: "",
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
      const numericValue = Number(modifier.value);
      const value: HardModifier["value"] = Number.isFinite(numericValue)
        ? numericValue
        : modifier.value;

      const hardModifierCondition =
        modifier.conditionMode === "custom" &&
        (modifier.conditionKey || modifier.conditionValue)
          ? {
              key: modifier.conditionKey,
              operator: modifier.conditionOperator,
              value: modifier.conditionValue,
            }
          : undefined;

      const hardMod = {
        kind: "modify" as const,
        target: canonicalTarget,
        operation: modifier.operation,
        value,
        ...(scopeMetadata
          ? {
              metadata: scopeMetadata as unknown as Record<
                string,
                HardModifier["value"]
              >,
            }
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
