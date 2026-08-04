import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { CharacterSheetView } from "@/components/characters/character-sheet-view";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { aggregateCharacterSheet } from "@/lib/engine";
import {
  bulkResolveLatestVersions,
  makeKey,
  type VersionKey,
} from "@/lib/versions/bulk-resolve-latest-versions";
import type { SlotSource } from "@/db/schema/characters";
import { parseBackstory } from "@/lib/character/character-backstory";
import { enrichItemLinksWithNestedBundle } from "@/lib/api/enrich-item-links";

export const dynamic = "force-dynamic";

export default async function CharacterSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
      // Phase 8.1 batch 13.1: include heritage slots for the origin
      // chain badges on the sheet.
      heritageLinks: { with: { heritage: true } },
      // Phase 8.2 batch 3: include the character's event log so the
      // History tab can render a timeline. Order newest-first.
      logEntries: {
        orderBy: (l, { desc }) => [desc(l.createdAt)],
        limit: 500,
      },
    },
  });

  if (!row) notFound();

  // Ownership: redirect to list if not owner
  if (userId && row.userId !== userId) {
    redirect("/characters");
  }

  // Phase 5 (T5.C.2): compute the latest version id for every linked
  // entity so the sheet can render "stale" badges. One bulk query per
  // entity kind, returns a Map keyed by `${kind}:${id}`.
  const entityPairs = [
    ...row.primitiveLinks.map((l) => ({ kind: "primitive" as const, id: l.primitiveId })),
    ...row.capabilityLinks.map((l) => ({ kind: "capability" as const, id: l.capabilityId })),
    ...row.itemLinks.map((l) => ({ kind: "item" as const, id: l.itemId })),
    // Phase 8.5 / Session H6 round 7 (Mashu
    // 2026-08-03): include heritages so the
    // HeritageBundleView header can render the
    // SlotSourceBadge with a real latest version id
    // (not just the slot's pinned versionId).
    ...(row as unknown as { heritageLinks?: Array<{ heritageId: string }> })
      .heritageLinks?.map((l) => ({ kind: "heritage" as const, id: l.heritageId })) ?? [],
  ];
  const latestVersions = await bulkResolveLatestVersions(entityPairs);

  // Phase 8.4 v22 (Mashu 2026-07-29): T2 followup — enrich
  // itemLinks with the nested bundle via flat queries.
  // Same helper the modal uses; safe because it's a
  // separate roundtrip (no depth-N Drizzle joins).
  await enrichItemLinksWithNestedBundle(row.itemLinks);

  const sheet = aggregateCharacterSheet({
    level: row.level,
    attrPhysical: row.attrPhysical,
    attrMental: row.attrMental,
    attrMagical: row.attrMagical,
    attrProficient: row.attrProficient,
    practiceSlices:
      (row.practiceSlices as Record<string, number> | null) ?? null,
    startingBu: row.startingBu,
    buSpent: row.buSpent,
    dmBonusBu: row.dmBonusBu,
    currentVitality: row.currentVitality,
    size: row.size,
    primitiveLinks: row.primitiveLinks.map((l) => ({
      primitiveId: l.primitive.id,
      source: l.source,
      acquiredAtLevel: l.acquiredAtLevel,
      isMirrored: l.isMirrored ?? false,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("primitive", l.primitiveId)) ?? null,
      // Phase 8.1 batch 13.1: bundle-origin tracking — passed through
      // to SheetPrimitiveLink so the sheet can show "from Lineage 'Elf'"
      // / "from capability 'Fireball'" breadcrumbs.
      originHeritageId: l.originHeritageId ?? null,
      originCapabilityId: l.originCapabilityId ?? null,
      originEffectId: l.originEffectId ?? null,
      primitive: {
        id: l.primitive.id,
        name: l.primitive.name,
        category: l.primitive.category,
        buCost: l.primitive.buCost,
        isMirrorable: l.primitive.isMirrorable,
        mirrorBuCredit: l.primitive.mirrorBuCredit,
        narrativeRule: l.primitive.narrativeRule ?? "",
        // Phase 8.3f S4 (Mashu 2026-07-28): mirrorVector needed
        // by the resolver to apply the correct mirror semantics
        // (VARIABLE_VECTOR flips sign, STRUCTURAL_FAULT preserves
        // magnitude, COST_INSTABILITY adds user-side cost).
        mirrorVector: l.primitive.mirrorVector,
        // Phase 8.3d (Mashu 2026-07-27): include hardModifiers in
        // the aggregator's primitive shape. The aggregator doesn't
        // use them today, but the type requires it. 8.3d commit 2
        // will render them via ConditionBadges on the sheet.
        hardModifiers: l.primitive.hardModifiers ?? [],
      },
    })),
    capabilityLinks: row.capabilityLinks.map((l) => ({
      capabilityId: l.capabilityId,
      acquiredAtLevel: l.acquiredAtLevel,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("capability", l.capabilityId)) ?? null,
      // Phase 8.1 batch 13.1: capability origin (the heritage that
      // brought it in, if any).
      originHeritageId: l.originHeritageId ?? null,
      capability: {
        id: l.capability.id,
        name: l.capability.name,
        type: l.capability.type,
        sourceType: l.capability.sourceType,
        verboseDescription: l.capability.verboseDescription,
      },
    })),
    itemLinks: row.itemLinks.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      equipped: l.equipped,
      // Phase 5: surface slot metadata to the view.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: latestVersions.get(makeKey("item", l.itemId)) ?? null,
      item: {
        id: l.item.id,
        name: l.item.name,
        itemType: l.item.itemType,
        rarity: l.item.rarity,
        description: l.item.description,
        buCost: l.item.buCost,
        slotCost: l.item.slotCost,
        isTwoHanded: l.item.isTwoHanded,
        isConsumable: l.item.isConsumable,
        // Phase 8.5 / Session H6 round 6 (Mashu
        // 2026-08-03): the loader must forward
        // `size` to the engine — without it the
        // sheet.ts encumbrance calculator falls
        // back to ITEM_SIZE_DEFAULT = SMALL, so a
        // LARGE Claymore computes Load=1 instead of
        // Load=4. Round-5 caught this in the chip,
        // round-6 catches it in the items-tab header.
        size: l.item.size ?? undefined,
        // Phase 8.5 / Session H6 (Mashu 2026-08-03):
        // carried-but-not-equippable. Default false for
        // legacy characters (rows created before migration
        // 0051). The modal's ItemsTab uses this to hide
        // the Equip button on potions / scrolls / ammo.
        isNotEquippable: l.item.isNotEquippable ?? false,
      },
    })),
  });

  return (
    <CharacterSheetView
      id={row.id}
      name={row.name}
      level={row.level}
      size={row.size}
      portraitUrl={row.portraitUrl}
      notes={row.notes}
      dmNotes={row.dmNotes}
      lineageName={row.lineageName}
      lineageDescription={row.lineageDescription}
      upbringingName={row.upbringingName}
      upbringingDescription={row.upbringingDescription}
      manifestName={row.manifestName}
      attrPhysical={row.attrPhysical}
      attrMental={row.attrMental}
      attrMagical={row.attrMagical}
      attrProficient={row.attrProficient}
      startingBu={row.startingBu}
      buSpent={row.buSpent}
      dmBonusBu={row.dmBonusBu}
      currentVitality={row.currentVitality}
      enforceTemplateCaps={row.enforceTemplateCaps}
      volatility={sheet.volatility}
      practices={sheet.practices.map((p) => {
        const attr = sheet.practiceAttributeMap.PHYSICAL.includes(p.practice as never)
          ? "PHYSICAL"
          : sheet.practiceAttributeMap.MENTAL.includes(p.practice as never)
            ? "MENTAL"
            : "MAGICAL";
        return {
          practice: p.practice,
          attribute: attr,
          total: p.total,
          slice: p.slice,
          pbContribution: p.pbContribution,
          primitiveContributions: p.primitiveContributions.map((pc) => ({
            primitiveId: pc.primitiveId,
            primitiveName: pc.primitiveName,
            bonus: pc.bonus,
          })),
        };
      })}
      defensiveDCs={sheet.defensiveDCs.map((d) => ({
        attribute: d.attribute,
        dc: d.dc,
      }))}
      vitality={sheet.vitality}
      encumbrance={sheet.encumbrance}
      buBalance={sheet.buBalance}
      primitiveLinks={row.primitiveLinks.map((l) => ({
        primitiveId: l.primitiveId,
        source: l.source,
        acquiredAtLevel: l.acquiredAtLevel,
        isMirrored: l.isMirrored ?? false,
        // Phase 5: surface slot metadata to the view.
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: latestVersions.get(makeKey("primitive", l.primitiveId)) ?? null,
        // Phase 8.1 batch 13.1: origin tracking for bundle-expanded primitives.
        originHeritageId: l.originHeritageId ?? null,
        originCapabilityId: l.originCapabilityId ?? null,
        originEffectId: l.originEffectId ?? null,
        primitive: {
          id: l.primitive.id,
          name: l.primitive.name,
          category: l.primitive.category,
          buCost: l.primitive.buCost,
          isMirrorable: l.primitive.isMirrorable,
          mirrorBuCredit: l.primitive.mirrorBuCredit,
          narrativeRule: l.primitive.narrativeRule ?? "",
          // Phase 8.3f S4 (Mashu 2026-07-28): mirrorVector needed
          // by the resolver to apply the correct mirror semantics
          // (VARIABLE_VECTOR flips sign, STRUCTURAL_FAULT preserves
          // magnitude, COST_INSTABILITY adds user-side cost).
          mirrorVector: l.primitive.mirrorVector,
          // Phase 8.3d (Mashu 2026-07-27): surface the primitive's
          // hard_modifiers JSONB so the character sheet can render
          // each modifier's condition as a pill badge. The column
          // is on the primitive row (not the link row), defaults
          // to [] if not authored. The downstream component
          // (ConditionBadges) parses both legacy and v1 condition
          // shapes, so we pass through the raw array.
          hardModifiers: l.primitive.hardModifiers ?? [],
        },
      }))}
      capabilityLinks={row.capabilityLinks.map((l) => {
        // Phase 8.4 v5 (Mashu 2026-07-28): capability.effectLinks
        // is joined from the API but the TS inference for
        // l.capability doesn't include it by default. Cast
        // through a local to keep the rest of the code clean.
        const cap = l.capability as typeof l.capability & {
          effectLinks?: Array<{
            effectId: string;
            effect: { id: string; name: string; description: string | null };
          }>;
        };
        return {
          capabilityId: l.capabilityId,
          acquiredAtLevel: l.acquiredAtLevel,
          versionId: l.versionId,
          slotSource: l.slotSource,
          latestVersionId: latestVersions.get(makeKey("capability", l.capabilityId)) ?? null,
          originHeritageId: l.originHeritageId ?? null,
          // Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab
          // accordion routing. Normalise legacy null rows
          // (pre-v24.6) to MANIFEST — the sheet's
          // HeritageKindAccordion expects a strict string.
          slotTab: l.slotTab ?? "MANIFEST",
          effectLinks: (cap.effectLinks ?? []).map((el) => ({
            effectId: el.effectId,
            effect: {
              id: el.effect.id,
              name: el.effect.name,
              description: el.effect.description ?? "",
            },
          })),
          capability: {
            id: l.capability.id,
            name: l.capability.name,
            type: l.capability.type,
            sourceType: l.capability.sourceType,
            verboseDescription: l.capability.verboseDescription,
          },
        };
      })}
      itemLinks={row.itemLinks.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        equipped: l.equipped,
        // Phase 5: surface slot metadata to the view.
        versionId: l.versionId,
        slotSource: l.slotSource,
        latestVersionId: latestVersions.get(makeKey("item", l.itemId)) ?? null,
        item: {
          id: l.item.id,
          name: l.item.name,
          itemType: l.item.itemType,
          rarity: l.item.rarity,
          description: l.item.description,
          buCost: l.item.buCost,
          slotCost: l.item.slotCost,
          isTwoHanded: l.item.isTwoHanded,
          isConsumable: l.item.isConsumable,
          // Phase 8.5 / Session H6 (Mashu 2026-08-03): see
          // the duplicate of this mapping at line 148 above
          // for context on the carried-but-not-equippable
          // flag. Defaults to false for legacy rows.
          isNotEquippable: l.item.isNotEquippable ?? false,
          // Phase 8.5 H5: item size drives Load via SIZE_LOAD.
          // Defaults to SMALL for legacy items pre-0050.
          size: l.item.size ?? "SMALL",
          // Phase 8.4 v22 (Mashu 2026-07-29): T2 — pass the
          // nested bundle through so the sheet ItemsTab can
          // render primitives/caps/effects per item.
          capabilityLinks:
            (l.item as { capabilityLinks?: Array<{
              capabilityId: string;
              capability: {
                id: string;
                name: string;
                type: string;
                sourceType: string;
                verboseDescription: string;
                effectLinks: Array<{
                  effectId: string;
                  effect: { id: string; name: string; description: string };
                }>;
              };
            }> }).capabilityLinks ?? [],
          effectLinks:
            (l.item as { effectLinks?: Array<{
              effectId: string;
              effect: { id: string; name: string; description: string };
            }> }).effectLinks ?? [],
          primitiveLinks:
            (l.item as { primitiveLinks?: Array<{
              primitiveId: number;
              primitive: {
                id: number;
                name: string;
                category: string;
                buCost: number;
                isMirrorable: boolean;
                mirrorBuCredit: number;
                narrativeRule: string | null;
              };
            }> }).primitiveLinks ?? [],
        },
      }))}
      // Phase 8.1 batch 13.1: pass heritageLinks so the sheet can
      // resolve "from Lineage 'Elf'" badges on capabilities/primitives
      // that came in via a heritage. The GET endpoint already
      // includes heritageLinks in its `with` clause.
      heritageLinks={(
        (row as unknown as { heritageLinks?: Array<{
          heritageId: string;
          acquiredAtLevel: number;
          isMirrored: boolean | null;
          versionId: string | null;
          slotSource: SlotSource | null;
          heritage: {
            id: string;
            name: string;
            kind: string;
            description: string | null;
            // Phase 8.4 v3 (Mashu 2026-07-28): the heritage's
            // canonical bundle is included so the Capabilities
            // tab's "By Heritage" section can list the
            // heritage's bundled capabilities + primitives.
            capabilityLinks: Array<{
              capabilityId: string;
              capability: {
                id: string;
                name: string;
                type: string;
                sourceType: string;
                verboseDescription: string;
              };
            }>;
            primitiveLinks: Array<{
              primitiveId: number;
              primitive: {
                id: number;
                name: string;
                category: string;
                buCost: number;
                isMirrorable: boolean;
                mirrorBuCredit: number;
                narrativeRule: string | null;
                hardModifiers: unknown[];
              };
            }>;
          };
        }> }).heritageLinks ?? []
      ).map((l) => ({
        heritageId: l.heritageId,
        acquiredAtLevel: l.acquiredAtLevel,
        isMirrored: l.isMirrored ?? false,
        // Phase 8.5 / Session H6 round 7 (Mashu
        // 2026-08-03): forward versionId + slotSource
        // from the character_heritages row so the
        // HeritageBundleView header can render the
        // SlotSourceBadge with a real version number
        // instead of a hardcoded "Pinned" chip.
        versionId: l.versionId ?? null,
        slotSource: l.slotSource ?? null,
        heritage: {
          id: l.heritage.id,
          name: l.heritage.name,
          kind: l.heritage.kind,
          description: l.heritage.description,
          capabilityLinks: (l.heritage.capabilityLinks ?? []).map((cl) => ({
            capabilityId: cl.capabilityId,
            capability: cl.capability,
          })),
          primitiveLinks: (l.heritage.primitiveLinks ?? []).map((pl) => ({
            primitiveId: pl.primitiveId,
            primitive: pl.primitive,
          })),
        },
      }))}
      // Phase 8.5 / Session H6 round 7 (Mashu
      // 2026-08-03): forward the bulk-resolved
      // latest-version map so HeritageKindAccordion
      // → HeritageBundleView can render the heritage
      // header SlotSourceBadge with the latest
      // version id (drives the "update available"
      // stale pill when a heritage has been
      // re-published).
      latestVersions={latestVersions}
      // Phase 8.2 batch 3: pass logEntries to the view for the
      // History tab. The shape matches what aggregateCharacterSheet
      // has historically logged on the character row; here we just
      // forward the raw log rows from the join.
      logEntries={(
        (row as unknown as { logEntries?: Array<{
          id: number;
          characterId: string;
          kind: string;
          payload: unknown;
          createdAt: Date;
        }> }).logEntries ?? []
      ).map((l) => ({
        id: l.id,
        kind: l.kind,
        payload: (l.payload ?? {}) as Record<string, unknown>,
        createdAt:
          l.createdAt instanceof Date
            ? l.createdAt.toISOString()
            : new Date(l.createdAt as unknown as string).toISOString(),
      }))}
      // Phase 8.2 batch 3: parse the backstory jsonb column once
      // here so the view doesn't need to know the raw shape.
      backstory={parseBackstory(
        (row as unknown as { backstory?: unknown }).backstory,
      )}
    />
  );
}