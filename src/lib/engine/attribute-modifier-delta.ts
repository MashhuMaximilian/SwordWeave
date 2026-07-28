/**
 * attribute-modifier-delta.ts — Phase 8.4 (Mashu 2026-07-28)
 *
 * Compute the **per-attribute modifier delta** that a character's
 * slotted primitives should contribute to their P / Me / Ma modifiers.
 *
 * Why this exists:
 *   The character sheet's CoreStatsCard and BottomStickyBar used to
 *   show modifiers computed from the raw attribute scores only:
 *   `Math.floor((attr - 10) / 2)`. The user's complaint on
 *   2026-07-28: "the modifiers are not properly resolved for
 *   attributes idk why they are with minus. And maybe they don't
 *   take into concern mirrored primitives or primitives."
 *
 *   The full engine wiring (`aggregateCharacterSheet` evaluating
 *   per-primitive `hardModifiers` is tracked separately in the
 *   Phase 7.5 / 7.9 modifier-rebuild spec). For the v1 sheet we
 *   approximate the contribution by:
 *     1. Walking each slotted primitive's `hardModifiers[]`.
 *     2. For each modifier whose target resolves to one of the
 *        three attributes (via `modifierMatchesScope` — short
 *        axis "attribute" / layer "ATTRIBUTE" / legacy dotted
 *        "character.attribute.{physical,mental,magical}"), apply
 *        its numeric value via the op's "add" + "subtract" curve.
 *     3. If the primitive is mirrored, flip the sign of the
 *        contribution (per `applyMirror` round-trip semantics).
 *   The delta is the difference between the resolved attribute
 *   score and the base — so the displayed `Math.floor((resolved
 *   - 10) / 2)` modifier is the raw modifier plus the delta.
 *
 * This is a presentation-time computation. The server already
 * passes primitive `hardModifiers` through to the sheet
 * (`src/app/characters/[id]/page.tsx`), so we can build the
 * delta on the client without an extra round-trip.
 */
import type { HardModifier } from "@/types/swordweave";
import { modifierMatchesScope } from "@/lib/engine/stats";

/**
 * Args:
 *   - links: every primitive linked to the character (both
 *     regular and mirrored rows).
 *   - target: which attribute we're computing the delta for.
 *
 * Returns: the integer delta to add to the raw attribute modifier
 * (e.g. +1 if a primitive gives +1 to Physical, -1 if a mirrored
 * primitive gives -1 to Physical).
 */
export function attributeModifierDelta(
  links: ReadonlyArray<{
    readonly isMirrored: boolean;
    readonly primitive: {
      readonly hardModifiers: readonly unknown[];
    };
  }>,
  target: "physical" | "mental" | "magical",
): number {
  let delta = 0;
  const expectedLegacy = `character.attribute.${target}`;
  const expectedAxis = "attribute";
  const expectedScopeLayer = "ATTRIBUTE";
  const expectedScopeValue = target.toUpperCase();

  for (const link of links) {
    // Resolve the per-primitive modifier list. We trust the runtime
    // helper to filter out malformed rows (stats.ts already calls
    // modifierMatchesScope and handles Number(value)).
    const mods = Array.isArray(link.primitive.hardModifiers)
      ? (link.primitive.hardModifiers as readonly HardModifier[])
      : [];

    // Per-primitive net contribution. We sum add/subtract first,
    // then flip the sign if the primitive is mirrored.
    let per = 0;
    for (const mod of mods) {
      if (
        !modifierMatchesScope(mod, {
          legacyTarget: expectedLegacy,
          shortAxis: expectedAxis,
          scopeLayer: expectedScopeLayer,
          scopeValue: expectedScopeValue,
        })
      ) {
        continue;
      }
      if (typeof mod.value !== "number" && typeof mod.value !== "string") {
        continue;
      }
      const numericValue =
        typeof mod.value === "number" ? mod.value : Number(mod.value);
      if (!Number.isFinite(numericValue)) continue;

      switch (mod.operation) {
        case "add":
          per += numericValue;
          break;
        case "subtract":
          per -= numericValue;
          break;
        // For attribute scores we treat set / min / max / multiply /
        // divide / grant / revoke as "no contribution to the
        // presentation delta" — these are intrinsic-stat flips
        // that the v1 sheet roll-up doesn't surface separately.
        default:
          break;
      }
    }

    if (per === 0) continue;
    if (link.isMirrored) {
      // Per Phase 7.5 mirror rule: add ↔ subtract sign flip on
      // mirror. Other ops are not mirrorable so we ignore them.
      delta -= per;
    } else {
      delta += per;
    }
  }

  return delta;
}

/**
 * Convenience wrapper that returns the three deltas at once. Used
 * by the sheet view to feed both CoreStatsCard and the bottom
 * sticky bar.
 */
export function attributeModifierDeltas(
  links: ReadonlyArray<{
    readonly isMirrored: boolean;
    readonly primitive: {
      readonly hardModifiers: readonly unknown[];
    };
  }>,
): { physical: number; mental: number; magical: number } {
  return {
    physical: attributeModifierDelta(links, "physical"),
    mental: attributeModifierDelta(links, "mental"),
    magical: attributeModifierDelta(links, "magical"),
  };
}
