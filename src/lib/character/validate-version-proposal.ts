import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, characterCapabilities, characterItems, primitiveVersions, capabilityVersions, itemVersions } from "@/db/schema";
import type { ProposalTargetKind } from "./proposal-types";

/** Legacy version proposals must refer to the exact current occurrence and versions of the same definition. */
export async function validateVersionProposal(characterId: string, kind: ProposalTargetKind, targetId: string, currentVersionId: string, proposedVersionId: string, instanceId?: string) {
  if (kind === "PRIMITIVE") {
    const id = Number(targetId);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const versions = await db.select().from(primitiveVersions).where(eq(primitiveVersions.primitiveId, id));
    if (!versions.some(v => v.id === currentVersionId) || !versions.some(v => v.id === proposedVersionId)) return null;
    const slots = await db.select().from(characterPrimitives).where(and(eq(characterPrimitives.characterId, characterId), eq(characterPrimitives.primitiveId, id)));
    const matching = slots.filter(slot => (!instanceId || slot.instanceId === instanceId) && slot.versionId === currentVersionId);
    if (matching.length !== 1) return null;
    return { instanceId: matching[0]!.instanceId };
  }
  if (kind === "CAPABILITY") {
    const versions = await db.select().from(capabilityVersions).where(eq(capabilityVersions.capabilityId, targetId));
    if (!versions.some(v => v.id === currentVersionId) || !versions.some(v => v.id === proposedVersionId)) return null;
    const slots = await db.select().from(characterCapabilities).where(and(eq(characterCapabilities.characterId, characterId), eq(characterCapabilities.capabilityId, targetId), eq(characterCapabilities.versionId, currentVersionId)));
    return slots.length === 1 ? {} : null;
  }
  const versions = await db.select().from(itemVersions).where(eq(itemVersions.itemId, targetId));
  if (!versions.some(v => v.id === currentVersionId) || !versions.some(v => v.id === proposedVersionId)) return null;
  const slots = await db.select().from(characterItems).where(and(eq(characterItems.characterId, characterId), eq(characterItems.itemId, targetId), eq(characterItems.versionId, currentVersionId)));
  return slots.length === 1 ? {} : null;
}
