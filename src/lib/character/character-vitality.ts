/**
 * character-vitality.ts — Phase 8.2 batch 2
 *
 * Server-side helpers for the vitality API. Computes the canonical
 * max vitality for a character by reading the character's level +
 * slotted primitives + items + heritages (anything that contributes
 * a vitality modifier). Used by:
 *
 *   - POST /api/characters/[id]/vitality (apply damage / heal)
 *   - POST /api/characters/[id]/rest (long / short)
 *
 * Important: this MUST agree with src/lib/engine/sheet.ts
 * (aggregateCharacterSheet) — if these two diverge, the sheet will
 * display "X / Y max" where X comes from one source and Y from
 * another. We re-use the same engine functions to keep parity.
 */

import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { characters } from "@/db/schema";

/**
 * Load every primitive + item that could carry a vitality modifier
 * for the given character, then compute max vitality the same way
 * `aggregateCharacterSheet` does.
 */
export async function loadCharacterMaxVitality(
  characterId: string,
): Promise<{ max: number; current: number }> {
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: {
      primitiveLinks: { with: { primitive: true } },
      itemLinks: { with: { item: true } },
    },
  });

  if (!row) {
    throw new Error(`Character ${characterId} not found.`);
  }

  const [{ readWorkspace }, { consequenceAdjustedSlots }, { resolveMaxVitality }, { proficiencyBonus, computeAllPracticeModifiers }] = await Promise.all([
    import('./workspace/read'), import('./consequences/resolve'), import('@/lib/engine/target-registry'), import('@/lib/engine/practices'),
  ]);
  const { characterConsequences } = await import('@/db/schema');
  const { and,isNull } = await import('drizzle-orm');
  const records=await db.select().from(characterConsequences).where(and(eq(characterConsequences.characterId,characterId),isNull(characterConsequences.deletedAt)));
  const graph=await readWorkspace(characterId);
  const slots=consequenceAdjustedSlots(row.primitiveLinks.map(l=>({
    instanceId:l.instanceId,directSource:l.directSource,primitiveId:l.primitiveId,name:l.primitive.name,category:l.primitive.category,
    isMirrored:l.isMirrored,isMirrorable:l.primitive.isMirrorable,mirrorVector:l.primitive.mirrorVector,
    hardModifiers:l.primitive.consequenceBehavior?[]:l.primitive.hardModifiers??[],originHeritageId:l.originHeritageId,originCapabilityId:l.originCapabilityId,originEffectId:l.originEffectId,originItemId:l.originItemId,
  })),graph,records.map(r=>r.occurrence));
  const input={characterId,level:row.level,pb:proficiencyBonus(row.level),proficientAttribute:row.attrProficient?.toLowerCase() as 'physical'|'mental'|'magical'|null,attributes:{physical:row.attrPhysical,mental:row.attrMental,magical:row.attrMagical},slots};
  const base=resolveMaxVitality({...input,slots:[]}).total;
  const practices=Object.fromEntries(computeAllPracticeModifiers(input.attributes,row.practiceSlices??{},row.attrProficient,row.level).map(p=>[p.practice,p.total])) as import('@/lib/engine/condition-evaluator').PracticeState;
  const max=Math.max(0,Math.ceil(resolveMaxVitality({...input,conditionContext:{character:{vitality:row.currentVitality??base,vitalityMax:base,attributes:input.attributes,practices,saveDc:5+input.pb+(input.proficientAttribute?input.attributes[input.proficientAttribute]:0),blockValue:0,proficiencies:new Set(input.proficientAttribute?[input.proficientAttribute]:[]),flags:new Set(),custom:{}}}}).total));
  return {max,current:row.currentVitality??max};
}

/**
 * Clamp a candidate vitality value to [0, max]. Mashu's policy
 * (2026-07-22): "I should not be able to heal past max vitality
 * nor take damage below 0 ... clamping or whatever". We clamp
 * silently rather than 400 — see comment in route handler.
 */
export function clampVitality(next: number, max: number): number {
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(max, Math.floor(next)));
}