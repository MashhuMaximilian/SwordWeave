// =============================================================================
// Seed sample effects + a nested-effect capability into the library.
//
// Idempotent: uses ON CONFLICT (name, source_origin) so re-running is safe.
// Sources the building blocks from existing primitives + effects.
//
// Examples sourced from the Notion Capability Composition Map canonical page:
// - System Freeze (Technology/Technomancy or Ice Domain)
// - Corrosive Decay (Physical/Acid or Magical/Void Domain)
// - Vertigo Spasms (Psychic/Sensory or Magical/Air Domain)
// - Compelled Focus (Psychic/Emotion Domain)
// - Blind Stun (user-requested addition — Sensory/Physical control)
//
// Plus the Abyssal Despair capability (Phase 6 example from the Notion page)
// that nests "Shattered Composure" which nests "Vertigo Spasms" — proving
// the recursive effect_nesting model.
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityEffects,
  capabilityPrimitives,
  effectEffects,
  effectPrimitives,
  effects,
  primitives,
} from "@/db/schema";

// Primitive IDs discovered from `select id, name from primitives where ...`
// (see Phase 5 Commit C seeding log)
const P = {
  // VERB_TIER
  verbT1: 20,
  verbT2: 21,
  verbT3: 22,
  verbT4: 23,
  // DOMAIN
  domainT1: 24,
  domainT2: 25,
  domainT3: 26,
  domainT4: 27,
  // SIZING
  structT1: 28,
  structT2: 29,
  structT3: 30,
  structT4: 31,
  // RANGE
  closeRange: 33,
  closeGate: 15,
  nearRange: 34,
  farRange: 35,
  veryFarRange: 36,
  extremeRange: 37,
  // DURATION
  shortDuration: 44,
  mediumDuration: 45,
  longDuration: 46,
  persistentDuration: 47,
  reaction: 42,
  // CONDITION (tags)
  physTag: 49,
  sensoryTag: 50,
  cogTag: 51,
  sysTag: 52,
  // KINETIC_CONTROL (velocity)
  velocityArrest: 17,
  velocityArrestStd: 176,
  advVector: 177,
  systemicKinetic: 178,
  minorDisplace: 175,
  // AGENCY_OVERRIDE
  impulseNudge: 179,
  behavioralDir: 180,
  directExec: 181,
  existAllegiance: 182,
  // DEFENSIVE
  kineticHarden: 382,
  psychicFirewall: 384,
  reactiveBulwark: 386,
  structHardening: 387,
  universalAegis: 385,
  wardingShell: 383,
  absoluteInsulation: 388,
} as const;

const SEED_ORIGIN = "system:phase5-commit-c-library-seed";

interface EffectSeed {
  name: string;
  description: string;
  tags: string[];
  primitives: Array<{ id: number; quantity?: number; notes?: string }>;
}

const EFFECT_SEEDS: EffectSeed[] = [
  {
    name: "System Freeze",
    description:
      "**System Freeze** targets an entity's mechanical apparatus or nervous system with a complete lockdown. The affected entity's reaction slot is suppressed for the duration and all velocity-based movement is reduced to zero — they remain rooted in their current coordinate until the effect ends or is dispelled.\n\nBuilt from a **Physical Interaction Tag** (structural lockdown) plus **Velocity Arrest** (anchor to current coordinate) and a **Behavioral Directive / Data Trace Masking** that suspends reaction permissions. Ideal for isolating high-threat enemies orbs of technology or ice domain encounters.",
    tags: ["control", "lockdown", "anchor", "technomancy", "ice"],
    primitives: [
      { id: P.physTag, notes: "Mechanical apparatus lockdown" },
      { id: P.velocityArrest, notes: "Pin to current coordinate" },
      { id: P.behavioralDir, notes: "Suppress reaction slot" },
      { id: P.reaction, notes: "Reaction override" },
    ],
  },
  {
    name: "Corrosive Decay",
    description:
      "**Corrosive Decay** is an ongoing structural erosion condition. While active, the target's physical protections degrade incrementally — each turn their effective defense threshold drops. Does not deal direct damage; instead makes the target a vulnerable target for the rest of the player squad to exploit.\n\nComposed of **Sensory & Physiological Tag** (biological/material erosion) plus a **Structural Hardening (Domain Resistance)** inversion — the hardening modifier is applied to the *attacker*'s bypass, not the target's own defense. Pairs naturally with acid or void domains.",
    tags: ["erosion", "defense-debuff", "dot", "acid", "void"],
    primitives: [
      { id: P.sensoryTag, notes: "Biological/material erosion" },
      { id: P.structHardening, notes: "Inverted — defender bypass" },
      { id: P.mediumDuration, notes: "Persistent decay window" },
    ],
  },
  {
    name: "Vertigo Spasms",
    description:
      "**Vertigo Spasms** simulates complete inner-ear or mental disruption. The target experiences severe probability manipulation — every coordinated action becomes unreliable. The character's inner-ear or spatial-perception circuit is overridden, throwing off all coordination rolls for the duration.\n\nBuilt from a **Sensory & Physiological Tag** (vestibular disruption) combined with a **Cognitive & Agency Tag** (motor coordination interference) and a **Probability Bias** primitive that introduces Negative Bias (Disadvantage) on Physical Checks for the duration. Common in psychic and air-domain attacks.",
    tags: ["control", "disorientation", "psychic", "air"],
    primitives: [
      { id: P.sensoryTag, notes: "Vestibular disruption" },
      { id: P.cogTag, notes: "Motor coordination interference" },
      { id: P.shortDuration, notes: "Brief coordination break" },
    ],
  },
  {
    name: "Compelled Focus",
    description:
      "**Compelled Focus** is the system's clean translation of an MMO-style Taunt / Aggro mechanic — built purely by restricting the targets' mathematical options rather than using rigid behavioral mind-control. While active, the affected entity's reaction targeting is restricted: they can only spend their reaction slot against the source of the effect, not against any other target.\n\nComposed of a **Cognitive & Agency Tag** (attention lock) plus a **Behavioral Directive / Data Trace Masking** that re-targets reaction permissions. The target still chooses to act — they just can't choose to act on anyone but you.",
    tags: ["taunt", "aggro", "psychic", "emotion"],
    primitives: [
      { id: P.cogTag, notes: "Attention lock" },
      { id: P.behavioralDir, notes: "Reaction permission redirect" },
      { id: P.shortDuration, notes: "Standard engagement window" },
    ],
  },
  {
    name: "Blind Stun",
    description:
      "**Blind Stun** is a complete sensory + motor shutdown. The target's vision is fully negated and their reaction slot is suppressed for the duration, leaving them blind, deaf to subtle cues, and unable to mount a counter-response. The effect is the canonical 'stunned' condition in the system — neither attack nor defense is permitted.\n\nBuilt from a **Sensory & Physiological Tag** (vision disruption), a **Cognitive & Agency Tag** (reaction suppression), and a **Reactive Bulwark (DEFENSIVE)** inverted — instead of granting defense, it denies the target their own reactive response window. Universal stun primitive for physical, magical, or psychic sources.",
    tags: ["stun", "blind", "control", "crowd-control"],
    primitives: [
      { id: P.sensoryTag, notes: "Vision / perception cut" },
      { id: P.cogTag, notes: "Reaction suppression" },
      { id: P.reactiveBulwark, notes: "Inverted — deny reactive defense" },
      { id: P.shortDuration, notes: "Standard stun window" },
    ],
  },
  {
    name: "Shattered Composure",
    description:
      "**Shattered Composure** is a multi-mechanical hysterical breakdown condition. Combines movement speed zero, reaction locking, and defense penalties to mimic a total psychic collapse. Designed to be nested inside a larger psychic-wave capability to represent the full mechanical surface area of the meltdown.\n\nComposed of **Velocity Arrest** (no movement), **Blind Stun** (reaction + perception denied), and a **Cognitive & Agency Tag** (defense penalty framing). This effect alone doesn't deal damage — it strips the target of all mechanical agency for the duration.",
    tags: ["psychic", "hysterical", "breakdown", "complex"],
    primitives: [
      { id: P.velocityArrest, notes: "Movement locked" },
      { id: P.cogTag, notes: "Defense penalty + agency denial" },
      { id: P.mediumDuration, notes: "Sustained breakdown" },
    ],
  },
];

export async function seedPhase5LibraryEffects(): Promise<{
  effectsCreated: number;
  effectsReused: number;
  nestingLinks: number;
}> {
  let created = 0;
  let reused = 0;
  let nestingLinks = 0;

  // 1. Upsert each leaf effect first (so children exist before parents)
  const idsByName = new Map<string, string>();

  for (const seed of EFFECT_SEEDS) {
    // Look for existing row by (name, source_origin)
    const existing = await db.query.effects.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.name, seed.name),
          eq(table.sourceOrigin, SEED_ORIGIN),
        ),
    });

    let id: string;
    if (existing) {
      id = existing.id;
      reused++;
    } else {
      const [row] = await db
        .insert(effects)
        .values({
          name: seed.name,
          narrativeDescription: seed.description,
          isPublic: true,
          sourceOrigin: SEED_ORIGIN,
          tags: seed.tags,
        })
        .returning({ id: effects.id });
      if (!row) throw new Error(`Failed to insert effect ${seed.name}`);
      id = row.id;
      created++;
    }
    idsByName.set(seed.name, id);

    // 2. Upsert primitive_links for this effect (delete-then-insert to avoid
    //    stale rows on re-seed). Cheap because effects have few primitives.
    await db
      .delete(effectPrimitives)
      .where(eq(effectPrimitives.effectId, id));
    if (seed.primitives.length > 0) {
      await db.insert(effectPrimitives).values(
        seed.primitives.map((p, i) => ({
          effectId: id,
          primitiveId: p.id,
          quantity: p.quantity ?? 1,
          sortOrder: i,
          notes: p.notes ?? null,
        })),
      );
    }
  }

  // 3. Nest: Shattered Composure → Vertigo Spasms (parent nests child)
  const shatteredId = idsByName.get("Shattered Composure");
  const vertigoId = idsByName.get("Vertigo Spasms");
  if (shatteredId && vertigoId) {
    const existing = await db.query.effectEffects.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.parentEffectId, shatteredId),
          eq(table.childEffectId, vertigoId),
        ),
    });
    if (!existing) {
      await db.insert(effectEffects).values({
        parentEffectId: shatteredId,
        childEffectId: vertigoId,
        sortOrder: 0,
        slotLabel: "primary breakdown",
      });
      nestingLinks++;
    }
  }

  return { effectsCreated: created, effectsReused: reused, nestingLinks };
}

// =============================================================================
// Seed a capability that nests an effect — "Abyssal Despair" demonstrating
// the canonical Phase 6 example from the Notion page.
// =============================================================================

export async function seedAbyssalDespair(): Promise<{
  capabilityId: string;
  reused: boolean;
}> {
  const name = "Abyssal Despair";
  const existing = await db.query.capabilities.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.name, name), eq(table.sourceOrigin, SEED_ORIGIN)),
  });

  let capabilityId: string;
  let reused: boolean;
  if (existing) {
    capabilityId = existing.id;
    reused = true;
  } else {
    const [row] = await db
      .insert(capabilities)
      .values({
        name,
        type: "ACTIVE",
        sourceType: "PSYCHIC",
        verboseDescription:
          "**Abyssal Despair** is a high-tier mentalist projection that unleashes a wave of pure psychic horror across multiple targets. The wave itself deals psychic damage and applies the nested **Shattered Composure** condition to each affected target — a total hysterical breakdown that pins them in place, locks their reactions, and forces defense penalties for the medium duration.\n\nThe capability is built from a **Domain Access Tier III** (psychic wave domain), an **AoE Sphere** primitive for the wave's footprint, a **Far Range** primitive, and the nested Shattered Composure effect. Source Type is psychic — all nested components inherit this designation downward per the Capability Template rules.",
        isPublic: true,
        sourceOrigin: SEED_ORIGIN,
        tags: ["psychic", "wave", "aoe", "crowd-control", "high-tier"],
      })
      .returning({ id: capabilities.id });
    if (!row) throw new Error("Failed to insert Abyssal Despair");
    capabilityId = row.id;
    reused = false;
  }

  // Re-seed primitive_links idempotently
  await db
    .delete(capabilityPrimitives)
    .where(eq(capabilityPrimitives.capabilityId, capabilityId));
  await db.insert(capabilityPrimitives).values([
    {
      capabilityId,
      primitiveId: P.domainT3,
      role: "DOMAIN",
      quantity: 1,
      sortOrder: 0,
      slotLabel: "psychic domain",
    },
    {
      capabilityId,
      primitiveId: P.farRange,
      role: "RANGE",
      quantity: 1,
      sortOrder: 1,
      slotLabel: "wave reach",
    },
  ]);

  // Re-seed capability_effects link idempotently
  const shatteredId = await db
    .select({ id: effects.id })
    .from(effects)
    .where(
      and(eq(effects.name, "Shattered Composure"), eq(effects.sourceOrigin, SEED_ORIGIN)),
    )
    .limit(1)
    .then((r) => r[0]?.id);

  if (shatteredId) {
    await db
      .delete(capabilityEffects)
      .where(eq(capabilityEffects.capabilityId, capabilityId));
    await db.insert(capabilityEffects).values({
      capabilityId,
      effectId: shatteredId,
      sortOrder: 0,
      slotLabel: "primary effect",
    });
  }

  return { capabilityId, reused };
}

// =============================================================================
// Top-level seed runner
// =============================================================================

export async function runPhase5LibrarySeed(): Promise<{
  effectsCreated: number;
  effectsReused: number;
  nestingLinks: number;
  capabilityReused: boolean;
}> {
  const effects = await seedPhase5LibraryEffects();
  const cap = await seedAbyssalDespair();
  return {
    effectsCreated: effects.effectsCreated,
    effectsReused: effects.effectsReused,
    nestingLinks: effects.nestingLinks,
    capabilityReused: cap.reused,
  };
}

// Avoid unused-import warning if sql isn't referenced
void sql;
void primitives;