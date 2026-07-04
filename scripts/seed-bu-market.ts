/**
 * BU Market canonical seed — Phase 4.5-B.
 *
 * Source: BU Market of Primitive components — Complete System (Notion)
 * https://app.notion.com/p/...BU-Market-of-Primitive-components-Complete-System
 *
 * Populates the 13 categories that were missing from the live DB prior to
 * migration 0009. Each entry mirrors a row in the Notion reference table with
 *   - name
 *   - category (one of the 14 new enums)
 *   - buCost (per Notion)
 *   - isMirrorable + mirrorBuCredit (only when Notion marks the row as a
 *     Variable Vector / Mirrorable Node)
 *   - costTier (the structural tier the row sits in)
 *   - mechanicalOutputText (what the row grants)
 *   - narrativeRule (how the DM interprets it)
 *   - mirrorEligibilityNotes (only when mirrorable)
 *
 * Idempotency: rows are inserted with category+name unique constraint. The
 * seed upserts on conflict so re-runs are safe.
 *
 * Run: `set -a && . ./.env.local && set +a && npx tsx scripts/seed-bu-market.ts`
 */
import { db } from "../src/db/client";
import { primitives } from "../src/db/schema/engine";
import { sql } from "drizzle-orm";

type SeedRow = {
  name: string;
  category: string;
  buCost: number;
  costTier: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable?: boolean;
  mirrorBuCredit?: number;
  mirrorEligibilityNotes?: string;
};

const SEED: SeedRow[] = [
  // ===========================================================================
  // PROBABILITY_BIAS (4 tiers per Notion)
  // ===========================================================================
  { name: "Positive Bias I — Narrative Focus", category: "PROBABILITY_BIAS", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU anchor)",
    mechanicalOutputText: "Positive Bias (Advantage) on one ultra-specific narrative sub-trigger.",
    narrativeRule: "Highly specialized passive trait. Roll twice and take the higher result within the named focus." },
  { name: "Negative Bias I — Narrative Focus", category: "PROBABILITY_BIAS", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias (Disadvantage) on one ultra-specific narrative sub-trigger.",
    narrativeRule: "Forces negative bias on a narrow narrative trigger. Roll twice and take the lower result.",
    isMirrorable: true, mirrorBuCredit: 3, mirrorEligibilityNotes: "Variable Vector — probability math is fully mirrorable." },
  { name: "Positive Bias II — Named Practice", category: "PROBABILITY_BIAS", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Positive Bias (Advantage) on a single Named Practice or singular combat interaction.",
    narrativeRule: "Specialist shift. Affects all rolls for the chosen Practice." },
  { name: "Negative Bias II — Named Practice", category: "PROBABILITY_BIAS", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias on a Named Practice or singular combat interaction.",
    narrativeRule: "Specialist shift. DM must be able to expose the affected Practice in play to grant credit.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Variable Vector — must be exposed by DM." },
  { name: "Positive Bias III — Core Attribute", category: "PROBABILITY_BIAS", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Positive Bias across an entire primary Attribute axis.",
    narrativeRule: "Systemic shift. Affects all Physical / Mental / Magical checks." },
  { name: "Negative Bias III — Core Attribute", category: "PROBABILITY_BIAS", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias across an entire primary Attribute axis.",
    narrativeRule: "High-impact capability that distorts the target's overall efficiency.",
    isMirrorable: true, mirrorBuCredit: 12, mirrorEligibilityNotes: "Variable Vector — DM exposure required." },
  { name: "Causal Override (Fate Replacement)", category: "PROBABILITY_BIAS", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Bypass rolling engine entirely — replace an upcoming d20 with a fixed value.",
    narrativeRule: "Timeline lock. Pre-determines a narrative outcome by substituting a guaranteed mathematical baseline." },

  // ===========================================================================
  // TRIGGER_HOOK (4 tiers per Notion)
  // ===========================================================================
  { name: "Direct Material Trigger", category: "TRIGGER_HOOK", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU anchor)",
    mechanicalOutputText: "Wakes up on a basic physical or kinetic interaction within immediate proximity.",
    narrativeRule: "Reactive Guard. Triggered by concrete actions: crossing a physical threshold, launching an attack, dropping an object." },
  { name: "Systemic Threshold Trigger", category: "TRIGGER_HOOK", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Wakes up on a localized state transition or quantified shift in the engine.",
    narrativeRule: "Automated Response. Triggered by parameter changes: energy signature manifesting, vitality below a threshold, entity entering a zone." },
  { name: "Conditional Informational Trigger", category: "TRIGGER_HOOK", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Wakes up on complex narrative conditions, remote events, or non-obvious structural changes.",
    narrativeRule: "Vigilant Sentinel. Triggered by abstract conditions: specific individual lying, ally losing consciousness anywhere, hidden entity crossing a boundary." },
  { name: "Interceptive Causal Trigger", category: "TRIGGER_HOOK", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Intercepts reality before an incoming event resolves, pausing resolution.",
    narrativeRule: "Causality Interdiction. Freezes an incoming fatal impact, halts a capability mid-manifestation, or warps space to change a target's position before the event connects." },

  // ===========================================================================
  // PERCEPTION_QUALIFIER (4 tiers per Notion)
  // ===========================================================================
  { name: "Environmental Translation Qualifier", category: "PERCEPTION_QUALIFIER", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Tracks physical anomalies: thermal signatures, substrate vibrations, illumination deficits.",
    narrativeRule: "Material Sensor. Navigate and locate entities in total darkness or through opaque barriers up to a fixed scale." },
  { name: "Systemic Resonance Qualifier", category: "PERCEPTION_QUALIFIER", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Perceives active energetic matrices, chemical compositions, physiological fluctuations.",
    narrativeRule: "Operational Sensor. Track active capability trails, identify toxic components, read biological tells." },
  { name: "Non-Material Translation Qualifier", category: "PERCEPTION_QUALIFIER", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Perceives non-physical data: surface intent, emotional currents, phase-shifted anomalies.",
    narrativeRule: "Abstract Sensor. Track withdrawn entities, interpret unexpressed emotional baselines." },
  { name: "Existential Clarity Qualifier", category: "PERCEPTION_QUALIFIER", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Direct, unfiltered observation of the scene's underlying systemic truth.",
    narrativeRule: "Absolute Sensor. Total visual truth. If a target is structurally present in the scene, it is perceived in its true form regardless of any concealment." },

  // ===========================================================================
  // KINETIC_CONTROL (4 tiers per Notion)
  // ===========================================================================
  { name: "Minor Linear Displacement", category: "KINETIC_CONTROL", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Straight-line horizontal displacement up to 10 feet, OR reduce target's movement speed by 15 feet.",
    narrativeRule: "Basic Impulse. Simple kinetic impacts or minor environmental drag." },
  { name: "Velocity Arrest / Standard Vector", category: "KINETIC_CONTROL", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Impose Velocity Lock (Movement Speed = 0) OR force displacement up to 20 feet in any direction.",
    narrativeRule: "Absolute Anchor / Launch. Magnetic pins, gravity spikes, concussive blasts." },
  { name: "Advanced Vector Manipulation", category: "KINETIC_CONTROL", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Force complex displacement up to 40 feet with mid-travel trajectory shifts OR enforce absolute kinetic lock.",
    narrativeRule: "Trajectory Control. Bends the direction of a throw around physical corners, or isolates an entity's physics profile so it cannot be moved by outside force." },
  { name: "Systemic Kinetic Override", category: "KINETIC_CONTROL", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Draw all targets within an area to a single focal point OR completely invert incoming physical momentum.",
    narrativeRule: "Momentum Catastrophe. Collapses local kinetic space — entire squad into a singularity, or reverses an incoming high-velocity projectile." },

  // ===========================================================================
  // AGENCY_OVERRIDE (4 tiers per Notion)
  // ===========================================================================
  { name: "Impulse Nudge / Point Transmission", category: "AGENCY_OVERRIDE", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Inject a temporary emotional state/reaction vector OR transmit a single secure stream of thought between two conscious entities.",
    narrativeRule: "Momentary Ingress. Sudden brief states (paranoia, curiosity) or quiet direct mental conduit without sound." },
  { name: "Behavioral Directive / Data Trace Masking", category: "AGENCY_OVERRIDE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Compel a sustained course of action that does not violate immediate survival protocols OR entirely conceal/reveal localized data traces.",
    narrativeRule: "Systemic Influence / Scan. Directs an entity to perform a specific task, or sweeps a scene clean of data tracks." },
  { name: "Direct Executive Override / Matrix Redaction", category: "AGENCY_OVERRIDE", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Complete execution control over an entity's mental/physical choices OR permanently rewrite/erase an isolated memory block.",
    narrativeRule: "Total Hijack / Memory Edit. Commands the target's entire action economy as a proxy, or permanently removes a specific hour of data." },
  { name: "Existential Allegiance Bind / Informational Absolutism", category: "AGENCY_OVERRIDE", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Permanent rewrite of an entity's baseline loyalty architecture OR establish total structural information blackout.",
    narrativeRule: "Identity Re-Anchor. Forges a permanent behavioral bond, or locks an entire network zone so zero data can exit or enter." },

  // ===========================================================================
  // METAMORPHOSIS (4 tiers per Notion)
  // ===========================================================================
  { name: "Composition Tuning", category: "METAMORPHOSIS", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Alter minor material properties: cosmetic features, surface texture, superficial elemental resilience.",
    narrativeRule: "Surface Mod. Biological camouflage, shifting appearance, minor skin calcification." },
  { name: "Volumetric Scale Shift", category: "METAMORPHOSIS", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Increase or decrease physical size category by up to two steps. Expands/shrinks reach and mass.",
    narrativeRule: "Geometric Shift. Growth or shrinking capabilities. Heavy mass modifiers for physical checks, or compression to fit through tight apertures." },
  { name: "State Transmutation", category: "METAMORPHOSIS", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Phase-shift matter into Gaseous, Liquid, Crystalline, or Energetic state while retaining entity control.",
    narrativeRule: "Phase Shifting. Transform into smoke to bypass physical barriers and gain physical immunity, or into rigid stone to surge defensive thresholds." },
  { name: "Polymorphic Template Overwrite", category: "METAMORPHOSIS", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Suppress target's physical sheet and enforce a completely new physical template.",
    narrativeRule: "Template Swap. Complete anatomical replacement — the target gains all physical metrics of the chosen form while holding their original mind." },

  // ===========================================================================
  // ACTION_ECONOMY (11 entries per Notion)
  // ===========================================================================
  { name: "Timeline Shift / Minor Window Grant", category: "ACTION_ECONOMY", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Shift initiative tracking position by ±5 OR grant an additional minor/bonus action window.",
    narrativeRule: "Minor Tuning. Speed-blitzing initiative traits, or allowing gear draw without consuming the main action." },
  { name: "Reactive Expansion (Guardian Vector)", category: "ACTION_ECONOMY", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Grant +1 additional Reaction Window per round, usable exclusively for Trigger Hooks.",
    narrativeRule: "Essential for defensive bodyguards or counter-mages — execute multiple reactive capabilities before next turn." },
  { name: "Core Action Multiplication (Haste Vector)", category: "ACTION_ECONOMY", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Grant +1 Standard Action Window on the entity's turn.",
    narrativeRule: "Two distinct capabilities or doubled output within a single turn loop." },
  { name: "Absolute Timeline Deprivation (Stun Vector)", category: "ACTION_ECONOMY", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Erase all Actions and Reactions from the target for 1 round.",
    narrativeRule: "Total suppression — target cannot act and cannot use reactions." },
  { name: "Track Acceleration", category: "ACTION_ECONOMY", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Permanently shifts one designated capability up 1 Track (e.g. Measured → Fast).",
    narrativeRule: "Overwrites native Complexity mapping. A capability that normally sits on Measured is treated as Fast." },
  { name: "Heavy Compactor", category: "ACTION_ECONOMY", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Allows a Heavy Track capability to execute on Measured.",
    narrativeRule: "Compresses massive, reality-straining actions — bypasses standard Heavy Track delay." },
  { name: "Timeline Anchor", category: "ACTION_ECONOMY", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Immunity to adverse Track Displacement.",
    narrativeRule: "The entity's declared intent can never be forcibly demoted to a later track by enemy status tags, environmental friction, or tactical suppression." },
  { name: "Reaction Pulse", category: "ACTION_ECONOMY", buCost: 10,
    costTier: "Tier 2 — Standard (10 BU anchor)",
    mechanicalOutputText: "Gain +1 additional Independent Reaction Slot per round.",
    narrativeRule: "Expand the character's reaction loop — answer two distinct narrative catalysts in the same round." },
  { name: "Reaction Reflex", category: "ACTION_ECONOMY", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "+2 flat bonus to all Reaction Clash rolls.",
    narrativeRule: "Permanently increases raw baseline speed when ally intent and adversary intent collide." },
  { name: "Clash Dominance", category: "ACTION_ECONOMY", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Gain Positive Bias (Advantage) on Reaction Clashes.",
    narrativeRule: "Supreme tactical anticipation. Roll two resolution dice and take the higher result." },
  { name: "Interceptive Priority", category: "ACTION_ECONOMY", buCost: 14,
    costTier: "Tier 3 — Major (14 BU anchor)",
    mechanicalOutputText: "Automatically win Ties during a Reaction Clash.",
    narrativeRule: "Absolute temporal edge. Bypass GM evaluation and act first on a tied roll." },

  // ===========================================================================
  // EVALUATION_STRAIN (9 entries per Notion)
  // ===========================================================================
  { name: "Heuristic Buffer", category: "EVALUATION_STRAIN", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Reduce the final Strain Score by 1 step (minimum 0) for one designated capability.",
    narrativeRule: "Drops the final evaluation down one bracket. Heavy Strain 4 cast filtered to Moderate Strain 3." },
  { name: "Systemic Sink", category: "EVALUATION_STRAIN", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "Reduce the final Strain Score by 2 steps (minimum 0).",
    narrativeRule: "Advanced structural alignment. Allows complex actions to bypass severe fallout brackets." },
  { name: "Volatile Vent", category: "EVALUATION_STRAIN", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Once per scene, treat an incoming Strain 1–2 cast as Strain 0.",
    narrativeRule: "Explicit safety valve — eliminates routine low-pressure costs or minor resource depletion of standard maneuvers once per scene." },
  { name: "Vitality Shielding", category: "EVALUATION_STRAIN", buCost: 10,
    costTier: "Tier 2 — Standard (10 BU anchor)",
    mechanicalOutputText: "Halve any upfront Vitality cost demanded by the Cost Ledger.",
    narrativeRule: "Direct trauma buffer. A 30% Vitality cost becomes 15%.",
    isMirrorable: true, mirrorBuCredit: 10, mirrorEligibilityNotes: "Inverting forces the character to pay double Vitality costs (Metaphysical Debt)." },
  { name: "Condition Insulation", category: "EVALUATION_STRAIN", buCost: 10,
    costTier: "Tier 2 — Standard (10 BU anchor)",
    mechanicalOutputText: "Negate one DM-imposed status condition arising from Strain feedback.",
    narrativeRule: "If the DM rules a spell's backlash knocks you prone/blinded/staggered, your anatomy isolates the shock." },
  { name: "Domain Lock Shield", category: "EVALUATION_STRAIN", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Immunity to Strain-based Domain Burnouts / Locks.",
    narrativeRule: "Protects active capabilities. If the DM rules a heavy cast fractures your focus, this maintains the conduit." },
  { name: "Hazard Transmutation", category: "EVALUATION_STRAIN", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Convert all personal Vitality loss into an Environmental Hazard.",
    narrativeRule: "Health remains untouched but the DM converts the pressure into slick mud, thick smoke, or gravity pockets." },
  { name: "Narrative Pivot", category: "EVALUATION_STRAIN", buCost: 14,
    costTier: "Tier 3 — Major (14 BU anchor)",
    mechanicalOutputText: "Convert all mechanical sheet costs into a severe Narrative Twist.",
    narrativeRule: "Vitality, status, domains unaffected — but the DM introduces an immediate outside complication (alarm triggers, tool breaks)." },
  { name: "CV Matrix Trap", category: "EVALUATION_STRAIN", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Convert a Strain 3+ cast into a temporary defensive threshold.",
    narrativeRule: "Catch the high CV and turn it into a fleeting barrier equal to the halved Vitality lost." },

  // ===========================================================================
  // TEMPORAL_CHRONOLOGICAL (7 entries per Notion)
  // ===========================================================================
  { name: "Chronological Echo", category: "TEMPORAL_CHRONOLOGICAL", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Delay resolution by up to 2 rounds.",
    narrativeRule: "Execute a capability normally but its physical entry into reality is suspended — bursts forth at the start of a designated future Council Phase." },
  { name: "Dormant Trigger Hook", category: "TEMPORAL_CHRONOLOGICAL", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Convert an instant capability into a dormant mine.",
    narrativeRule: "Plants the intent into a spatial coordinate. Stays hidden until an environmental catalyst triggers its release." },
  { name: "Timeline Tether", category: "TEMPORAL_CHRONOLOGICAL", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Immunity to forced chronological delays.",
    narrativeRule: "Actions can never be forcibly deferred, slowed, or pushed to a future round by enemy chronomancy." },
  { name: "Duration Anchor", category: "TEMPORAL_CHRONOLOGICAL", buCost: 10,
    costTier: "Tier 2 — Standard (10 BU anchor)",
    mechanicalOutputText: "Freeze a capability's duration countdown for 2 rounds.",
    narrativeRule: "Extends the lifespan of a decaying zone, barrier, or transformation without re-cast or initialization costs." },
  { name: "Perpetual Lock", category: "TEMPORAL_CHRONOLOGICAL", buCost: 18,
    costTier: "Tier 3 — Major (18 BU anchor)",
    mechanicalOutputText: "Convert a 'Scene' duration into a 'Persistent' effect.",
    narrativeRule: "Permanently anchors a capability. The effect no longer expires when the combat round loop terminates." },
  { name: "Kinetic Stasis", category: "TEMPORAL_CHRONOLOGICAL", buCost: 14,
    costTier: "Tier 3 — Major (14 BU anchor)",
    mechanicalOutputText: "Freeze an inanimate object's momentum completely.",
    narrativeRule: "Catches an item or projectile mid-flight. All kinetic energy locked in place until dismissed." },
  { name: "Temporal Isolate", category: "TEMPORAL_CHRONOLOGICAL", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU anchor)",
    mechanicalOutputText: "Lock a single target entity in absolute timeline stasis for 1 round.",
    narrativeRule: "Target entirely removed from sequential flow. Cannot act, move, or think — but also completely immune to damage until stasis shatters." },

  // ===========================================================================
  // SENSORY_ARRAY (4 tiers per Notion)
  // ===========================================================================
  { name: "Umbral Sight I (Darkvision 60ft)", category: "SENSORY_ARRAY", buCost: 5,
    costTier: "Tier 1 — Minor (5 BU anchor)",
    mechanicalOutputText: "Converts total physical darkness into dim light within 60 feet. Cannot discern color in pitch black.",
    narrativeRule: "Material Sensor. Navigate and locate entities in zero light within range." },
  { name: "Substrate Echo (Tremorsense 30ft)", category: "SENSORY_ARRAY", buCost: 7,
    costTier: "Tier 2 — Standard (7 BU anchor)",
    mechanicalOutputText: "Pinpoints exact coordinates of any entity making physical contact with contiguous ground, bypassing blindness/smoke/walls.",
    narrativeRule: "Operational Sensor. Tracks vibration through the same physical substrate the entity occupies." },
  { name: "Umbral Sight II (Darkvision 120ft)", category: "SENSORY_ARRAY", buCost: 8,
    costTier: "Tier 3 — Major (8 BU anchor)",
    mechanicalOutputText: "Extended deep-scout sensory array. Pierces natural and synthesized darkness effortlessly.",
    narrativeRule: "Wide-band deep-pierce sensor suite." },
  { name: "Tactile Echo (Blindsight 30ft)", category: "SENSORY_ARRAY", buCost: 12,
    costTier: "Tier 4 — Core Axis (12 BU anchor)",
    mechanicalOutputText: "Absolute localized awareness without using eyes via acoustic/olfactory/ambient pressure currents.",
    narrativeRule: "Absolute Sensor. Perceives the scene perfectly without sight." },

  // ===========================================================================
  // MOBILITY_LOCOMOTION (6 entries per Notion)
  // ===========================================================================
  { name: "Stride Extension", category: "MOBILITY_LOCOMOTION", buCost: 5,
    costTier: "Tier 1 — Minor (5 BU anchor)",
    mechanicalOutputText: "+10 feet to baseline Land Speed. Stacks infinitely unless restricted by armor/archetype.",
    narrativeRule: "Linear velocity upgrade.",
    isMirrorable: true, mirrorBuCredit: 5, mirrorEligibilityNotes: "Inverting imposes -10ft reduction to baseline movement speed." },
  { name: "Aquatic Unlock", category: "MOBILITY_LOCOMOTION", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Swim Speed equal to baseline Land Speed. Natural buoyancy.",
    narrativeRule: "Eliminates drowning or underwater movement penalties." },
  { name: "Subterranean Bore", category: "MOBILITY_LOCOMOTION", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Burrow Speed (15 feet) through soft earth/sand.",
    narrativeRule: "Permits travel underneath terrain. Cannot pierce solid stone without upgrades." },
  { name: "Aero Unlock", category: "MOBILITY_LOCOMOTION", buCost: 15,
    costTier: "Tier 3 — Major (15 BU anchor)",
    mechanicalOutputText: "Fly Speed equal to baseline Land Speed. Three-dimensional movement.",
    narrativeRule: "Requires constant forward momentum to stay aloft." },
  { name: "Phase Slip", category: "MOBILITY_LOCOMOTION", buCost: 15,
    costTier: "Tier 3 — Major (15 BU anchor)",
    mechanicalOutputText: "Incorporeal Movement through non-magical solid matter.",
    narrativeRule: "Treats solid barriers as difficult terrain. Ending turn inside matter inflicts immediate heavy Strain." },
  { name: "Hover Precision", category: "MOBILITY_LOCOMOTION", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Fly Speed (60 feet) + Hover State.",
    narrativeRule: "Supreme aerial mastery. Remain perfectly stationary mid-air without stalling or drifting." },

  // ===========================================================================
  // TARGETING_AOE (10+ entries per Notion — Vector Split already exists)
  // ===========================================================================
  { name: "Bouncing Vector", category: "TARGETING_AOE", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "Chain-hop on successful resolution — automatically leaps to a new target within 15 feet.",
    narrativeRule: "Operative projection that bounces through adjacent profiles." },
  { name: "Collateral Buffer", category: "TARGETING_AOE", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Friendly Fire Immunity inside AoE templates.",
    narrativeRule: "Filters AoE output. Allies inside the footprint are automatically bypassed." },
  { name: "Selective Focus", category: "TARGETING_AOE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Precise entity exclusion — choose exactly which specific entities are affected within an AoE shape.",
    narrativeRule: "Absolute control over who is and isn't hit." },
  { name: "Linear / Conical Vector", category: "TARGETING_AOE", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "15-ft Cone OR 30-ft Line rigid spatial template radiating outward from facing direction.",
    narrativeRule: "Directional geometric template." },
  { name: "Kinetic Sphere", category: "TARGETING_AOE", buCost: 5,
    costTier: "Tier 2 — Standard (5 BU anchor)",
    mechanicalOutputText: "10-ft Radius Burst radiating symmetrically outward from a selected coordinate.",
    narrativeRule: "Omnidirectional area template." },
  { name: "Stationary Zone", category: "TARGETING_AOE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Persisting stationary field at a fixed coordinate.",
    narrativeRule: "Plants an area footprint that endures across rounds based on upkeep rules." },
  { name: "Mobile Aura", category: "TARGETING_AOE", buCost: 7,
    costTier: "Tier 2 — Standard (7 BU anchor)",
    mechanicalOutputText: "Moving 10-ft radius field anchored to the user.",
    narrativeRule: "Shifts dynamically as the originating entity moves." },
  { name: "Structural Wall", category: "TARGETING_AOE", buCost: 7,
    costTier: "Tier 2 — Standard (7 BU anchor)",
    mechanicalOutputText: "30-ft Long × 10-ft Tall flat barrier.",
    narrativeRule: "Erects a thin linear sheet of energy/matter that blocks line of sight or passage." },
  { name: "Volume Scaling I", category: "TARGETING_AOE", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "+1 Size Tier Upgrade (e.g. 10ft radius sphere → 20ft radius).",
    narrativeRule: "Expands active blueprint dimensions." },
  { name: "Global Field", category: "TARGETING_AOE", buCost: 15,
    costTier: "Tier 3 — Major (15 BU anchor)",
    mechanicalOutputText: "Scene-Wide Blanket Effect.",
    narrativeRule: "Drops all localized boundaries — impacts every coordinate across the active combat map." },

  // ===========================================================================
  // DEFENSIVE (7 entries per Notion — note: existing enum is DEFENSE; mirror
  // Notion's "DEFENSIVE" name to keep the taxonomy honest with the doc, even
  // though the existing DEFENSE rows stay)
  // ===========================================================================
  { name: "Kinetic Hardening (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Physical Defense. Stacks.",
    narrativeRule: "Integrates physical plating or toughens tissue. Raises threshold against physical strikes.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against physical attacks." },
  { name: "Warding Shell (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Magical Defense. Stacks.",
    narrativeRule: "Insulates the profile's matrix. Increases resistance to incoming spell arrays or elemental domains.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against magical effects." },
  { name: "Psychic Firewall (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Mental Defense. Stacks.",
    narrativeRule: "Fortifies neural/spiritual pathways against cognitive overrides and emotional prompts.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against mental/cognitive effects." },
  { name: "Universal Aegis (DEFENSIVE)", category: "DEFENSIVE", buCost: 10,
    costTier: "Tier 3 — Major (10 BU anchor)",
    mechanicalOutputText: "+1 to ALL Defenses. Stacks.",
    narrativeRule: "Comprehensive structural upgrade across all three defensive scores simultaneously." },
  { name: "Reactive Bulwark (DEFENSIVE)", category: "DEFENSIVE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Reaction Shield (+2 Defense when targeted).",
    narrativeRule: "Spend an Independent Reaction Slot when targeted to gain immediate +2 defense against that attack." },
  { name: "Structural Hardening (Domain Resistance)", category: "DEFENSIVE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Permanent Resistance (half damage) to one designated damage domain.",
    narrativeRule: "Elemental mastery — take half damage from the chosen domain (Fire, Gravity, etc.)." },
  { name: "Absolute Insulation (Domain Immunity)", category: "DEFENSIVE", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Damage Domain Immunity — take 0 damage from one specified domain under all conditions.",
    narrativeRule: "Supreme elemental mastery." },

  // ===========================================================================
  // INTENSITY_DICE (6 die blocks per Notion — Minor already exists)
  // ===========================================================================
  { name: "Standard Die Block (1d6)", category: "INTENSITY_DICE", buCost: 2,
    costTier: "Tier 1 — Minor (2 BU anchor)",
    mechanicalOutputText: "1d6 Damage / Healing. Inherits execution Source. Fundamental balance baseline.",
    narrativeRule: "Max 6 units per baseline capability." },
  { name: "Heavy Die Block (1d8)", category: "INTENSITY_DICE", buCost: 4,
    costTier: "Tier 2 — Standard (4 BU anchor)",
    mechanicalOutputText: "1d8 Damage / Healing. Standard martial/spell cutoff.",
    narrativeRule: "Inherits execution Source." },
  { name: "Impact Die Block (1d10)", category: "INTENSITY_DICE", buCost: 8,
    costTier: "Tier 3 — Major (8 BU anchor)",
    mechanicalOutputText: "1d10 Damage / Healing. High-tier concentrated payload.",
    narrativeRule: "Inherits execution Source." },
  { name: "Calamity Die Block (1d12)", category: "INTENSITY_DICE", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "1d12 Damage / Healing. Heavy Strain threat line.",
    narrativeRule: "Inherits execution Source." },
  { name: "Existential Tear (1d20)", category: "INTENSITY_DICE", buCost: 32,
    costTier: "Tier 4 — Core Axis (32 BU anchor)",
    mechanicalOutputText: "1d20 Damage / Healing. Mythic/Reality-breaking scale.",
    narrativeRule: "Reserved for reality-warping effects." },

  // ===========================================================================
  // BOSS_ECONOMY (5 entries per Notion)
  // ===========================================================================
  { name: "Legendary Cadence I", category: "BOSS_ECONOMY", buCost: 18,
    costTier: "Tier 3 — Major (18 BU anchor)",
    mechanicalOutputText: "+1 Legendary Action per round. Execute a designated low-cost capability at the immediate end of another entity's turn.",
    narrativeRule: "Out-of-sequence execution token. Maintains threat parity against squads." },
  { name: "Legendary Cadence II", category: "BOSS_ECONOMY", buCost: 32,
    costTier: "Tier 4 — Core Axis (32 BU anchor)",
    mechanicalOutputText: "+2 Legendary Actions per round.",
    narrativeRule: "Deeper pool of out-of-sequence points to react dynamically to squad movements." },
  { name: "Legendary Cadence III", category: "BOSS_ECONOMY", buCost: 45,
    costTier: "Tier 4 — Core Axis (45 BU anchor)",
    mechanicalOutputText: "+3 Legendary Actions per round. Restores all spent action points at start of Council Phase.",
    narrativeRule: "Apex boss baseline." },
  { name: "Existential Imperative (Legendary Resistance 1x/Day)", category: "BOSS_ECONOMY", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Choose to completely overwrite a failed Defensive Save, forcing automatic success.",
    narrativeRule: "Used 1x per day. Boss save insurance." },
  { name: "Mythic Safeguard (Legendary Resistance 3x/Day)", category: "BOSS_ECONOMY", buCost: 35,
    costTier: "Tier 4 — Core Axis (35 BU anchor)",
    mechanicalOutputText: "Bypass up to three catastrophic debuffs or crowd-control effects per encounter.",
    narrativeRule: "High-tier protection. Used 3x per day." },
];

async function main() {
  console.log(`Seeding ${SEED.length} BU Market primitive entries...`);
  let inserted = 0;
  let skipped = 0;

  for (const row of SEED) {
    // Upsert on (name, category, userId) unique constraint. Public rows have userId=null.
    const result = await db.execute(sql`
      INSERT INTO primitives (
        name, category, cost_tier, bu_cost, mechanical_output_text, narrative_rule,
        is_mirrorable, mirror_bu_credit, mirror_eligibility_notes,
        is_public, user_id, created_at, updated_at
      ) VALUES (
        ${row.name},
        ${row.category}::primitive_category,
        ${row.costTier},
        ${row.buCost},
        ${row.mechanicalOutputText},
        ${row.narrativeRule},
        ${row.isMirrorable ?? false},
        ${row.mirrorBuCredit ?? 0},
        ${row.mirrorEligibilityNotes ?? ""},
        true, NULL, NOW(), NOW()
      )
      ON CONFLICT (name, category, user_id) DO UPDATE SET
        cost_tier = EXCLUDED.cost_tier,
        bu_cost = EXCLUDED.bu_cost,
        mechanical_output_text = EXCLUDED.mechanical_output_text,
        narrative_rule = EXCLUDED.narrative_rule,
        is_mirrorable = EXCLUDED.is_mirrorable,
        mirror_bu_credit = EXCLUDED.mirror_bu_credit,
        mirror_eligibility_notes = EXCLUDED.mirror_eligibility_notes,
        updated_at = NOW()
      RETURNING (xmax = 0) AS was_inserted
    `);
    const wasInserted = (result as any).rows?.[0]?.was_inserted;
    if (wasInserted) inserted++;
    else skipped++;
  }

  console.log(`✓ inserted: ${inserted}, updated: ${skipped}, total: ${SEED.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });