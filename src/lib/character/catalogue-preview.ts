import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterPrimitives,
  characterCapabilities,
  primitives,
  capabilities,
} from "@/db/schema";
import { canResolveCharacterForPage } from "./can-resolve-character";
import { checkVisibility } from "@/lib/publishing/visibility";
import { visibilityCondition } from "@/lib/publishing/library-query";

/** A catalogue summary never returns private notes, history or gameplay state. */
export async function readCharacterCataloguePreview(
  id: string,
  viewerId: string | null,
) {
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    columns: {
      id: true,
      userId: true,
      isPublic: true,
      name: true,
      level: true,
      size: true,
      portraitUrl: true,
      lineageName: true,
      upbringingName: true,
      manifestName: true,
      attrPhysical: true,
      attrMental: true,
      attrMagical: true,
    },
  });
  if (!character) return null;
  const visible = await checkVisibility({
    targetType: "CHARACTER",
    targetId: id,
    ownerId: character.userId,
    isPublic: character.isPublic,
    viewerId,
  });
  if (
    !visible.allowed &&
    !(viewerId && (await canResolveCharacterForPage(viewerId, id)))
  )
    return null;
  const [primitiveLinks, capabilityLinks] = await Promise.all([
    db
      .select({ primitive: { id: primitives.id, name: primitives.name } })
      .from(characterPrimitives)
      .innerJoin(primitives, eq(characterPrimitives.primitiveId, primitives.id))
      .where(
        and(
          eq(characterPrimitives.characterId, id),
          visibilityCondition(
            "PRIMITIVE",
            sql`${primitives.id}`,
            sql`${primitives.userId}`,
            viewerId ?? undefined,
            sql`${primitives.isPublic}`,
          ),
        ),
      ),
    db
      .select({ capability: { id: capabilities.id, name: capabilities.name } })
      .from(characterCapabilities)
      .innerJoin(
        capabilities,
        eq(characterCapabilities.capabilityId, capabilities.id),
      )
      .where(
        and(
          eq(characterCapabilities.characterId, id),
          visibilityCondition(
            "CAPABILITY",
            sql`${capabilities.id}`,
            sql`${capabilities.userId}`,
            viewerId ?? undefined,
            sql`${capabilities.isPublic}`,
          ),
        ),
      ),
  ]);
  const { userId: _owner, isPublic: _public, ...summary } = character;
  return { ...summary, primitiveLinks, capabilityLinks };
}
