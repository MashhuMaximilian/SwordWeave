/**
 * Phase 7.10.2 — Re-author 25 canonical capabilities.
 *
 * Each capability gets:
 *   - verbose_description rewritten in 4-section schema
 *     (Composition / Spatial / Effect / Duration)
 *   - tags updated to include style classification
 *     (style-a / style-b / style-c)
 *   - content_hash recomputed
 *   - capability_versions snapshot inserted
 *
 * Additionally, Hypnotic Suggester (Style C) gets the
 * Compelled Focus effect nested via capability_effects.
 * This is the first demonstrative wire-up of a Style C
 * capability → effect relationship.
 *
 * Idempotent: re-running produces no changes.
 *
 * Run: pnpm exec tsx scripts/apply-phase710-2.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/db/client";
import { capabilities, capabilityPrimitives, capabilityEffects } from "@/db/schema/engine";
import { capabilityVersions } from "@/db/schema/versions";
import { eq, and, desc } from "drizzle-orm";
import { buildCanonicalCapabilityPayload, hashCapabilityContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";

// =============================================================================
// The 25 re-authored capabilities.
// =============================================================================

type ReauthoredCap = {
  id: string;
  name: string;
  type: "ACTIVE" | "PASSIVE" | "AUGMENT";
  style: "A" | "B" | "C";
  description: string;
  tags: string[];
};

const REAUTHORED: ReadonlyArray<ReauthoredCap> = [
  // ============= STYLE A: PASSIVE (8) =============
  {
    id: "c6de8b1e-ca2d-41d5-be18-47635f4e34f1", // Aegis Shield
    name: "Aegis Shield",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Direct Material Trigger (on hit) + Reactive Bulwark (+2 Defense when triggered) + Reaction Pulse (+1 Independent Reaction Slot).

Reaction-trigger: when hit by a physical attack, spend Reaction Slot to gain +2 Physical Defense against that specific strike. Plus +1 baseline Independent Reaction Slot.`,
    tags: ["defense", "reaction", "shield", "style-a", "passive"],
  },
  {
    id: "a451c819-9e67-489b-a15a-a2f2cde4b45b", // Archmage's Strain Redirection Plate
    name: "Archmage's Strain Redirection Plate",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Hazard Transmutation + Condition Insulation + Perpetual Lock.

Permanent trait: when a capability inflicts a status condition on the caster via Strain feedback, the trauma is converted into an environmental hazard. Health unchanged; surroundings shift.`,
    tags: ["defense", "passive", "strain-mitigation", "style-a"],
  },
  {
    id: "b0b97b64-2f00-443b-8fd8-21e5b0bd20ca", // Aura Detective
    name: "Aura Detective",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Systemic Resonance (read capability trails) + Focused Edge (Awareness on magical concealment).

Passive sensitivity to psychic residue. Notices magical influence within the last hour + focus advantage on Awareness for detecting magical concealment.`,
    tags: ["perception", "psychic", "style-a", "passive"],
  },
  {
    id: "598f8198-a534-4d49-90da-5b684e3dd234", // Blind Swordsman
    name: "Blind Swordsman",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Substrate Echo (Tremorsense 30ft) + Tactile Echo (Blindsight 30ft).

Trained to fight without sight. Gains Tremorsense 30ft + Blindsight 30ft (tactile echo fallback).`,
    tags: ["defense", "perception", "martial", "style-a", "passive"],
  },
  {
    id: "fd7dc79a-a877-4af7-ad18-ca29b249ad12", // Bloodhound Master
    name: "Bloodhound Master",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Practice Proficiency (Awareness) + Focused Edge (Awareness through smell) + Expertise Upgrade on Awareness.

Legendary tracker. Awareness Proficiency + Focus advantage on Awareness through smell + Expertise Upgrade path on Awareness.`,
    tags: ["tracking", "perception", "style-a", "passive"],
  },
  {
    id: "352bd76e-6efb-4275-b203-93e464db543f", // Ghost Walk
    name: "Ghost Walk",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Stride Extension + Focused Edge (Finesse vs physical-detection).

Combat flow training. Stride Extension baseline + Focus advantage on Finesse checks to avoid physical-detection.`,
    tags: ["stealth", "movement", "martial", "style-a", "passive"],
  },
  {
    id: "2adef2f3-e609-4eb4-8a22-8a5c661a93a7", // Heavy Tactical Cover
    name: "Heavy Tactical Cover",
    type: "PASSIVE",
    style: "A",
    description: `**Composition:** Defensive Save Upgrade (Physical) + Kinetic Hardening (+1 Physical Defense).

Permanent defensive training. The character automatically seeks cover, granting +1 Physical Defense against ranged attacks when cover is present.`,
    tags: ["defense", "tactical", "style-a", "passive"],
  },
  {
    id: "73d9ac79-af9f-4775-bc9e-aa0ca5ef5d25", // Vow of Enmity
    name: "Vow of Enmity",
    type: "AUGMENT",
    style: "A",
    description: `**Composition:** Focused Edge (narrow Narrative Focus on attacks vs sworn target).

Swearing an oath against a designated foe grants a Narrow Focus advantage on attacks vs that target. Augments another capability rather than standing alone.`,
    tags: ["augment", "martial", "narrative", "style-a"],
  },

  // ============= STYLE B: DIRECT RESOLUTION (8) =============
  {
    id: "80dd09d5-6916-416f-9cb3-bc54440fa3c2", // Cataclysmic Shockwave
    name: "Cataclysmic Shockwave",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier I (strike) + Earth Domain + Far Range (60ft) + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6) + Physical Interaction Tag.

**Spatial & Resolution Gate:** Far Range (60ft). Kinetic Sphere template. Single save per target.

**Duration:** Instant. Force-propelled ring radiates from a coordinate, knocking adjacent targets prone and dealing kinetic damage in a sphere.`,
    tags: ["aoe", "force", "style-b", "active"],
  },
  {
    id: "05876879-9f93-4740-aea5-5f40035dc7aa", // Rusting Strike
    name: "Rusting Strike",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier I + Decay Domain + Touch Range + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6) + Physical Interaction Tag.

**Spatial & Resolution Gate:** Touch / Melee. Single target.

**Duration:** Instant. Kinetic strike charged with corrosive entropy. Standard kinetic damage + applies Physical Interaction Tag deflexure debuff.`,
    tags: ["attack", "corrosion", "style-b", "active"],
  },
  {
    id: "704a1398-3376-4017-b7d0-68ce0e3f1823", // Strike
    name: "Strike",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier I (strike) + Earth Domain + Touch Range + Structure Tier I (Single Target) + Standard Execution + Standard Die Block (1d6).

**Spatial & Resolution Gate:** Touch / Melee. Single target.

**Duration:** Instant. Baseline physical attack. Single kinetic strike at touch range. Canonical "I swing my sword" capability built from atomic primitives (Verb Access Tier I + Earth Domain + Standard Die Block).`,
    tags: ["attack", "basic", "style-b", "active"],
  },
  {
    id: "9056720e-3dd2-4ef2-940a-c4cb401ab536", // Tornado Blast
    name: "Tornado Blast",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier I + Wind Domain + Far Range (60ft) + Structural Wall (30×10) + Fast Execution + Minor Linear Displacement (10ft) + Standard Die Block (1d6).

**Spatial & Resolution Gate:** Far Range. Structural Wall template. Multiple targets along the column.

**Duration:** Instant. Fast-moving column of cyclonic wind. Kinetic damage + displacement vector across field.`,
    tags: ["aoe", "wind", "style-b", "active"],
  },
  {
    id: "42cd612c-a265-4e7d-816f-9917f686f7ea", // Mind Scan
    name: "Mind Scan",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier I + Thought Domain + Near Range (30ft) + Structure Tier I (Single Target) + Standard Execution + Non-Material Translation Qualifier.

**Spatial & Resolution Gate:** Near Range (30ft). Single target. No save — informational read.

**Duration:** Instant (one reading). Reads surface thoughts of a target within range. Learns current emotional baseline + one piece of recent memory.`,
    tags: ["psychic", "detection", "style-b", "active"],
  },
  {
    id: "a136e673-7c0a-447a-b4f6-796cf2662930", // Spell Counter-Disruption Shield
    name: "Spell Counter-Disruption Shield",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier II (negate) + Arcane Domain + Touch Range (Self) + Structure Tier I (Single-target counter) + Reaction Execution + Interceptive Causal Trigger.

**Spatial & Resolution Gate:** Self. Reaction-triggered. Counters one incoming capability.

**Duration:** Instant (one absorption). Reaction-triggered ward absorbing a single incoming capability and dissipating its payload while leaving the caster's primitives intact.`,
    tags: ["defense", "reaction", "counter-magic", "style-b", "active"],
  },
  {
    id: "43ad665f-aedf-434c-a881-8bd3ff28059d", // Time Stop
    name: "Time Stop",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier IV (suspend rules) + Time Domain + Touch Range (Self — affects scene) + Structure Tier I (Single Target, scene-wide) + Instant Execution + System & Identity Tag.

**Spatial & Resolution Gate:** Self. Instant. Caster gains a Free Action Window during halt.

**Duration:** Instant window. Halts all other entities in scene for an instant window.`,
    tags: ["time", "control", "style-b", "active"],
  },
  {
    id: "81f75de9-79af-4d17-813d-5483babd1561", // Medusa's Gaze
    name: "Medusa's Gaze",
    type: "ACTIVE",
    style: "B",
    description: `**Composition:** Verb Access Tier IV (rewrite identity) + Form/Petrification Domain + Very Far Range (120ft) + Structure Tier I (Single Target) + Instant Execution + System & Identity Tag.

**Spatial & Resolution Gate:** Very Far Range (120ft). Single target. Mental save vs. Caster's Mental DC.

**Duration:** Instant resolution. Single-target instantaneous gaze attack. On failed Mental save, target's identity is overwritten — frozen into statue-state.`,
    tags: ["control", "petrify", "style-b", "active"],
  },

  // ============= STYLE C: DYNAMIC STATE (9) =============
  {
    id: "fb4abc89-8a9c-4ce4-b1f8-82c225723c04", // Aura of Total Enfeeblement
    name: "Aura of Total Enfeeblement",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier IV (weaken) + Force Domain Tier II + Touch Range (Self — emanation) + Mobile Aura (10ft) + Medium Duration + Negative Bias I (Narrative Focus on physical checks).

**Spatial & Resolution Gate:** Self — emanation that persists with caster. Mobile Aura 10ft radius.

**Delivered Effect:** Mobile aura imposing Negative Bias (Disadvantage) on all physical checks for creatures that enter. The bias is composed directly from the primitive (not a nested effect) since the bias is a modifier, not a condition.

**Duration:** Medium Duration (continues while caster maintains).`,
    tags: ["aoe", "debuff", "style-c", "active"],
  },
  {
    id: "5f7dd8ca-b4d7-4a94-8a18-d2590a5922c7", // Chamber Blackout Matrix
    name: "Chamber Blackout Matrix",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier I + Darkness Domain Tier II + Far Range (60ft) + Stationary Zone + Long Duration + System & Identity Tag.

**Spatial & Resolution Gate:** Far Range. Stationary Zone template.

**Delivered Effect:** Drains all light from a zone + System-level sensory denial. Targets fully blind; identities obscured from outside Awareness checks.

**Duration:** Long Duration.`,
    tags: ["aoe", "darkness", "style-c", "active"],
  },
  {
    id: "3ac2706a-a9cb-4f0e-ba58-eba5e35d53cf", // Chronomantic Haste
    name: "Chronomantic Haste",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier IV (synchronize) + Time Domain Tier II + Close Range + Structure Tier I (Single Target) + Medium Duration + Core Action Multiplication (Haste Vector, +1 Standard Action) + Timeline Tether (immune to delays).

**Spatial & Resolution Gate:** Close. Single target (ally).

**Delivered Effect:** Accelerates the subject's internal tempo. Target gains +1 Standard Action Window for the encounter. Immune to forced delays. Both effects compose from the two primitives.

**Duration:** Medium Duration (continues for the encounter).`,
    tags: ["time", "buff", "style-c", "active"],
  },
  {
    id: "9eb01658-3753-4368-953f-ddb627448ad2", // Gravity Anchor Trap
    name: "Gravity Anchor Trap",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier I + Gravity Domain Tier II + Near Range (30ft) + Structure Tier I (Single Target) + Reaction Execution + Velocity Arrest / Standard Vector (Velocity Lock) + Direct Material Trigger.

**Spatial & Resolution Gate:** Near Range (30ft). Reaction-triggered.

**Delivered Effect:** Localized gravity spike. Velocity Lock for one round + heavy kinetic slam on dismissal. The Velocity Lock primitive applies at cast; the slam is engine-applied on dismissal.

**Duration:** 1 round (velocity lock) + dismissal damage.`,
    tags: ["control", "gravity", "trap", "style-c", "active"],
  },
  {
    id: "868fe5e6-e1f0-4a0d-865e-a1ff8bc1a5ff", // Greater Invisibility
    name: "Greater Invisibility",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier II (phase/displace) + Light/Phase Domain Tier III + Close Range + Structure Tier I (Single Target) + Persistent Duration + System & Identity Tag.

**Spatial & Resolution Gate:** Close. Single target.

**Delivered Effect:** Phase-shift the target out of visual spectrum. Positive Bias on Stealth + immune to optical targeting.

**Duration:** Persistent.`,
    tags: ["stealth", "utility", "style-c", "active"],
  },
  {
    id: "78145c25-e8d7-447c-9b8f-d3795a62d60a", // Hypnotic Suggester
    name: "Hypnotic Suggester",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier I + Emotion Domain Tier II + Near Range (30ft) + Structure Tier I (Single Target) + Long Duration + Behavioral Directive / Data Trace Masking.

**Spatial & Resolution Gate:** Near Range (30ft). Single target. Mental save vs. Caster's Mental DC.

**Delivered Effect:** Projects a sustained cognitive directive. Imposes *Compelled Focus* (nests the canonical effect) — target rolls with Negative Bias on all offensive tracks that do NOT target the caster. The Behavioral Directive primitive is the capability surface; the Compelled Focus effect handles the bias math.

**Duration:** Long Duration.`,
    tags: ["psychic", "control", "style-c", "active", "nests-effect"],
  },
  {
    id: "e06c56e4-fb42-4435-90d2-4b6461a2b7c8", // Simulacrum
    name: "Simulacrum",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier IV (rewrite identity) + Existence Domain Tier IV + Touch Range + Structure Tier I (Single Target) + Permanent Duration + System & Identity Tag.

**Spatial & Resolution Gate:** Touch. Single target. Permanent duplicate.

**Delivered Effect:** Permanent duplicate of the target's identity and form, fully under the caster's command. Retains all primitive licenses. (Too complex to nest as a single effect; the System & Identity Tag tracks the duplicate state.)

**Duration:** Permanent.`,
    tags: ["summoning", "duplicate", "style-c", "active"],
  },
  {
    id: "b40309ef-3b22-4076-9709-0080dd84a03b", // Spore Choke
    name: "Spore Choke",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier I + Decay/Poison Domain Tier II + Near Range (30ft) + Linear / Conical Vector (15ft cone) + Standard Execution + Sensory & Physiological Tag.

**Spatial & Resolution Gate:** Near Range. 15ft cone. Standard save per caught target.

**Delivered Effect:** Dense spore cloud in a cone. Ticking damage + sensory-physiological interference on caught targets.

**Duration:** Ticking persists for capability duration.`,
    tags: ["aoe", "poison", "style-c", "active"],
  },
  {
    id: "7a887e68-0063-4af1-9f2a-4b1ed9096960", // Temporal Stasis Trap
    name: "Temporal Stasis Trap",
    type: "ACTIVE",
    style: "C",
    description: `**Composition:** Verb Access Tier IV (suspend) + Time Domain Tier III + Close Range + Structure Tier I (Single Target) + Reaction Execution + Temporal Isolate + Direct Material Trigger.

**Spatial & Resolution Gate:** Close. Reaction-triggered.

**Delivered Effect:** Locks target in timeline stasis for 1 round. Target invulnerable during lock. The engine reads the \`behavior:temporal_stasis_entity\` flag and applies the stasis state.

**Duration:** 1 round (auto-expires).`,
    tags: ["time", "control", "style-c", "active"],
  },
];

// =============================================================================
// Special: Hypnotic Suggester nests Compelled Focus effect
// =============================================================================

const HYPNOTIC_SUGGESTER_ID = "78145c25-e8d7-447c-9b8f-d3795a62d60a";
const COMPELLED_FOCUS_EFFECT_ID = "5d4267a8-0c97-474f-aac0-058fd199af21";

// =============================================================================
// Helpers
// =============================================================================

async function main() {
  console.log("=".repeat(72));
  console.log("Phase 7.10.2 — Re-author 25 capabilities (4-section schema)");
  console.log("=".repeat(72));
  console.log(`Capabilities: ${REAUTHORED.length}\n`);

  let applied = 0;
  let skipped = 0;
  let failed = 0;
  const styleCounts = { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>;

  for (const cap of REAUTHORED) {
    styleCounts[cap.style] = (styleCounts[cap.style] ?? 0) + 1;

    const [row] = await db
      .select()
      .from(capabilities)
      .where(eq(capabilities.id, cap.id))
      .limit(1);

    if (!row) {
      console.error(`  [${cap.id.slice(0, 8)}] ${cap.name} — NOT FOUND`);
      failed++;
      continue;
    }

    // Check if already updated (idempotency: same description + same tags)
    const sameNarrative = row.verboseDescription === cap.description;
    const sameTags =
      JSON.stringify([...row.tags].sort()) ===
      JSON.stringify([...cap.tags].sort());
    if (sameNarrative && sameTags) {
      console.log(
        `  [${cap.id.slice(0, 8)}] ${cap.name} (Style ${cap.style}) — already updated, skip`,
      );
      skipped++;
      continue;
    }

    // Fetch current primitive slots for the canonical hash.
    const slots = await db
      .select()
      .from(capabilityPrimitives)
      .where(eq(capabilityPrimitives.capabilityId, cap.id));

    const primitiveSlots = slots.map((s) => ({
      primitiveId: s.primitiveId,
      role: s.role,
      quantity: s.quantity,
      slotLabel: s.slotLabel ?? "",
      notes: s.notes ?? "",
    }));

    // Fetch current effect IDs (for the canonical hash).
    const effectLinks = await db
      .select()
      .from(capabilityEffects)
      .where(eq(capabilityEffects.capabilityId, cap.id));
    const effectIds = effectLinks.map((e) => e.effectId);

    const newHash = await hashCapabilityContent(
      buildCanonicalCapabilityPayload({
        name: row.name,
        type: row.type,
        sourceType: row.sourceType,
        verboseDescription: cap.description,
        tags: cap.tags,
        isPublic: row.isPublic,
        primitiveSlots,
        effectIds,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor ?? "#ffffff",
      }),
    );

    await db
      .update(capabilityVersions)
      .set({ isLatest: false })
      .where(
        and(
          eq(capabilityVersions.capabilityId, cap.id),
          eq(capabilityVersions.isLatest, true),
        ),
      );

    const lastVersion = await db
      .select({ v: capabilityVersions.versionNumber })
      .from(capabilityVersions)
      .where(eq(capabilityVersions.capabilityId, cap.id))
      .orderBy(desc(capabilityVersions.versionNumber))
      .limit(1);
    const nextVersionNumber = (lastVersion[0]?.v ?? 0) + 1;

    const newVersionId = resolveContentVersionId("capability", cap.id, newHash);
    const snapshot = {
      id: cap.id,
      sourceOrigin: row.sourceOrigin,
      data: {
        name: row.name,
        type: row.type,
        verboseDescription: cap.description,
        tags: cap.tags,
        isPublic: row.isPublic,
        metadata: row.metadata ?? {},
        primitiveSlots,
        effectIds,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor ?? "#ffffff",
      },
    };

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(capabilities)
          .set({
            verboseDescription: cap.description,
            tags: cap.tags,
            contentHash: newHash,
            updatedAt: new Date(),
          })
          .where(eq(capabilities.id, cap.id));

        await tx.insert(capabilityVersions).values({
          id: newVersionId,
          capabilityId: cap.id,
          versionNumber: nextVersionNumber,
          isLatest: true,
          deltaKind: "FULL",
          snapshot,
          publishedByUserId: null,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      console.log(
        `  [${cap.id.slice(0, 8)}] ${cap.name} (Style ${cap.style}) — re-authored (v${nextVersionNumber})`,
      );
      applied++;
    } catch (e) {
      console.error(`  [${cap.id.slice(0, 8)}] ${cap.name} — FAILED:`, e);
      failed++;
    }
  }

  // =============================================================================
  // Wire up Hypnotic Suggester → Compelled Focus effect
  // =============================================================================
  console.log("\n" + "-".repeat(72));
  console.log("Wiring up Hypnotic Suggester → Compelled Focus effect...");
  try {
    const existing = await db
      .select()
      .from(capabilityEffects)
      .where(eq(capabilityEffects.capabilityId, HYPNOTIC_SUGGESTER_ID));

    if (existing.some((e) => e.effectId === COMPELLED_FOCUS_EFFECT_ID)) {
      console.log("  [Hypnotic Suggester] → [Compelled Focus] — already linked");
    } else {
      await db.insert(capabilityEffects).values({
        capabilityId: HYPNOTIC_SUGGESTER_ID,
        effectId: COMPELLED_FOCUS_EFFECT_ID,
        sortOrder: 0,
        notes: "Hypnotic Suggester projects Compelled Focus on the target.",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("  [Hypnotic Suggester] → [Compelled Focus] — linked ✓");
    }
  } catch (e) {
    console.error("  Failed to wire up effect:", e);
    failed++;
  }

  console.log("\n" + "=".repeat(72));
  console.log(
    `Done. applied=${applied} skipped=${skipped} failed=${failed}`,
  );
  console.log(
    `Style distribution: A=${styleCounts["A"]} B=${styleCounts["B"]} C=${styleCounts["C"]}`,
  );
  console.log("=".repeat(72));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
