// =============================================================================
// Seed file for the Phase 5c BU Market library.
//
// Phase 3 update: every seed carries a source_origin of
// "system:phase5-commit-c-library-seed" matching the existing
// convention on effects/capabilities/items/heritage. The unique
// constraint on primitives is now (name, source_origin) so the
// onConflictDoUpdate target must use that pair — the previous
// (name, category, user_id) target would fail post-migration.
// =============================================================================
import { config } from "dotenv";
import { primitives } from "@/db/schema";
import type { HardModifier } from "@/types/swordweave";

config({ path: ".env.local" });
config({ path: ".env" });

type PrimitiveSeed = typeof primitives.$inferInsert;

const SYSTEM_SOURCE_ORIGIN = "system:phase5-commit-c-library-seed" as const;

const seeds: PrimitiveSeed[] = [
  {
    name: "Strike",
    category: "VERB_TIER",
    costTier: "Tier 2: Standard (8 BU anchor)",
    buCost: 4,
    mechanicalOutputText:
      "Grants access to direct offensive action language for physical or capability-based attacks.",
    narrativeRule:
      "The entity can express intent as a clean impact, blow, slash, shot, or forceful contact.",
    hardModifiers: [] satisfies readonly HardModifier[],
    sourceOrigin: SYSTEM_SOURCE_ORIGIN,
  },
  {
    name: "Fire",
    category: "DOMAIN",
    costTier: "Tier 2: Standard (8 BU anchor)",
    buCost: 4,
    mechanicalOutputText:
      "Licenses fire, heat, ignition, burning pressure, and fire-inherited damage typing.",
    narrativeRule:
      "The entity can route capability output through thermal force, flame, cinders, or heat distortion.",
    hardModifiers: [] satisfies readonly HardModifier[],
    sourceOrigin: SYSTEM_SOURCE_ORIGIN,
  },
  {
    name: "Close Range Gate",
    category: "RANGE",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 2,
    mechanicalOutputText:
      "Allows capability projection into close 5-10 ft same-zone proximity.",
    narrativeRule:
      "The effect reaches beyond touch without leaving immediate melee pressure.",
    hardModifiers: [
      {
        kind: "modify",
        target: "action.range",
        operation: "set",
        value: "close",
      },
    ],
  },
  {
    name: "Near Range Gate",
    category: "RANGE",
    costTier: "Tier 2: Standard (8 BU anchor)",
    buCost: 4,
    mechanicalOutputText:
      "Allows standard combat projection to roughly 30 ft.",
    narrativeRule:
      "The effect can cross ordinary tactical distance within the encounter space.",
    hardModifiers: [
      {
        kind: "modify",
        target: "action.range",
        operation: "set",
        value: "near",
      },
    ],
  },
  {
    name: "Velocity Arrest",
    category: "CONDITION",
    costTier: "Tier 3: Major (12 BU anchor)",
    buCost: 8,
    mechanicalOutputText:
      "Imposes a movement lock by setting target movement speed to 0, or anchors a displacement vector.",
    narrativeRule:
      "Pins an entity to its current spatial coordinate through drag, gravity, magnetism, restraint, or equivalent fiction.",
    hardModifiers: [
      {
        kind: "modify",
        target: "character.movement.land",
        operation: "set",
        value: 0,
        condition: {
          key: "effect.applies",
          operator: "equals",
          value: true,
        },
      },
    ],
  },
  {
    name: "Vector Split",
    category: "TARGETING",
    costTier: "Tier 2: Standard (8 BU anchor)",
    buCost: 4,
    mechanicalOutputText:
      "Adds one additional independent target profile within range. Stacks.",
    narrativeRule:
      "The capability branches, forks, ricochets, or distributes intent across an extra target.",
    hardModifiers: [
      {
        kind: "modify",
        target: "action.targetCount",
        operation: "add",
        value: 1,
        stacking: "stack",
      },
    ],
  },
  {
    name: "Minor Die Block",
    category: "OUTPUT",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText:
      "Adds one 1d4 damage or healing unit that inherits source type and domain.",
    narrativeRule:
      "A small packet of force, injury, restoration, or pressure enters the capability output.",
    hardModifiers: [
      {
        kind: "modify",
        target: "action.damage",
        operation: "add",
        value: "1d4",
        stacking: "stack",
      },
    ],
  },
];

async function seedPrimitives() {
  const { db } = await import("@/db/client");

  for (const seed of seeds) {
    await db
      .insert(primitives)
      .values(seed)
      .onConflictDoUpdate({
        // Phase 3: identity is (name, source_origin) per migration 0020.
        target: [primitives.name, primitives.sourceOrigin],
        set: {
          costTier: seed.costTier,
          buCost: seed.buCost,
          mechanicalOutputText: seed.mechanicalOutputText,
          narrativeRule: seed.narrativeRule,
          hardModifiers: seed.hardModifiers,
          updatedAt: new Date(),
        },
      });
  }
}

seedPrimitives()
  .then(() => {
    console.log(`Seeded ${seeds.length} primitives.`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
