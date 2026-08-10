/**
 * /api/characters/[id]/resolve — Phase 8.3f S3 (Mashu 2026-07-28)
 *
 * Returns the resolved modifier map for a character. Two query
 * modes:
 *
 *   GET /api/characters/[id]/resolve
 *     → full ResolvedModifiers (all targets)
 *
 *   GET /api/characters/[id]/resolve?target=character.attribute.physical
 *     → just that target's { total, contributions }
 *
 * Phase 8.I i3: Also fetches capability/effect-derived primitive slots
 * and builds sourceNames + conditionContext for full provenance +
 * condition evaluation.
 *
 * Cached per (characterId, target) for 30 seconds via the
 * character-resolver-cache LRU. PATCH/POST handlers call
 * bustResolverCache(characterId) to drop the cache.
 */

import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  primitives,
  capabilities,
  effects,
} from "@/db/schema";
import {
  type ModifierContribution,
  type ResolvedModifiers,
  type ResolvedPrimitiveSlot,
  type ResolvedCharacterInput,
  resolveModifiers,
} from "@/lib/engine/resolve-modifiers";
import { type ConditionContext } from "@/lib/engine/condition-evaluator";
import { type PracticeKey } from "@/types/modifier";
import { ALL_PRACTICES } from "@/types/modifier";
import {
  ATTR_TARGETS,
  SAVE_TARGETS,
  VITALITY_TARGETS,
  type Attribute,
  resolveAttributeModifier,
  resolveMaxVitality,
  resolveSaveDc,
  resolveSaveValue,
} from "@/lib/engine/target-registry";
import { proficiencyBonus } from "@/lib/engine/practices";
import {
  getResolverCache,
  setResolverCache,
} from "@/lib/cache/character-resolver-cache";

// =============================================================================
// Helpers
// =============================================================================

function attrKey(attr: Attribute): "physical" | "mental" | "magical" {
  return attr;
}

function isValidTarget(t: string): boolean {
  const valid = new Set<string>([
    ...Object.values(ATTR_TARGETS),
    ...Object.values(SAVE_TARGETS),
    ...Object.values(VITALITY_TARGETS),
    "character.attribute.physical",
    "character.attribute.mental",
    "character.attribute.magical",
    "character.defense.saveDc",
    "character.defense.physicalDc",
    "character.defense.mentalDc",
    "character.defense.magicalDc",
    "character.maxVitality",
    "character.currentVitality",
  ]);
  return valid.has(t);
}

function attrFromTarget(target: string): Attribute | null {
  if (target === "character.attribute.physical" || target === "character.defense.physicalDc") return "physical";
  if (target === "character.attribute.mental" || target === "character.defense.mentalDc") return "mental";
  if (target === "character.attribute.magical" || target === "character.defense.magicalDc") return "magical";
  if (target === "character.defense.saveDc") return "physical";
  return null;
}

// =============================================================================
// Route handler
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const targetFilter = url.searchParams.get("target");

  if (targetFilter && !isValidTarget(targetFilter)) {
    return NextResponse.json(
      { error: `Unknown target "${targetFilter}".` },
      { status: 400 },
    );
  }

  if (targetFilter) {
    const cached = getResolverCache(id, targetFilter);
    if (cached) {
      return NextResponse.json({ target: targetFilter, ...(cached as object) });
    }
  }

  const charRow = await db.query.characters.findFirst({
    where: eq(characters.id, id),
  });

  if (!charRow) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  // -----------------------------------------------------------------
  // Fetch ALL primitive slots for this character from
  // character_primitives, including those with origin_capability_id
  // or origin_effect_id set (Phase 8.I i3: capability-derived primitives).
  // -----------------------------------------------------------------
  const slotRows = await db
    .select({
      primitiveId: characterPrimitives.primitiveId,
      isMirrored: characterPrimitives.isMirrored,
      originHeritageId: characterPrimitives.originHeritageId,
      originCapabilityId: characterPrimitives.originCapabilityId,
      originEffectId: characterPrimitives.originEffectId,
      primitiveName: primitives.name,
      primitiveCategory: primitives.category,
      primitiveIsMirrorable: primitives.isMirrorable,
      primitiveMirrorVector: primitives.mirrorVector,
      primitiveHardModifiers: primitives.hardModifiers,
    })
    .from(characterPrimitives)
    .innerJoin(primitives, eq(primitives.id, characterPrimitives.primitiveId))
    .where(eq(characterPrimitives.characterId, id));

  const slots: ResolvedPrimitiveSlot[] = slotRows.map((row) => ({
    primitiveId: row.primitiveId,
    name: row.primitiveName,
    category: row.primitiveCategory,
    hardModifiers: (row.primitiveHardModifiers ?? []) as ResolvedPrimitiveSlot["hardModifiers"],
    isMirrored: row.isMirrored,
    isMirrorable: row.primitiveIsMirrorable,
    mirrorVector: row.primitiveMirrorVector,
    originHeritageId: row.originHeritageId,
    originCapabilityId: row.originCapabilityId,
    originEffectId: row.originEffectId,
  }));

  // -----------------------------------------------------------------
  // Phase 8.I i3: Build sourceNames lookup map for provenance.
  // Map primitiveId → { capabilityName, effectName, heritageName }.
  // -----------------------------------------------------------------
  const sourceNames = new Map<
    number,
    { heritageName: string | null; capabilityName: string | null; effectName: string | null }
  >();

  // Collect all unique capability/effect IDs from slots
  const capIds = new Set<string>();
  const effIds = new Set<string>();
  for (const slot of slots) {
    if (slot.originCapabilityId) capIds.add(slot.originCapabilityId);
    if (slot.originEffectId) effIds.add(slot.originEffectId);
  }

  // Batch lookup capability names
  const capNameMap = new Map<string, string>();
  if (capIds.size > 0) {
    const capRows = await db
      .select({ id: capabilities.id, name: capabilities.name })
      .from(capabilities)
      .where(inArray(capabilities.id, [...capIds]));
    for (const r of capRows) capNameMap.set(r.id, r.name);
  }

  // Batch lookup effect names
  const effNameMap = new Map<string, string>();
  if (effIds.size > 0) {
    const effRows = await db
      .select({ id: effects.id, name: effects.name })
      .from(effects)
      .where(inArray(effects.id, [...effIds]));
    for (const r of effRows) effNameMap.set(r.id, r.name);
  }

  // Build the sourceNames map
  for (const slot of slots) {
    if (slot.originHeritageId || slot.originCapabilityId || slot.originEffectId) {
      const capabilityName = slot.originCapabilityId ? (capNameMap.get(slot.originCapabilityId) ?? null) : null;
      const effectName = slot.originEffectId ? (effNameMap.get(slot.originEffectId) ?? null) : null;
      sourceNames.set(slot.primitiveId, {
        heritageName: null, // heritage name lookup requires another query — skip for now
        capabilityName,
        effectName,
      });
    }
  }

  // -----------------------------------------------------------------
  // Build conditionContext for condition-gated modifiers.
  // -----------------------------------------------------------------
  const maxVit = resolveMaxVitality({
    characterId: id,
    level: charRow.level,
    pb: proficiencyBonus(charRow.level),
    proficientAttribute: (charRow.attrProficient ?? null) as Attribute | null,
    attributes: {
      physical: charRow.attrPhysical,
      mental: charRow.attrMental,
      magical: charRow.attrMagical,
    },
    slots: [],
  }).total;

  const currentVit = charRow.currentVitality ?? maxVit;

  // Build proficiency flags and scan for proficient_in tokens
  const proficiencies = new Set<string>();
  if (charRow.attrProficient) {
    proficiencies.add(charRow.attrProficient.toLowerCase());
    proficiencies.add(charRow.attrProficient.toLowerCase() + "_proficiency");
  }

  // Scan condition tokens from ALL slots for proficiency flags
  const PRIOF_MATCH = /^self:proficient_in\((\w+)\)/;
  for (const slot of slots) {
    for (const mod of slot.hardModifiers) {
      const cond = mod.condition as unknown as { tokens?: string[] } | undefined;
      if (cond && Array.isArray(cond.tokens)) {
        for (const tok of cond.tokens) {
          const m = tok.match(PRIOF_MATCH);
          if (m && m[1]) {
            proficiencies.add(m[1]); // e.g. "fieldcraft"
          }
        }
      }
    }
  }

  // Build practice states (all 10 practices, default 0)
  const practiceStates = {} as Record<PracticeKey, number>;
  for (const key of ALL_PRACTICES) {
    practiceStates[key] = 0;
  }

  const conditionContext: ConditionContext = {
    character: {
      vitality: currentVit,
      vitalityMax: maxVit,
      saveDc: 0,
      blockValue: 0,
      attributes: {
        physical: charRow.attrPhysical,
        mental: charRow.attrMental,
        magical: charRow.attrMagical,
      },
      practices: practiceStates,
      proficiencies,
      flags: new Set(),
      custom: {},
    },
  };

  const input: ResolvedCharacterInput = {
    characterId: id,
    level: charRow.level,
    pb: proficiencyBonus(charRow.level),
    proficientAttribute: (charRow.attrProficient ?? null) as Attribute | null,
    attributes: {
      physical: charRow.attrPhysical,
      mental: charRow.attrMental,
      magical: charRow.attrMagical,
    },
    slots,
    conditionContext,
  };

  // -----------------------------------------------------------------
  // Single-target fast path
  // -----------------------------------------------------------------
  if (targetFilter) {
    const attr = attrFromTarget(targetFilter);
    let result: { total: number; contributions: readonly ModifierContribution[] };

    if (attr && targetFilter === ATTR_TARGETS[attrKey(attr)]) {
      result = resolveAttributeModifier(input, attr);
    } else if (attr && targetFilter === SAVE_TARGETS[attrKey(attr)]) {
      result = resolveSaveValue(input, attr);
    } else if (targetFilter === VITALITY_TARGETS.max) {
      result = resolveMaxVitality(input);
    } else if (targetFilter === VITALITY_TARGETS.current) {
      result = {
        total: charRow.currentVitality ?? 0,
        contributions: [],
      };
    } else {
      const full = resolveModifiers(input, sourceNames);
      result = {
        total: full.totals[targetFilter] ?? 0,
        contributions: full.byTarget[targetFilter] ?? [],
      };
    }

    let dc: number | undefined;
    if (attr && targetFilter === SAVE_TARGETS[attrKey(attr)]) {
      dc = resolveSaveDc(input, attr).total;
    }

    const payload = { total: result.total, contributions: result.contributions, dc };
    setResolverCache(id, targetFilter, payload);
    return NextResponse.json({ target: targetFilter, ...payload });
  }

  // -----------------------------------------------------------------
  // Full resolver (no target filter)
  // -----------------------------------------------------------------
  const resolved: ResolvedModifiers = resolveModifiers(input, sourceNames);
  return NextResponse.json({ characterId: id, resolved });
}
