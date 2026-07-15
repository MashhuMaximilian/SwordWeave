/**
 * SwordWeave Condition v1 — parser, authoring helpers, and migration.
 *
 * Three responsibilities:
 *
 *   1. `parseCondition(raw)` — accepts legacy `{key, operator, value}`
 *      OR new `{kind: "preset", presetKey, customTags}` /
 *      `{kind: "narrative", text}`. Returns the v1 `ModifierCondition`
 *      or `null` if no condition is set.
 *
 *   2. `buildCondition(authoring)` — takes the form's
 *      `ConditionAuthoring` (preset + custom tags + narrative) and
 *      produces the canonical `ModifierCondition`. Returns `null` if
 *      everything is empty.
 *
 *   3. `migrateLegacyCondition(legacy)` — explicit migrator for the
 *      one-time DB backfill. If `legacy.key` matches a known preset,
 *      returns a `preset` variant; otherwise returns a `narrative`
 *      variant with the legacy value as the text. The legacy
 *      `operator` field is dropped (v1 doesn't evaluate).
 *
 * All three are pure — no DB calls, no side effects, fully testable.
 */

import {
  CONDITION_PRESET_KEYS,
  type ConditionAuthoring,
  type ConditionPresetKey,
  type ModifierCondition,
} from "@/types/condition";

// =============================================================================
// Parser — accepts both legacy and new shapes
// =============================================================================

/**
 * Parse a raw condition payload (from DB row, API request, or legacy
 * JSON) into a v1 `ModifierCondition`. Returns `null` if the input
 * has no condition.
 *
 * Accepts:
 *   - `undefined` / `null` → `null`
 *   - `{kind: "preset", presetKey, customTags}` → `preset` variant
 *   - `{kind: "narrative", text}` → `narrative` variant
 *   - `{kind: "preset", ...}` with an unknown `presetKey` → throws
 *   - `{key, operator, value}` (legacy) → migrates inline
 *   - `{}` (empty object) → `null`
 *
 * Throws on malformed shapes (e.g. `presetKey` set but `kind` missing,
 * or `text` set but not a string). Callers in API routes should
 * catch and convert to a 400.
 */
export function parseCondition(
  raw: unknown,
): ModifierCondition | null {
  if (raw === undefined || raw === null) return null;

  if (typeof raw !== "object") {
    throw new Error("condition must be an object or null.");
  }

  const obj = raw as Record<string, unknown>;

  // New shape — has `kind`
  if ("kind" in obj) {
    const kind = obj["kind"];
    if (kind === "preset") {
      const presetKey = obj["presetKey"];
      if (typeof presetKey !== "string") {
        throw new Error("preset condition requires presetKey: string.");
      }
      if (!CONDITION_PRESET_KEYS.has(presetKey)) {
        throw new Error(`unknown presetKey: ${presetKey}`);
      }
      const customTags = Array.isArray(obj["customTags"])
        ? obj["customTags"].map((t) => {
            if (typeof t !== "string") {
              throw new Error(
                "preset condition customTags must be string[].",
              );
            }
            return t;
          })
        : [];
      return {
        kind: "preset",
        presetKey: presetKey as ConditionPresetKey,
        customTags,
      };
    }
    if (kind === "narrative") {
      const text = obj["text"];
      if (typeof text !== "string") {
        throw new Error("narrative condition requires text: string.");
      }
      return { kind: "narrative", text };
    }
    if (kind === "tags") {
      const customTags = Array.isArray(obj["customTags"])
        ? obj["customTags"].map((t) => {
            if (typeof t !== "string") {
              throw new Error("tags condition customTags must be string[].");
            }
            return t;
          })
        : [];
      // Empty tags is treated as "no condition" — never returns
      // an empty tags variant (would render as nothing on the sheet).
      if (customTags.length === 0) return null;
      return { kind: "tags", customTags };
    }
    throw new Error(`unknown condition kind: ${String(kind)}`);
  }

  // Legacy shape — has `key` / `operator` / `value`
  if ("key" in obj) {
    return migrateLegacyCondition({
      key: String(obj["key"]),
      operator: String(obj["operator"] ?? ""),
      value: obj["value"],
    });
  }

  // Unknown shape — empty
  return null;
}

// =============================================================================
// Authoring helper — picker UI → canonical shape
// =============================================================================

/**
 * Reduce the picker's authoring state to a single
 * `ModifierCondition` (or `null`).
 *
 * Precedence:
 *   1. If a preset is picked → return a `preset` variant. Custom
 *      tags ride along on the preset. Narrative is dropped because
 *      the preset already carries the mechanic intent.
 *
 *   2. Else if `includeTags` is true AND at least one trimmed tag
 *      is non-empty → return a `tags` variant. The author opted
 *      into "I want pills but no preset" mode.
 *
 *   3. Else if narrative text (trimmed) is non-empty → return a
 *      `narrative` variant. Custom tags, if any, are folded into
 *      the narrative text as a comma-separated prefix — they're
 *      being treated as descriptive prose, not separate badges.
 *
 *   4. Else → return `null` (no condition).
 *
 * Examples:
 *
 *   `{ presetKey: "target-prone", customTags: [], narrative: "", includeTags: false }`
 *     → `{ kind: "preset", presetKey: "target-prone", customTags: [] }`
 *
 *   `{ presetKey: null, customTags: ["when wounded"], narrative: "", includeTags: true }`
 *     → `{ kind: "tags", customTags: ["when wounded"] }`
 *
 *   `{ presetKey: null, customTags: ["when wounded"], narrative: "", includeTags: false }`
 *     → `null` (no preset, no narrative, tags opted out — nothing)
 *
 *   `{ presetKey: null, customTags: [], narrative: "during a full moon", includeTags: true }`
 *     → `{ kind: "narrative", text: "during a full moon" }` (narrative wins because tags empty)
 */
export function buildCondition(
  authoring: ConditionAuthoring,
): ModifierCondition | null {
  // 1. Custom-pills path. When the user picks any categories and
  //    authors pills under them, we emit a tags variant where each
  //    pill is prefixed with its category slug ("target:Prone").
  //    This keeps storage shape compatible with the v1 schema
  //    (no DB migration) and lets conditionToBadges render pills
  //    bucketed under their category labels.
  const pills = authoring.customPills
    .map((p) => ({
      category: p.category,
      label: p.label.trim(),
    }))
    .filter((p) => p.label.length > 0);

  if (pills.length > 0) {
    const prefixed = pills.map(
      (p) => `${p.category}:${p.label}`,
    );
    return { kind: "tags", customTags: prefixed };
  }

  // 2. Tags-only path (author opted in but has no pills).
  //    Empty authoring customPills + includeTags flag — kept for
  //    backwards compat with the legacy authoring shape.
  void authoring.categories;
  void authoring.includeTags;

  // 3. Narrative path — fold any un-tagged tags in as a prefix.
  const trimmedNarrative = authoring.narrative.trim();
  if (trimmedNarrative.length > 0) {
    return { kind: "narrative", text: trimmedNarrative };
  }

  // 4. Nothing meaningful.
  return null;
}

// =============================================================================
// Migration — explicit one-shot for DB backfill
// =============================================================================

/**
 * Migrate a legacy `{key, operator, value}` row to v1.
 *
 *   - If `legacy.key` matches a known preset → `preset` variant with
 *     empty customTags.
 *   - Otherwise → `narrative` variant. The text is taken from
 *     `legacy.value` if it's a string, otherwise the key itself
 *     is used as a fallback so no authoring intent is lost.
 *
 * The `operator` field is **dropped** because v1 doesn't evaluate
 * conditions. If we add runtime evaluation later (Q2 option A),
 * we'll need a second migration pass keyed on the preset.
 */
export function migrateLegacyCondition(legacy: {
  key: string;
  operator?: string;
  value?: unknown;
}): ModifierCondition | null {
  if (!legacy.key) return null;

  if (CONDITION_PRESET_KEYS.has(legacy.key)) {
    return {
      kind: "preset",
      presetKey: legacy.key as ConditionPresetKey,
      customTags: [],
    };
  }

  // Unknown key — preserve intent as narrative.
  const text =
    typeof legacy.value === "string" && legacy.value.length > 0
      ? legacy.value
      : legacy.key;

  return { kind: "narrative", text };
}

// =============================================================================
// Display helpers — used by the character sheet
// =============================================================================

/**
 * Render a `ModifierCondition` as a list of badge labels for the
 * character sheet. The DM and the player see this verbatim.
 *
 * Each preset contributes one badge (its label from
 * `CONDITION_PRESETS`). Each customTag is its own badge.
 *
 * For `tags` (customTags-only), each tag is its own pill.
 *
 * For `narrative`, returns a single-element array with the text
 * (the character sheet renders narrative as italic, not a badge).
 */
export function conditionToBadges(
  condition: ModifierCondition | null,
): Array<{ kind: "preset" | "tag" | "narrative"; label: string }> {
  if (!condition) return [];
  if (condition.kind === "preset") {
    return [
      {
        kind: "preset",
        label: presetLabel(condition.presetKey) ?? condition.presetKey,
      },
      ...condition.customTags.map((t) => ({ kind: "tag" as const, label: t })),
    ];
  }
  if (condition.kind === "tags") {
    // Each pill may carry a "category:label" prefix (Phase 7 Q-B m3
    // — author can add custom pills bucketed under Target / Self /
    // Scene). Strip the prefix for rendering; the category is
    // surfaced via the surrounding UI section.
    return condition.customTags.map((t) => ({
      kind: "tag" as const,
      label: stripCategoryPrefix(t),
    }));
  }
  // condition.kind === "narrative"
  return [{ kind: "narrative", label: condition.text }];
}

// =============================================================================
// Helpers
// =============================================================================

const KNOWN_CATEGORY_PREFIXES = new Set(["target", "actor", "scene"]);

/**
 * Strip the "category:" prefix from a tag pill. If the prefix is
 * not one of the canonical categories, return the pill verbatim.
 * Used by conditionToBadges when rendering tags stored under the
 * `{kind: "tags", customTags}` variant.
 */
function stripCategoryPrefix(pill: string): string {
  const idx = pill.indexOf(":");
  if (idx === -1) return pill;
  const prefix = pill.slice(0, idx);
  if (!KNOWN_CATEGORY_PREFIXES.has(prefix)) return pill;
  return pill.slice(idx + 1);
}

// =============================================================================
// Internal — look up a preset's display label
// =============================================================================

import { CONDITION_PRESETS } from "@/types/condition";

/**
 * Internal — returns the human-readable label for a canonical preset
 * key, or `null` if the key isn't in the catalog. Used by
 * `conditionToBadges` and by the picker UI.
 *
 * Kept in this file (not in `types/condition.ts`) because it
 * imports the full catalog and is only needed at the runtime layer.
 */
export function presetLabel(key: string): string | null {
  const entry = CONDITION_PRESETS.find((p) => p.key === key);
  return entry ? entry.label : null;
}

// =============================================================================
// Migration window — legacy triple projection
// =============================================================================

/**
 * Phase-7-Q-B: project any condition shape (legacy `{key, operator,
 * value}` OR v1 `{kind, ...}`) into a legacy triple. Used by code
 * paths that still carry a `ModifierDraft.conditionKey/Operator/Value`
 * cache during the migration window.
 *
 * The v1 engine does not evaluate, so the `operator` is always
 * coerced to `"equals"` for the legacy fields — the original operator
 * is dropped on the floor. Authoring intent (text, preset name,
 * custom tags) is preserved via the `value` field.
 *
 * Pure function. No side effects.
 */
export function legacyConditionProjection(
  raw: unknown,
): { key: string; operator: "equals"; value: string } {
  const EMPTY = { key: "", operator: "equals" as const, value: "" };
  if (raw === undefined || raw === null) return EMPTY;
  if (typeof raw !== "object") return EMPTY;
  const obj = raw as Record<string, unknown>;
  // New v1 shape — has `kind`
  if ("kind" in obj) {
    const kind = obj["kind"];
    if (kind === "preset") {
      return {
        key: typeof obj["presetKey"] === "string" ? obj["presetKey"] : "",
        operator: "equals",
        value: "",
      };
    }
    if (kind === "narrative") {
      return {
        key: "",
        operator: "equals",
        value: typeof obj["text"] === "string" ? obj["text"] : "",
      };
    }
    if (kind === "tags") {
      const tags = Array.isArray(obj["customTags"])
        ? obj["customTags"].filter((t): t is string => typeof t === "string")
        : [];
      return {
        key: "",
        operator: "equals",
        value: tags.join(", "),
      };
    }
    return EMPTY;
  }
  // Legacy shape — has `key` / `operator` / `value`
  if ("key" in obj) {
    const value = obj["value"];
    return {
      key: typeof obj["key"] === "string" ? obj["key"] : "",
      operator: "equals", // ignore original operator; v1 doesn't evaluate
      value:
        value === undefined || value === null
          ? ""
          : typeof value === "string"
            ? value
            : String(value),
    };
  }
  return EMPTY;
}