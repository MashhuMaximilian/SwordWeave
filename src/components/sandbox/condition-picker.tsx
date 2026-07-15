"use client";

/**
 * ConditionPicker — Phase 7 Q-B v1
 *
 * Replaces the old Applies-When + 3-field triple with a categorized
 * preset picker + free-text escape hatch.
 *
 * UX shape:
 *
 *   Triggers when…
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ ▾ Target state                                          │
 *   │   [Bleeding] [Prone] [Grappled] [...]   ← pill chips    │
 *   │ ▸ Scene state                                           │
 *   │ ▸ Actor state                                           │
 *   │                                                         │
 *   │ ─── or describe it yourself ───                         │
 *   │ [_________________________________]  ← narrative text   │
 *   │ [ ] Show as separate badges (pills)                     │
 *   │ [add pill…] [+ add]                                     │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Authoring state → canonical `ModifierCondition` via
 * `buildCondition()` in `@/lib/primitives/condition`. Engine does
 * not evaluate in v1; the character sheet displays badges.
 */

import { useState, type ReactElement } from "react";
import {
  CONDITION_PRESETS,
  type ConditionAuthoring,
  type ConditionPresetCategory,
  type ConditionPresetEntry,
  type ConditionPresetKey,
} from "@/types/condition";

const CATEGORY_LABELS: Record<ConditionPresetCategory, string> = {
  target: "Target state",
  scene: "Scene state",
  actor: "Actor state",
};

const CATEGORY_ORDER: ConditionPresetCategory[] = ["target", "scene", "actor"];

interface ConditionPickerProps {
  /** Current authoring state. Read-only from the picker — emit via onChange. */
  readonly value: ConditionAuthoring;
  /** Fired on every change. The parent decides what to do with the new state. */
  readonly onChange: (next: ConditionAuthoring) => void;
}

/**
 * Render the picker. Collapsible category sections (accordions).
 * Default: first category (Target) open, others collapsed.
 *
 * The "clear selection" button (small `x` next to the selected chip)
 * resets `presetKey` to null without touching customTags/narrative,
 * so the author can demote a preset back to tags/narrative without
 * losing other work.
 */
export function ConditionPicker({
  value,
  onChange,
}: ConditionPickerProps): ReactElement {
  const [openCategories, setOpenCategories] = useState<Set<ConditionPresetCategory>>(
    () => new Set<ConditionPresetCategory>(["target"]),
  );

  const toggleCategory = (cat: ConditionPresetCategory) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const setPreset = (key: ConditionPresetKey) => {
    onChange({ ...value, presetKey: key });
  };
  const clearPreset = () => {
    onChange({ ...value, presetKey: null });
  };

  const setNarrative = (text: string) => {
    onChange({ ...value, narrative: text });
  };

  const setIncludeTags = (checked: boolean) => {
    onChange({ ...value, includeTags: checked });
  };

  const addCustomTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed.length === 0) return;
    if (value.customTags.includes(trimmed)) return;
    onChange({ ...value, customTags: [...value.customTags, trimmed] });
  };
  const removeCustomTag = (tag: string) => {
    onChange({
      ...value,
      customTags: value.customTags.filter((t) => t !== tag),
    });
  };

  // Group presets by category for the accordions.
  const grouped = groupByCategory(CONDITION_PRESETS);

  const showCustomTagsSection = value.presetKey === null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Triggers when…</span>
        {value.presetKey ? (
          <button
            type="button"
            onClick={clearPreset}
            className="text-xs text-muted-foreground hover:underline"
            title="Clear preset (keeps custom tags and narrative)"
          >
            clear preset
          </button>
        ) : null}
      </div>

      {/* ── Accordion: preset chips grouped by category ── */}
      <div className="mt-2 flex flex-col gap-2">
        {CATEGORY_ORDER.map((cat) => {
          const entries = grouped[cat];
          const isOpen = openCategories.has(cat);
          return (
            <div key={cat} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                aria-expanded={isOpen}
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="text-muted-foreground">
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen ? (
                <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
                  {entries.map((entry) => {
                    const selected = value.presetKey === entry.key;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setPreset(entry.key)}
                        title={entry.hint ?? entry.label}
                        className={
                          selected
                            ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                            : "rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                        }
                      >
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Custom tags (preset's own customTags ride along, plus the
              tags-only path) ── */}
      <div className="mt-3 border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">
          Custom pills
        </span>
        {value.customTags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {value.customTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeCustomTag(tag)}
                  aria-label={`Remove pill ${tag}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <CustomTagInput onAdd={addCustomTag} />
      </div>

      {/* ── Free-text escape hatch (narrative) ── */}
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
        {showCustomTagsSection ? (
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
// Custom tag input
// =============================================================================

function CustomTagInput({
  onAdd,
}: {
  readonly onAdd: (tag: string) => void;
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

function groupByCategory(
  entries: readonly ConditionPresetEntry[],
): Record<ConditionPresetCategory, ConditionPresetEntry[]> {
  const out: Record<ConditionPresetCategory, ConditionPresetEntry[]> = {
    target: [],
    scene: [],
    actor: [],
  };
  for (const e of entries) {
    out[e.category].push(e);
  }
  return out;
}

/**
 * Convert a legacy `{key, operator, value}` triple (the shape
 * `ModifierDraft.conditionKey/conditionOperator/conditionValue` carry
 * during the migration window) into a `ConditionAuthoring` value, so
 * the new picker can show existing rows correctly.
 *
 * Used by `fromHardModifier` to populate the new `v1Condition` field
 * when loading old rows.
 */
export function conditionAuthoringFromLegacy(
  conditionKey: string,
  conditionOperator: string,
  conditionValue: string,
): ConditionAuthoring {
  // No legacy condition at all.
  if (!conditionKey && !conditionOperator && !conditionValue) {
    return {
      presetKey: null,
      customTags: [],
      narrative: "",
      includeTags: false,
    };
  }

  // The legacy form's "Mode" toggle is captured separately — if
  // conditionMode is "always" the upstream caller won't reach this
  // function. When called here, conditionMode was "custom", meaning
  // the user typed something. We can't perfectly recover intent, so
  // we default to a narrative variant carrying the legacy value as
  // the text. The author can re-pick a preset from the picker.
  //
  // Future enhancement: detect that `conditionKey` matches a known
  // preset slug and pre-populate the preset variant. v1 keeps it
  // simple — narrative fallback for unknown legacy shapes.
  void conditionOperator; // intentionally unused in v1
  return {
    presetKey: null,
    customTags: [],
    narrative: conditionValue || conditionKey,
    includeTags: false,
  };
}

/**
 * Convert the picker's `ConditionAuthoring` back to the legacy
 * triple fields, so the existing `toHardModifier` path keeps working
 * without a separate code path for the new shape.
 *
 * In practice this is only used during the migration window: new
 * rows write the canonical `ModifierCondition` (via the new shape
 * coming next), and the legacy fields are kept in sync as a
 * transitional cache.
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
    authoring.presetKey === null &&
    authoring.customTags.length === 0 &&
    authoring.narrative.trim().length === 0;
  if (isEmpty) {
    return {
      conditionMode: "always",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "",
    };
  }
  // Best-effort projection to the legacy triple. The canonical
  // `ModifierCondition` is written via the new path; the legacy
  // fields are a transitional cache so old `toHardModifier` still
  // emits something coherent.
  return {
    conditionMode: "custom",
    conditionKey: authoring.presetKey ?? "",
    conditionOperator: "equals",
    conditionValue:
      authoring.narrative.trim() ||
      authoring.customTags.join(", ") ||
      "",
  };
}