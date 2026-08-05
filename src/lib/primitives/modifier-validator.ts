/**
 * Phase 8.I i1 — Null sub-target validator (Mashu 2026-08-04).
 *
 * The user said: "Attribute increment with target attribute with no
 * attribute selected should not give any modifier to anything for
 * example even if set up. We have to explicitly set a target/sub
 * target."
 *
 * Validation rules per target widget:
 *   - "checklist"               → must have at least one value (non-empty array)
 *   - "free-text"               → must have non-empty text in the free-text field
 *   - "checklist-with-free-text" → at least one value OR non-empty text
 *   - "none"                    → no validation
 *
 * For `behavior:<name>` (free-text), the behavior name is normalized
 * via `normalizeBehaviorName()`. Reserved names (engine keywords,
 * canonical attribute/practice/derived keys) reject at save time.
 *
 * The validator is pure: takes a modifier draft + the target spec,
 * returns an error string or null. The form uses this to block save
 * with a user-facing message. The engine also calls `isModifierValid`
 * to silently drop invalid modifiers at evaluation time (does NOT
 * throw — backwards compat with existing malformed data).
 */
import {
  MODIFIER_TARGET_SPEC,
  type ModifierTarget,
  type ModifierTargetSpec,
} from "@/lib/primitives/modifier-scope";

/**
 * Reserved behavior names — names that cannot be used as a custom
 * `behavior:<name>` because they'd conflict with engine keywords,
 * canonical attributes, practices, or derived values.
 */
const RESERVED_BEHAVIOR_NAMES = new Set<string>([
  // Engine keywords
  "set",
  "add",
  "subtract",
  "multiply",
  "divide",
  "min",
  "max",
  "grant",
  "revoke",
  "stack",
  "highest",
  "lowest",
  "unique",
  "replace",
  "true",
  "false",
  // Canonical attributes
  "physical",
  "mental",
  "magical",
  "magic-abstract",
  // Canonical practices
  "awareness",
  "fieldcraft",
  "influence",
  "reason",
  "vitality",
  "lore",
  "magic",
  "combat",
  "movement",
  "social",
  // Derived
  "pb",
  "pb_half",
  "level",
  // Common reserved
  "behavior",
  "behavior:",
  "",
]);

export interface ModifierDraftForValidation {
  /** The canonical target value (e.g. "attribute", "speed"). */
  readonly target: string;
  /** The multi-select checklist values. */
  readonly targetValues: readonly string[];
  /**
   * Free-text field (used by "free-text" and "checklist-with-free-text"
   * widgets). The form's `ModifierDraft.freeTextNarrowFocus` field
   * plays this role for both strain/scene-pace/behavior
   * ("free-text") and targeting ("checklist-with-free-text").
   */
  readonly freeTextNarrowFocus: string;
}

/**
 * Validate a single modifier draft. Returns an error message or null.
 *
 * The form calls this at save time and surfaces the error to the user.
 * The engine calls `isModifierValid()` (which is cheaper) to silently
 * drop invalid modifiers at evaluation time.
 */
export function validateModifierDraft(
  draft: ModifierDraftForValidation,
): string | null {
  const targetKey = String(draft.target);
  const spec = MODIFIER_TARGET_SPEC[targetKey as ModifierTarget];
  if (!spec) {
    // Unknown target — let the server-side enum handle it.
    return null;
  }

  switch (spec.widget) {
    case "none":
      return null;

    case "checklist": {
      const has = draft.targetValues.some((v) => v && v.length > 0);
      if (!has) {
        return `Select at least one value for "${spec.label}".`;
      }
      return null;
    }

    case "free-text": {
      const text = String(draft.freeTextNarrowFocus ?? "").trim();
      if (text.length === 0) {
        return `Enter a value for "${spec.label}".`;
      }
      // For `behavior:` targets, also validate the name
      if (spec.target === "behavior") {
        return validateBehaviorName(text);
      }
      return null;
    }

    case "checklist-with-free-text": {
      const has = draft.targetValues.some((v) => v && v.length > 0);
      const text = String(draft.freeTextNarrowFocus ?? "").trim();
      if (!has && text.length === 0) {
        return `Select at least one value or enter text for "${spec.label}".`;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Validate a free-text behavior name. Returns null if valid, error
 * string if not.
 *
 * Rules:
 *   - Must be non-empty after stripping whitespace
 *   - Strip whitespace and most punctuation except `-` and `_`
 *   - Must start with a letter
 *   - Normalized form must not be a reserved name
 */
export function validateBehaviorName(rawText: string): string | null {
  const trimmed = String(rawText ?? "").trim();
  if (trimmed.length === 0) {
    return "Behavior name is required.";
  }
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return "Behavior name must start with a letter.";
  }
  const normalized = normalizeBehaviorName(trimmed);
  if (RESERVED_BEHAVIOR_NAMES.has(normalized)) {
    return `Behavior name "${normalized}" is reserved (engine keyword or canonical axis).`;
  }
  return null;
}

/**
 * Normalize a behavior name to lowercase-hyphen form. This is the
 * canonical form used in storage and at runtime.
 *
 *   blockValue  → blockvalue
 *   block-value → block-value
 *   BLOCK_VALUE → block_value
 *   block.value → blockvalue (dots stripped)
 *   block value → blockvalue (spaces stripped)
 */
export function normalizeBehaviorName(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Cheap check: does this modifier draft have a valid (non-empty)
 * sub-target? Used by the engine to silently drop invalid modifiers
 * at evaluation time without parsing the full spec.
 *
 * For backwards compat with existing malformed data, this returns
 * true when the target is missing or unknown (let the engine
 * gracefully no-op rather than throw).
 */
export function isModifierValid(draft: ModifierDraftForValidation): boolean {
  return validateModifierDraft(draft) === null;
}

/**
 * Wrap a validator with a "validate all" loop. Returns the first
 * error message or null. Convenient for the form's save handler.
 */
export function validateModifierDrafts(
  drafts: readonly ModifierDraftForValidation[],
): string | null {
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    if (!draft) continue;
    const err = validateModifierDraft(draft);
    if (err) {
      return `Modifier ${i + 1}: ${err}`;
    }
  }
  return null;
}
