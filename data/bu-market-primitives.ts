/**
 * bu-market-primitives.ts — Canonical BU Market primitive catalog
 *
 * Extracted from Notion page: "BU Market of Primitive components — Complete System"
 * Page ID: 37eed8479ccd8155b917c373194dbdf4
 *
 * Each primitive maps to the DB schema:
 *   - name: primitive name (canonical identity)
 *   - category: DB enum value (VERB_TIER, DOMAIN, etc.)
 *   - buCost: integer BU cost
 *   - tier: Notion tier label (canonical wording)
 *   - description: short description for the registry
 *   - isMirrorable: whether primitive can be inverted for BU credit
 *   - mirrorVector: STANDARD_ONLY | VARIABLE_VECTOR | STRUCTURAL_FAULT | COST_INSTABILITY
 *   - mirrorBuCredit: BU credit when mirrored (typically = buCost)
 *   - sourceTable: which BU Market table this came from
 *
 * Per Notion rule: "BU Market is canonical for pricing; Lexicon pages are now
 * stripped of pricing and serve only as vocabulary reference."
 */

export interface PrimitiveSeed {
  readonly name: string;
  readonly category: string;
  readonly buCost: number;
  readonly tier: string;
  readonly description: string;
  readonly isMirrorable: boolean;
  readonly mirrorVector: "STANDARD_ONLY" | "VARIABLE_VECTOR" | "STRUCTURAL_FAULT" | "COST_INSTABILITY";
  readonly mirrorBuCredit: number;
  readonly sourceTable: string;
  /**
   * Target scope — Phase 7. What the modifier applies to.
   * Optional: only set on modifier primitives (SHEET_AUGMENT,
   * PROBABILITY_BIAS). Verbs, Domains, Structures etc. leave
   * this undefined. Values are JSON-serialized into the
   * `target_scope` text column at migration time; see
   * src/lib/primitives/target-scope.ts for the canonical enums.
   */
  readonly targetScope?: {
    readonly layer: string;
    readonly value?: string | null;
  };
}

export const BU_MARKET_PRIMITIVES: readonly PrimitiveSeed[] = [

  // ==========================================================================
  // VERBS — Action permissions
  // ==========================================================================
  {
    name: "Verb Access Tier I",
    category: "VERB_TIER",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Basic physical + perceptual action language. Ground-level interaction with reality (move, strike, push, sense, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Verbs",
  },
  {
    name: "Verb Access Tier II",
    category: "VERB_TIER",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Transformative action language. Manipulation of existing states and properties (alter, modify, combine, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Verbs",
  },
  {
    name: "Verb Access Tier III",
    category: "VERB_TIER",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Structural/system-level action language. Control over internal structure of systems (restructure, invert, merge, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Verbs",
  },
  {
    name: "Verb Access Tier IV",
    category: "VERB_TIER",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Conceptual / rule-level action language. Interaction with governing logic (override rules, redefine logic, alter causality)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Verbs",
  },

  // ==========================================================================
  // DOMAINS — Slice of reality
  // ==========================================================================
  {
    name: "Domain Access Tier I",
    category: "DOMAIN",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Concrete, physical domains (fire, water, air, earth, metal, stone, wood, ice, lightning, light, darkness, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Domains",
  },
  {
    name: "Domain Access Tier II",
    category: "DOMAIN",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Hybrid physical-conceptual domains (life, decay, growth, memory, emotion, time local, space local, disease, energy systems, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Domains",
  },
  {
    name: "Domain Access Tier III",
    category: "DOMAIN",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Abstract / systemic domains (consciousness, identity, will, intent, thought, belief, information, probability local, fate, causality bounded, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Domains",
  },
  {
    name: "Domain Access Tier IV",
    category: "DOMAIN",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Fundamental / reality-defining domains (existence, non-existence, reality, causality global, time absolute, space global, etc.)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Domains",
  },

  // ==========================================================================
  // STRUCTURE — Targeting shapes
  // ==========================================================================
  {
    name: "Structure Tier I",
    category: "SIZING",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Single-point application structures (single target, self target, touch range, line-of-sight single interaction, fixed object targeting)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Structure",
  },
  {
    name: "Structure Tier II",
    category: "SIZING",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Multi-target and basic spatial distribution (multi-target, chain, cone, radius/AoE, directional spread, basic field placement)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Structure",
  },
  {
    name: "Structure Tier III",
    category: "SIZING",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Complex spatial and adaptive distribution (expanding zones, moving fields, branching chains, conditional targeting, layered effects)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Structure",
  },
  {
    name: "Structure Tier IV",
    category: "SIZING",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Systemic or rule-driven application structures (global/scene-wide, rule-based targeting, priority targeting, exclusion/inclusion logic, state-triggered zones)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Structure",
  },

  // ==========================================================================
  // RANGE — Distance gates
  // ==========================================================================
  {
    name: "Touch Range",
    category: "RANGE",
    buCost: 0,
    tier: "Tier 0: Touch (0 BU)",
    description: "Immediate contact or self-contained (Touch / Self / Melee 5ft)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "Close Range",
    category: "RANGE",
    buCost: 2,
    tier: "Tier 1: Minor (2 BU)",
    description: "Same-zone / melee proximity (Close 5-10ft)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "Near Range",
    category: "RANGE",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Standard combat range (Near 30ft)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "Far Range",
    category: "RANGE",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Extended tactical range (Far 60ft)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "Very Far Range",
    category: "RANGE",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Cross-battlefield influence (Very Far 120ft)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "Extreme Range",
    category: "RANGE",
    buCost: 24,
    tier: "Tier 4: Core Axis (24 BU)",
    description: "Scene-wide / near-remote presence (Extreme 240ft-3mi)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },
  {
    name: "World Range",
    category: "RANGE",
    buCost: 48,
    tier: "Tier 4: Core Axis (48 BU)",
    description: "Huge area or world-sized scope",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Range Scaling",
  },

  // ==========================================================================
  // SPEED / QUICKENING — Execution timing
  // ==========================================================================
  {
    name: "Standard Execution",
    category: "DURATION",
    buCost: 0,
    tier: "Tier 0: Standard (0 BU)",
    description: "Normal resolution timing",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Speed / Quickening",
  },
  {
    name: "Fast Execution",
    category: "DURATION",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Prioritized within round (Fast Track)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Speed / Quickening",
  },
  {
    name: "Instant Execution",
    category: "DURATION",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Immediate resolution on declaration",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Speed / Quickening",
  },
  {
    name: "Reaction Execution",
    category: "DURATION",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Interrupt-triggered execution",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Speed / Quickening",
  },

  // ==========================================================================
  // DURATION — Persistence
  // ==========================================================================
  {
    name: "Instant Duration",
    category: "DURATION",
    buCost: 0,
    tier: "Tier 0: Instant (0 BU)",
    description: "Single resolution, resolves immediately",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },
  {
    name: "Short Duration",
    category: "DURATION",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Brief persistence (rounds), exists briefly after resolution",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },
  {
    name: "Medium Duration",
    category: "DURATION",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Encounter-length, sustained presence in scene",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },
  {
    name: "Long Duration",
    category: "DURATION",
    buCost: 16,
    tier: "Tier 3: Major (16 BU anchor)",
    description: "Multi-scene / narrative segment, persistent strategic effect",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },
  {
    name: "Persistent Duration",
    category: "DURATION",
    buCost: 32,
    tier: "Tier 4: Core Axis (32 BU)",
    description: "Long-term world state, ongoing until removed",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },
  {
    name: "Permanent Duration",
    category: "DURATION",
    buCost: 64,
    tier: "Tier 4: Core Axis (64 BU)",
    description: "Fixed reality state, requires explicit reversal logic",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Duration & Persistence",
  },

  // ==========================================================================
  // STATE TAGS — Foundational state change permissions
  // ==========================================================================
  {
    name: "Physical Interaction Tag",
    category: "CONDITION",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Direct structural, positional, kinetic, or material interference (movement restriction, spatial displacement, structural instability, kinetic bind)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Semantic State Tags",
  },
  {
    name: "Sensory & Physiological Tag",
    category: "CONDITION",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Alteration of sensory input channels or biological stability (vision disruption, acoustic interference, biological invalidation, nervous system friction)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Semantic State Tags",
  },
  {
    name: "Cognitive & Agency Tag",
    category: "CONDITION",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Interference with conscious thought, intent, memory, choice (attention lock, terror loop, cognitive suppression, emotional drift)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Semantic State Tags",
  },
  {
    name: "System & Identity Tag",
    category: "CONDITION",
    buCost: 16,
    tier: "Tier 4: Core Axis (16 BU anchor)",
    description: "Overwriting core system parameters, rule interpretation, existential status (form instability, reality banishment, action validity constraints, probability fracture)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Semantic State Tags",
  },

  // ==========================================================================
  // CHARACTER PROGRESSION — Attribute/Practice upgrades
  // ==========================================================================
  {
    name: "Attribute Increment",
    category: "SHEET_AUGMENT",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "+1 to a Core Attribute Score (max score limits apply per tier)",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 12,
    sourceTable: "Character Progression Market",
    targetScope: { layer: "ATTRIBUTE", value: null },
  },
  {
    name: "Attack Bonus Increment",
    category: "SHEET_AUGMENT",
    buCost: 6,
    tier: "Tier 2: Standard (6 BU)",
    description: "+1 to baseline Attack Rolls (max +1 per character level)",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 6,
    sourceTable: "Character Progression Market",
    targetScope: { layer: "METRIC", value: "ATTACK_ROLL" },
  },
  {
    name: "Defensive Save Upgrade",
    category: "SHEET_AUGMENT",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Gain Saving Throw Proficiency for one chosen Attribute type (adds full PB to defense/hazard saves)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Character Progression Market",
    targetScope: { layer: "ATTRIBUTE", value: null },
  },
  {
    name: "Broad Familiarity",
    category: "SHEET_AUGMENT",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Add half Proficiency Bonus (rounded down) to all non-proficient checks. Requires no active Practice Proficiencies.",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Practice Progression",
    targetScope: { layer: "ALL", value: null },
  },
  {
    name: "Focused Edge",
    category: "SHEET_AUGMENT",
    buCost: 3,
    tier: "Tier 1: Minor (3 BU)",
    description: "Gain Narrow Advantage on one chosen Narrative Focus (e.g., Awareness when tracking by scent)",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Practice Progression",
    targetScope: { layer: "NARROW_FOCUS", value: null },
  },
  {
    name: "Practice Proficiency",
    category: "SHEET_AUGMENT",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Add full Proficiency Bonus (+PB) to all checks matching a single Named Practice",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Practice Progression",
    targetScope: { layer: "PRACTICE", value: null },
  },
  {
    name: "Expertise Upgrade",
    category: "SHEET_AUGMENT",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Double the Proficiency Bonus (+2x PB) for that single Named Practice. Requires Practice Proficiency.",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Practice Progression",
    targetScope: { layer: "PRACTICE", value: null },
  },
  {
    name: "Reliable Practice",
    category: "SHEET_AUGMENT",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Establish a natural d20 floor of 10 for that single Named Practice. Requires Expertise Upgrade.",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Practice Progression",
    targetScope: { layer: "PRACTICE", value: null },
  },

  // ==========================================================================
  // VITALITY AUGMENTS
  // ==========================================================================
  {
    name: "Vitality Core Augment I",
    category: "SHEET_AUGMENT",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "Flat +5 Max Vitality. Injects a permanent, structural increase to the character's base health pool. Stacks cumulatively.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 4,
    sourceTable: "Vitality Extension Primitives",
    targetScope: { layer: "METRIC", value: "HP" },
  },
  {
    name: "Vitality Core Augment II",
    category: "SHEET_AUGMENT",
    buCost: 8,
    tier: "Tier 2: Standard (8 BU anchor)",
    description: "Flat +12 Max Vitality. A deeper, mid-tier investment for dedicated frontline or high-endurance builds.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 8,
    sourceTable: "Vitality Extension Primitives",
    targetScope: { layer: "METRIC", value: "HP" },
  },
  {
    name: "Vitality Core Augment III",
    category: "SHEET_AUGMENT",
    buCost: 12,
    tier: "Tier 3: Major (12 BU anchor)",
    description: "Flat +20 Max Vitality. A massive character-altering health spike representing peak physical or metaphysical fortitude.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 12,
    sourceTable: "Vitality Extension Primitives",
    targetScope: { layer: "METRIC", value: "HP" },
  },

  // ==========================================================================
  // GLOBAL ATTACK & CHARACTER DC MODIFIERS
  // ==========================================================================
  {
    name: "Focused Presence (Global DC Modifier)",
    category: "SHEET_AUGMENT",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "+1 to Character DC. Permanently raises the global baseline check threshold (5 + PB + Attribute Modifier) for all saving throws forced by the character.",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Global Attack & DC Modifiers",
    targetScope: { layer: "METRIC", value: "CHARACTER_DC" },
  },
  {
    name: "Precise Vector Alignment (Global Attack Modifier)",
    category: "SHEET_AUGMENT",
    buCost: 4,
    tier: "Tier 1: Minor (4 BU anchor)",
    description: "+1 to All Attack/Accuracy Rolls. Adds a flat, permanent bonus to accuracy resolution tracks regardless of source.",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Global Attack & DC Modifiers",
    targetScope: { layer: "METRIC", value: "ATTACK_ROLL" },
  },

  // ==========================================================================
  // PROBABILITY BIAS MARKET — Phase 7
  // ==========================================================================
  // Per BU Market canonical Probability Bias table. Scope is *intrinsic*
  // to the tier — see src/lib/primitives/target-scope.ts PROBABILITY_BIAS_TIER_SPEC.
  // Tiers I-III are mirrorable (accept Disadvantage for BU credit).
  // Tier IV (Causal Override) is not: you cannot purchase a "negative fate."
  {
    name: "Probability Bias — Narrative Focus",
    category: "PROBABILITY_BIAS",
    buCost: 3,
    tier: "Tier 1: Minor (3 BU)",
    description:
      "Tier I Probability Bias (3 BU). Gain Positive Bias (Advantage) OR impose Negative Bias (Disadvantage) within an ultra-specific, narrowly-defined narrative context. Examples: balancing boots granting Positive Bias vs. physical knockdowns; cursed item imposing Negative Bias on Awareness checks by smell only. Mountable on passive traits, refined sensory tools, or hyper-specific gear modifications.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 3,
    sourceTable: "Probability Bias Market",
    targetScope: { layer: "NARROW_FOCUS", value: null },
  },
  {
    name: "Probability Bias — Named Metric",
    category: "PROBABILITY_BIAS",
    buCost: 6,
    tier: "Tier 2: Standard (6 BU)",
    description:
      "Tier II Probability Bias (6 BU). Gain Positive or impose Negative Bias across a full Named Practice (e.g., all Awareness checks) or a single combat interaction (e.g., attacks against a single chosen foe). Used for core active capabilities and deep tactical features.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 6,
    sourceTable: "Probability Bias Market",
    targetScope: { layer: "PRACTICE", value: null },
  },
  {
    name: "Probability Bias — Core Attribute",
    category: "PROBABILITY_BIAS",
    buCost: 12,
    tier: "Tier 3: Major (12 BU)",
    description:
      "Tier III Probability Bias (12 BU). Gain Positive or impose Negative Bias across an entire primary Attribute axis (e.g., all Mental checks) or all attack/defense profiles. High-impact capability that temporarily distorts a target's overall efficiency or grants supreme clarity.",
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: 12,
    sourceTable: "Probability Bias Market",
    targetScope: { layer: "ATTRIBUTE", value: null },
  },
  {
    name: "Causal Override (Timeline Lock)",
    category: "PROBABILITY_BIAS",
    buCost: 20,
    tier: "Tier 4: Core Axis (20+ BU)",
    description:
      "Tier IV Probability Bias — Causal Override (20 BU). Bypass the rolling engine entirely. An unpredictable d20 roll is replaced with a fixed, static value. Timeline Lock: high-tier reality or chronological distortion. The user pre-determines a narrative outcome by substituting a variable roll with a guaranteed mathematical baseline. NOT mirrorable — you cannot possess a \"negative fate.\"",
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    sourceTable: "Probability Bias Market",
    targetScope: { layer: "DICE", value: "D20" },
  },
];

export const BU_MARKET_META = {
  sourcePageId: "37eed8479ccd8155b917c373194dbdf4",
  sourcePageTitle: "BU Market of Primitive components — Complete System",
  extractedOn: "2026-07-04",
  totalPrimitives: BU_MARKET_PRIMITIVES.length,
  note: "Total auto-calculated. Lexicon pages are NOT included — vocabulary reference only; BU Market is canonical for pricing.",
} as const;