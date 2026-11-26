import { readMirrorMeta, resolveEffectiveModifierValue } from "@/lib/engine/mirror";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import type { HardModifier } from "@/types/swordweave";

/** Describe each affected modifier from the selected version, including its conditions. */
export function creationDrawback(modifiers: readonly HardModifier[], snapshot?: Record<string, unknown>) {
  const vector = snapshot?.["mirrorVector"];
  if (typeof vector !== "string" || !Array.isArray(modifiers)) return null;
  const rules: string[] = [];
  for (const modifier of modifiers) {
    if (!modifier || typeof modifier.target !== "string" || !modifier.target.trim() ||
        typeof modifier.operation !== "string" || modifier.value == null) return null;
    if (readMirrorMeta(modifier)?.optedOut) continue;
    const effect = resolveEffectiveModifierValue({ mirror_vector: vector }, { is_mirrored: true }, modifier);
    if (effect.mirroredOperation) {
      rules.push(mechanicalDescriptionFromModifiers([{ ...modifier, operation: effect.mirroredOperation as HardModifier["operation"] }]));
    } else if (effect.userCost?.kind === "extra_strain") {
      if (effect.userCost.magnitude <= 0) return null;
      rules.push(`${mechanicalDescriptionFromModifiers([modifier])} This adds ${effect.userCost.magnitude} Strain when it applies.`);
    } else if (effect.vector === "STRUCTURAL_FAULT") {
      rules.push(`This protection becomes a vulnerability. The standard rule is “${mechanicalDescriptionFromModifiers([modifier])}”`);
    }
  }
  if (!rules.length || rules.some(rule => !rule.trim())) return null;
  const notes = snapshot?.["mirrorEligibilityNotes"];
  return { description: rules.join(" "), ...(typeof notes === "string" && notes.trim() ? { eligibilityNotes: notes } : {}) };
}
