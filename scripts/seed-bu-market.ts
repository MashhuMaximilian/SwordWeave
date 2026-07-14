/**
 * BU Market canonical seed — Phase 4.5-B + Phase 7.
 *
 * Source: BU Market of Primitive components — Complete System (Notion)
 * Page ID: 37eed8479ccd8155b917c373194dbdf4
 *
 * This seed carries the full 139-row BU Market canonical. It is the
 * single source-of-truth for primitive catalog rows in this repo:
 *   - data/bu-market-primitives.ts (50 rows) is DEPRECATED — partial
 *     historical subset, do not edit.
 *   - scripts/seed-library-augmentations.ts (25 rows) covers
 *     template-linked augments (HERITAGE / BACKGROUND / CHARACTER_SHEET
 *     / ITEM) — out of Phase 7 scope.
 *   - DB holds 139 core library primitives (user_id IS NULL) seeded
 *     from this script's content.
 *
 * Each entry mirrors a row in the Notion reference table with:
 *   - name (canonical identity)
 *   - category (one of the 25 primitive_category enum values)
 *   - buCost (per Notion)
 *   - isMirrorable + mirrorBuCredit (Variable Vector / mirrorable)
 *   - costTier (Notion tier label)
 *   - mechanicalOutputText (what the row grants)
 *   - narrativeRule (how the DM interprets it)
 *   - mirrorEligibilityNotes (only when mirrorable)
 *   - targetScope { layer, value } — Phase 7, modifier primitives only
 *
 * Idempotency: rows upsert on (name, category, user_id) so re-runs
 * update fields but never delete. Rows not in this seed keep their
 * existing source_origin / DB state.
 *
 * Run: `set -a && . ./.env.local && set +a && npx tsx scripts/seed-bu-market.ts`
 *
 * Dry-run: `DRY_RUN=1 npx tsx scripts/seed-bu-market.ts` prints the
 * planned UPSERT plan (insert/update counts) without DB writes.
 */
import { db } from "../src/db/client";
import { sql } from "drizzle-orm";
import {
  buildScope,
  serializeForDB,
  validateScope,
  type TargetScope,
} from "../src/lib/primitives/target-scope";

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
  /**
   * Phase 7. Optional. If set on a modifier-shaped primitive, the
   * seeder writes it to the `target_scope` text column on UPSERT.
   * Grammar primitives (verbs, domains, ranges, durations) should
   * leave this undefined — their `target_scope` stays NULL.
   */
  targetScope?: {
    layer: string;
    value?: string | null;
  };
};

/**
 * Default source_origin for all 139 BU Market rows.
 *
 * Migration 0030 simplified this from the original seed-name suffix
 * `'system:phase5-commit-c-library-seed'` (introduced by migration
 * 0020 as a transient backfill marker) to the stable identity
 * `'system'`. The (name, source_origin) unique constraint remains
 * the public-identity contract; the simplified string lets canonical
 * seeders UPSERT into existing rows without suffix-drift hazard.
 *
 * The migration that rewrote all 139 rows is
 * `src/db/migrations/0030_simplify_system_source_origin.sql`.
 */
const SEED_SOURCE_ORIGIN = "system";

const SEED: SeedRow[] = [
  // ===========================================================================
  // PROBABILITY_BIAS (4 tiers per Notion) — phase 7: targetScope tier-coupled
  // ===========================================================================
  { name: "Positive Bias I — Narrative Focus", category: "PROBABILITY_BIAS", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU anchor)",
    mechanicalOutputText: "Positive Bias (Advantage) on one ultra-specific narrative sub-trigger.",
    narrativeRule: "Highly specialized passive trait. Roll twice and take the higher result within the named focus.",
    targetScope: { layer: "NARROW_FOCUS", value: null } },
  { name: "Negative Bias I — Narrative Focus", category: "PROBABILITY_BIAS", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias (Disadvantage) on one ultra-specific narrative sub-trigger.",
    narrativeRule: "Forces negative bias on a narrow narrative trigger. Roll twice and take the lower result.",
    isMirrorable: true, mirrorBuCredit: 3, mirrorEligibilityNotes: "Variable Vector — probability math is fully mirrorable.",
    targetScope: { layer: "NARROW_FOCUS", value: null } },
  { name: "Positive Bias II — Named Practice", category: "PROBABILITY_BIAS", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Positive Bias (Advantage) on a single Named Practice or singular combat interaction.",
    narrativeRule: "Specialist shift. Affects all rolls for the chosen Practice.",
    targetScope: { layer: "PRACTICE", value: null } },
  { name: "Negative Bias II — Named Practice", category: "PROBABILITY_BIAS", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias on a Named Practice or singular combat interaction.",
    narrativeRule: "Specialist shift. DM must be able to expose the affected Practice in play to grant credit.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Variable Vector — must be exposed by DM.",
    targetScope: { layer: "PRACTICE", value: null } },
  { name: "Positive Bias III — Core Attribute", category: "PROBABILITY_BIAS", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Positive Bias across an entire primary Attribute axis.",
    narrativeRule: "Systemic shift. Affects all Physical / Mental / Magical checks.",
    targetScope: { layer: "ATTRIBUTE", value: null } },
  { name: "Negative Bias III — Core Attribute", category: "PROBABILITY_BIAS", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "Impose Negative Bias across an entire primary Attribute axis.",
    narrativeRule: "High-impact capability that distorts the target's overall efficiency.",
    isMirrorable: true, mirrorBuCredit: 12, mirrorEligibilityNotes: "Variable Vector — DM exposure required.",
    targetScope: { layer: "ATTRIBUTE", value: null } },
  { name: "Causal Override (Fate Replacement)", category: "PROBABILITY_BIAS", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Bypass rolling engine entirely — replace an upcoming d20 with a fixed value.",
    narrativeRule: "Timeline lock. Pre-determines a narrative outcome by substituting a guaranteed mathematical baseline.",
    targetScope: { layer: "DICE", value: "D20" } },

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
    narrativeRule: "Expand the character's reaction loop — answer two distinct narrative catalysts in the same round.",
    targetScope: { layer: "METRIC", value: "REACTION_SLOT" } },
  { name: "Reaction Reflex", category: "ACTION_ECONOMY", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "+2 flat bonus to all Reaction Clash rolls.",
    narrativeRule: "Permanently increases raw baseline speed when ally intent and adversary intent collide.",
    targetScope: { layer: "METRIC", value: "REACTION_SLOT" } },
  { name: "Clash Dominance", category: "ACTION_ECONOMY", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Gain Positive Bias (Advantage) on Reaction Clashes.",
    narrativeRule: "Supreme tactical anticipation. Roll two resolution dice and take the higher result.",
    targetScope: { layer: "METRIC", value: "REACTION_SLOT" } },
  { name: "Interceptive Priority", category: "ACTION_ECONOMY", buCost: 14,
    costTier: "Tier 3 — Major (14 BU anchor)",
    mechanicalOutputText: "Automatically win Ties during a Reaction Clash.",
    narrativeRule: "Absolute temporal edge. Bypass GM evaluation and act first on a tied roll.",
    targetScope: { layer: "METRIC", value: "REACTION_SLOT" } },

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
    isMirrorable: true, mirrorBuCredit: 5, mirrorEligibilityNotes: "Inverting imposes -10ft reduction to baseline movement speed.",
    targetScope: { layer: "METRIC", value: "MOVEMENT_SPEED" } },
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
  // though the existing DEFENSE rows stay) — phase 7: targetScope on modifiers
  // ===========================================================================
  { name: "Kinetic Hardening (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Physical Defense. Stacks.",
    narrativeRule: "Integrates physical plating or toughens tissue. Raises threshold against physical strikes.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against physical attacks.",
    targetScope: { layer: "METRIC", value: "DEFENSE_ROLL" } },
  { name: "Warding Shell (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Magical Defense. Stacks.",
    narrativeRule: "Insulates the profile's matrix. Increases resistance to incoming spell arrays or elemental domains.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against magical effects.",
    targetScope: { layer: "METRIC", value: "DEFENSE_ROLL" } },
  { name: "Psychic Firewall (DEFENSIVE)", category: "DEFENSIVE", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU anchor)",
    mechanicalOutputText: "+1 Mental Defense. Stacks.",
    narrativeRule: "Fortifies neural/spiritual pathways against cognitive overrides and emotional prompts.",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Inverting imposes a structural fault against mental/cognitive effects.",
    targetScope: { layer: "METRIC", value: "DEFENSE_ROLL" } },
  { name: "Universal Aegis (DEFENSIVE)", category: "DEFENSIVE", buCost: 10,
    costTier: "Tier 3 — Major (10 BU anchor)",
    mechanicalOutputText: "+1 to ALL Defenses. Stacks.",
    narrativeRule: "Comprehensive structural upgrade across all three defensive scores simultaneously.",
    targetScope: { layer: "METRIC", value: "DEFENSE_ROLL" } },
  { name: "Reactive Bulwark (DEFENSIVE)", category: "DEFENSIVE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Reaction Shield (+2 Defense when targeted).",
    narrativeRule: "Spend an Independent Reaction Slot when targeted to gain immediate +2 defense against that attack.",
    targetScope: { layer: "METRIC", value: "REACTION_SLOT" } },
  { name: "Structural Hardening (Domain Resistance)", category: "DEFENSIVE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Permanent Resistance (half damage) to one designated damage domain.",
    narrativeRule: "Elemental mastery — take half damage from the chosen domain (Fire, Gravity, etc.)",
    targetScope: { layer: "NARROW_FOCUS", value: null } },
  { name: "Absolute Insulation (Domain Immunity)", category: "DEFENSIVE", buCost: 20,
    costTier: "Tier 4 — Core Axis (20 BU anchor)",
    mechanicalOutputText: "Damage Domain Immunity — take 0 damage from one specified domain under all conditions.",
    narrativeRule: "Supreme elemental mastery.",
    targetScope: { layer: "NARROW_FOCUS", value: null } },

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

  // ==========================================================================
  // PHASE 7: ADDITIONAL CANONICAL ROWS — bring seed up to full DB coverage
  // ==========================================================================
  // The DB has 139 primitives; this seed previously had 91. These 48 rows
  // were missing — verifier (scripts/_seed-vs-db.ts) confirms the gap.
  // Mirror/targetScope flags are aligned with the live DB so re-running
  // the seeder against an existing DB is a no-op apart from re-writing
  // target_scope where the row carries one.
  //
  // Categorized by table in the BU Market Notion page. Modifier-shaped
  // rows (sheet augments, practice progression, defensive metrics,
  // reaction-window, intensity dice) get a targetScope. Grammar /
  // permission primitives stay un-scoped.

  // VERB_TIER (4) — action language permissions, no scope
  { name: "Verb Access Tier I", category: "VERB_TIER", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Basic physical + perceptual action language. Ground-level interaction with reality (move, strike, push, sense, etc.)" },
  { name: "Verb Access Tier II", category: "VERB_TIER", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Transformative action language. Manipulation of existing states and properties (alter, modify, combine, etc.)" },
  { name: "Verb Access Tier III", category: "VERB_TIER", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Structural/system-level action language. Control over internal structure of systems (restructure, invert, merge, etc.)" },
  { name: "Verb Access Tier IV", category: "VERB_TIER", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Conceptual / rule-level action language. Interaction with governing logic (override rules, redefine logic, alter causality)" },

  // DOMAIN (4) — thematic reality licenses, no scope
  { name: "Domain Access Tier I", category: "DOMAIN", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Concrete, physical domains (fire, water, air, earth, metal, stone, wood, ice, lightning, light, darkness, etc.)" },
  { name: "Domain Access Tier II", category: "DOMAIN", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Hybrid physical-conceptual domains (life, decay, growth, memory, emotion, time local, space local, disease, energy systems, etc.)" },
  { name: "Domain Access Tier III", category: "DOMAIN", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Abstract / systemic domains (consciousness, identity, will, intent, thought, belief, information, probability local, fate, causality bounded, etc.)" },
  { name: "Domain Access Tier IV", category: "DOMAIN", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Fundamental / reality-defining domains (existence, non-existence, reality, causality global, time absolute, space global, etc.)" },

  // SIZING / Structure tiers (4) — spatial templates, no scope
  { name: "Structure Tier I", category: "SIZING", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Single-point application structures (single target, self target, touch range, line-of-sight single interaction, fixed object targeting)" },
  { name: "Structure Tier II", category: "SIZING", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Multi-target and basic spatial distribution (multi-target, chain, cone, radius/AoE, directional spread, basic field placement)" },
  { name: "Structure Tier III", category: "SIZING", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Complex spatial and adaptive distribution (expanding zones, moving fields, branching chains, conditional targeting, layered effects)" },
  { name: "Structure Tier IV", category: "SIZING", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Systemic or rule-driven application structures (global/scene-wide, rule-based targeting, priority targeting, exclusion/inclusion logic, state-triggered zones)" },

  // RANGE (7) — cost gates only, no scope
  { name: "Touch Range", category: "RANGE", buCost: 0,
    costTier: "Tier 0: Touch (0 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Immediate contact or self-contained (Touch / Self / Melee 5ft)" },
  { name: "Close Range", category: "RANGE", buCost: 2,
    costTier: "Tier 1 — Minor (2 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Same-zone / melee proximity (Close 5-10ft)" },
  { name: "Near Range", category: "RANGE", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Standard combat range (Near 30ft)" },
  { name: "Far Range", category: "RANGE", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Extended tactical range (Far 60ft)" },
  { name: "Very Far Range", category: "RANGE", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Cross-battlefield influence (Very Far 120ft)" },
  { name: "Extreme Range", category: "RANGE", buCost: 24,
    costTier: "Tier 4 — Core Axis (24 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Scene-wide / near-remote presence (Extreme 240ft-3mi)" },
  { name: "World Range", category: "RANGE", buCost: 48,
    costTier: "Tier 4 — Core Axis (48 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Huge area or world-sized scope" },

  // SPEED_QUICKENING (4) — execution timing, no scope
  { name: "Standard Execution", category: "SPEED_QUICKENING", buCost: 0,
    costTier: "Tier 0: Standard (0 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Normal resolution timing" },
  { name: "Fast Execution", category: "SPEED_QUICKENING", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Prioritized within round (Fast Track)" },
  { name: "Instant Execution", category: "SPEED_QUICKENING", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Immediate resolution on declaration" },
  { name: "Reaction Execution", category: "SPEED_QUICKENING", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Interrupt-triggered execution" },

  // DURATION (6) — temporal footprint, no scope
  { name: "Instant Duration", category: "DURATION", buCost: 0,
    costTier: "Tier 0: Instant (0 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Single resolution, resolves immediately" },
  { name: "Short Duration", category: "DURATION", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Brief persistence (rounds), exists briefly after resolution" },
  { name: "Medium Duration", category: "DURATION", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Encounter-length, sustained presence in scene" },
  { name: "Long Duration", category: "DURATION", buCost: 16,
    costTier: "Tier 3 — Major (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Multi-scene / narrative segment, persistent strategic effect" },
  { name: "Persistent Duration", category: "DURATION", buCost: 32,
    costTier: "Tier 4 — Core Axis (32 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Long-term world state, ongoing until removed" },
  { name: "Permanent Duration", category: "DURATION", buCost: 64,
    costTier: "Tier 4 — Core Axis (64 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Fixed reality state, requires explicit reversal logic" },

  // CONDITION / Semantic State Tags (4) — permission primitives, no scope
  { name: "Physical Interaction Tag", category: "CONDITION", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Direct structural, positional, kinetic, or material interference (movement restriction, spatial displacement, structural instability, kinetic bind)" },
  { name: "Sensory & Physiological Tag", category: "CONDITION", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Alteration of sensory input channels or biological stability (vision disruption, acoustic interference, biological invalidation, nervous system friction)" },
  { name: "Cognitive & Agency Tag", category: "CONDITION", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Interference with conscious thought, intent, memory, choice (attention lock, terror loop, cognitive suppression, emotional drift)" },
  { name: "System & Identity Tag", category: "CONDITION", buCost: 16,
    costTier: "Tier 4 — Core Axis (16 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Overwriting core system parameters, rule interpretation, existential status (form instability, reality banishment, action validity constraints, probability fracture)" },

  // SHEET_AUGMENT (8) — modifier primitives, all carry targetScope
  { name: "Defensive Save Upgrade", category: "SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Gain Saving Throw Proficiency for one chosen Attribute type (adds full PB to defense/hazard saves)",
    targetScope: { layer: "ATTRIBUTE", value: null } },
  { name: "Attack Bonus Increment", category: "SHEET_AUGMENT", buCost: 6,
    costTier: "Tier 2 — Standard (6 BU)",
    mechanicalOutputText: "",
    narrativeRule: "+1 to baseline Attack Rolls (max +1 per character level)",
    isMirrorable: true, mirrorBuCredit: 6, mirrorEligibilityNotes: "Mirrorable - VARIABLE_VECTOR",
    targetScope: { layer: "METRIC", value: "ATTACK_ROLL" } },
  { name: "Attribute Increment", category: "SHEET_AUGMENT", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "+1 to a Core Attribute Score (max score limits apply per tier)",
    isMirrorable: true, mirrorBuCredit: 12, mirrorEligibilityNotes: "Mirrorable - VARIABLE_VECTOR",
    targetScope: { layer: "ATTRIBUTE", value: null } },
  { name: "Vitality Core Augment I", category: "SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Flat +5 Max Vitality. Injects a permanent, structural increase to the character's base health pool. Stacks cumulatively.",
    isMirrorable: true, mirrorBuCredit: 4, mirrorEligibilityNotes: "Mirrorable - VARIABLE_VECTOR",
    targetScope: { layer: "METRIC", value: "HP" } },
  { name: "Vitality Core Augment II", category: "SHEET_AUGMENT", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Flat +12 Max Vitality. A deeper, mid-tier investment for dedicated frontline or high-endurance builds.",
    isMirrorable: true, mirrorBuCredit: 8, mirrorEligibilityNotes: "Mirrorable - VARIABLE_VECTOR",
    targetScope: { layer: "METRIC", value: "HP" } },
  { name: "Vitality Core Augment III", category: "SHEET_AUGMENT", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Flat +20 Max Vitality. A massive character-altering health spike representing peak physical or metaphysical fortitude.",
    isMirrorable: true, mirrorBuCredit: 12, mirrorEligibilityNotes: "Mirrorable - VARIABLE_VECTOR",
    targetScope: { layer: "METRIC", value: "HP" } },
  { name: "Focused Presence (Global DC Modifier)", category: "SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "+1 to Character DC. Permanently raises the global baseline check threshold (5 + PB + Attribute Modifier) for all saving throws forced by the character.",
    targetScope: { layer: "METRIC", value: "CHARACTER_DC" } },
  { name: "Precise Vector Alignment (Global Attack Modifier)", category: "SHEET_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "+1 to All Attack/Accuracy Rolls. Adds a flat, permanent bonus to accuracy resolution tracks regardless of source.",
    targetScope: { layer: "METRIC", value: "ATTACK_ROLL" } },

  // PRACTICE_PROGRESSION_AUGMENT (5) — modifier primitives, all carry targetScope
  { name: "Broad Familiarity", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Add half Proficiency Bonus (rounded down) to all non-proficient checks. Requires no active Practice Proficiencies.",
    targetScope: { layer: "ALL", value: null } },
  { name: "Focused Edge", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 3,
    costTier: "Tier 1 — Minor (3 BU)",
    mechanicalOutputText: "",
    narrativeRule: "Gain Narrow Advantage on one chosen Narrative Focus (e.g., Awareness when tracking by scent)",
    targetScope: { layer: "NARROW_FOCUS", value: null } },
  { name: "Practice Proficiency", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 4,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Add full Proficiency Bonus (+PB) to all checks matching a single Named Practice",
    targetScope: { layer: "PRACTICE", value: null } },
  { name: "Expertise Upgrade", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 8,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Double the Proficiency Bonus (+2x PB) for that single Named Practice. Requires Practice Proficiency.",
    targetScope: { layer: "PRACTICE", value: null } },
  { name: "Reliable Practice", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 12,
    costTier: "Tier 3 — Major (12 BU anchor)",
    mechanicalOutputText: "",
    narrativeRule: "Establish a natural d20 floor of 10 for that single Named Practice. Requires Expertise Upgrade.",
    targetScope: { layer: "PRACTICE", value: null } },

  // INTENSITY_DICE (1 missing) — dice blocks ARE the metric expression,
  // no targetScope applied (the dice slot is the entire scope).
  { name: "Minor Die Block", category: "INTENSITY_DICE", buCost: 1,
    costTier: "Tier 1 — Minor (4 BU anchor)",
    mechanicalOutputText: "Adds one 1d4 damage or healing unit that inherits source type and domain.",
    narrativeRule: "A small packet of force, injury, restoration, or pressure enters the capability output." },

  // TARGETING (1) — multi-target permission, no scope
  { name: "Vector Split", category: "TARGETING", buCost: 4,
    costTier: "Tier 2 — Standard (8 BU anchor)",
    mechanicalOutputText: "Adds one additional independent target profile within range. Stacks.",
    narrativeRule: "The capability branches, forks, ricochets, or distributes intent across an extra target." },
];

async function main() {
  const dryRun = process.env["DRY_RUN"] === "1";
  console.log(`Seeding ${SEED.length} BU Market primitive entries...`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  let inserted = 0;
  let skipped = 0;
  let scopeWritten = 0;
  let scopeErrors = 0;

  for (const row of SEED) {
    // Phase 7: target_scope — JSON-stringified structured scope.
    // Grammar primitives (verbs, domains, ranges, durations, conditions)
    // leave targetScope undefined → target_scope column stays NULL.
    const targetScope: TargetScope | null = row.targetScope
      ? buildScope(
          row.targetScope.layer as TargetScope["layer"],
          row.targetScope.value ?? null,
        )
      : null;
    const targetScopeJson = serializeForDB(targetScope);

    // Soft validate; doesn't block seeding, just warns.
    const validation = validateScope(targetScope);
    if (validation.ok === false) {
      scopeErrors++;
      console.warn(`  ! ${row.name}: invalid scope — ${validation.error}`);
    }

    if (targetScopeJson) scopeWritten++;

    if (dryRun) {
      // Plan only — no DB write
      console.log(
        `  ${row.targetScope ? "★" : " "} ${row.name.padEnd(50)} [${row.category}]${targetScopeJson ? ` → scope=${row.targetScope?.layer}` : ""}`,
      );
      continue;
    }

    // Upsert on (name, source_origin) unique constraint (schema migration
    // 0020 introduced it, replacing the prior (name, category, user_id)
    // constraint). All canonical BU Market rows share SEED_SOURCE_ORIGIN
    // so existing rows are matched and updated in place.
    const result = await db.execute(sql`
      INSERT INTO primitives (
        name, category, cost_tier, bu_cost, mechanical_output_text, narrative_rule,
        is_mirrorable, mirror_bu_credit, mirror_eligibility_notes,
        target_scope,
        source_origin, is_public, user_id, created_at, updated_at
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
        ${targetScopeJson},
        ${SEED_SOURCE_ORIGIN},
        true, NULL, NOW(), NOW()
      )
      ON CONFLICT (name, source_origin) DO UPDATE SET
        category = EXCLUDED.category,
        cost_tier = EXCLUDED.cost_tier,
        bu_cost = EXCLUDED.bu_cost,
        mechanical_output_text = EXCLUDED.mechanical_output_text,
        narrative_rule = EXCLUDED.narrative_rule,
        is_mirrorable = EXCLUDED.is_mirrorable,
        mirror_bu_credit = EXCLUDED.mirror_bu_credit,
        mirror_eligibility_notes = EXCLUDED.mirror_eligibility_notes,
        target_scope = EXCLUDED.target_scope,
        is_public = EXCLUDED.is_public,
        user_id = EXCLUDED.user_id,
        updated_at = NOW()
      RETURNING (xmax = 0) AS was_inserted
    `);
    const wasInserted = (result as any).rows?.[0]?.was_inserted;
    if (wasInserted) inserted++;
    else skipped++;
  }

  console.log(`✓ inserted: ${inserted}, updated: ${skipped}, total: ${SEED.length}`);
  console.log(`  Rows with targetScope: ${scopeWritten}`);
  if (scopeErrors > 0) {
    console.log(`  Scope validation errors: ${scopeErrors} (above)`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });