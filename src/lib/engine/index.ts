// Re-export engine modules. Stats has some names that conflict with practices,
// so we import both explicitly and pick which to export.
export * from "./bu";
export * from "./stats";
export * from "./modifiers";
export * from "./capabilities";
export * from "./vitality";
export * from "./bu-balance";
export * from "./encumbrance";
export * from "./sheet";

// Practices — explicit imports to avoid clashes with stats.
// We choose the PRACTICES versions for these (newer, more complete):
import {
  validateAttributes as validateAttributesPractice,
  proficiencyBonus as proficiencyBonusPractice,
  MAX_ATTRIBUTE as MAX_ATTRIBUTE_PRACTICE,
  MIN_ATTRIBUTE as MIN_ATTRIBUTE_PRACTICE,
  ATTRIBUTE_SUM as ATTRIBUTE_SUM_PRACTICE,
  MAX_PB as MAX_PB_PRACTICE,
  distributeAttributeSlices,
  validatePracticeSlicesForAttribute,
  computePracticeModifier,
  computePracticeModifierAtLevel,
  computeAllPracticeModifiers,
  computeDefensiveDC,
  computeAllDefensiveDCs,
  getPracticeSlice,
  getPracticeAttribute,
  PRACTICE_ATTRIBUTE_MAP,
  MIN_SLICE,
  STARTING_PB,
  PB_PER_LEVEL_INTERVAL,
  type Attribute,
  type PhysicalPractice,
  type MentalPractice,
  type MagicalPractice,
  type Practice,
  type Attributes,
  type PracticeAttributeMap,
  type PracticeSlices,
  type PracticeModifierBreakdown,
} from "./practices";

// Re-export practice versions, overriding stats.
export const validateAttributes = validateAttributesPractice;
export const proficiencyBonus = proficiencyBonusPractice;
export const MAX_ATTRIBUTE = MAX_ATTRIBUTE_PRACTICE;
export const MIN_ATTRIBUTE = MIN_ATTRIBUTE_PRACTICE;
export const ATTRIBUTE_SUM = ATTRIBUTE_SUM_PRACTICE;
export const MAX_PB = MAX_PB_PRACTICE;
export {
  distributeAttributeSlices,
  validatePracticeSlicesForAttribute,
  computePracticeModifier,
  computePracticeModifierAtLevel,
  computeAllPracticeModifiers,
  computeDefensiveDC,
  computeAllDefensiveDCs,
  getPracticeSlice,
  getPracticeAttribute,
  PRACTICE_ATTRIBUTE_MAP,
  MIN_SLICE,
  STARTING_PB,
  PB_PER_LEVEL_INTERVAL,
  type Attribute,
  type PhysicalPractice,
  type MentalPractice,
  type MagicalPractice,
  type Practice,
  type Attributes,
  type PracticeAttributeMap,
  type PracticeSlices,
  type PracticeModifierBreakdown,
};