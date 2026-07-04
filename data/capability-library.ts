/**
 * capability-library.ts — Compiled capabilities from Notion's Blueprint Ledger
 *
 * Extracted from Notion page: "SWORDWEAVE BLUEPRINT LEDGER: COMPILED CAPABILITIES & DESIGN MATH"
 * Page ID: 38eed8479ccd80909bc1d206ed4afe8a
 *
 * Each capability is decomposed into its primitive assembly.
 * The migration script will look up primitive IDs by name+category and
 * create the capability + capability_primitives join rows.
 *
 * Per Notion rule: "BU Market is canonical; this ledger is example assembly."
 */

export interface CapabilitySeed {
  readonly name: string;
  readonly type: "ACTIVE" | "PASSIVE" | "AUGMENT";
  readonly sourceType: "PHYSICAL" | "MAGICAL" | "PSYCHIC";
  readonly verboseDescription: string;
  readonly totalBu: number; // Authoritative total from Notion
  readonly tier: "PART_1_L1" | "PART_2_L2" | "PART_3_L3";
  readonly primitives: readonly {
    readonly name: string;
    readonly category: string;
    readonly role: "VERB" | "DOMAIN" | "SIZING" | "RANGE" | "DURATION" | "OUTPUT" | "AUGMENT" | "OTHER";
  }[];
}

export const CAPABILITY_LIBRARY: readonly CapabilitySeed[] = [

  // ==========================================================================
  // PART 1 — LEVEL I ENHANCEMENTS & UTILITIES (5-20 BU)
  // ==========================================================================
  {
    name: "Bloodhound Master",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A character with highly specialized, supernatural observation skills who can track targets with extreme accuracy specifically through physical scent. Adds double Proficiency Bonus (+2x PB) to all standard visual, auditory, or general observation checks. When tracking by scent, also rolls with Positive Bias (Advantage).",
    totalBu: 9,
    tier: "PART_1_L1",
    primitives: [
      { name: "Practice Proficiency", category: "SHEET_AUGMENT", role: "AUGMENT" },
      { name: "Focused Edge", category: "SHEET_AUGMENT", role: "AUGMENT" },
      { name: "Expertise Upgrade", category: "SHEET_AUGMENT", role: "AUGMENT" },
    ],
  },
  {
    name: "Heavy Tactical Cover",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A thick, reinforced stone barrier deployed or chosen on the battlefield that provides heavy protection against physical kinetic projectiles but offers zero defense against mental attacks. Adds flat +4 to Physical Defense profile vs. ranged kinetic strikes.",
    totalBu: 8,
    tier: "PART_1_L1",
    primitives: [
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Vow of Enmity",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A martial challenger locks eyes with a single priority foe on the field, causing their weapon attacks to become supernaturally guided against them. Upon execution, the attacker gains rolling Positive Bias (Advantage) on all offensive resolution rolls targeting the chosen enemy.",
    totalBu: 6,
    tier: "PART_1_L1",
    primitives: [
      { name: "Focused Edge", category: "SHEET_AUGMENT", role: "AUGMENT" },
    ],
  },
  {
    name: "Aura Detective",
    type: "PASSIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "The character's eyes shift visually, allowing them to permanently perceive and trace lingering magical matrices left behind by active spells in a room. The character has constant passive permission to observe magical residue, trails, and active conduits. Pinpointing a hidden spell uses Awareness check with unlocked sensory permission.",
    totalBu: 14,
    tier: "PART_1_L1",
    primitives: [
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
    ],
  },
  {
    name: "Aegis Shield",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A heavy physical shield that permanently bolsters defense and can be braced as a reaction to intercept incoming strikes. The wielder gains a permanent +1 to their Physical Defense (AC) score. When targeted by an incoming physical strike, they can choose to spend their Independent Reaction Slot to instantly add +2 to their defense against that specific attack.",
    totalBu: 14,
    tier: "PART_1_L1",
    primitives: [
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
      { name: "Reaction Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Rusting Strike",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A physical strike or spell designed to rot away a target's armor plates on contact, leaving them structurally compromised. On a successful hit, the target's physical defensive integrity is compromised. Their physical armor value is reduced by a flat -2 for the duration of the state.",
    totalBu: 16,
    tier: "PART_1_L1",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Blind Swordsman",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A warrior who wears a cloth over their eyes but can slice flies and track opponents in the pitch black by reading subtle acoustic vibrations and wind currents. The character is completely blind to far-range objects. However, within a 30-foot radius, they possess absolute targeting permission, completely ignoring normal sight penalties, invisibility, magical illusions, or thick smoke.",
    totalBu: 19,
    tier: "PART_1_L1",
    primitives: [
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
    ],
  },
  {
    name: "Ghost Walk",
    type: "PASSIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "A spectral assassin or phantom infiltrator who can step directly through solid stone dungeon walls and locked vault doors. The entity's movement rate is increased by +10 feet. They can move directly through solid matter (walls, barriers, enemies) treating it as difficult terrain. Stopping their turn inside solid matter violates reality, forcing the DM to apply immediate, heavy Strain.",
    totalBu: 20,
    tier: "PART_1_L1",
    primitives: [
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
    ],
  },

  // ==========================================================================
  // PART 2 — LEVEL II TACTICAL MANEUVERS (20-40 BU)
  // ==========================================================================
  {
    name: "Aura of Total Enfeeblement",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "An active, pulsing bubble of draining energy that follows the user, making every physical action exhausting for nearby enemies. While active, any enemy coordinate that enters or starts its turn within the 10-foot field surrounding the user suffers a flat -2 penalty on all Physical Checks (Prowess, Finesse) and Physical Defensive Saves.",
    totalBu: 15,
    tier: "PART_2_L2",
    primitives: [
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
    ],
  },
  {
    name: "Gravity Anchor Trap",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "A runic trap planted on the floor. When triggered, it surges local gravity downward, pinning an enemy's boots to the floor and holding them in place. Any entity entering the zone is caught by the downward gravity vector; their physical speed is instantly locked to 0. Maintaining this coordinate lock requires standard turn-by-turn upkeep from the caster.",
    totalBu: 20,
    tier: "PART_2_L2",
    primitives: [
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
      { name: "Reaction Execution", category: "DURATION", role: "DURATION" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
    ],
  },
  {
    name: "Hypnotic Suggester",
    type: "ACTIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "The caster's eyes glow with an unnatural, swaying light, implanting a sudden, undeniable behavioral directive into an opponent's mind. If the target fails their Mental Defensive Save, they must perform the specified task (e.g., 'leave your post,' 'unlock this security door'). This command is maintained via active turn-by-turn upkeep from the caster.",
    totalBu: 20,
    tier: "PART_2_L2",
    primitives: [
      { name: "Cognitive & Agency Tag", category: "CONDITION", role: "OTHER" },
      { name: "Cognitive & Agency Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Tornado Blast",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The caster unleashes a violent, localized wind burst in a cone shape, throwing all enemies within the area backward through the air. Resolves on the Fast or Measured track. All targets within the 15-foot cone must succeed on a Physical Save or be forcibly thrown 20 feet directly backward away from the caster.",
    totalBu: 21,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
      { name: "Fast Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Archmage's Strain Redirection Plate",
    type: "PASSIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "An ancient, runic breastplate designed to trap the physical backlash of spell casting, converting biological wear into localized environmental tremors. When the wearer casts a capability evaluated at Extreme Strain (Strain 5), the plate automatically filters it down to Heavy Strain (Strain 4). Instead of taking the 20% Vitality damage, the caster can choose to protect their health entirely; the DM instead converts that raw pressure into a localized hazard.",
    totalBu: 20,
    tier: "PART_2_L2",
    primitives: [
      { name: "Sensory & Physiological Tag", category: "CONDITION", role: "OTHER" },
      { name: "Sensory & Physiological Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Cataclysmic Shockwave",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The caster slams their foot or focus into the ground, generating a massive seismic wave that ruptures the earth in a wide radius while bypassing their allies. Fires on the Heavy Track. Instantly creates a 30-foot radius kinetic explosion centered on a point in range. All enemies must make a Physical Save or suffer damage and be knocked prone. Allies inside the coordinate footprint are automatically bypassed and remain completely unharmed.",
    totalBu: 25,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Sentry's Retaliation",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "The classic vigilant warrior maneuver. The moment an enemy attempts to slide or step out of the warrior's close-combat reach, they trigger a swift retaliatory strike. The character can spend their Independent Reaction Slot out-of-turn. The moment an enemy moves past their combat coordinates, this capability interrupts the movement, resolving a rapid physical strike.",
    totalBu: 27,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier I", category: "DOMAIN", role: "DOMAIN" },
      { name: "Reaction Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Mind Scan",
    type: "ACTIVE",
    sourceType: "PSYCHIC",
    verboseDescription:
      "The psychic projects an invisible sensory ripple through a room, cleanly intercepting the active surface thoughts of everyone present in the zone. Resolves on the Measured Track. The psychic scans all coordinates within a 10-foot radius sphere at Medium range. For every target within the footprint, they receive a stream of active surface thoughts and immediate intentions, bypassing physical cover.",
    totalBu: 31,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier II", category: "DOMAIN", role: "DOMAIN" },
      { name: "Near Range", category: "RANGE", role: "RANGE" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
    ],
  },
  {
    name: "Colossus Form",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription:
      "The caster channels elemental and physical energy, expanding their skeletal structure and mass category up to Huge size to dominate the combat zone. While maintained (requires active upkeep of 3 BU per turn), the caster's physical category shifts from Medium to Huge, extending their reach on the grid. They gain a flat +4 bonus to physical strikes and move +10 feet faster.",
    totalBu: 31,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier II", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier II", category: "DOMAIN", role: "DOMAIN" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Long Duration", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Spore Choke",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The caster generates a thick, toxic cloud of fungal spores. Enemies caught inside are blinded by the irritating dust and choked so violently they cannot speak or cast. Fires on the Measured Track. Any target failing their Defensive Save is caught in the spores: they suffer rolling Disadvantage on all physical strikes and checks, and their throat is seized—preventing speech, communication, or capabilities containing vocal/verbal triggers.",
    totalBu: 32,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier II", category: "DOMAIN", role: "DOMAIN" },
      { name: "Sensory & Physiological Tag", category: "CONDITION", role: "OTHER" },
    ],
  },
  {
    name: "Chronomantic Haste",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The chronomancer accelerates their personal timeline, sliding their actions forward to the absolute top of the round and gaining an extra Standard Action to perform. When declared during the Council Phase, this capability instantly resolves at the top of the Fast Track before standard physical actions. Upon resolution, it grants the caster a double Standard Action window to use on subsequent tracks during the round.",
    totalBu: 32,
    tier: "PART_2_L2",
    primitives: [
      { name: "Physical Interaction Tag", category: "CONDITION", role: "OTHER" },
      { name: "Fast Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Spell Counter-Disruption Shield",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "A defensive mage sits in deep focus. The moment they perceive an enemy trying to cast a spell nearby, they launch an energetic spike that shatters the spell's structure mid-air. The caster holds this reaction dormant. The millisecond an enemy declares an intent containing a Magical domain, the reaction triggers out-of-sequence, forcing an Active Contest to break and cancel the incoming spell before it manifests in the fiction.",
    totalBu: 32,
    tier: "PART_2_L2",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier II", category: "DOMAIN", role: "DOMAIN" },
      { name: "Reaction Execution", category: "DURATION", role: "DURATION" },
    ],
  },

  // ==========================================================================
  // PART 3 — LEVEL III HIGH-TIER & MYTHIC INFLUENCES (40-100 BU)
  // ==========================================================================
  {
    name: "Chamber Blackout Matrix",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The caster drives a localized void field into a room. Within this sphere, all electronic, radio, cellular, and magical frequencies are completely severed, creating an absolute informational vacuum. Sustained via heavy upkeep. Creates a stationary, 20-foot radius sphere. While active inside this matrix, zero data, radio transmissions, magical scrying, telepathic signals, or sensory information can cross the boundary.",
    totalBu: 43,
    tier: "PART_3_L3",
    primitives: [
      { name: "Verb Access Tier I", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier II", category: "DOMAIN", role: "DOMAIN" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Structure Tier I", category: "SIZING", role: "SIZING" },
      { name: "Long Duration", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Medusa's Gaze",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The gorgon or mage focuses their visual intent on a victim's coordinate. If the victim's physical resilience fails, their flesh and blood instantly turn into rigid limestone, freezing their movement and actions. The caster targets an entity. The target must execute a Physical Save against the capability's DC. On a failure, the state tag anchors: their speed drops to 0, they lose their standard action, and their tissue is transformed into stone.",
    totalBu: 45,
    tier: "PART_3_L3",
    primitives: [
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Instant Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Temporal Stasis Trap",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "A temporal trap planted at a coordinate. When an enemy steps into range, they are instantly locked in a shimmering field of absolute frozen time, halting their momentum completely. Stays silent on the grid. The instant an enemy entity crosses into close-range proximity, the trap erupts. The target is isolated from the chronological timeline for 1 round: they cannot move or act, but they are also completely invulnerable to external harm as time around them is entirely halted.",
    totalBu: 46,
    tier: "PART_3_L3",
    primitives: [
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Reaction Execution", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Time Stop",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The temporal master halts the universal timeline. For a brief window, every other entity on the field is frozen in place, allowing the master to freely move, lay traps, or cast shields with zero interference. When executed during the Council Phase, the GM evaluates the extreme scale and assigns a Strain 6 (Reality-Breaking) profile. To force this freeze into reality, the caster must accept a permanent narrative complication or pay 30%+ of their Vitality upfront.",
    totalBu: 59,
    tier: "PART_3_L3",
    primitives: [
      { name: "Verb Access Tier II", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier III", category: "DOMAIN", role: "DOMAIN" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Instant Duration", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Greater Invisibility",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The entity completely bends local light waves and acoustics around their physical frame. They remain entirely invisible to all physical senses, even while active, running, and executing attacks. An incredibly high-footprint master technique. At runtime, the DM evaluates this persistent space-bending fold at Strain 4 (Heavy Strain). While maintaining this active concealment, the caster pays an ongoing 2 BU Upkeep cost at the start of every Council Phase.",
    totalBu: 94,
    tier: "PART_3_L3",
    primitives: [
      { name: "Verb Access Tier II", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier III", category: "DOMAIN", role: "DOMAIN" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Persistent Duration", category: "DURATION", role: "DURATION" },
    ],
  },
  {
    name: "Simulacrum",
    type: "ACTIVE",
    sourceType: "MAGICAL",
    verboseDescription:
      "The caster clones their physical and cognitive matrix, creating a precise physical duplicate that operates with its own independent action economy under their complete control. An absolute, mythic-tier design. When this duplicate is initiated, the GM applies Strain 6 (Reality-Breaking), demanding an immediate, permanent narrative sacrifice, 30%+ of the caster's Vitality upfront, and a persistent environmental anomaly in the chamber where the duplicate was woven.",
    totalBu: 97,
    tier: "PART_3_L3",
    primitives: [
      { name: "Verb Access Tier IV", category: "VERB_TIER", role: "VERB" },
      { name: "Domain Access Tier IV", category: "DOMAIN", role: "DOMAIN" },
      { name: "System & Identity Tag", category: "CONDITION", role: "OTHER" },
      { name: "Permanent Duration", category: "DURATION", role: "DURATION" },
    ],
  },
];

export const CAPABILITY_LIBRARY_META = {
  sourcePageId: "38eed8479ccd80909bc1d206ed4afe8a",
  sourcePageTitle: "SWORDWEAVE BLUEPRINT LEDGER: COMPILED CAPABILITIES & DESIGN MATH",
  extractedOn: "2026-07-04",
  totalCapabilities: CAPABILITY_LIBRARY.length,
  part1Count: CAPABILITY_LIBRARY.filter((c) => c.tier === "PART_1_L1").length,
  part2Count: CAPABILITY_LIBRARY.filter((c) => c.tier === "PART_2_L2").length,
  part3Count: CAPABILITY_LIBRARY.filter((c) => c.tier === "PART_3_L3").length,
  note: "These are compiled example capabilities. Primitive references are simplified to their tier/category — fine-grained primitive IDs will be looked up at migration time.",
} as const;