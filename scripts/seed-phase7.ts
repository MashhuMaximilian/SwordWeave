// =============================================================================
// Phase 7 Seed — Rebuild Content Library from scratch
// =============================================================================
// Run with: npx tsx scripts/seed-phase7.ts
// =============================================================================

import { db } from "../src/db/client";
import {
  effects,
  effectPrimitives,
  capabilities,
  capabilityPrimitives,
  heritage,
  heritagePrimitives,
  heritageCapabilities,
  items,
  itemPrimitives,
  itemCapabilities,
} from "../src/db/schema";

// =============================================================================
// EFFECTS (8)
// =============================================================================

const effectSeeds = [
  {
    name: "System Freeze",
    narrativeDescription:
      "Target's mechanical apparatus or nervous system locks down. Movement speed zero + reaction lockout.",
    tags: ["control", "lockdown"],
    primitives: [
      { id: 176, notes: "Velocity Lock" },
      { id: 190, notes: "Erase reactions 1 round" },
      { id: 51, notes: "Cognitive & Agency Tag" },
    ],
  },
  {
    name: "Corrosive Decay",
    narrativeDescription:
      "Ongoing structural erosion against armor/defenses. Ticking damage. Persists multi-scene.",
    tags: ["debuff", "armor-break", "ticking"],
    primitives: [
      { id: 387, notes: "Domain Resistance marker" },
      { id: 50, notes: "Sensory & Physiological Tag" },
      { id: 47, notes: "Persistent Duration" },
    ],
  },
  {
    name: "Vertigo Spasms",
    narrativeDescription:
      "Inner-ear or mental coordination disruption. Disadvantage on checks requiring physical coordination.",
    tags: ["crowd-control", "disorientation"],
    primitives: [
      { id: 161, notes: "Negative Bias — Narrative Focus" },
      { id: 51, notes: "Cognitive & Agency Tag" },
    ],
  },
  {
    name: "Compelled Focus",
    narrativeDescription:
      "Target's offensive attention redirected. Disadvantage on non-caster attacks. Persistent.",
    tags: ["taunt", "aggro"],
    primitives: [
      { id: 163, notes: "Negative Bias II" },
      { id: 51, notes: "Cognitive & Agency Tag" },
      { id: 47, notes: "Persistent" },
    ],
  },
  {
    name: "Blind Stun",
    narrativeDescription:
      "Total sensory denial + reaction lockdown + standard action erasure.",
    tags: ["stun", "blind", "control"],
    primitives: [
      { id: 50, notes: "Sensory & Physiological Tag" },
      { id: 190, notes: "Erase reactions 1 round" },
      { id: 189, notes: "Erase standard action" },
    ],
  },
  {
    name: "Shattered Composure",
    narrativeDescription:
      "Total hysterical breakdown. Velocity Lock + reactions erased + defense penalty.",
    tags: ["fear", "breakdown", "crowd-control"],
    primitives: [
      { id: 176, notes: "Velocity Lock" },
      { id: 190, notes: "Erase reactions 1 round" },
      { id: 163, notes: "Negative Bias II — defenses" },
      { id: 52, notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Staggered (Acid Corrosion)",
    narrativeDescription:
      "Acid-corrosion staggered state. Movement halved + attack disadvantage + ticking.",
    tags: ["acid", "ticking", "stagger"],
    primitives: [
      { id: 175, notes: "Minor Linear Displacement — -15ft" },
      { id: 163, notes: "Negative Bias II — attacks" },
      { id: 50, notes: "Sensory & Physiological Tag" },
      { id: 47, notes: "Persistent" },
    ],
  },
  {
    name: "Snared (Vine Bind)",
    narrativeDescription:
      "Living vines bind the target. Velocity lock + ticking 1d20 damage.",
    tags: ["nature", "bind", "control"],
    primitives: [
      { id: 176, notes: "Velocity Lock" },
      { id: 393, notes: "Existential Tear 1d20 ticking" },
      { id: 49, notes: "Physical Interaction Tag" },
    ],
  },
];

// =============================================================================
// CAPABILITIES (25 — recovered from previous plus new Strike)
// =============================================================================
interface CapSlot {
  primitiveId: number;
  role: "VERB" | "DOMAIN" | "RANGE" | "DURATION" | "SIZING" | "OUTPUT" | "AUGMENT" | "OTHER";
  quantity?: number;
  notes?: string;
}

const capabilitySeeds: Array<{
  name: string;
  type: "ACTIVE" | "PASSIVE" | "AUGMENT";
  sourceType: "PHYSICAL" | "MAGICAL" | "PSYCHIC";
  verboseDescription: string;
  tags: string[];
  primitives: CapSlot[];
}> = [
  // ─── STYLE A — PASSIVE (sheet-modifying only) ───
  {
    name: "Heavy Tactical Cover",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Permanent defensive training. The character automatically seeks cover, granting +1 Physical Defense against ranged attacks when cover is present.",
    tags: ["defense", "tactical"],
    primitives: [
      { primitiveId: 55, role: "OTHER", notes: "Defensive Save Upgrade — Physical" },
      { primitiveId: 382, role: "OTHER", notes: "+1 Physical Defense" },
    ],
  },
  {
    name: "Vow of Enmity",
    type: "AUGMENT",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Swearing an oath against a designated foe grants a Narrow Focus advantage on attacks vs that target.",
    tags: ["augment", "martial", "narrative"],
    primitives: [
      { primitiveId: 57, role: "AUGMENT", notes: "Focused Edge — narrow Narrative Focus on attacks vs sworn target" },
    ],
  },
  {
    name: "Blind Swordsman",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Trained to fight without sight. Gains Tremorsense 30ft + Blindsight 30ft (tactile echo fallback).",
    tags: ["defense", "perception", "martial"],
    primitives: [
      { primitiveId: 215, role: "OTHER", notes: "Tremorsense 30ft" },
      { primitiveId: 217, role: "OTHER", notes: "Blindsight 30ft (Tactile Echo)" },
    ],
  },
  {
    name: "Aura Detective",
    type: "PASSIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "Passive sensitivity to psychic residue. Notices magical influence within the last hour + focus advantage on Awareness for detecting magical concealment.",
    tags: ["perception", "psychic"],
    primitives: [
      { primitiveId: 172, role: "OTHER", notes: "Systemic Resonance — read capability trails" },
      { primitiveId: 57, role: "AUGMENT", notes: "Focused Edge — Awareness on magical concealment" },
    ],
  },
  {
    name: "Aegis Shield",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Reaction-trigger: when hit by a physical attack, spend Reaction Slot to gain +2 Physical Defense against that specific strike. Plus +1 baseline Independent Reaction Slot.",
    tags: ["defense", "reaction", "shield"],
    primitives: [
      { primitiveId: 167, role: "OTHER", notes: "Direct Material Trigger — on hit" },
      { primitiveId: 386, role: "OTHER", notes: "Reactive Bulwark — +2 Defense when triggered" },
      { primitiveId: 194, role: "OTHER", notes: "+1 Independent Reaction Slot" },
    ],
  },
  {
    name: "Ghost Walk",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Combat flow training. Stride Extension baseline + Focus advantage on Finesse checks to avoid physical-detection.",
    tags: ["stealth", "movement", "martial"],
    primitives: [
      { primitiveId: 218, role: "OTHER", notes: "Stride Extension" },
      { primitiveId: 57, role: "AUGMENT", notes: "Focused Edge — Finesse vs physical-detection" },
    ],
  },
  {
    name: "Bloodhound Master",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Legendary tracker. Awareness Proficiency + Focus advantage on Awareness through smell + Expertise Upgrade path on Awareness.",
    tags: ["tracking", "perception"],
    primitives: [
      { primitiveId: 58, role: "AUGMENT", notes: "Practice Proficiency — Awareness" },
      { primitiveId: 57, role: "AUGMENT", notes: "Focused Edge — Awareness through smell" },
      { primitiveId: 59, role: "AUGMENT", notes: "Expertise Upgrade on Awareness" },
    ],
  },

  // ─── STYLE B — DIRECT (active, no effects) ───
  {
    name: "Rusting Strike",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Kinetic strike charged with corrosive entropy. Standard kinetic damage + applies Physical Interaction Tag deflexure debuff.",
    tags: ["attack", "corrosion"],
    primitives: [
      { primitiveId: 20, role: "VERB", notes: "Verb Tier I" },
      { primitiveId: 24, role: "DOMAIN", notes: "Domain Tier I — Decay" },
      { primitiveId: 32, role: "RANGE", notes: "Touch" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 39, role: "DURATION", notes: "Standard" },
      { primitiveId: 389, role: "OUTPUT", notes: "Standard Die 1d6" },
      { primitiveId: 49, role: "OTHER", notes: "Physical Interaction Tag" },
    ],
  },
  {
    name: "Cataclysmic Shockwave",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Force-propelled ring radiates from a coordinate, knocking adjacent targets prone and dealing kinetic damage in a sphere.",
    tags: ["aoe", "force"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 24, role: "DOMAIN", notes: "Domain Tier I — Force" },
      { primitiveId: 35, role: "RANGE", notes: "Far 60ft" },
      { primitiveId: 228, role: "SIZING", notes: "Kinetic Sphere" },
      { primitiveId: 39, role: "DURATION", notes: "Standard" },
      { primitiveId: 389, role: "OUTPUT", notes: "Standard Die 1d6" },
      { primitiveId: 49, role: "OTHER", notes: "Knock-prone" },
    ],
  },
  {
    name: "Gravity Anchor Trap",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Localized gravity spike. Velocity Lock for one round + heavy kinetic slam on dismissal. Reaction-triggered.",
    tags: ["control", "gravity", "trap"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Gravity" },
      { primitiveId: 34, role: "RANGE", notes: "Near 30ft" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 42, role: "DURATION", notes: "Reaction Execution" },
      { primitiveId: 176, role: "OTHER", notes: "Velocity Lock" },
      { primitiveId: 167, role: "OTHER", notes: "Direct Material Trigger" },
    ],
  },
  {
    name: "Mind Scan",
    type: "ACTIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "Reads surface thoughts of a target within range. Learns current emotional baseline + one piece of recent memory.",
    tags: ["psychic", "detection"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Thought" },
      { primitiveId: 34, role: "RANGE", notes: "Near 30ft" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 39, role: "DURATION", notes: "Standard" },
      { primitiveId: 173, role: "OTHER", notes: "Non-Material Translation — read thoughts" },
    ],
  },
  {
    name: "Spore Choke",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Dense spore cloud in a cone. Ticking damage + sensory-physiological interference on caught targets.",
    tags: ["aoe", "poison"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Decay/Poison" },
      { primitiveId: 34, role: "RANGE", notes: "Near 30ft" },
      { primitiveId: 227, role: "SIZING", notes: "Linear/Conical Vector 15ft" },
      { primitiveId: 39, role: "DURATION", notes: "Standard" },
      { primitiveId: 50, role: "OTHER", notes: "Sensory & Physiological Tag" },
    ],
  },
  {
    name: "Tornado Blast",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Fast-moving column of cyclonic wind. Kinetic damage + displacement vector across field.",
    tags: ["aoe", "wind"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 24, role: "DOMAIN", notes: "Domain Tier I — Wind" },
      { primitiveId: 35, role: "RANGE", notes: "Far 60ft" },
      { primitiveId: 231, role: "SIZING", notes: "Structural Wall 30×10" },
      { primitiveId: 40, role: "DURATION", notes: "Fast Execution" },
      { primitiveId: 175, role: "OTHER", notes: "Minor Linear Displacement 10ft" },
      { primitiveId: 389, role: "OUTPUT", notes: "Standard Die 1d6" },
    ],
  },
  {
    name: "Chronomantic Haste",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Accelerates the subject's internal tempo. Target gains +1 Standard Action Window for the encounter. Immune to forced delays.",
    tags: ["time", "buff"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — synchronize" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Time" },
      { primitiveId: 33, role: "RANGE", notes: "Close" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 45, role: "DURATION", notes: "Medium Duration" },
      { primitiveId: 189, role: "OTHER", notes: "+1 Standard Action" },
      { primitiveId: 209, role: "OTHER", notes: "Timeline Tether — immune to delays" },
    ],
  },
  {
    name: "Medusa's Gaze",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Single-target instantaneous gaze attack. On failed Mental save, target's identity is overwritten — frozen into statue-state. Instant resolution.",
    tags: ["control", "petrify"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — rewrite identity" },
      { primitiveId: 26, role: "DOMAIN", notes: "Domain Tier III — Form/Petrification" },
      { primitiveId: 36, role: "RANGE", notes: "Very Far 120ft" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 41, role: "DURATION", notes: "Instant Execution" },
      { primitiveId: 52, role: "OTHER", notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Chamber Blackout Matrix",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Drains all light from a zone + System-level sensory denial. Targets fully blind; identities obscured from outside Awareness checks.",
    tags: ["aoe", "darkness"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Darkness" },
      { primitiveId: 35, role: "RANGE", notes: "Far 60ft" },
      { primitiveId: 229, role: "SIZING", notes: "Stationary Zone" },
      { primitiveId: 46, role: "DURATION", notes: "Long Duration" },
      { primitiveId: 52, role: "OTHER", notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Simulacrum",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Permanent duplicate of the target's identity and form, fully under the caster's command. Retains all primitive licenses.",
    tags: ["summoning", "duplicate"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — rewrite identity" },
      { primitiveId: 27, role: "DOMAIN", notes: "Domain Tier IV — Existence" },
      { primitiveId: 32, role: "RANGE", notes: "Touch" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 48, role: "DURATION", notes: "Permanent Duration" },
      { primitiveId: 52, role: "OTHER", notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Greater Invisibility",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Phase-shift the target out of visual spectrum. Advantage on Stealth + immune to optical targeting.",
    tags: ["stealth", "utility"],
    primitives: [
      { primitiveId: 21, role: "VERB", notes: "Verb Tier II — phase/displace" },
      { primitiveId: 26, role: "DOMAIN", notes: "Domain Tier III — Light/Phase" },
      { primitiveId: 33, role: "RANGE", notes: "Close" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 47, role: "DURATION", notes: "Persistent Duration" },
      { primitiveId: 52, role: "OTHER", notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Time Stop",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Halts all other entities in scene for an instant window. Caster gains a Free Action Window during halt.",
    tags: ["time", "control"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — suspend rules" },
      { primitiveId: 26, role: "DOMAIN", notes: "Domain Tier III — Time" },
      { primitiveId: 32, role: "RANGE", notes: "Self — affects scene" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target (scene-wide)" },
      { primitiveId: 41, role: "DURATION", notes: "Instant Execution" },
      { primitiveId: 52, role: "OTHER", notes: "System & Identity Tag" },
    ],
  },
  {
    name: "Temporal Stasis Trap",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Reaction-triggered trap that locks target in timeline stasis for 1 round. Target invulnerable during lock.",
    tags: ["time", "control"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — suspend" },
      { primitiveId: 26, role: "DOMAIN", notes: "Domain Tier III — Time" },
      { primitiveId: 33, role: "RANGE", notes: "Close" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 42, role: "DURATION", notes: "Reaction Execution" },
      { primitiveId: 213, role: "OTHER", notes: "Temporal Isolate" },
      { primitiveId: 167, role: "OTHER", notes: "Direct Material Trigger" },
    ],
  },
  {
    name: "Aura of Total Enfeeblement",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Mobile aura imposing negative bias on all physical checks for creatures that enter. Persists with caster.",
    tags: ["aoe", "debuff"],
    primitives: [
      { primitiveId: 23, role: "VERB", notes: "Verb Tier IV — weaken" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Force" },
      { primitiveId: 32, role: "RANGE", notes: "Self — emanation" },
      { primitiveId: 230, role: "SIZING", notes: "Mobile Aura 10ft" },
      { primitiveId: 45, role: "DURATION", notes: "Medium Duration" },
      { primitiveId: 161, role: "OTHER", notes: "Negative Bias on physical checks" },
    ],
  },
  {
    name: "Spell Counter-Disruption Shield",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Reaction-triggered ward absorbing a single incoming capability and dissipating its payload while leaving the caster's primitives intact.",
    tags: ["defense", "reaction", "counter-magic"],
    primitives: [
      { primitiveId: 21, role: "VERB", notes: "Verb Tier II — negate" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Arcane" },
      { primitiveId: 32, role: "RANGE", notes: "Self — defensive shield" },
      { primitiveId: 28, role: "SIZING", notes: "Single-target counter" },
      { primitiveId: 42, role: "DURATION", notes: "Reaction Execution" },
      { primitiveId: 170, role: "OTHER", notes: "Interceptive Causal Trigger" },
    ],
  },
  {
    name: "Archmage's Strain Redirection Plate",
    type: "PASSIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "Permanent trait: when a capability inflicts a status condition on the caster via Strain feedback, the trauma is converted into environmental hazard. Health unchanged; surroundings shift.",
    tags: ["defense", "passive"],
    primitives: [
      { primitiveId: 204, role: "OTHER", notes: "Hazard Transmutation" },
      { primitiveId: 202, role: "OTHER", notes: "Condition Insulation" },
      { primitiveId: 211, role: "OTHER", notes: "Perpetual Lock" },
    ],
  },

  // ─── STRIKE — should be a capability (mashu) ───
  {
    name: "Strike",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "Baseline physical attack. Single kinetic strike at touch range. Canonical 'I swing my sword' capability built from atomic primitives (Verb Access Tier I + Earth Domain + Standard Die Block).",
    tags: ["attack", "basic"],
    primitives: [
      { primitiveId: 20, role: "VERB", notes: "Verb Tier I — strike" },
      { primitiveId: 424, role: "DOMAIN", notes: "Earth Domain — kinetic matter" },
      { primitiveId: 32, role: "RANGE", notes: "Touch / Melee" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 39, role: "DURATION", notes: "Standard" },
      { primitiveId: 389, role: "OUTPUT", notes: "Standard Die Block 1d6" },
    ],
  },

  // ─── STYLE C — DYNAMIC (active + nested effects) ───
  {
    name: "Hypnotic Suggester",
    type: "ACTIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "Projects a sustained cognitive directive. Imposes Compelled Focus effect on the target — Behavioral Directive that doesn't violate survival protocols.",
    tags: ["psychic", "control"],
    primitives: [
      { primitiveId: 20, role: "VERB" },
      { primitiveId: 25, role: "DOMAIN", notes: "Domain Tier II — Emotion" },
      { primitiveId: 34, role: "RANGE", notes: "Near 30ft" },
      { primitiveId: 28, role: "SIZING", notes: "Single Target" },
      { primitiveId: 46, role: "DURATION", notes: "Long Duration" },
      { primitiveId: 180, role: "OTHER", notes: "Behavioral Directive — agency override" },
    ],
  },
];

// =============================================================================
// TEMPLATES (16) — Race / Background / Archetype slots
// =============================================================================

const templateSeeds: Array<{
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  description: string;
  suggestedTraits?: string;
  primitiveSlots: Array<{ primitiveId: number; notes?: string }>;
  capabilitySlots?: string[];
  isArchetypeTemplate?: boolean;
}> = [
  // RACES
  {
    kind: "LINEAGE", name: "Human",
    description: "Versatile and ambitious. Single Attribute Increment + Broad Familiarity — any build path without penalty.",
    suggestedTraits: "+1 to any Attribute; resilient to environmental change.",
    primitiveSlots: [
      { primitiveId: 53, notes: "Attribute Increment — choose your path" },
      { primitiveId: 56, notes: "Broad Familiarity — half PB across non-proficient practices" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "LINEAGE", name: "Mountainfolk",
    description: "Built for altitude and endurance. +5 Vitality baseline, Cold resistance, Focus advantage on Prowess on vertical terrain.",
    suggestedTraits: "Stocky frame; pale skin; thick accents.",
    primitiveSlots: [
      { primitiveId: 61, notes: "Vitality Core Augment I — +5 HP" },
      { primitiveId: 387, notes: "Structural Hardening — Cold resistance" },
      { primitiveId: 57, notes: "Focused Edge — Prowess on vertical terrain" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "LINEAGE", name: "Forestkind",
    description: "Cousin to the trees. Darkvision 60ft, Fieldcraft Proficiency, +10ft movement through overgrown terrain.",
    suggestedTraits: "Tall and thin; bark-patterned skin; leaf-fall hair.",
    primitiveSlots: [
      { primitiveId: 214, notes: "Umbral Sight I — Darkvision 60ft" },
      { primitiveId: 218, notes: "Stride Extension — +10ft" },
      { primitiveId: 58, notes: "Practice Proficiency — Fieldcraft" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "LINEAGE", name: "Ironborn",
    description: "Forged in volcanic crucibles. Heavy Die Block on unarmed strikes, +1 Physical Defense, fire resistance.",
    suggestedTraits: "Slightly metallic tint; warmth radiating from hands.",
    primitiveSlots: [
      { primitiveId: 382, notes: "Kinetic Hardening — +1 Physical Defense" },
      { primitiveId: 387, notes: "Structural Hardening — Fire resistance" },
      { primitiveId: 390, notes: "Heavy Die Block 1d8 — unarmed baseline" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "LINEAGE", name: "Skyborn",
    description: "Born of migratory winds. Aero Unlock (Fly = land speed), Perception advantage against aerial threats.",
    suggestedTraits: "Tall, hollow-boned; faint whisper when speaking.",
    primitiveSlots: [
      { primitiveId: 221, notes: "Aero Unlock — Fly speed = land" },
      { primitiveId: 172, notes: "Systemic Resonance — atmospheric patterns" },
      { primitiveId: 57, notes: "Focused Edge — Awareness vs aerial threats" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "LINEAGE", name: "Tidekin",
    description: "Amphibious breathers. Aquatic Unlock, Substrate Echo 30ft, pressure resistance.",
    suggestedTraits: "Webbed fingers; gill slits at neck; pale eyes.",
    primitiveSlots: [
      { primitiveId: 219, notes: "Aquatic Unlock — Swim = land" },
      { primitiveId: 215, notes: "Substrate Echo 30ft" },
      { primitiveId: 387, notes: "Structural Hardening — Pressure resistance" },
    ],
    capabilitySlots: [],
  },

  // BACKGROUNDS
  {
    kind: "UPBRINGING", name: "Scholar",
    description: "Years of academic dedication. Proficient in Knowledge + Reason + Focus advantage on area of study.",
    suggestedTraits: "Slight stoop; ink-stained fingers; always carries a journal.",
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Knowledge" },
      { primitiveId: 58, notes: "Practice Proficiency — Reason" },
      { primitiveId: 57, notes: "Focused Edge — Knowledge within specialization" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "UPBRINGING", name: "Soldier",
    description: "Frontline training. Proficient in Prowess + Influence (Intimidation), +1 Physical Defense.",
    suggestedTraits: "Battle scars; straight posture; militant vocabulary.",
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Prowess" },
      { primitiveId: 58, notes: "Practice Proficiency — Influence" },
      { primitiveId: 382, notes: "Kinetic Hardening — +1 Physical Defense" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "UPBRINGING", name: "Wanderer",
    description: "Endless roads underfoot. Fieldcraft Proficiency + +10ft movement + weather resistance.",
    suggestedTraits: "Tanned skin; patched gear; stories for any season.",
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Fieldcraft" },
      { primitiveId: 218, notes: "Stride Extension — +10ft" },
      { primitiveId: 387, notes: "Structural Hardening — Weather resistance" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "UPBRINGING", name: "Courtier",
    description: "Bred in salons and parlors. Influence + Awareness Proficiency + deception-detection focus.",
    suggestedTraits: "Plumage-conscious dress; precise vocabulary; refined palate.",
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Influence" },
      { primitiveId: 58, notes: "Practice Proficiency — Awareness" },
      { primitiveId: 57, notes: "Focused Edge — Awareness detecting deception" },
    ],
    capabilitySlots: [],
  },
  {
    kind: "UPBRINGING", name: "Tinkerer",
    description: "Hands forever smudged with soot. Reason Proficiency + Mechanical Finesse.",
    suggestedTraits: "Burns on fingers; pockets full of gears; takes things apart.",
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Reason" },
      { primitiveId: 58, notes: "Practice Proficiency — Finesse (mechanical)" },
      { primitiveId: 53, notes: "Attribute Increment — Mind" },
    ],
    capabilitySlots: [],
  },

  // ARCHETYPES
  {
    kind: "MANIFEST", name: "Striker",
    description: "Martial damage dealer. +1 Attack Bonus + Heavy Die Block on basic attacks + Strike capability.",
    suggestedTraits: "Damage-focused; trusts their weapon; lives for the next hit.",
    isArchetypeTemplate: true,
    primitiveSlots: [
      { primitiveId: 54, notes: "Attack Bonus Increment — +1 attacks" },
      { primitiveId: 390, notes: "Heavy Die Block 1d8 — martial baseline" },
    ],
    capabilitySlots: ["Strike", "Rusting Strike"],
  },
  {
    kind: "MANIFEST", name: "Guardian",
    description: "Defensive backbone. +2 Physical Defense + +1 Mental Defense + Aegis Shield capability.",
    suggestedTraits: "Patient; stubborn; stands between allies and harm.",
    isArchetypeTemplate: true,
    primitiveSlots: [
      { primitiveId: 382, notes: "Kinetic Hardening — +1 Physical Defense" },
      { primitiveId: 382, notes: "Kinetic Hardening — stack for +2" },
      { primitiveId: 384, notes: "Psychic Firewall — +1 Mental Defense" },
    ],
    capabilitySlots: ["Aegis Shield"],
  },
  {
    kind: "MANIFEST", name: "Mystic",
    description: "Spell-flinger. Domain Tier II license + Fast Execution baseline + 2 spell capabilities.",
    suggestedTraits: "Quiet; bookish; unsettling certainty about the universe.",
    isArchetypeTemplate: true,
    primitiveSlots: [
      { primitiveId: 25, notes: "Domain Access Tier II license" },
      { primitiveId: 40, notes: "Fast Execution baseline" },
      { primitiveId: 64, notes: "Focused Presence — +1 DC" },
    ],
    capabilitySlots: ["Greater Invisibility", "Spell Counter-Disruption Shield"],
  },
  {
    kind: "MANIFEST", name: "Skirmisher",
    description: "Hit-and-run. +10ft movement, Reaction Pulse expansion, Ghost Walk capability.",
    suggestedTraits: "Quick; prefers to strike first; never stays in one place.",
    isArchetypeTemplate: true,
    primitiveSlots: [
      { primitiveId: 218, notes: "Stride Extension — +10ft" },
      { primitiveId: 194, notes: "Reaction Pulse — +1 extra reaction" },
      { primitiveId: 65, notes: "Precise Vector Alignment — +1 attack rolls" },
    ],
    capabilitySlots: ["Ghost Walk"],
  },
  {
    kind: "MANIFEST", name: "Artificer",
    description: "Engineer of magical devices. Reason Expertise + Substrate Echo perception + item-attunement framework.",
    suggestedTraits: "Workshop-stained; metal-and-glass vocabulary; knows every gear.",
    isArchetypeTemplate: true,
    primitiveSlots: [
      { primitiveId: 58, notes: "Practice Proficiency — Reason (mechanical)" },
      { primitiveId: 59, notes: "Expertise Upgrade — Reason (mechanical)" },
      { primitiveId: 215, notes: "Substrate Echo — feel device internals" },
    ],
    capabilitySlots: [],
  },
];

// =============================================================================
// ITEMS (5)
// =============================================================================

const itemSeeds: Array<{
  name: string;
  itemType: "WEAPON" | "ARMOR" | "TRINKET" | "ARTIFACT" | "CONSUMABLE";
  rarity: "COMMON" | "RARE" | "LEGENDARY" | "EPIC";
  description: string;
  slotCost: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  primitiveSlots: Array<{ primitiveId: number; notes?: string }>;
  capabilitySlots?: string[];
}> = [
  {
    name: "Steel Longsword", itemType: "WEAPON", rarity: "COMMON",
    description: "Balanced steel longsword. +1 to attack rolls + Heavy Die Block damage.",
    slotCost: 1, isTwoHanded: false, isConsumable: false, actsAsFocus: false,
    primitiveSlots: [
      { primitiveId: 65, notes: "Precise Vector Alignment +1 attack" },
      { primitiveId: 390, notes: "Heavy Die Block 1d8 baseline" },
    ],
    capabilitySlots: ["Strike", "Rusting Strike"],
  },
  {
    name: "Oak Shield", itemType: "ARMOR", rarity: "COMMON",
    description: "Heavy oak-and-iron shield. +2 Physical Defense from blocks.",
    slotCost: 1, isTwoHanded: false, isConsumable: false, actsAsFocus: false,
    primitiveSlots: [
      { primitiveId: 382, notes: "Kinetic Hardening +1" },
      { primitiveId: 382, notes: "Kinetic Hardening stack" },
      { primitiveId: 57, notes: "Focused Edge on block Prowess" },
    ],
    capabilitySlots: ["Aegis Shield"],
  },
  {
    name: "Healing Tonic", itemType: "CONSUMABLE", rarity: "COMMON",
    description: "Bitter herbal tincture. Restores 1d6+4 Vitality and stabilizes the dying.",
    slotCost: 0, isTwoHanded: false, isConsumable: true, actsAsFocus: false,
    primitiveSlots: [
      { primitiveId: 19, notes: "Minor Die Block 1d4 healing" },
      { primitiveId: 389, notes: "Standard Die Block 1d6 baseline" },
    ],
    capabilitySlots: [],
  },
  {
    name: "Arcane Focus", itemType: "TRINKET", rarity: "RARE",
    description: "Cut crystal channeling casting. +1 spell DCs; substitutes for components.",
    slotCost: 1, isTwoHanded: false, isConsumable: false, actsAsFocus: true,
    primitiveSlots: [
      { primitiveId: 64, notes: "Focused Presence +1 DC" },
      { primitiveId: 173, notes: "Non-Material Translation — read magic threads" },
    ],
    capabilitySlots: ["Spell Counter-Disruption Shield"],
  },
  {
    name: "Traveler's Cloak", itemType: "ARMOR", rarity: "COMMON",
    description: "Weather-resistant cloak. Resistance to cold, heat, and storm.",
    slotCost: 1, isTwoHanded: false, isConsumable: false, actsAsFocus: false,
    primitiveSlots: [
      { primitiveId: 387, notes: "Structural Hardening — Cold" },
      { primitiveId: 387, notes: "Structural Hardening — Heat" },
    ],
    capabilitySlots: ["Ghost Walk"],
  },
];

// =============================================================================
// MAIN
// =============================================================================

async function seed() {
  console.log("=== PHASE 7 SEED START ===\n");

  // Cleanup partial state in case the script was interrupted mid-run
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`DELETE FROM item_capabilities`);
  await db.execute(sql`DELETE FROM item_primitives`);
  await db.execute(sql`DELETE FROM items`);
  await db.execute(sql`DELETE FROM template_capabilities`);
  await db.execute(sql`DELETE FROM template_primitives`);
  await db.execute(sql`DELETE FROM heritage`);
  await db.execute(sql`DELETE FROM capability_primitives`);
  await db.execute(sql`DELETE FROM capabilities`);
  await db.execute(sql`DELETE FROM effect_primitives`);
  await db.execute(sql`DELETE FROM effects`);
  console.log("  (cleared any partial state)");

  // 1. Effects
  console.log("[1/4] Seeding " + effectSeeds.length + " effects...");
  const effectNameToId: Record<string, string> = {};
  for (const eff of effectSeeds) {
    const [row] = await db.insert(effects).values({
      name: eff.name,
      narrativeDescription: eff.narrativeDescription,
      tags: eff.tags,
      sourceOrigin: "system",
      isPublic: true,
    }).returning({ id: effects.id });
    if (!row) throw new Error("Failed to insert effect " + eff.name);
    effectNameToId[eff.name] = row.id;
    let sortOrder = 0;
    for (const p of eff.primitives) {
      await db.insert(effectPrimitives).values({
        effectId: row.id,
        primitiveId: p.id,
        quantity: 1,
        sortOrder: sortOrder++,
        notes: p.notes ?? null,
      });
    }
    console.log("  ✓ " + eff.name + " (" + eff.primitives.length + " primitives)");
  }

  // 2. Capabilities
  console.log("\n[2/4] Seeding " + capabilitySeeds.length + " capabilities...");
  const capNameToId: Record<string, string> = {};
  for (const cap of capabilitySeeds) {
    const [row] = await db.insert(capabilities).values({
      name: cap.name,
      type: cap.type,
      sourceType: cap.sourceType,
      verboseDescription: cap.verboseDescription,
      tags: cap.tags,
      sourceOrigin: "system",
      isPublic: true,
    }).returning({ id: capabilities.id });
    if (!row) throw new Error("Failed to insert capability " + cap.name);
    capNameToId[cap.name] = row.id;
    let sortOrder = 0;
    for (const p of cap.primitives) {
      await db.insert(capabilityPrimitives).values({
        capabilityId: row.id,
        primitiveId: p.primitiveId,
        role: p.role,
        quantity: p.quantity ?? 1,
        sortOrder: sortOrder++,
        notes: p.notes ?? null,
      });
    }
    console.log("  ✓ " + cap.name + " (" + cap.primitives.length + " primitives)");
  }

  // 3. Templates
  console.log("\n[3/4] Seeding " + templateSeeds.length + " heritage...");
  for (const t of templateSeeds) {
    const [row] = await db.insert(heritage).values({
      kind: t.kind,
      name: t.name,
      description: t.description,
      suggestedTraits: t.suggestedTraits ?? null,
      sourceOrigin: "system",
      isPublic: true,
    }).returning({ id: heritage.id });
    if (!row) throw new Error("Failed to insert template " + t.name);

    // Dedupe primitives by primitiveId (PK = templateId+primitiveId).
    // Multiple slots for the same primitive (e.g. Scholar has Knowledge AND
    // Reason Proficiency using the same Practice Proficiency primitive)
    // get concatenated into a single row with merged notes.
    const seenPrims = new Map<number, string[]>();
    for (const p of t.primitiveSlots) {
      if (!seenPrims.has(p.primitiveId)) seenPrims.set(p.primitiveId, []);
      seenPrims.get(p.primitiveId)!.push(p.notes ?? "");
    }
    let sortOrder = 0;
    for (const [primitiveId, notesList] of seenPrims) {
      const mergedNotes = notesList.filter(n => n.length > 0).join(" | ");
      await db.insert(heritagePrimitives).values({
        templateId: row.id,
        primitiveId,
        sortOrder: sortOrder++,
        notes: mergedNotes.length > 0 ? mergedNotes : null,
      });
    }
    if (t.capabilitySlots) {
      for (const capName of t.capabilitySlots) {
        const capId = capNameToId[capName];
        if (!capId) {
          console.warn("    ! capability '" + capName + "' not found for " + t.name);
          continue;
        }
        await db.insert(heritageCapabilities).values({
          templateId: row.id,
          capabilityId: capId,
        });
      }
    }
    console.log("  ✓ " + t.name + " (" + t.kind + ") — " + t.primitiveSlots.length + " prims, " + (t.capabilitySlots?.length ?? 0) + " caps");
  }

  // 4. Items
  console.log("\n[4/4] Seeding " + itemSeeds.length + " items...");
  for (const it of itemSeeds) {
    const buCost = it.primitiveSlots.length * 2;
    const [row] = await db.insert(items).values({
      name: it.name,
      itemType: it.itemType,
      rarity: it.rarity,
      description: it.description,
      slotCost: it.slotCost,
      quantity: 1,
      isTwoHanded: it.isTwoHanded,
      isConsumable: it.isConsumable,
      actsAsFocus: it.actsAsFocus,
      sourceOrigin: "system",
      isPublic: true,
      buCost,
      tags: [it.itemType.toLowerCase(), it.rarity.toLowerCase()],
    }).returning({ id: items.id });
    if (!row) throw new Error("Failed to insert item " + it.name);

    // Dedupe primitives by primitiveId (PK = itemId+primitiveId).
    // Oak Shield stacks Kinetic Hardening for +2 — same primitive twice,
    // so merge into a single row.
    const seenPrims = new Map<number, string[]>();
    for (const p of it.primitiveSlots) {
      if (!seenPrims.has(p.primitiveId)) seenPrims.set(p.primitiveId, []);
      seenPrims.get(p.primitiveId)!.push(p.notes ?? "");
    }
    let sortOrder = 0;
    for (const [primitiveId, notesList] of seenPrims) {
      const mergedNotes = notesList.filter(n => n.length > 0).join(" | ");
      await db.insert(itemPrimitives).values({
        itemId: row.id,
        primitiveId,
        sortOrder: sortOrder++,
      });
    }
    if (it.capabilitySlots) {
      for (const capName of it.capabilitySlots) {
        const capId = capNameToId[capName];
        if (!capId) {
          console.warn("    ! capability '" + capName + "' not found for " + it.name);
          continue;
        }
        await db.insert(itemCapabilities).values({
          itemId: row.id,
          capabilityId: capId,
          sortOrder: sortOrder++,
          notes: null,
        });
      }
    }
    console.log("  ✓ " + it.name + " (" + it.itemType + ") — " + it.primitiveSlots.length + " prims, " + (it.capabilitySlots?.length ?? 0) + " caps");
  }

  console.log("\n=== PHASE 7 SEED COMPLETE ===");
  console.log("Effects: " + Object.keys(effectNameToId).length);
  console.log("Capabilities: " + Object.keys(capNameToId).length);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SEED FAILED:", err);
    process.exit(1);
  });
