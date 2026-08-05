/**
 * Vitality engine — Phase 4.
 *
 * Per Notion: Vitality = (10 + PB) × Level + BU modifiers + cap modifiers.
 */

import { proficiencyBonus } from "./practices";

export interface VitalityModifier {
  readonly source: string;
  readonly amount: number;
}

/**
 * Compute max vitality for a character.
 *
 * @param level Character level (1-20)
 * @param modifiers Extra modifiers from primitives/items/etc
 */
export function computeMaxVitality(
  level: number,
  modifiers: ReadonlyArray<VitalityModifier> = [],
): number {
  const base = (10 + proficiencyBonus(level)) * level;
  const modTotal = modifiers.reduce((t, m) => t + m.amount, 0);
  return base + modTotal;
}

/**
 * Compute vitality bonus from a list of primitives.
 *
 * Phase 8.I i2 (Mashu 2026-08-04): REPLACE name-based heuristic
 * with real hardModifier walks. Previously this filtered by
 * primitive name containing "vitality"/"hp"/"health"/"tough" AND
 * used buCost as the amount. That's exactly the buCost-as-proxy
 * pattern that breaks when authors name primitives anything else.
 *
 * New behaviour: walk each primitive's hardModifiers and pick up
 * `add`/`subtract`/`set` ops that target `max_vitality`. Sum
 * those (with mirror flip).
 *
 * If a primitive has NO hardModifier targeting `max_vitality`,
 * it contributes 0 — the buCost/name-match path is gone.
 */
export function computeVitalityModifiersFromPrimitives(
  primitives: ReadonlyArray<{
    readonly buCost: number;
    readonly category: string;
    readonly name: string;
    /** True if this primitive slot is mirrored at the character level. */
    readonly isMirrored?: boolean;
    readonly hardModifiers?: readonly unknown[];
  }>,
): ReadonlyArray<VitalityModifier> {
  const out: VitalityModifier[] = [];
  for (const p of primitives) {
    const mods = Array.isArray(p.hardModifiers) ? p.hardModifiers : [];
    let amount = 0;
    for (const rawMod of mods) {
      const mod = rawMod as {
        target?: string;
        operation?: string;
        value?: unknown;
      };
      if (String(mod.target ?? "") !== "max_vitality") continue;

      // Phase 8.I i2.5c (Mashu 2026-08-05): typed tokens
      // (PB chip, /physical/, etc.) are stored as objects.
      // Without character state we can't resolve them here,
      // so we skip them — the resolveModifiers() path (with
      // character state) handles typed tokens. Plain numbers
      // still work.
      if (mod.value === null || typeof mod.value === "object") continue;
      const value = typeof mod.value === "number"
        ? mod.value
        : Number(mod.value);
      if (!Number.isFinite(value)) continue;

      const op = String(mod.operation ?? "");
      let delta = 0;
      if (op === "add") delta = value;
      else if (op === "subtract") delta = -value;
      else continue; // multiply/divide/set/grant don't apply to max vitality

      if (p.isMirrored === true) delta = -delta;
      amount += delta;
    }
    if (amount !== 0) {
      out.push({ source: p.name, amount });
    }
  }
  return out;
}