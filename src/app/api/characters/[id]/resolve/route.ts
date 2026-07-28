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
 * The resolver needs the character's slotted primitives + their
 * hard_modifiers + provenance. We fetch them via a single
 * Drizzle query (joins primitiveLinks.primitive), then build
 * `ResolvedCharacterInput` and call `resolveModifiers()` from
 * @/lib/engine/resolve-modifiers.
 *
 * Cached per (characterId, target) for 30 seconds via the
 * character-resolver-cache LRU. PATCH/POST handlers call
 * bustResolverCache(characterId) to drop the cache.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterPrimitives, primitives } from "@/db/schema";
import {
  type ModifierContribution,
  type ResolvedModifiers,
  type ResolvedPrimitiveSlot,
  resolveModifiers,
} from "@/lib/engine/resolve-modifiers";
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
  // Already lowercase; this is just for TS narrowing.
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

  // -----------------------------------------------------------------
  // Validate target param
  // -----------------------------------------------------------------
  if (targetFilter && !isValidTarget(targetFilter)) {
    return NextResponse.json(
      { error: `Unknown target "${targetFilter}".` },
      { status: 400 },
    );
  }

  // -----------------------------------------------------------------
  // Cache check (target-filtered only — the "all" form is less
  // common and cheaper to recompute).
  // -----------------------------------------------------------------
  if (targetFilter) {
    const cached = getResolverCache(id, targetFilter);
    if (cached) {
      return NextResponse.json({ target: targetFilter, ...(cached as object) });
    }
  }

  // -----------------------------------------------------------------
  // Fetch character + primitive slots
  // -----------------------------------------------------------------
  const charRow = await db.query.characters.findFirst({
    where: eq(characters.id, id),
  });

  if (!charRow) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

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

  // -----------------------------------------------------------------
  // Build ResolvedCharacterInput
  // -----------------------------------------------------------------
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

  // The DB stores attribute slices as 0-5 ints. The canonical
  // formula Math.floor((attr - 10) / 2) treats them as D&D-style
  // scores directly (PHYS=4 → -3, PHYS=5 → -2, etc.). We pass
  // the slice count through unchanged.
  const input = {
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
      // For save targets, "total" is the save VALUE (the d20
      // modifier the character adds). The provenance modal wants
      // the save-specific contributions, not the attribute mod.
      // We resolve save value here but include both attr-mod
      // contributions + save-target contributions for the modal.
      result = resolveSaveValue(input, attr);
    } else if (targetFilter === VITALITY_TARGETS.max) {
      result = resolveMaxVitality(input);
    } else if (targetFilter === VITALITY_TARGETS.current) {
      // Current vitality isn't computed by the resolver — it's
      // the character's tracked runtime value (a separate
      // /vitality endpoint mutates it). Return a stub.
      result = {
        total: charRow.currentVitality ?? 0,
        contributions: [],
      };
    } else {
      // Fallback: compute the whole resolver and pluck the target.
      const full = resolveModifiers(input);
      result = {
        total: full.totals[targetFilter] ?? 0,
        contributions: full.byTarget[targetFilter] ?? [],
      };
    }

    // For save targets, also include the DC so the modal can show
    // both the save VALUE (d20 modifier) and the DC (5 + PB + mod).
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
  const resolved: ResolvedModifiers = resolveModifiers(input);
  return NextResponse.json({ characterId: id, resolved });
}