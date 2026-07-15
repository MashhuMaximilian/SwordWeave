"use client";

/**
 * ConditionPicker — Phase 7 Q-B v1 + Q-B-m3
 *
 * Replaces the legacy "Applies When" triple with a 2-part picker:
 *
 *   Part 1: Which categories? (multi-select)
 *     [Target] [Self] [Scene]   ← toggle buttons
 *
 *   Part 2: User-authored pills (per selected category)
 *     For each selected category, the user types their own
 *     free-form pills. No limited preset list — the canonical
 *     CONDITION_PRESETS catalog is suggested via "Insert preset"
 *     but the primary affordance is free text.
 *
 *   Or describe it yourself (free-text narrative escape hatch)
 *
 * No DB change — the stored shape remains the v1
 * `{kind: "tags", customTags: string[]}` variant with each pill
 * prefixed by its category slug (e.g. "target:Prone"). The badge
 * renderer parses the prefix back into a category label.
 */

import { useState, type ReactElement } from "react";
import {
  CONDITION_PRESETS,
  type ConditionAuthoring,
  type ConditionPresetCategory,
  type ConditionPresetEntry,
} from "@/types/condition";

const CATEGORY_LABELS: Record<ConditionPresetCategory, string> = {
  target: "Target",
  // The canonical category key is "actor" (matches presetKey
  // prefixes like actor-stance, actor-below-half-hp). The display
  // label is "Self" per the user's UX rule: conditions on this
  // category apply to the entity using the modifier (the acting
  // character), not a generic "actor" in the narrative sense.
  actor: "Self",
  scene: "Scene",
};

const CATEGORY_ORDER: ConditionPresetCategory[] = ["target", "actor", "scene"];

interface ConditionPickerProps {
  readonly value: ConditionAuthoring;
  readonly onChange: (next: ConditionAuthoring) => void;
}

export function ConditionPicker({
  value,
  onChange,
}: ConditionPickerProps): ReactElement {
  const toggleCategory = (cat: ConditionPresetCategory) => {
    const has = value.categories.includes(cat);
    // If removing the category, also drop pills in it.
    const nextPills = has
      ? value.customPills.filter((p) => p.category !== cat)
      : value.customPills;
    onChange({
      ...value,
      categories: has
        ? value.categories.filter((c) => c !== cat)
        : [...value.categories, cat],
      customPills: nextPills,
    });
  };

  const setNarrative = (text: string) => {
    onChange({ ...value, narrative: text });
  };

  const setIncludeTags = (checked: boolean) => {
    onChange({ ...value, includeTags: checked });
  };

  const addCustomPill = (category: ConditionPresetCategory, label: string) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    const dup = value.customPills.some(
      (p) => p.category === category && p.label === trimmed,
    );
    if (dup) return;
    onChange({
      ...value,
      customPills: [...value.customPills, { category, label: trimmed }],
    });
  };
  const removeCustomPill = (category: ConditionPresetCategory, label: string) => {
    onChange({
      ...value,
      customPills: value.customPills.filter(
        (p) => !(p.category === category && p.label === label),
      ),
    });
  };

  const showIncludeTagsCheckbox = value.customPills.length === 0;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      {/* ── Header ── */}
      <span className="text-sm font-medium">Triggers when…</span>

      {/* ── Part 1: category multi-select ── */}
      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const selected = value.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Part 2: per-category custom pill authoring ── */}
      {value.categories.length > 0 ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {value.categories.map((cat) => {
            const pills = value.customPills.filter(
              (p) => p.category === cat,
            );
            // Suggested presets for this category from the canonical
            // catalog (optional quick-pick). The user is not
            // restricted to these — they can type their own pills.
            const suggestions = CONDITION_PRESETS.filter(
              (p) => p.category === cat,
            );
            return (
              <div key={cat}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]} pills
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {pills.length} pill{pills.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Existing pills as chips with × delete affordance */}
                {pills.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {pills.map((p) => (
                      <span
                        key={`${p.category}:${p.label}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                      >
                        {p.label}
                        <button
                          type="button"
                          onClick={() => removeCustomPill(p.category, p.label)}
                          aria-label={`Remove pill ${p.label}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Free-form pill input */}
                <CustomPillInput
                  onAdd={(label) => addCustomPill(cat, label)}
                />

                {/* Optional suggestions from canonical catalog */}
                {suggestions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {suggestions.map((s) => {
                      const alreadyAdded = pills.some(
                        (p) => p.label === s.label,
                      );
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => addCustomPill(cat, s.label)}
                          disabled={alreadyAdded}
                          title={s.hint ?? s.label}
                          className={
                            alreadyAdded
                              ? "rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground line-through"
                              : "rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                          }
                        >
                          + {s.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Free-text narrative escape hatch ── */}
      <div className="mt-3 border-t border-border pt-3">
        <label
          htmlFor="condition-narrative"
          className="block text-xs font-medium text-muted-foreground"
        >
          Or describe it yourself
        </label>
        <textarea
          id="condition-narrative"
          value={value.narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={2}
          placeholder="e.g. when tracking by smell or in fog"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none ring-ring focus:ring-2"
        />
        {showIncludeTagsCheckbox ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={value.includeTags}
              onChange={(e) => setIncludeTags(e.target.checked)}
              className="size-3.5"
            />
            Show custom pills as separate badges on the character sheet
          </label>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// Custom pill input (per-category)
// =============================================================================

function CustomPillInput({
  onAdd,
}: {
  readonly onAdd: (label: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const t = draft.trim();
    if (t.length === 0) return;
    onAdd(t);
    setDraft("");
  };

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="add a pill…"
        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
      />
      <button
        type="button"
        onClick={submit}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
      >
        + add
      </button>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

export type { ConditionPresetEntry };

/**
 * Convert a legacy `{key, operator, value}` triple into a
 * `ConditionAuthoring` value. Used by `fromHardModifier` to populate
 * the new `v1Condition` field when loading old rows.
 *
 * The legacy shape doesn't carry category metadata, so we don't
 * try to map key prefixes (target-, scene-, actor-) back to
 * categories — we treat the legacy value as narrative text and let
 * the author re-pick categories + pills from the picker.
 */
export function conditionAuthoringFromLegacy(
  conditionKey: string,
  conditionOperator: string,
  conditionValue: string,
): ConditionAuthoring {
  if (!conditionKey && !conditionOperator && !conditionValue) {
    return {
      categories: [],
      customPills: [],
      narrative: "",
      includeTags: false,
    };
  }
  void conditionOperator;
  // Legacy keys like "target-prone" carry a category prefix in v1.
  // Map that prefix back to a category so the picker lights up the
  // correct bucket on load.
  let categories: ConditionPresetCategory[] = [];
  if (conditionKey.startsWith("target-")) categories = ["target"];
  else if (conditionKey.startsWith("scene-")) categories = ["scene"];
  else if (conditionKey.startsWith("actor-")) categories = ["actor"];
  return {
    categories,
    customPills: [],
    narrative: conditionValue || conditionKey,
    includeTags: false,
  };
}

/**
 * Convert the picker's `ConditionAuthoring` back to the legacy
 * triple fields, so the existing `toHardModifier` path keeps working
 * during the migration window.
 *
 * Best-effort projection — the canonical `ModifierCondition` is
 * written via the new `buildCondition()` path. This helper exists
 * only so old code that reads from the legacy cache continues to
 * render something coherent.
 */
export function legacyFieldsFromAuthoring(
  authoring: ConditionAuthoring,
): {
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator: "equals";
  conditionValue: string;
} {
  const isEmpty =
    authoring.categories.length === 0 &&
    authoring.customPills.length === 0 &&
    authoring.narrative.trim().length === 0;
  if (isEmpty) {
    return {
      conditionMode: "always",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "",
    };
  }
  // Best-effort: the legacy triple can only carry one key. Use the
  // first pill's category as a sentinel prefix, or empty if no pills.
  const firstPill = authoring.customPills[0];
  const conditionKey = firstPill
    ? `${firstPill.category}:${firstPill.label}`
    : "";
  return {
    conditionMode: "custom",
    conditionKey,
    conditionOperator: "equals",
    conditionValue:
      authoring.narrative.trim() ||
      authoring.customPills
        .map((p) => `${p.category}:${p.label}`)
        .join(", ") ||
      "",
  };
}