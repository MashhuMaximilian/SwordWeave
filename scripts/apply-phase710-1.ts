/**
 * Phase 7.10.1 — Re-author the 8 canonical effects.
 *
 * Updates narrative_description on each effect to follow the
 * 4-section Universal Ledger Schema from the Capability
 * Composition Map (Notion 37fed8479ccd810dbd98e4c942a98553):
 *   - Composition
 *   - Spatial & Resolution Gate
 *   - Delivered Effect
 *   - Duration
 *
 * Also recomputes content_hash for each effect so the
 * versioning system picks up the new content.
 *
 * Idempotent: re-running produces no changes (compared
 * against content_hash).
 *
 * Run: pnpm exec tsx scripts/apply-phase710-1.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/db/client";
import { effects, effectPrimitives } from "@/db/schema/engine";
import { effectVersions } from "@/db/schema/versions";
import { eq, and, desc, inArray } from "drizzle-orm";
import { buildCanonicalEffectPayload, hashEffectContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";

// =============================================================================
// The 8 re-authored effects.
// =============================================================================

const REAUTHORED: ReadonlyArray<{
  id: string;
  name: string;
  narrative: string;
}> = [
  {
    id: "ddfa115f-3403-4db1-a0b4-62e6f15e94b6", // Blind Stun
    name: "Blind Stun",
    narrative: `**Composition:** Sensory & Physiological Tag + Absolute Timeline Deprivation (Stun Vector) + Core Action Multiplication inverse (Stun Vector's mirror, subtract 1 standard action).

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Target's reaction window is erased for 1 round AND standard action window is subtracted by 1. Combined: total sensory denial + reaction lockdown + standard action erasure. The engine reads the Stun Vector's \`add action.standard_action_window -1\` modifier; for an entity with 1 standard action baseline, this fully suppresses action.

**Duration:** 1 round.`,
  },
  {
    id: "5d4267a8-0c97-474f-aac0-058fd199af21", // Compelled Focus
    name: "Compelled Focus",
    narrative: `**Composition:** Negative Bias II (Named Practice) + Cognitive & Agency Tag + Persistent Duration.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target. Mental Defensive Save vs. Caster's Mental DC.

**Delivered Effect:** Target rolls with Negative Bias (Disadvantage) on all offensive tracks that do NOT target the caster. The "Practices that do target the caster" exclusion is set via fork condition. The system is the clean translation of an MMO-style Taunt/Aggro mechanic — restricting mathematical options rather than rigid behavioral mind-control.

**Duration:** Persistent (until removed by capability or condition-clearing effect).`,
  },
  {
    id: "60ded22a-4649-46ee-a17c-c9b5ef87db0d", // Corrosive Decay
    name: "Corrosive Decay",
    narrative: `**Composition:** Structural Hardening (Domain Resistance) + Sensory & Physiological Tag + Persistent Duration.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Target's defenses are progressively degraded — the engine applies a structural erosion tick. Reads as: the target's armor/defenses erode over time, making them a vulnerable target for the rest of the squad. The actual damage application is one-shot at cast time; the persistence is the engine tracking the "Domain Resistance erosion" flag across scenes.

**Duration:** Persistent (multi-scene).`,
  },
  {
    id: "30016446-0171-4c5a-aa1d-326ebf333c2f", // Shattered Composure
    name: "Shattered Composure",
    narrative: `**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Absolute Timeline Deprivation (Stun Vector) + Negative Bias II (Named Practice, on defenses) + System & Identity Tag.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Total hysterical breakdown. Movement speed forced to 0 (Velocity Lock flag), reaction window erased, and defense rolls receive Negative Bias. The compound effect mimics a complete psychological break. The negative-bias scope ("on defenses") is set via fork condition.

**Duration:** 1 round for the velocity lock and reaction erasure; the negative bias lingers via Persistent if the parent capability specifies.`,
  },
  {
    id: "b196fa82-40a7-43d6-ae3f-4578d7ea0702", // Snared (Vine Bind)
    name: "Snared (Vine Bind)",
    narrative: `**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Existential Tear (1d20 ticking damage) + Physical Interaction Tag.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target. Physical Defensive Save vs. Caster's Physical DC.

**Delivered Effect:** Living vines bind the target. Movement speed = 0 (Velocity Lock flag), and the target takes 1d20 Existential Tear damage at the start of each of their turns (ticking damage while bound).

**Duration:** Persistent until the target breaks free (strength check) or the parent capability's duration expires.`,
  },
  {
    id: "80bca164-faea-4d34-ac66-ecd051cdedef", // Staggered (Acid Corrosion)
    name: "Staggered (Acid Corrosion)",
    narrative: `**Composition:** Minor Linear Displacement (movement halved) + Negative Bias II (Named Practice, on attacks) + Sensory & Physiological Tag + Persistent Duration.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Acid-corrosion staggered state. Movement speed reduced by 15ft (Minor Linear Displacement modifier: \`add character.movement.land -15\`), attack rolls receive Negative Bias, and the engine tracks the persistence flag for ticking damage application by the parent capability.

**Duration:** Persistent (until removed).`,
  },
  {
    id: "5b37e8ff-3974-402a-8c3e-d6c0acff26b3", // System Freeze
    name: "System Freeze",
    narrative: `**Composition:** Velocity Arrest / Standard Vector (Velocity Lock) + Absolute Timeline Deprivation (Stun Vector) + Cognitive & Agency Tag.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Target's mechanical apparatus or nervous system locks down completely. Movement speed = 0 (Velocity Lock) + reaction window erased. Isolates a high-threat enemy by removing their action options. Built for Technology/Technomancy or Ice Domain contexts.

**Duration:** 1 round (Stun Vector duration).`,
  },
  {
    id: "dabe0a3f-5af2-4bfc-872c-398e9064f909", // Vertigo Spasms
    name: "Vertigo Spasms",
    narrative: `**Composition:** Negative Bias I (Narrative Focus) + Cognitive & Agency Tag.

**Spatial & Resolution Gate:** Delivered via parent capability's range/target.

**Delivered Effect:** Inner-ear or mental coordination disruption. Target rolls with Negative Bias on a specific narrative sub-trigger (e.g. "physical coordination checks"). The narrow scope is set via fork condition. Built for Psychic/Sensory or Magical/Air Domain contexts.

**Duration:** Persistent (until removed).`,
  },
];

// =============================================================================
// Helpers
// =============================================================================

async function main() {
  console.log("=".repeat(72));
  console.log("Phase 7.10.1 — Re-author 8 effects (4-section schema)");
  console.log("=".repeat(72));
  console.log(`Effects: ${REAUTHORED.length}\n`);

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id, name, narrative } of REAUTHORED) {
    const [row] = await db
      .select()
      .from(effects)
      .where(eq(effects.id, id))
      .limit(1);

    if (!row) {
      console.error(`  [${id.slice(0, 8)}] ${name} — NOT FOUND`);
      failed++;
      continue;
    }

    if (row.narrativeDescription === narrative) {
      console.log(`  [${id.slice(0, 8)}] ${name} — already updated, skip`);
      skipped++;
      continue;
    }

    // Fetch current primitive slots for the canonical hash.
    const slots = await db
      .select()
      .from(effectPrimitives)
      .where(eq(effectPrimitives.effectId, id));

    const primitiveSlots = slots.map((s) => ({
      primitiveId: s.primitiveId,
      quantity: s.quantity,
      notes: s.notes ?? "",
    }));

    const newHash = await hashEffectContent(
      buildCanonicalEffectPayload({
        name: row.name,
        narrativeDescription: narrative,
        isPublic: row.isPublic,
        tags: row.tags,
        primitiveSlots,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor ?? "#ffffff",
      }),
    );

    await db
      .update(effectVersions)
      .set({ isLatest: false })
      .where(
        and(
          eq(effectVersions.effectId, id),
          eq(effectVersions.isLatest, true),
        ),
      );

    const lastVersion = await db
      .select({ v: effectVersions.versionNumber })
      .from(effectVersions)
      .where(eq(effectVersions.effectId, id))
      .orderBy(desc(effectVersions.versionNumber))
      .limit(1);
    const nextVersionNumber = (lastVersion[0]?.v ?? 0) + 1;

    const newVersionId = resolveContentVersionId("effect", id, newHash);
    const snapshot = {
      id,
      sourceOrigin: row.sourceOrigin,
      data: {
        name: row.name,
        narrativeDescription: narrative,
        isPublic: row.isPublic,
        tags: row.tags,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor ?? "#ffffff",
      },
    };

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(effects)
          .set({
            narrativeDescription: narrative,
            contentHash: newHash,
            updatedAt: new Date(),
          })
          .where(eq(effects.id, id));

        await tx.insert(effectVersions).values({
          id: newVersionId,
          effectId: id,
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
        `  [${id.slice(0, 8)}] ${name} — re-authored (v${nextVersionNumber})`,
      );
      applied++;
    } catch (e) {
      console.error(`  [${id.slice(0, 8)}] ${name} — FAILED:`, e);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done. applied=${applied} skipped=${skipped} failed=${failed}`);
  console.log("=".repeat(72));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
