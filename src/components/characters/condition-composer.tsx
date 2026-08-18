"use client";

/**
 * condition-composer.tsx — Phase 8.L round 48 (Mashu 2026-08-14)
 *
 * Modal for creating or editing a Play Session Scratchpad
 * condition. Per Mashu R48:
 *
 *  - Title (required, e.g. "Poisoned")
 *  - Description (optional, e.g. "Stung by giant spider")
 *  - Tags (multi-tag free-form chips)
 *  - Modifiers (list, same UI as primitive composer)
 *  - Trigger (when... clause, optional)
 *  - Duration tier: long_rest | short_rest | manual
 *
 * Reuses MODIFIER_TARGET_SPEC + scopeForSelection from the
 * primitive composer so the modifier UI stays in lockstep.
 *
 * Conditions are stored in localStorage via use-runtime-conditions.
 * They do NOT clear on long/short rest (Mashu explicit in R48).
 */

import { useState, useMemo, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { HardModifier } from "@/types/swordweave";
import type { ModifierOperation } from "@/types/swordweave";
import { type ModifierTarget } from "@/lib/primitives/modifier-scope";
import {
  MODIFIER_TARGET_SPEC,
  MODIFIER_TARGETS,
  scopeForSelection,
} from "@/lib/primitives/modifier-scope";
import {
  type RuntimeCondition,
  type DurationTier,
  notifyConditionsChanged,
} from "@/lib/hooks/use-runtime-conditions";

// ModifierDraft shape mirrors the atelier primitive form so the
// modifier UI stays in lockstep. The shape is local to this file
// (we don't import from primitive-registry because that file is
// huge — better to duplicate the shape than drag in 2000 lines).
interface ModifierDraft {
  id: string;
  target: string; // short axis (matches MODIFIER_TARGETS)
  operation: ModifierOperation;
  value: string;
  targetValues: string[];
  freeTextNarrowFocus: string;
  granularity: "broad" | "narrow" | null;
}

const blankModifier: ModifierDraft = {
  id: "modifier-1",
  target: "attribute",
  operation: "add",
  value: "",
  targetValues: [],
  freeTextNarrowFocus: "",
  granularity: "broad",
};

const targetOptions: ReadonlyArray<{ label: string; value: string }> =
  MODIFIER_TARGETS.map((t) => ({
    label: MODIFIER_TARGET_SPEC[t].label,
    value: t,
  }));

const operationsList: Array<{ label: string; value: ModifierOperation }> = [
  { label: "Add (+)", value: "add" },
  { label: "Subtract (−)", value: "subtract" },
  { label: "Set (=)", value: "set" },
  { label: "Multiply (×)", value: "multiply" },
  { label: "Min (⌊)", value: "min" },
  { label: "Max (⌈)", value: "max" },
  { label: "Grant", value: "grant" },
];

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
      return initial.modifiers.map((hm, i) => ({
        id: `modifier-${i + 1}`,
        target: 'attribute',
        operation: (hm.operation || 'add'),
        value: typeof hm.value === 'number' ? String(hm.value) : typeof hm.value === 'string' ? hm.value : '',
        targetValues: Array.isArray((hm.metadata as { targetScope?: { values?: string[] } } | null)?.targetScope?.values)
          ? ((hm.metadata as { targetScope?: { values?: string[] } }).targetScope!.values!)
          : [],
        freeTextNarrowFocus: '',
        granularity: 'broad' as const,
      }));
    }
    return [blankModifier];
  });

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const updateModifier = (id: string, field: keyof ModifierDraft, val: unknown) => {
    setModifiers((mods) =>
      mods.map((m) => (m.id === id ? { ...m, [field]: val } : m)),
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
    setModifiers((mods) => [...mods, { ...blankModifier, id: newId }]);
  };

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
          granularity:
            targetForScope === "skill_practice_check"
              ? modifier.granularity
              : null,
          freeTextNarrowFocus: modifier.freeTextNarrowFocus,
        });
      const numericValue = Number(modifier.value);
      const value: HardModifier["value"] = Number.isFinite(numericValue)
        ? numericValue
        : modifier.value;
      const hardMod = {
        kind: "modify" as const,
        target: canonicalTarget,
        operation: modifier.operation,
        value,
        ...(scopeMetadata ? { metadata: scopeMetadata as unknown as Record<string, HardModifier["value"]> } : {}),
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
          Runtime conditions are tracked locally. They don't auto-clear on rest —
          press X in the drawer to remove them.
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
            {modifiers.map((modifier, index) => {
              const currentTarget: ModifierTarget = (
                MODIFIER_TARGETS as readonly string[]
              ).includes(modifier.target)
                ? (modifier.target as ModifierTarget)
                : ("attribute" as ModifierTarget);
              const spec = MODIFIER_TARGET_SPEC[currentTarget];
              return (
                <div
                  key={modifier.id}
                  className="space-y-3 rounded-md border border-amber-500/30 bg-background p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Modifier {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeModifier(modifier.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-medium">
                      What changes?
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
                        value={modifier.target}
                        onChange={(e) =>
                          updateModifier(
                            modifier.id,
                            "target",
                            e.target.value,
                          )
                        }
                      >
                        {targetOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-medium">
                      Operation
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
                        value={modifier.operation}
                        onChange={(e) =>
                          updateModifier(
                            modifier.id,
                            "operation",
                            e.target.value as ModifierOperation,
                          )
                        }
                      >
                        {operationsList.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {(spec.widget === "checklist" ||
                    spec.widget === "checklist-with-free-text") && (
                    <div className="space-y-2 rounded-md border border-border bg-background/50 p-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {spec.label} — empty = any
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                        {(spec.options ?? []).map((opt: string) => {
                          const checked = modifier.targetValues.includes(opt);
                          const label = spec.optionLabels?.[opt] ?? opt;
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  toggleTargetValue(
                                    modifier.id,
                                    opt,
                                    e.target.checked,
                                  )
                                }
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {spec.widget === "free-text" && (
                    <label className="block text-xs font-medium">
                      {spec.label} details
                      <input
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
                        value={modifier.freeTextNarrowFocus}
                        onChange={(e) =>
                          updateModifier(
                            modifier.id,
                            "freeTextNarrowFocus",
                            e.target.value,
                          )
                        }
                        placeholder={spec.freeTextPlaceholder ?? ""}
                      />
                    </label>
                  )}

                  {spec.widget === "none" && (
                    <p className="text-xs text-muted-foreground italic">
                      Affects all {spec.label.toLowerCase()} by default — set value below.
                    </p>
                  )}

                  <label className="block text-xs font-medium">
                    Value
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
                      value={modifier.value}
                      onChange={(e) =>
                        updateModifier(modifier.id, "value", e.target.value)
                      }
                      placeholder="e.g. -1, 0.5, 10"
                      type="text"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              );
            })}
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