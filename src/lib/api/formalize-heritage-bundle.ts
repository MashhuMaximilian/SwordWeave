import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  heritage,
  primitives,
  characterPrimitives,
  characterCapabilities,
} from "@/db/schema";
import { expandBundles } from "@/lib/engine/bundle-expander";
import {
  resolveLatestVersionId,
  resolveSlotSource,
} from "@/lib/versions/slot-source";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Materialize just this heritage; preserve unrelated slots and existing instance IDs. */
export async function formalizeHeritageBundle(
  tx: Tx,
  characterId: string,
  heritageId: string,
  userId: string,
  level: number,
) {
  const template = await tx.query.heritage.findFirst({
    where: eq(heritage.id, heritageId),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: {
        with: {
          capability: {
            with: {
              primitiveLinks: { with: { primitive: true } },
              effectLinks: {
                with: {
                  effect: {
                    with: { primitiveLinks: { with: { primitive: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!template) throw new Error("Heritage not found.");
  const expansion = expandBundles({
    heritages: [
      {
        ...template,
        capabilityLinks: template.capabilityLinks.map((link) => ({
          capabilityId: link.capabilityId,
          primitiveLinks: link.capability.primitiveLinks,
          effectLinks: link.capability.effectLinks.map((el) => ({
            effectId: el.effectId,
            primitiveLinks: el.effect.primitiveLinks,
          })),
        })),
      },
    ],
    primitives: [],
    capabilities: [],
    effects: [],
  });
  const existingPrimitives = await tx.query.characterPrimitives.findMany({
    where: eq(characterPrimitives.characterId, characterId),
  });
  const existingCapabilities = await tx.query.characterCapabilities.findMany({
    where: eq(characterCapabilities.characterId, characterId),
  });
  for (const slot of expansion.capabilities) {
    const existing = existingCapabilities.find(
      (c) => c.capabilityId === slot.capabilityId,
    );
    if (existing) {
      if (!existing.originHeritageId && existing.slotTab === template.kind) {
        await tx
          .update(characterCapabilities)
          .set({ originHeritageId: heritageId, slotTab: null })
          .where(
            and(
              eq(characterCapabilities.characterId, characterId),
              eq(characterCapabilities.capabilityId, slot.capabilityId),
            ),
          );
      }
    } else {
      const entity = template.capabilityLinks.find(
        (c) => c.capabilityId === slot.capabilityId,
      )!.capability;
      await tx
        .insert(characterCapabilities)
        .values({
          characterId,
          capabilityId: slot.capabilityId,
          originHeritageId: heritageId,
          slotTab: null,
          acquiredAtLevel: level,
          versionId: await resolveLatestVersionId(
            "capability",
            slot.capabilityId,
          ),
          slotSource: resolveSlotSource({ entity, callerUserId: userId }),
        });
    }
  }
  const primitiveEntities = expansion.primitives.length
    ? await tx.query.primitives.findMany({
        where: inArray(
          primitives.id,
          expansion.primitives.map((p) => p.primitiveId),
        ),
        columns: { id: true, userId: true, sourceOrigin: true },
      })
    : [];
  for (const slot of expansion.primitives) {
    // All inheritance paths share one baseline, regardless of direction.
    const inherited = existingPrimitives.find(
      (p) =>
        p.primitiveId === slot.primitiveId &&
        (p.originHeritageId ||
          p.originCapabilityId ||
          p.originEffectId ||
          p.originItemId),
    );
    const existing = existingPrimitives.find(
      (p) =>
        p.primitiveId === slot.primitiveId &&
        p.isMirrored === slot.isMirrored &&
        p.source === template.kind &&
        !p.originHeritageId &&
        !p.originItemId &&
        p.originCapabilityId === slot.originCapabilityId &&
        p.originEffectId === slot.originEffectId,
    );
    if (inherited && inherited.instanceId !== existing?.instanceId) continue;
    const origin = {
      originHeritageId: heritageId,
      originCapabilityId: slot.originCapabilityId,
      originEffectId: slot.originEffectId,
    };
    if (existing) {
      await tx
        .update(characterPrimitives)
        .set(origin)
        .where(eq(characterPrimitives.instanceId, existing.instanceId));
    } else {
      await tx
        .insert(characterPrimitives)
        .values({
          characterId,
          primitiveId: slot.primitiveId,
          source: template.kind,
          isMirrored: slot.isMirrored,
          acquiredAtLevel: level,
          ...origin,
          versionId: await resolveLatestVersionId(
            "primitive",
            slot.primitiveId,
          ),
          slotSource: resolveSlotSource({
            entity: primitiveEntities.find((p) => p.id === slot.primitiveId)!,
            callerUserId: userId,
          }),
        });
    }
  }
  return expansion.primitives.length;
}
