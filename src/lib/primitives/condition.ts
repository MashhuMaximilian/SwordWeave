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
  type ConditionPresetCategory,
  type ConditionPresetKey,
  type ModifierCondition,
} from "@/types/condition";

/**
 * The set of valid operator tokens in a `compound` expression.
 * Anything else (case-sensitive) is a parse error.
 */
const COMPOUND_OPERATORS = new Set(["AND", "OR"]);

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
    if (kind === "compound") {
      const tokens = obj["tokens"];
      if (!Array.isArray(tokens)) {
        throw new Error("compound condition requires tokens: string[].");
      }
      const stringTokens = tokens.map((t) => {
        if (typeof t !== "string") {
          throw new Error("compound condition tokens must be string[].");
        }
        return t;
      });
      // Validate alternating pill/operator structure (Phase 7
      // Q-B m4). N pills and N-1 operators, no trailing operator.
      // Also validate each pill's category prefix and each
      // operator token's value.
      validateCompoundTokens(stringTokens);
      if (stringTokens.length === 0) return null;
      return { kind: "compound", tokens: stringTokens };
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
// Compound token validation (Phase 7 Q-B m4)
// =============================================================================

const VALID_CATEGORIES = new Set<ConditionPresetCategory>([
  "target",
  "actor",
  "scene",
]);

/**
 * Validate the alternating pill/operator structure of a
 * `compound` condition's tokens array. Throws on any structural
 * problem with a descriptive error message.
 *
 * Rules:
 *   - Even-indexed tokens (0, 2, 4, ...) must be pills in the
 *     shape `<category>:<label>` where category is one of
 *     `target` / `actor` / `scene`.
 *   - Odd-indexed tokens (1, 3, 5, ...) must be exactly `"AND"`
 *     or `"OR"`.
 *   - Last token must be a pill (no trailing operator).
 *
 * Empty arrays pass (caller decides what to do — usually `null`).
 */
export function validateCompoundTokens(tokens: readonly string[]): void {
  if (tokens.length === 0) return;
  if (tokens.length % 2 === 0) {
    throw new Error(
      `compound condition requires odd token count (N pills, N-1 operators); got ${tokens.length}.`,
    );
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (i % 2 === 0) {
      // Pill slot
      const colonIdx = token.indexOf(":");
      if (colonIdx === -1) {
        throw new Error(
          `compound condition pill at index ${i} must be '<category>:<label>' (got '${token}').`,
        );
      }
      const category = token.slice(0, colonIdx);
      if (!VALID_CATEGORIES.has(category as ConditionPresetCategory)) {
        throw new Error(
          `compound condition pill at index ${i} has invalid category '${category}' (expected target/actor/scene).`,
        );
      }
      const label = token.slice(colonIdx + 1);
      if (label.length === 0) {
        throw new Error(
          `compound condition pill at index ${i} has empty label.`,
        );
      }
    } else {
      // Operator slot
      if (!COMPOUND_OPERATORS.has(token)) {
        throw new Error(
          `compound condition operator at index ${i} must be 'AND' or 'OR' (got '${token}').`,
        );
      }
    }
  }
}

/**
 * Serialize a `compound` token stream from the structured
 * authoring shape (pills + operators arrays). Walks them in
 * parallel and interleaves them with the `category:` prefix
 * on each pill.
 */
export function serializeCompoundTokens(
  pills: readonly { category: ConditionPresetCategory; label: string }[],
  operators: readonly ("AND" | "OR")[],
): string[] {
  if (pills.length === 0) return [];
  if (operators.length !== pills.length - 1) {
    throw new Error(
      `serializeCompoundTokens: operators.length (${operators.length}) must equal pills.length - 1 (${pills.length - 1}).`,
    );
  }
  const tokens: string[] = [];
  for (let i = 0; i < pills.length; i++) {
    const pill = pills[i]!;
    tokens.push(`${pill.category}:${pill.label}`);
    if (i < operators.length) {
      tokens.push(operators[i]!);
    }
  }
  return tokens;
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
  // 1. Custom-pills path. When the user picks any pills (via the
  //    authoring pills[] + operators[] chain), serialize the
  //    structured shape into the flat token stream and emit a
  //    compound variant. Two or more pills OR any operator
  //    expression → compound. Single pill with no operators →
  //    tags variant (legacy shape, no need for compound).
  //
  // When trimming pills (empty labels get dropped), the
  // operators array must be re-indexed too. Operator at
  // authoring.operators[i] originally sat between pills[i] and
  // pills[i+1]. After trimming, the operator that now sits
  // between the surviving pills[0] and surviving pills[1] is
  // the operator whose LEFT pill is the first surviving pill —
  // we look that up by finding which authoring.operators slot
  // has pills[firstSurvivingIdx] as its left side.
  const trimmed: { category: ConditionPresetCategory; label: string }[] = [];
  // Map: trimmed index → authoring.operators index that connects
  // trimmed[trimmedIdx] to trimmed[trimmedIdx+1].
  const trimmedOps: ("AND" | "OR")[] = [];
  for (let i = 0; i < authoring.pills.length; i++) {
    const p = authoring.pills[i]!;
    if (p.label.trim().length === 0) continue;
    const newIdx = trimmed.length;
    trimmed.push({ category: p.category, label: p.label.trim() });
    if (newIdx > 0) {
      // We just added a 2nd+ surviving pill. Find the operator
      // whose LEFT pill is the previous surviving pill (i.e.
      // operator at authoring.operators[prevSurvivingIdx]).
      // prevSurvivingIdx is the index in authoring.pills of the
      // pill that just became trimmed[newIdx - 1].
      const prevSurvivingIdx = trimmed.length >= 2
        ? authoring.pills.findIndex(
            (q, j) =>
              j < i &&
              q.label.trim().length > 0 &&
              authoring.pills.slice(j + 1, i).every(
                (r) => r.label.trim().length === 0,
              ),
          )
        : -1;
      if (prevSurvivingIdx >= 0 && prevSurvivingIdx < authoring.operators.length) {
        trimmedOps.push(authoring.operators[prevSurvivingIdx]!);
      }
    }
  }

  if (trimmed.length >= 2) {
    // Compound path — multi-pill chain with operators.
    const tokens = serializeCompoundTokens(trimmed, trimmedOps);
    return { kind: "compound", tokens };
  }

  if (trimmed.length === 1) {
    const single = trimmed[0]!;
    return {
      kind: "tags",
      customTags: [`${single.category}:${single.label}`],
    };
  }

  // 2. Tags-only path (author opted in but has no pills).
  //    Empty authoring pills + includeTags flag — kept for
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
  if (condition.kind === "compound") {
    // Walk tokens alternately: pill → operator → pill → ...
    // Render each pill as a tag badge and each operator as
    // a connector. The character sheet displays them inline as
    // "Prone OR Grappled AND Stance".
    const badges: Array<{ kind: "preset" | "tag" | "narrative"; label: string }> = [];
    for (let i = 0; i < condition.tokens.length; i++) {
      const token = condition.tokens[i]!;
      if (i % 2 === 0) {
        // Pill slot — strip category prefix for display
        badges.push({ kind: "tag", label: stripCategoryPrefix(token) });
      } else {
        // Operator slot — render as inline connector (using
        // the same tag kind so the sheet renders it; future
        // improvement: introduce a 'connector' badge kind).
        badges.push({ kind: "tag", label: token });
      }
    }
    return badges;
  }
  if (condition.kind === "narrative") {
    return [{ kind: "narrative", label: condition.text }];
  }
  // Exhaustiveness — should be unreachable
  throw new Error(
    `conditionToBadges: unhandled condition kind '${
      // @ts-expect-error - exhaustiveness check
      condition.kind
    }'`,
  );
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