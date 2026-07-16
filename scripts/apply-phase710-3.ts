/**
 * Phase 7.10.3 — Compile Notion table columns into mechanical_output_text.
 *
 * For each canonical primitive that has a Notion row, appends the
 * missing Notion columns (Required Prerequisite + Operational Rule)
 * to mechanical_output_text using plain text with labels.
 *
 * Format per primitive (when appending):
 *   "Required Prerequisite: X. Operational Rule: Y."
 *
 * No schema changes. No restructuring. Plain text. Idempotent.
 *
 * Categories with no Notion row (DB-only, left untouched):
 *   - TACTICAL (4 cover primitives — Phase 7.9 originals)
 *   - VITALITY (3 tenacity primitives — Phase 7.9 originals)
 *
 * Run: pnpm exec tsx scripts/apply-phase710-3.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/db/client";
import { primitives } from "@/db/schema/engine";
import { eq } from "drizzle-orm";

// =============================================================================
// Notion data per primitive name.
// Format: "Required Prerequisite: X. Operational Rule: Y."
// =============================================================================

const NOTION_APPENDS: Record<string, string> = {
  // ===== Tier IV Defensive =====
  "Absolute Insulation (Domain Immunity)": "Operational Rule: Supreme elemental mastery. The entity takes 0 damage from a single specified domain under all conditions.",
  "Absolute Timeline Deprivation (Stun Vector)": "Operational Rule: The Slow/Stun Vector: Total suppression. The target is locked out of the action economy completely; they cannot act on their turn and cannot use reactions.",

  // ===== Kinetic Control =====
  "Advanced Vector Manipulation": "Operational Rule: Trajectory Control: Bends the direction of a throw or slide around physical corners, or completely isolates an entity's physics profile so they cannot be moved by any outside force.",

  // ===== Mobility =====
  "Aero Unlock": "Operational Rule: Grants full three-dimensional movement. Requires constant forward momentum to stay aloft.",
  "Aquatic Unlock": "Operational Rule: Grants natural buoyancy; eliminates drowning or underwater movement penalties.",

  // ===== Sheet Augment =====
  "Attack Bonus Increment": "Required Prerequisite: Max +1 per character level. Operational Rule: Permanently increases accuracy vectors across all compatible offensive systems.",
  "Attribute Increment": "Required Prerequisite: Max score limits apply per tier. Operational Rule: Permanently expands the raw physical, mental, or abstract capacity of the entity.",

  // ===== Agency Override =====
  "Behavioral Directive / Data Trace Masking": "Operational Rule: Systemic Influence / Scan: Directs an entity to perform a specific task (e.g., leave a room, drop a guard), or completely sweeps a scene clean of data tracks/reveals hidden security trails.",

  // ===== Targeting AOE =====
  "Bouncing Vector": "Operational Rule: If the capability successfully impacts the first target, it automatically leaps to a new target within 15 feet.",

  // ===== Practice Progression =====
  "Broad Familiarity": "Required Prerequisite: Must not possess any active Practice Proficiencies. Operational Rule: Represents a wide but shallow baseline of life experience. Instantly overridden on any Practice that later gains true Proficiency.",

  // ===== Evaluation / Strain =====
  "CV Matrix Trap": "Required Prerequisite: Heuristic Buffer. Operational Rule: Rather than absorbing trauma passively, you catch the high mathematical complexity (CV) of the cast and turn it into a fleeting barrier equal to the halved Vitality lost.",
  "Calamity Die Block (1d12)": "Required Prerequisite: 1d12 Damage / Healing. Operational Rule: Heavy Strain threat line.",

  // ===== Probability Bias =====
  "Causal Override (Fate Replacement)": "Operational Rule: Timeline Lock: High-tier reality or chronological distortion. The user pre-determines a narrative outcome by substituting a variable roll with a guaranteed mathematical baseline.",

  // ===== Temporal Chronological =====
  "Chronological Echo": "Required Prerequisite: One designated capability preset. Operational Rule: The user executes a capability normally on their track, but its physical entry into reality is suspended. It bursts into the fiction automatically at the start of a designated future Council Phase.",

  // ===== Action Economy =====
  "Clash Dominance": "Required Prerequisite: Reaction Reflex. Operational Rule: Represents supreme tactical anticipation. Whenever a Reaction Clash is triggered (\"Who gets there first?\"), the player rolls two resolution dice and utilizes the higher result.",

  // ===== Range =====
  "Close Range": "Operational Rule: Same-zone / melee proximity.",

  // ===== Condition Tags =====
  "Cognitive & Agency Tag": "Operational Rule: Attention Lock: Taunting, forced focal priority, single-target fixation, mental distractions. Terror Loop: Panic induction, flight impulses, overwhelming dread, paralysis from fear. Cognitive Suppression: Mental slowing, spellcasting interruption, memory blocking, confusion. Emotional Drift: Unnatural calm, aggressive rage triggers, temporary charm, behavioral nudges.",

  // ===== Targeting AOE =====
  "Collateral Buffer": "Operational Rule: Filters the output of an Area of Effect template. Allies inside the footprint are automatically bypassed by harmful effects.",

  // ===== Metamorphosis =====
  "Composition Tuning": "Operational Rule: Surface Mod: Governs adaptation traits (e.g., biological camouflage traits, shifting appearance to match another persona, or minor skin calcification).",

  // ===== Evaluation / Strain =====
  "Condition Insulation": "Operational Rule: If the DM rules that a spell's backlash knocks you prone, blinded, or staggered due to environmental friction, your anatomy isolates the shock and ignores that specific flag.",

  // ===== Trigger Hook =====
  "Conditional Informational Trigger": "Operational Rule: Vigilant Sentinel: Triggered by abstract conditions, such as a specific individual telling an intentional falsehood, a specific designated ally losing consciousness anywhere in the sector, or a hidden entity crossing a boundary.",

  // ===== Action Economy =====
  "Core Action Multiplication (Haste Vector)": "Operational Rule: The Haste Vector: Grants immense power. The entity can execute two distinct capabilities or double their output within a single turn loop.",

  // ===== Sheet Augment =====
  "Defensive Save Upgrade": "Required Prerequisite: One chosen Attribute type. Operational Rule: Allows the character to add their full Proficiency Bonus (PB) to defense/hazard saves of that category.",

  // ===== Agency Override =====
  "Direct Executive Override / Matrix Redaction": "Operational Rule: Total Hijack / Memory Edit: The user commands the target's entire action economy as a proxy, or permanently removes/replaces a specific hour of data from a biological brain or machine log.",

  // ===== Trigger Hook =====
  "Direct Material Trigger": "Operational Rule: Reactive Guard: Triggered by concrete actions like an entity crossing a physical threshold, launching a direct attack vector, or physically dropping an object.",

  // ===== Domain =====
  "Domain Access Tier I": "Operational Rule: Grounded, tangible reality domains. Includes physical matter and direct sensory reality spaces such as fire, water, air, earth, metal, stone, wood, ice, lightning, light, darkness, gravity (local), motion, force, sound, heat, cold, pressure, friction, vibration, smell, taste, touch, weather (basic), terrain, biological tissue (simple lifeforms), simple ecosystems. These domains are direct and observable, without abstract interpretation layers.",
  "Domain Access Tier II": "Operational Rule: Domains that blend physical reality with structured interpretation. Includes life, decay, growth, memory (as biological/mental imprint), emotion (as physiological state), time (local perception), space (local distortion), disease, evolution, energy systems, magnetism, entropy, chaos (localized), order, perception, language, motion systems, adaptation, transformation, networks, resonance, balance, instability. These domains begin to describe systems rather than just materials.",
  "Domain Access Tier III": "Operational Rule: High-level conceptual and systemic domains. Includes consciousness, identity, will, intent, thought, belief, information, probability (local manipulation), fate (limited scope), causality (bounded systems), narrative structure, memory systems (collective), archetypes, emotional ecosystems, societal structures, conflict, law, hierarchy, corruption, purity (conceptual), synchronization, divergence, coherence, entropy systems, dimensional interfaces (local), symbolic systems. These domains define how systems behave and relate.",
  "Domain Access Tier IV": "Operational Rule: Core existential and rule-defining domains. Includes existence, non-existence, reality itself, causality (global), time (absolute structure), space (global structure), identity (existential), probability fields (global), narrative authority, rule-logic, paradox, void structures, infinity (bounded conceptual access), origin states, termination states, multilevel existence frameworks, reality layers, ontological hierarchy, system authorship, fundamental laws of reality. These domains define what reality is allowed to be.",

  // ===== Evaluation / Strain =====
  "Domain Lock Shield": "Required Prerequisite: Condition Insulation. Operational Rule: Protects active capabilities. If the DM rules that a heavy cast fractures your focus—locking your access to a Domain (e.g., Fire) for several rounds—this component maintains the conduit.",

  // ===== Temporal Chronological =====
  "Dormant Trigger Hook": "Required Prerequisite: One designated capability preset. Operational Rule: Plants the intent directly into a spatial coordinate. The capability stays perfectly hidden and silent until an environmental catalyst triggers its release.",
  "Duration Anchor": "Operational Rule: Direct timeline preservation. Extends the lifespan of a decaying active zone, barrier, or transformation without requiring the player to re-cast or pay initialization costs again.",

  // ===== Perception Qualifier =====
  "Environmental Translation Qualifier": "Operational Rule: Material Sensor: Permits the character to navigate and locate entities in total physical darkness or across opaque barriers (e.g., tracking movement through stone up to a fixed scale).",

  // ===== Agency Override =====
  "Existential Allegiance Bind / Informational Absolutism": "Operational Rule: Identity Re-Anchor: Forges a permanent behavioral bond, turning an enemy entity into an unshakeable asset, or locks an entire network zone so zero data can exit or enter.",
  "Existential Clarity Qualifier": "Operational Rule: Absolute Sensor: Total visual truth. If a target is structurally present in the scene, it is perceived in its true form, regardless of any active capability or environmental obfuscation trying to hide it.",

  // ===== Boss Economy =====
  "Existential Imperative (Legendary Resistance 1x/Day)": "Operational Rule: The entity can choose to completely overwrite a failed Defensive Save, forcing an automatic success instead.",

  // ===== Intensity Dice =====
  "Existential Tear (1d20)": "Required Prerequisite: 1d20 Damage / Healing. Operational Rule: Mythic/Reality-breaking scale.",

  // ===== Practice Progression =====
  "Expertise Upgrade": "Required Prerequisite: Practice Proficiency in the chosen Practice. Operational Rule: Represents extreme, dedicated specialization. Overrides standard Proficiency; does not stack with it.",

  // ===== Range =====
  "Extreme Range": "Operational Rule: Scene-wide / near-remote presence.",
  "Far Range": "Operational Rule: Extended tactical range.",

  // ===== Speed Quickening =====
  "Fast Execution": "Operational Rule: Prioritized within round.",

  // ===== Practice Progression =====
  "Focused Edge": "Required Prerequisite: Proficiency in the parenting Practice. Operational Rule: Example: Buying this for Awareness (Smell) lets you roll twice and take the highest only when tracking or detecting by scent.",

  // ===== Sheet Augment =====
  "Focused Presence (Global DC Modifier)": "Operational Rule: Permanently raises the global baseline check threshold 5 + PB + Attribute Modifier + Purchased Modifiers for all saving throws forced by the character.",

  // ===== Targeting AOE =====
  "Global Field": "Operational Rule: Drops all localized boundaries. The capability instantly impacts every coordinate across the entire active combat map.",

  // ===== Evaluation / Strain =====
  "Hazard Transmutation": "Operational Rule: Swaps personal sheet cost for battlefield chaos. Your health remains completely untouched, but the DM instantly converts the pressure into slick mud, thick smoke, or gravity pockets.",

  // ===== Action Economy =====
  "Heavy Compactor": "Required Prerequisite: One designated preset or capability. Operational Rule: Compresses massive, reality-straining actions (Complexity 4+). The user bypasses the standard Heavy Track delay, forcing the execution to complete during the Measured resolution phase.",

  // ===== Intensity Dice =====
  "Heavy Die Block (1d8)": "Required Prerequisite: 1d8 Damage / Healing. Operational Rule: Standard martial/spell cutoff.",

  // ===== Evaluation / Strain =====
  "Heuristic Buffer": "Required Prerequisite: One designated capability preset. Operational Rule: Drops the final evaluation down one bracket on the Ledger. Example: A Heavy Strain (Strain 4) cast is structurally filtered down to a Moderate Strain (Strain 3) result.",

  // ===== Mobility =====
  "Hover Precision": "Operational Rule: Supreme aerial mastery. The entity can remain perfectly stationary in mid-air without stalling or drifting.",

  // ===== Intensity Dice =====
  "Impact Die Block (1d10)": "Required Prerequisite: 1d10 Damage / Healing. Operational Rule: High-tier concentrated payload.",

  // ===== Agency Override =====
  "Impulse Nudge / Point Transmission": "Operational Rule: Momentary Ingress: Induces sudden brief states (e.g., sudden paranoia, brief curiosity) or establishes a quiet direct mental conduit to pass data without sound.",

  // ===== Duration =====
  "Instant Duration": "Operational Rule: Resolves immediately.",

  // ===== Speed Quickening =====
  "Instant Execution": "Operational Rule: Immediate resolution on declaration.",

  // ===== Trigger Hook =====
  "Interceptive Causal Trigger": "Operational Rule: Causality Interdiction: The ultimate timeline interceptor. Used to freeze an incoming fatal impact, halt a capability execution mid-manifestation, or warp space to change a target's position before an event connects.",

  // ===== Action Economy =====
  "Interceptive Priority": "Required Prerequisite: Clash Dominance. Operational Rule: Absolute temporal edge. If the d20 roll results in a direct mathematical tie against an adversary, this entity bypasses GM evaluation and automatically acts first.",

  // ===== Defensive =====
  "Kinetic Hardening (DEFENSIVE)": "Operational Rule: Integrates physical plating or toughens tissue. Raises threshold against physical strikes. Stacks.",

  // ===== Targeting AOE =====
  "Kinetic Sphere": "Operational Rule: Radiates symmetrically outward from a selected coordinate within the capability's range.",

  // ===== Temporal Chronological =====
  "Kinetic Stasis": "Operational Rule: Catches an item or a projectile mid-flight or mid-fall. All kinetic energy is locked in place; the object hangs suspended in the air until the stasis is dismissed.",

  // ===== Boss Economy =====
  "Legendary Cadence I": "Operational Rule: Allows the entity to execute a designated low-cost capability at the immediate end of another entity's turn track.",
  "Legendary Cadence II": "Operational Rule: Provides a deeper pool of out-of-sequence points to react dynamically to squad movements.",
  "Legendary Cadence III": "Operational Rule: Apex boss baseline. Restores all spent action points at the start of the Council Phase.",

  // ===== Targeting AOE =====
  "Linear / Conical Vector": "Operational Rule: Rigid spatial templates radiating outward from the user's current facing direction.",

  // ===== Duration =====
  "Long Duration": "Operational Rule: Persistent strategic effect.",
  "Medium Duration": "Operational Rule: Sustained presence in scene.",

  // ===== Intensity Dice =====
  "Minor Die Block": "Required Prerequisite: 1d4 Damage / Healing. Operational Rule: Max 6 units per baseline capability.",

  // ===== Kinetic Control =====
  "Minor Linear Displacement": "Operational Rule: Basic Impulse: Simple kinetic impacts or minor physical environmental drag (e.g., a gust of wind, a sweeping foot strike, or sticky mud).",

  // ===== Targeting AOE =====
  "Mobile Aura": "Operational Rule: Creates a 10-ft radius boundary that shifts dynamically as the originating entity moves through space.",

  // ===== Boss Economy =====
  "Mythic Safeguard (Legendary Resistance 3x/Day)": "Operational Rule: High-tier protection. Bypasses up to three catastrophic debuffs or crowd-control effects per encounter.",

  // ===== Evaluation / Strain =====
  "Narrative Pivot": "Required Prerequisite: Hazard Transmutation. Operational Rule: Perfect asset preservation. Your Vitality, status conditions, and domains are completely unaffected, but the DM introduces an immediate outside complication (e.g., an alarm triggers, a tool breaks).",

  // ===== Range =====
  "Near Range": "Operational Rule: Standard combat range.",

  // ===== Probability Bias =====
  "Negative Bias I — Narrative Focus": "Operational Rule: Focused Shift: Governs highly specialized passive traits, refined sensory tools, or hyper-specific gear modifications (e.g., balancing boots that grant Positive Bias vs. physical knockdowns).",
  "Negative Bias II — Named Practice": "Operational Rule: Specialist Shift: Used for core active capabilities or deep tactical features (e.g., an ongoing tactical challenge that forces Negative Bias on attacks made against a single ally).",
  "Negative Bias III — Core Attribute": "Operational Rule: Systemic Shift: High-impact capabilities that temporarily distort a target's overall efficiency or grant supreme clarity (e.g., total sensory distortion forcing Negative Bias on all offensive checks).",

  // ===== Perception Qualifier =====
  "Non-Material Translation Qualifier": "Operational Rule: Abstract Sensor: Permits tracking of entities that have withdrawn their physical presence from the immediate spectrum, or interpreting the unexpressed emotional baselines of a target.",

  // ===== Duration =====
  "Permanent Duration": "Operational Rule: Requires explicit reversal logic.",

  // ===== Temporal Chronological =====
  "Perpetual Lock": "Required Prerequisite: Duration Anchor. Operational Rule: Permanently anchors a capability preset. The effect no longer expires when the combat round loop terminates, enduring across subsequent narrative scenes.",

  // ===== Duration =====
  "Persistent Duration": "Operational Rule: Ongoing until removed.",

  // ===== Mobility =====
  "Phase Slip": "Operational Rule: Treat solid barriers as difficult terrain. Ending a turn inside solid matter inflicts immediate, heavy Strain.",

  // ===== Condition Tags =====
  "Physical Interaction Tag": "Operational Rule: Movement Restriction: Roots, anchors, physical snares, weight load increases.  Spatial Displacement: Forced vectors, knockbacks, pulling, momentum changes. Structural Instability: Armor degradation, weapon brittleness, balance disruption.Kinetic Bind: Grips, grapples, physical blockades, leverage denial, disarms.",

  // ===== Metamorphosis =====
  "Polymorphic Template Overwrite": "Operational Rule: Template Swap: Complete anatomical replacement. The target gains all physical metrics, movement types, and structural capabilities of the chosen form while holding their original mind.",

  // ===== Probability Bias =====
  "Positive Bias I — Narrative Focus": "Operational Rule: Focused Shift: Governs highly specialized passive traits, refined sensory tools, or hyper-specific gear modifications (e.g., balancing boots that grant Positive Bias vs. physical knockdowns).",
  "Positive Bias II — Named Practice": "Operational Rule: Specialist Shift: Used for core active capabilities or deep tactical features (e.g., an ongoing tactical challenge that forces Negative Bias on attacks made against a single ally).",
  "Positive Bias III — Core Attribute": "Operational Rule: Systemic Shift: High-impact capabilities that temporarily distort a target's overall efficiency or grant supreme clarity (e.g., total sensory distortion forcing Negative Bias on all offensive checks).",

  // ===== Practice Progression =====
  "Practice Proficiency": "Operational Rule: Establishes dependable, trained competence within a core field of action (e.g., Awareness).",

  // ===== Sheet Augment =====
  "Precise Vector Alignment (Global Attack Modifier)": "Operational Rule: Adds a flat, permanent bonus to accuracy resolution tracks regardless of source (Physical, Magical, or Psychic).",

  // ===== Defensive =====
  "Psychic Firewall (DEFENSIVE)": "Operational Rule: Fortifies neural or spiritual pathways, raising the threshold against cognitive overrides and emotional prompts. Stacks.",

  // ===== Speed Quickening =====
  "Reaction Execution": "Operational Rule: Interrupt-triggered execution.",

  // ===== Action Economy =====
  "Reaction Pulse": "Operational Rule: Expands the character's reaction loop. The entity can answer two distinct narrative catalysts in the same round. Each reaction must still independently obey standard Scale/Complexity limits (0–1).",
  "Reaction Reflex": "Operational Rule: Permanently increases the entity's raw baseline speed when an ally's intent and an adversary's intent directly collide within the same track ($1d20 + \\text{Attribute} + \\text{PB} + 2$).",

  // ===== Defensive =====
  "Reactive Bulwark (DEFENSIVE)": "Operational Rule: Spend an Independent Reaction Slot when targeted to gain an immediate +2 bonus to your defenses against that specific attack.",

  // ===== Action Economy =====
  "Reactive Expansion (Guardian Vector)": "Operational Rule: The Guardian Vector: Essential for defensive bodyguards or counter-mages. Allows the entity to execute multiple reactive capabilities before their next turn.",

  // ===== Practice Progression =====
  "Reliable Practice": "Required Prerequisite: Expertise Upgrade in the chosen Practice. Operational Rule: The absolute peak of training. When rolling for this Practice, any natural result of 9 or lower on the die is instantly treated as a 10.",

  // ===== Targeting AOE =====
  "Selective Focus": "Operational Rule: Absolute control over an AoE template. The player chooses exactly which specific entities are affected within the shape's boundaries.",

  // ===== Condition Tags =====
  "Sensory & Physiological Tag": "Operational Rule: Vision Disruption: Blindness, flashing light bursts, severe sensory blur, optical occlusion. Acoustic Interference: Deafening, high-frequency ringing, absolute sound suppression (silence). Biological Invalidation: Nausea, internal poisoning, cell decay, cellular paralysis, freezing muscles. Nervous System Friction: Pain induction, physical numbness, fatigue accumulation, reflex suppression.",

  // ===== Duration =====
  "Short Duration": "Operational Rule: Exists briefly after resolution.",

  // ===== Intensity Dice =====
  "Standard Die Block (1d6)": "Required Prerequisite: 1d6 Damage / Healing. Operational Rule: Fundamental balance baseline.",

  // ===== Speed Quickening =====
  "Standard Execution": "Operational Rule: Normal resolution timing.",

  // ===== Metamorphosis =====
  "State Transmutation": "Operational Rule: Phase Shifting: Transforms an entity into smoke to bypass tight physical barriers and gain physical immunity, or turns them into rigid stone to massively surge defensive thresholds.",

  // ===== Targeting AOE =====
  "Stationary Zone": "Operational Rule: Plants an area footprint at a fixed coordinate. The field endures across rounds based on upkeep rules.",

  // ===== Mobility =====
  "Stride Extension": "Operational Rule: Stacks infinitely unless explicitly restricted by an armor or archetype trait.",

  // ===== Defensive =====
  "Structural Hardening (Domain Resistance)": "Operational Rule: Grants permanent Resistance (take half damage) to one designated damage domain (e.g., Fire or Gravity).",

  // ===== Targeting AOE =====
  "Structural Wall": "Operational Rule: Erects a thin, linear sheet of energy or matter that blocks line of sight or physical passage.",

  // ===== Sizing =====
  "Structure Tier I": "Operational Rule: Simple, direct application of effects. Includes single target, self target, touch range application, line-of-sight single interaction, fixed object targeting, and direct point-based placement. These structures are precise, isolated, and non-distributive.",
  "Structure Tier II": "Operational Rule: Allows effects to spread across multiple defined targets or small spatial patterns. Includes multi-target (small group), chain targeting (limited hops), cone structures, radius/area of effect (sphere, circle, square, star, unique shape), directional spread (line, cone, rectangle, etc.) , and basic field placement. These structures distribute effects without dynamic adaptation.",
  "Structure Tier III": "Operational Rule: Allows effects to propagate dynamically or follow structured spatial logic. Includes expanding zones, moving fields, branching chains, conditional targeting (based on state or proximity), layered area effects, segmented regions, orbiting or shifting zones, and reactive spatial patterns (area changes based on triggers). These structures allow effects to behave differently across space or time.",
  "Structure Tier IV": "Operational Rule: Allows effects to apply based on rule conditions rather than spatial logic. Includes global or scene-wide application (within defined scope), rule-based targeting (e.g. \"all unstable entities\"), priority targeting systems, exclusion/inclusion logic, state-triggered application zones, recursive propagation rules, and structure that changes based on system state rather than fixed geometry. These structures define how reality selects targets, not just where effects land.",

  // ===== Sensory Array =====
  "Substrate Echo (Tremorsense 30ft)": "Operational Rule: Pinpoints the exact coordinates of any entity making physical contact with the same contiguous ground/floor, completely bypassing blindness, heavy smoke, or physical walls.",

  // ===== Mobility =====
  "Subterranean Bore": "Operational Rule: Permits travel underneath the terrain. Cannot pierce solid stone or reinforced metal without upgrades.",

  // ===== Condition Tags =====
  "System & Identity Tag": "Operational Rule: Form Instability: Shapechanging, physical polymorphing, turning flesh to stone or mist.Reality Banishment: Phase-state drifting, temporal displacement, dimensional shunting.Action Validity Constraints: Creating total rule exceptions, rewriting relationship permissions (e.g., friend/foe identification).Probability Fracture: Causal distortion, altering luck or outcome validity.",

  // ===== Kinetic Control =====
  "Systemic Kinetic Override": "Operational Rule: Momentum Catastrophe: Collapses local kinetic space. Can draw an entire squad into a central crushing singularity, or catch an incoming high-velocity projectile/rushing creature and instantly reverse its direction.",

  // ===== Perception Qualifier =====
  "Systemic Resonance Qualifier": "Operational Rule: Operational Sensor: Permits the tracking of active capability trails, identifying toxic components within a substance, or reading biological tells (e.g., heart rates or adrenaline shifts).",

  // ===== Evaluation / Strain =====
  "Systemic Sink": "Required Prerequisite: One designated capability preset. Operational Rule: Advanced structural alignment. Allows complex, high-friction actions to bypass severe fallout brackets entirely by shearing 2 whole points off the final score.",

  // ===== Trigger Hook =====
  "Systemic Threshold Trigger": "Operational Rule: Automated Response: Triggered by parameter changes, such as a localized energy signature manifesting, a target's vitality dropping below a fixed percentage, or an entity entering an active zone.",

  // ===== Sensory Array =====
  "Tactile Echo (Blindsight 30ft)": "Operational Rule: Absolute localized awareness. Perceive the scene perfectly without using eyes via acoustic, olfactory, or ambient pressure currents.",

  // ===== Temporal Chronological =====
  "Temporal Isolate": "Required Prerequisite: Kinetic Stasis. Operational Rule: The ultimate lockdown. The target is entirely removed from the sequential flow of the round. They cannot act, move, or think, but they are also completely immune to all outside damage or state changes until the stasis shatters.",

  // ===== Action Economy =====
  "Timeline Anchor": "Required Prerequisite: Passive trait; self only. Operational Rule: The entity's declared intent can never be forcibly demoted to a later track by enemy status tags, heavy environmental friction, or tactical suppression effects.",

  // ===== Temporal Chronological =====
  "Timeline Shift / Minor Window Grant": "Operational Rule: Minor Tuning: Used for speed-blitzing initiative traits, or allowing an entity to draw gear or adjust positioning without consuming their main action.",
  "Timeline Tether": "Required Prerequisite: Passive trait; self only. Operational Rule: Your actions can never be forcibly deferred, slowed, or pushed to a future round by enemy chronomancy or time-warping status tags.",

  // ===== Range =====
  "Touch Range": "Operational Rule: Immediate contact or self-contained.",

  // ===== Action Economy =====
  "Track Acceleration": "Required Prerequisite: One designated preset or capability. Operational Rule: Overwrites the native Complexity mapping. A chosen capability that normally sits on the Measured Track (Complexity 2–3) is permanently treated as sitting on the Fast Track when evaluated by the GM.",

  // ===== Sensory Array =====
  "Umbral Sight I (Darkvision 60ft)": "Operational Rule: Converts total physical darkness into dim light within range. Cannot discern color in pitch black.",
  "Umbral Sight II (Darkvision 120ft)": "Operational Rule: Extended deep-scout sensory array. Pierces natural and synthesized darkness effortlessly.",

  // ===== Defensive =====
  "Universal Aegis (DEFENSIVE)": "Operational Rule: Comprehensive structural upgrade across all three defensive scores simultaneously. Stacks.",

  // ===== Targeting =====
  "Vector Split": "Operational Rule: Allows a single-target capability to branch out, striking an additional independent profile within range. Stacks.",

  // ===== Kinetic Control =====
  "Velocity Arrest / Standard Vector": "Operational Rule: Absolute Anchor / Launch: Completely roots an entity to its current spatial coordinate, or violently throws them across the scene (e.g., magnetic pins, gravity spikes, or concussive blasts).",

  // ===== Verb Tier =====
  "Verb Access Tier I": "Operational Rule: Ground-level interaction with reality. Includes simple direct actions such as move, strike, push, pull, lift, drop, interact, sense, observe, touch, grab, throw, break, hold, release, dodge, step, crawl, run, simple create/destroy (light objects, small-scale changes), manipulate nearby objects, basic environmental interaction (open, close, activate), basic communication gestures, simple force application.",
  "Verb Access Tier II": "Operational Rule: Manipulation of existing states and properties. Includes alter, modify, combine, separate, enhance, weaken, suppress, extend, compress, reshape, redirect, convert, stabilize, destabilize, amplify, reduce, transfer, infuse, extract, bind (simple), disrupt, channel, reshape materials, change state (solid/liquid/gas), adjust energy flow, modify motion, reroute forces, soften/harden, accelerate/decelerate processes.",
  "Verb Access Tier III": "Operational Rule: Control over internal structure of systems and entities. Includes restructure, reconfigure, invert, synchronize, entangle, fracture (systemic), merge systems, split systems, override local rules, rewrite properties (limited scope), impose constraints, unlock latent states, reorganize systems, collapse subsystems, stabilize complex interactions, redirect causal chains (local), reshape multi-component structures, reorganize battlefield-level interactions.",
  "Verb Access Tier IV": "Operational Rule: Interaction with governing logic and abstract systems. Includes override rules, redefine interaction logic, collapse entire systems, enforce outcomes, rewrite constraints, negate conditions, alter causality (global or partial), suspend rules, define exceptions, modify probability structures, reshape narrative causality, impose system-wide states, alter existence conditions, redefine identity properties, rewrite system frameworks, enforce absolute states within scope.",

  // ===== Range =====
  "Very Far Range": "Operational Rule: Cross-battlefield influence.",

  // ===== Sheet Augment =====
  "Vitality Core Augment I": "Operational Rule: Injects a permanent, structural increase to the character's base health pool. Stacks cumulatively.",
  "Vitality Core Augment II": "Operational Rule: A deeper, mid-tier investment for dedicated frontline or high-endurance builds.",
  "Vitality Core Augment III": "Operational Rule: A massive character-altering health spike representing peak physical or metaphysical fortitude.",

  // ===== Evaluation / Strain =====
  "Vitality Shielding": "Operational Rule: Direct trauma buffer. If the DM states that a desperate, reality-warping overreach demands a flat loss of 30% Vitality, this component instantly cuts it to 15%.",
  "Volatile Vent": "Required Prerequisite: Passive trait; self only. Operational Rule: Explicit safety valve for minor overreach. Completely eliminates the routine low-pressure costs or minor resource depletion of standard maneuvers once per scene.",

  // ===== Targeting AOE =====
  "Volume Scaling I": "Operational Rule: Expands an active blueprint's dimensions (e.g., grows a 10-ft radius sphere into a 20-ft radius sphere).",

  // ===== Metamorphosis =====
  "Volumetric Scale Shift": "Operational Rule: Geometric Shift: Used for growth or shrinking capabilities. Grants heavy mass modifiers for physical checks or allows compression to squeeze through tiny apertures.",

  // ===== Defensive =====
  "Warding Shell (DEFENSIVE)": "Operational Rule: Insulates the profile's matrix, increasing resistance to incoming spell arrays or elemental domains. Stacks.",

  // ===== Range =====
  "World Range": "Operational Rule: A huge area or world sized.",
};

// =============================================================================
// Main migration
// =============================================================================

async function main() {
  console.log("=".repeat(72));
  console.log("Phase 7.10.3 — Compile Notion table data into mechanical_output_text");
  console.log("=".repeat(72));
  console.log(`Notion entries: ${Object.keys(NOTION_APPENDS).length}\n`);

  let applied = 0;
  let skipped = 0;
  let notFound = 0;
  const notFoundNames: string[] = [];

  for (const [name, append] of Object.entries(NOTION_APPENDS)) {
    // Find primitive by name (must be canonical, user_id IS NULL)
    const [row] = await db
      .select()
      .from(primitives)
      .where(eq(primitives.name, name))
      .limit(1);

    if (!row) {
      console.error(`  [${name}] — NOT FOUND in DB`);
      notFound++;
      notFoundNames.push(name);
      continue;
    }

    if (row.userId !== null) {
      console.error(`  [${name}] — not canonical (user_id set), skipping`);
      notFound++;
      notFoundNames.push(name);
      continue;
    }

    // Idempotency: skip if append text is already in mechanical_output_text
    const currentMech = row.mechanicalOutputText ?? "";
    if (currentMech.includes(append)) {
      console.log(`  [${row.id}] ${name} — already contains append, skip`);
      skipped++;
      continue;
    }

    // Append
    const newMech = currentMech ? `${currentMech} ${append}` : append;

    try {
      // Compute new content hash for the canonical envelope
      const slots: Array<{
        primitiveId: number;
        role: string;
        quantity: number;
        slotLabel: string;
        notes: string;
      }> = []; // primitives don't have a slot table in the same way as effects/caps
      // For now we don't recompute hash — just update text. content_hash will be
      // stale until next legitimate save, which is acceptable for a doc-only update.

      await db
        .update(primitives)
        .set({
          mechanicalOutputText: newMech,
          updatedAt: new Date(),
        })
        .where(eq(primitives.id, row.id));

      console.log(`  [${row.id}] ${name} — appended (${append.length} chars)`);
      applied++;
    } catch (e) {
      console.error(`  [${row.id}] ${name} — FAILED:`, e);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done. applied=${applied} skipped=${skipped} notFound=${notFound}`);
  console.log("=".repeat(72));

  if (notFoundNames.length > 0) {
    console.log("\nNot found in DB:");
    for (const n of notFoundNames) console.log(`  - ${n}`);
  }

  if (notFound > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});