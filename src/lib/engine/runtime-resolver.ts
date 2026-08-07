/**
 * runtime-resolver.ts — Phase 8.I i2.5 (Mashu 2026-08-05)
 *
 * Resolve a typed ValueToken (or OperandValue) against character
 * state. The form's `classifyTypedValue` (form-helpers.ts) emits
 * these tokens when the user types a non-numeric value into the
 * Value field:
 *
 *   - `derived`   — PB / PB/2 / LEVEL (character's current state)
 *   - `attribute` — physical / mental / magical (the character's
 *                   attribute slice, NOT a primitive contribution)
 *   - `practice`  — awareness / fieldcraft / etc. (the character's
 *                   practice roll-up)
 *   - `behavior`  — blockValue / darkvision / etc. (custom variable
 *                   populated by other primitives via `set` ops)
 *   - `dice`      — `2d6+3` (rolled at runtime; modifiers use avg,
 *                   actions use the rolled total)
 *   - `keyword`   — `[fire]` / `[piercing]` (tag-style label;
 *                   contributes 0 to the numeric accumulator)
 *   - `runtime`   — `/blockValue/` (deferred runtime reference;
 *                   treated as a behavior variable)
 *   - `number`    — plain numeric value (already resolved)
 *
 * The engine's `resolveModifiers` reads `mod.value` and resolves
 * it before applying the operation. Backwards compat: a plain
 * number is treated as a resolved value (no lookup).
 *
 * See: docs/phase-8/PHASE-8-I-ASSESSMENT-2026-08-05.md (i2.5)
 */

import type { ValueToken } from "@/types/modifier";
import type { PracticeKey } from "@/types/modifier";

// =============================================================================
// Character context — what the resolver reads against
// =============================================================================

/**
 * Snapshot of character state needed to resolve runtime tokens.
 * Built by the caller (resolve-modifiers.ts) before walking slots.
 */
export interface ResolveContext {
  /** Character's level (1-50). Used by `derived: "level"`. */
  readonly level: number;
  /** Character's proficiency bonus. Used by `derived: "pb"`. */
  readonly pb: number;
  /**
   * Character's attribute slices (each ∈ [-1, +5]).
   * Keys are the engine's canonical names: "physical" | "mental" | "magical".
   * The form uses "magic-abstract" in its chip/ValueToken layer — the
   * resolver normalizes that to "magical" at lookup time.
   */
  readonly attributes: Readonly<Record<"physical" | "mental" | "magical", number>>;
  /**
   * Character's practice roll-ups. Each practice is a number
   * (typically the modifier + PB if proficient). The form's
   * existing resolve practices logic populates these.
   */
  readonly practices: Readonly<Record<PracticeKey, number>>;
  /**
   * Behavior variables populated by `set` ops on `behavior:<name>`
   * targets. Keyed by the behavioral name (lowercased).
   *
   * Populated DURING the modifier walk (Phase 8.I i2.5 — two-pass
   * resolution): the first pass collects behavior values from
   * `set` ops; the second pass resolves other modifiers that may
   * reference those values.
   */
  readonly behaviorVariables: Readonly<Record<string, number>>;
}

// =============================================================================
// Single-token resolution
// =============================================================================

/**
 * Resolve a single typed token to a number. Pure function.
 *
 * Returns NaN for unresolved runtime references (e.g. an
 * undeclared behavior variable). The caller decides whether to
 * drop the modifier or treat NaN as 0.
 */
export function resolveToken(
  token: ValueToken,
  ctx: ResolveContext,
): number {
  switch (token.kind) {
    case "number":
      return token.value;

    case "derived": {
      switch (token.which) {
        case "pb":
          return ctx.pb;
        case "pb_half":
          return ctx.pb / 2;
        // Phase 8.I i2.7c (Mashu 2026-08-06): pb2 / expertise
        // / pb*2 alias 2*pb. Authoring shortcut.
        case "pb2":
        case "expertise":
        case "pb*2":
          return ctx.pb * 2;
        case "level":
          return ctx.level;
      }
      // exhaustive check — should never reach here
      return NaN;
    }

    case "attribute": {
      // Phase 8.I i2.5g: ALL_ATTRIBUTES now uses "magical"
      // matching the engine. We accept both "magical" and the
      // legacy "magic-abstract" kebab form (saved by older
      // form versions) and normalize at the resolver boundary.
      const attr = token.attribute as string;
      const key = (attr === "magic-abstract" ? "magical" : attr) as
        | "physical"
        | "mental"
        | "magical";
      return ctx.attributes[key] ?? 0;
    }

    case "practice":
      return ctx.practices[token.practice] ?? 0;

    case "behavior":
      return ctx.behaviorVariables[token.name] ?? 0;

    case "dice":
      // Dice expressions are rolled by the caller. For modifier
      // math, the contributor returns the expected value (avg).
      // For action resolution, the caller can request the rolled
      // total instead. We return the avg here.
      return rollDice(token.expression).avg;

    case "keyword":
      // Keywords are tag-style labels. They don't contribute to
      // the numeric accumulator. The engine carries them through
      // as a `tags` array on the contribution.
      return 0;

    case "runtime":
      // Deferred runtime references are treated as behavior
      // variables. If the slot-time value isn't yet populated
      // (timeline hasn't shipped), it resolves to 0 (no penalty,
      // no bonus).
      return ctx.behaviorVariables[token.name] ?? 0;
  }
}

// =============================================================================
// Dice roller
// =============================================================================

/**
 * Parse a dice expression and roll it. Returns the average value
 * (sum of expected values), the individual rolls, and the total.
 *
 * Supported expressions:
 *   - "NdM"           e.g. "2d6", "1d20"
 *   - "NdM+k"         e.g. "2d6+3", "1d10-2"
 *   - "NdM+kdM"       e.g. "2d6+1d4" (multi-term)
 *
 * Returns {avg: 0, rolls: [], total: 0} for malformed input.
 */
export function rollDice(expr: string): {
  /** Sum of expected values for each die = floor((N+1)/2) × count. */
  avg: number;
  /** Individual die rolls (without modifiers). */
  rolls: number[];
  /** Final total = sum(rolls) + modifiers. */
  total: number;
} {
  const trimmed = String(expr ?? "").trim();
  if (!trimmed) return { avg: 0, rolls: [], total: 0 };

  // Match "NdM" or "NdM±k" tokens.
  const tokens = trimmed.match(/[+-]?\s*\d+d\d+|[+-]?\s*\d+/gi);
  if (!tokens) return { avg: 0, rolls: [], total: 0 };

  let total = 0;
  let avg = 0;
  const rolls: number[] = [];

  for (const t of tokens) {
    const cleaned = t.replace(/\s+/g, "");
    const sign = cleaned.startsWith("-") ? -1 : 1;
    const body = cleaned.replace(/^[+-]/, "");

    if (body.includes("d")) {
      // Dice term: "2d6"
      const [countStr, sidesStr] = body.split("d");
      const count = sign * Number(countStr);
      const sides = Number(sidesStr);
      if (!Number.isFinite(count) || !Number.isFinite(sides) || sides <= 0) {
        continue;
      }
      for (let i = 0; i < Math.abs(count); i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += sign * roll;
      }
      // Expected value: count × (sides + 1) / 2 (signed)
      avg += count * ((sides + 1) / 2);
    } else {
      // Flat modifier: "±3"
      const n = sign * Number(body);
      if (Number.isFinite(n)) {
        total += n;
        avg += n;
      }
    }
  }

  return { avg, rolls, total };
}

// =============================================================================
// Detect typed tokens
// =============================================================================

/**
 * Returns true if the value is a typed ValueToken (object with
 * a `kind` discriminator). Plain numbers and strings return false.
 */
export function isTypedToken(value: unknown): value is ValueToken {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof (value as { kind: unknown }).kind === "string"
  );
}

/**
 * Resolve a primitive value to a number, dispatching to
 * `resolveToken` for typed tokens, falling through to a parser
 * for plain numbers/strings.
 *
 * Used by `resolveModifiers` when reading `mod.value` before
 * applying the operation.
 */
export function resolveValue(
  value: unknown,
  ctx: ResolveContext,
): number {
  if (isTypedToken(value)) {
    return resolveToken(value, ctx);
  }
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return 0;
}
