/**
 * Character bundle saver — Phase 8.4 v18 (Mashu 2026-07-28).
 *
 * Why this exists
 * ===============
 * The POST /api/characters route already does the full bundle
 * expansion: walk the modal's slot list, fetch each heritage +
 * direct-capability bundle from the DB, run expandBundles(),
 * and write the resulting rows into character_heritages /
 * character_capabilities / character_primitives / character_items.
 *
 * The PATCH /api/characters/[id] route only handled the FLAT
 * legacy arrays (primitiveIds / capabilityIds / itemIds). It
 * never touched character_heritages. Mashu 2026-07-28:
 * "I entered edit mode. I removed all the heritages. I saved.
 * And in capabilities tab they are still there." — because PATCH
 * ignored heritage changes entirely.
 *
 * This module is the single source of truth for "given an
 * expansion input + a target characterId, write the canonical
 * junction rows". Both POST and PATCH call it. If you change
 * the persistence logic, change it here.
 *
 * The helper takes a Drizzle transaction (`tx`) so both routes
 * can compose it with their own pre/post work (POST inserts the
 * character row first; PATCH updates the character row first).
 */

import { and, eq, inArray } from "drizzle-orm";
import type { db as DbType } from "@/db/client";
import {
  capabilityEffects,
  capabilityPrimitives,
  characterCapabilities,
  characterHeritages,
  characterItems,
  characterPrimitives,
  effects,
  effectPrimitives,
  heritage,
  heritageCapabilities,
  heritagePrimitives,
  primitives,
  capabilities,
  items,
} from "@/db/schema";
import {
  expandBundles,
  type BundleExpansionInput,
  type BundleExpansionResult,
} from "@/lib/engine/bundle-expander";
import { validateMirrorSet } from "@/lib/api/volatility";
import {
  resolveLatestVersionId,
  resolveSlotSource,
} from "@/lib/versions/slot-source";

// Inferred transaction type (Drizzle doesn't export a clean Tx alias).
type DbClient = typeof DbType;
type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/**
 * Same shape as the POST/PATCH body fields:
 *   - heritages: array of heritageIds the user has slotted
 *   - primitivesBySource / capabilitiesBySource: { LINEAGE: [...], UPBRINGING: [...], MANIFEST: [...], PERSONAL: [...] }
 *   - itemsBySource: { PERSONAL: [{id, quantity}] } (item BU doesn't count; separate from primitives)
 *   - primitiveInstances: per-instance shape from Phase 8.3b
 *     (multiple direct-paid copies of the same primitiveId stack)
 *
 * `level` is the character's effective level — used for
 * acquiredAtLevel on the junction rows and for mirror-ceiling
 * validation.
 *
 * `callerUserId` is the authenticated user's id (used to compute
 * `slotSource` per row).
 */
export interface CharacterBundleInput {
  userId: string;
  characterId: string;
  level: number;
  heritages: string[];
  primitivesBySource: Record<string, Array<{ id: number; isMirrored: boolean }>>;
  capabilitiesBySource: Record<string, Array<{ id: string; isMirrored: boolean }>>;
  itemsBySource: Record<string, Array<{ id: string; quantity: number; equipped?: boolean }>>;
  primitiveInstances?: Array<{ primitiveId: number; isMirrored: boolean }>;
}

/**
 * Runs the bundle expansion for a character, writes the
 * expanded rows into the canonical junction tables, and
 * returns the raw expansion result so the caller can use
 * it (e.g. derive lineageName from the slotted heritage).
 *
 * Validation: this function performs the mirror-ceiling check
 * against the EXPANDED primitive set (heritage bundle
 * mirror-vector primitives count). If the check fails, it
 * throws — the caller's transaction is rolled back.
 *
 * Within a transaction: this function deletes the existing
 * rows for character_heritages / character_capabilities /
 * character_primitives / character_items and re-inserts from
 * the expansion output. (Items aren't expanded — they're
 * written straight from itemsBySource.)
 */
export async function saveCharacterBundles(
  tx: Tx,
  input: CharacterBundleInput,
): Promise<BundleExpansionResult> {
  // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — save regression
  // debug. Log the input shape so we can see what the modal
  // actually sent. Mashu's repro: "I added a cap via modal,
  // saved, cap not persisted, BU counted it briefly." If we
  // see the cap here, the issue is downstream.
  console.log(
    `[saveCharacterBundles ${input.characterId}] input:`,
    {
      level: input.level,
      heritageCount: input.heritages.length,
      heritageIds: input.heritages,
      capCountsBySource: Object.fromEntries(
        Object.entries(input.capabilitiesBySource).map(([k, v]) => [k, v.length]),
      ),
      capIdsBySource: Object.fromEntries(
        Object.entries(input.capabilitiesBySource).map(([k, v]) => [
          k,
          v.map((c) => c.id),
        ]),
      ),
      itemCountsBySource: Object.fromEntries(
        Object.entries(input.itemsBySource).map(([k, v]) => [k, v.length]),
      ),
    },
  );
  const {
    userId,
    characterId,
    level,
    heritages: rawHeritages,
    primitivesBySource: rawPrimBySource,
    capabilitiesBySource: rawCapsBySource,
    itemsBySource: rawItemsBySource,
    primitiveInstances = [],
  } = input;

  // -----------------------------------------------------------------
  // 1. Build the BundleExpansionInput.
  // -----------------------------------------------------------------
  const expansionInput: BundleExpansionInput = {
    heritages: [],
    capabilities: [],
    effects: [],
    primitives: [],
  };

  // Direct primitive slots from primitivesBySource (legacy grouped shape).
  for (const [source, list] of Object.entries(rawPrimBySource)) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const id = Number(e["id"]);
      if (!Number.isInteger(id) || id <= 0) continue;
      expansionInput.primitives.push({
        primitiveId: id,
        source: source as BundleExpansionInput["primitives"][number]["source"],
        isMirrored: Boolean(e["isMirrored"]),
      });
    }
  }

  // primitiveInstances (Phase 8.3b) — each entry is its own expansion row.
  for (const inst of primitiveInstances) {
    expansionInput.primitives.push({
      primitiveId: inst.primitiveId,
      source: "PERSONAL",
      isMirrored: inst.isMirrored,
    });
  }

  // Direct capability slots from capabilitiesBySource.
  const directCapabilityIdsBySource: Array<{
    id: string;
    source: BundleExpansionInput["capabilities"][number]["source"];
  }> = [];
  for (const [source, list] of Object.entries(rawCapsBySource)) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const id = String(e["id"]);
      if (!id) continue;
      directCapabilityIdsBySource.push({
        id,
        source: source as BundleExpansionInput["capabilities"][number]["source"],
      });
    }
  }

  // -----------------------------------------------------------------
  // 2. Fetch heritage bundles (kind + primitiveLinks + capabilityLinks
  //    with their own primitiveLinks + effectLinks with primitiveLinks).
  //    Same shape as POST uses.
  // -----------------------------------------------------------------
  if (rawHeritages.length > 0) {
    const heritageRows = await tx
      .select({
        id: heritage.id,
        kind: heritage.kind,
      })
      .from(heritage)
      .where(inArray(heritage.id, rawHeritages));

    const primLinksByHeritage = new Map<
      string,
      Array<{ primitiveId: number; isMirrored: boolean }>
    >();
    const capLinksByHeritage = new Map<string, Array<{ capabilityId: string }>>();
    const hpRows = await tx
      .select({
        templateId: heritagePrimitives.templateId,
        primitiveId: heritagePrimitives.primitiveId,
        isMirrored: heritagePrimitives.isMirrored,
      })
      .from(heritagePrimitives)
      .where(inArray(heritagePrimitives.templateId, rawHeritages));
    for (const r of hpRows) {
      const list = primLinksByHeritage.get(r.templateId) ?? [];
      list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
      primLinksByHeritage.set(r.templateId, list);
    }
    const hcRows = await tx
      .select({
        templateId: heritageCapabilities.templateId,
        capabilityId: heritageCapabilities.capabilityId,
      })
      .from(heritageCapabilities)
      .where(inArray(heritageCapabilities.templateId, rawHeritages));
    for (const r of hcRows) {
      const list = capLinksByHeritage.get(r.templateId) ?? [];
      list.push({ capabilityId: r.capabilityId });
      capLinksByHeritage.set(r.templateId, list);
    }

    // Capability bundles within heritages
    const allHeritageCapabilityIds = Array.from(
      new Set(hcRows.map((r) => r.capabilityId)),
    );
    const capPrimLinksByCap = new Map<
      string,
      Array<{ primitiveId: number; isMirrored: boolean }>
    >();
    if (allHeritageCapabilityIds.length > 0) {
      const cpRows = await tx
        .select({
          capabilityId: capabilityPrimitives.capabilityId,
          primitiveId: capabilityPrimitives.primitiveId,
          isMirrored: capabilityPrimitives.isMirrored,
        })
        .from(capabilityPrimitives)
        .where(inArray(capabilityPrimitives.capabilityId, allHeritageCapabilityIds));
      for (const r of cpRows) {
        const list = capPrimLinksByCap.get(r.capabilityId) ?? [];
        list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
        capPrimLinksByCap.set(r.capabilityId, list);
      }
    }

    const capEffLinksByCap = new Map<string, Array<{ effectId: string }>>();
    if (allHeritageCapabilityIds.length > 0) {
      const ceRows = await tx
        .select({
          capabilityId: capabilityEffects.capabilityId,
          effectId: capabilityEffects.effectId,
        })
        .from(capabilityEffects)
        .where(inArray(capabilityEffects.capabilityId, allHeritageCapabilityIds));
      for (const r of ceRows) {
        const list = capEffLinksByCap.get(r.capabilityId) ?? [];
        list.push({ effectId: r.effectId });
        capEffLinksByCap.set(r.capabilityId, list);
      }
    }

    // Effect primitive links
    const allEffectIds = Array.from(
      new Set(
        Array.from(capEffLinksByCap.values()).flatMap((l) =>
          l.map((x) => x.effectId),
        ),
      ),
    );
    const effectPrimLinksByEffect = new Map<
      string,
      Array<{ primitiveId: number; isMirrored: boolean }>
    >();
    if (allEffectIds.length > 0) {
      const epRows = await tx
        .select({
          effectId: effectPrimitives.effectId,
          primitiveId: effectPrimitives.primitiveId,
          isMirrored: effectPrimitives.isMirrored,
        })
        .from(effectPrimitives)
        .where(inArray(effectPrimitives.effectId, allEffectIds));
      for (const r of epRows) {
        const list = effectPrimLinksByEffect.get(r.effectId) ?? [];
        list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
        effectPrimLinksByEffect.set(r.effectId, list);
      }
    }

    for (const row of heritageRows) {
      expansionInput.heritages.push({
        id: row.id,
        kind: row.kind as "LINEAGE" | "UPBRINGING" | "MANIFEST",
        primitiveLinks: (primLinksByHeritage.get(row.id) ?? []).map((p) => ({
          primitiveId: p.primitiveId,
          isMirrored: p.isMirrored,
        })),
        capabilityLinks: (capLinksByHeritage.get(row.id) ?? []).map((c) => ({
          capabilityId: c.capabilityId,
          primitiveLinks: (capPrimLinksByCap.get(c.capabilityId) ?? []).map(
            (p) => ({
              primitiveId: p.primitiveId,
              isMirrored: p.isMirrored,
            }),
          ),
          effectLinks: (capEffLinksByCap.get(c.capabilityId) ?? []).map(
            (e) => ({
              effectId: e.effectId,
              primitiveLinks: (
                effectPrimLinksByEffect.get(e.effectId) ?? []
              ).map((p) => ({
                primitiveId: p.primitiveId,
                isMirrored: p.isMirrored,
              })),
            }),
          ),
        })),
      });
    }
  }

  // -----------------------------------------------------------------
  // 3. Direct capability bundles (not inside any heritage).
  // -----------------------------------------------------------------
  const directCapsOnly = directCapabilityIdsBySource.filter(
    (c) =>
      !expansionInput.heritages.some((h) =>
        h.capabilityLinks.some((cl) => cl.capabilityId === c.id),
      ),
  );
  if (directCapsOnly.length > 0) {
    const directCapIds = directCapsOnly.map((c) => c.id);
    const cpRows = await tx
      .select({
        capabilityId: capabilityPrimitives.capabilityId,
        primitiveId: capabilityPrimitives.primitiveId,
        isMirrored: capabilityPrimitives.isMirrored,
      })
      .from(capabilityPrimitives)
      .where(inArray(capabilityPrimitives.capabilityId, directCapIds));
    const directCapPrimLinks = new Map<
      string,
      Array<{ primitiveId: number; isMirrored: boolean }>
    >();
    for (const r of cpRows) {
      const list = directCapPrimLinks.get(r.capabilityId) ?? [];
      list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
      directCapPrimLinks.set(r.capabilityId, list);
    }
    const ceRows = await tx
      .select({
        capabilityId: capabilityEffects.capabilityId,
        effectId: capabilityEffects.effectId,
      })
      .from(capabilityEffects)
      .where(inArray(capabilityEffects.capabilityId, directCapIds));
    const directCapEffLinks = new Map<string, Array<{ effectId: string }>>();
    for (const r of ceRows) {
      const list = directCapEffLinks.get(r.capabilityId) ?? [];
      list.push({ effectId: r.effectId });
      directCapEffLinks.set(r.capabilityId, list);
    }
    const directEffectIds = Array.from(
      new Set(
        Array.from(directCapEffLinks.values()).flatMap((l) =>
          l.map((x) => x.effectId),
        ),
      ),
    );
    const directEffPrimLinks = new Map<
      string,
      Array<{ primitiveId: number; isMirrored: boolean }>
    >();
    if (directEffectIds.length > 0) {
      const epRows = await tx
        .select({
          effectId: effectPrimitives.effectId,
          primitiveId: effectPrimitives.primitiveId,
          isMirrored: effectPrimitives.isMirrored,
        })
        .from(effectPrimitives)
        .where(inArray(effectPrimitives.effectId, directEffectIds));
      for (const r of epRows) {
        const list = directEffPrimLinks.get(r.effectId) ?? [];
        list.push({ primitiveId: r.primitiveId, isMirrored: r.isMirrored });
        directEffPrimLinks.set(r.effectId, list);
      }
    }
    for (const c of directCapsOnly) {
      expansionInput.capabilities.push({
        id: c.id,
        source: c.source,
        primitiveLinks: (directCapPrimLinks.get(c.id) ?? []).map((p) => ({
          primitiveId: p.primitiveId,
          isMirrored: p.isMirrored,
        })),
        effectLinks: (directCapEffLinks.get(c.id) ?? []).map((e) => ({
          effectId: e.effectId,
          primitiveLinks: (directEffPrimLinks.get(e.effectId) ?? []).map(
            (p) => ({
              primitiveId: p.primitiveId,
              isMirrored: p.isMirrored,
            }),
          ),
        })),
      });
    }
  }

  // -----------------------------------------------------------------
  // 4. Run the expander.
  // -----------------------------------------------------------------
  const expansion = expandBundles(expansionInput);

  // -----------------------------------------------------------------
  // 5. Validate volatility ceiling BEFORE writing.
  // -----------------------------------------------------------------
  const volCheck = await validateMirrorSet(
    level,
    expansion.primitives.filter((p) => p.isMirrored).map((p) => p.primitiveId),
    expansion.primitives.map((p) => p.primitiveId),
  );
  if (!volCheck.ok) {
    throw new CharacterBundleVolatilityError({
      ok: false,
      status: volCheck.status,
      error: volCheck.error,
      ceiling: volCheck.ceiling,
      rating: String(volCheck.rating),
      bracket: volCheck.bracket,
      offendingPrimitiveId: volCheck.offendingPrimitiveId,
    });
  }

  // -----------------------------------------------------------------
  // 6. Delete existing junction rows for this character.
  // -----------------------------------------------------------------
  await tx.delete(characterHeritages).where(eq(characterHeritages.characterId, characterId));
  await tx.delete(characterCapabilities).where(eq(characterCapabilities.characterId, characterId));
  await tx.delete(characterPrimitives).where(eq(characterPrimitives.characterId, characterId));
  await tx.delete(characterItems).where(eq(characterItems.characterId, characterId));

  // -----------------------------------------------------------------
  // 7. Write expanded primitives (with version_id + slot_source).
  // -----------------------------------------------------------------
  if (expansion.primitives.length > 0) {
    const primRows = await tx
      .select({
        id: primitives.id,
        userId: primitives.userId,
        sourceOrigin: primitives.sourceOrigin,
      })
      .from(primitives)
      .where(
        inArray(
          primitives.id,
          expansion.primitives.map((p) => p.primitiveId),
        ),
      );
    const primMap = new Map(primRows.map((r) => [r.id, r]));
    const slotsWithVersion = await Promise.all(
      expansion.primitives.map(async (p) => {
        const prim = primMap.get(p.primitiveId);
        const versionId = await resolveLatestVersionId(
          "primitive",
          p.primitiveId,
        );
        const slotSource = prim
          ? resolveSlotSource({
              entity: prim,
              callerUserId: userId,
            })
          : "PINNED";
        return {
          characterId,
          primitiveId: p.primitiveId,
          source: p.source,
          acquiredAtLevel: level,
          isMirrored: p.isMirrored,
          versionId,
          slotSource,
          originHeritageId: p.originHeritageId,
          originCapabilityId: p.originCapabilityId,
          originEffectId: p.originEffectId,
        };
      }),
    );
    await tx.insert(characterPrimitives).values(slotsWithVersion);
  }

  // -----------------------------------------------------------------
  // 8. Write expanded capabilities (with version_id + slot_source +
  //    originHeritageId).
  // -----------------------------------------------------------------
  // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — save regression
  // debug. Log exactly which capabilities (with source +
  // originHeritageId) are about to be inserted. Mashu's repro:
  // "I added a cap via modal, saved, cap not persisted, BU
  // counted it briefly." If we see the cap here but it doesn't
  // show up in the sheet, the issue is downstream (sheet fetch
  // or seed). If we DON'T see it, the issue is upstream (modal
  // PATCH body or capabilitiesBySource parsing).
  if (expansion.capabilities.length > 0) {
    console.log(
      `[saveCharacterBundles ${characterId}] writing ${expansion.capabilities.length} capability slot(s):`,
      expansion.capabilities.map((c) => ({
        id: c.capabilityId,
        source: c.source,
        originHeritageId: c.originHeritageId,
        originPath: c.originPath,
      })),
    );
  }
  if (expansion.capabilities.length > 0) {
    const capRows = await tx
      .select({
        id: capabilities.id,
        userId: capabilities.userId,
        sourceOrigin: capabilities.sourceOrigin,
      })
      .from(capabilities)
      .where(
        inArray(
          capabilities.id,
          expansion.capabilities.map((c) => c.capabilityId),
        ),
      );
    const capMap = new Map(capRows.map((r) => [r.id, r]));
    const slotsWithVersion = await Promise.all(
      expansion.capabilities.map(async (c) => {
        const cap = capMap.get(c.capabilityId);
        const versionId = await resolveLatestVersionId(
          "capability",
          c.capabilityId,
        );
        const slotSource = cap
          ? resolveSlotSource({
              entity: cap,
              callerUserId: userId,
            })
          : "PINNED";
        return {
          characterId,
          capabilityId: c.capabilityId,
          acquiredAtLevel: level,
          versionId,
          slotSource,
          originHeritageId: c.originHeritageId,
        };
      }),
    );
    // Phase 8.4 v24.5 (Mashu 2026-07-29): T5 — log insert.
    // If this throws (PK violation, FK violation, etc.), the
    // whole transaction rolls back and we lose ALL slot writes
    // (primitives, heritages, items). That would explain
    // "BU recalculated correctly to not include it" if the
    // user was looking at a stale cached footer.
    try {
      await tx.insert(characterCapabilities).values(slotsWithVersion);
      console.log(
        `[saveCharacterBundles ${characterId}] capability insert OK:`,
        slotsWithVersion.map((s) => s.capabilityId),
      );
    } catch (insertErr) {
      console.error(
        `[saveCharacterBundles ${characterId}] capability insert FAILED:`,
        insertErr instanceof Error
          ? { message: insertErr.message, cause: insertErr.cause }
          : insertErr,
        slotsWithVersion,
      );
      throw insertErr;
    }
  }

  // -----------------------------------------------------------------
  // 9. Write heritages (with version_id).
  // -----------------------------------------------------------------
  if (expansion.heritages.length > 0) {
    const heritageRowsData = await Promise.all(
      expansion.heritages.map(async (h) => {
        const versionId = await resolveLatestVersionId(
          "template",
          h.heritageId,
        );
        return {
          characterId,
          heritageId: h.heritageId,
          acquiredAtLevel: level,
          isMirrored: h.isMirrored,
          versionId,
          slotSource: "PINNED" as const,
        };
      }),
    );
    await tx.insert(characterHeritages).values(heritageRowsData);
  }

  // -----------------------------------------------------------------
  // 10. Write items (no expansion — items don't bring primitives).
  // -----------------------------------------------------------------
  // Phase 8.4 v20 (Mashu 2026-07-29): defensive dedupe. If a
  // caller ever passes a duplicated (character_id, item_id)
  // pair in itemsBySource (e.g. from a buggy upstream), collapse
  // to the first occurrence. character_items PK is
  // (character_id, item_id), so duplicates crash the insert.
  const expandedItemIds: Array<{
    id: string;
    quantity: number;
    equipped: boolean;
  }> = [];
  const seenItemIds = new Set<string>();
  for (const [, list] of Object.entries(rawItemsBySource)) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const id = String(e["id"]);
      if (!id) continue;
      if (seenItemIds.has(id)) continue; // dedupe (see T1 above)
      seenItemIds.add(id);
      const q = Number(e["quantity"] ?? 1);
      expandedItemIds.push({
        id,
        quantity: Number.isInteger(q) && q > 0 ? q : 1,
        // Phase 8.4 v21 (Mashu 2026-07-29): T2 — equipped flag.
        // Defaults to false when missing (older callers).
        equipped: Boolean(e["equipped"]),
      });
    }
  }
  if (expandedItemIds.length > 0) {
    const itemRows = await tx
      .select({
        id: items.id,
        userId: items.userId,
        sourceOrigin: items.sourceOrigin,
      })
      .from(items)
      .where(inArray(items.id, expandedItemIds.map((i) => i.id)));
    const itemMap = new Map(itemRows.map((r) => [r.id, r]));
    const slotsWithVersion = await Promise.all(
      expandedItemIds.map(async (iid) => {
        const item = itemMap.get(iid.id);
        const versionId = await resolveLatestVersionId("item", iid.id);
        const slotSource = item
          ? resolveSlotSource({
              entity: item,
              callerUserId: userId,
            })
          : "PINNED";
        return {
          characterId,
          itemId: iid.id,
          quantity: iid.quantity,
          // Phase 8.4 v21 (Mashu 2026-07-29): T2 — equipped.
          // character_items.equipped has a default of false
          // in the schema; we explicitly write the user's
          // chosen value here so the modal save round-trips
          // correctly.
          equipped: iid.equipped,
          versionId,
          slotSource,
        };
      }),
    );
    await tx.insert(characterItems).values(slotsWithVersion);
  }

  return expansion;
}

/**
 * Thrown when the mirror-set validation fails. The caller
 * (POST/PATCH) catches this and returns a 400 with the
 * volatility ceiling details.
 */
export class CharacterBundleVolatilityError extends Error {
  readonly volCheck: {
    ok: false;
    error: string;
    status: number;
    ceiling: number;
    rating: string;
    bracket: string;
    offendingPrimitiveId: number | null;
  };

  constructor(
    volCheck: {
      ok: false;
      error: string;
      status: number;
      ceiling: number;
      rating: string;
      bracket: string;
      offendingPrimitiveId: number | null;
    },
  ) {
    super(volCheck.error);
    this.volCheck = volCheck;
    this.name = "CharacterBundleVolatilityError";
  }
}