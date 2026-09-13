import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { primitives, effects, capabilities, items, characters, heritage, primitiveVersions, effectVersions, capabilityVersions, itemVersions, characterVersions, heritageVersions } from "@/db/schema";
import { checkVisibility } from "@/lib/publishing/visibility";

const querySchema = z.object({
  targetType: z.enum(["PRIMITIVE", "EFFECT", "CAPABILITY", "ITEM", "CHARACTER", "LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"]),
  targetId: z.string().min(1).max(128),
  before: z.coerce.number().int().positive().optional(),
});

/** Bounded metadata only: graph nodes never fetch snapshot payloads. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid version query." }, { status: 400 });
  const { targetType, targetId, before } = parsed.data;
  if (targetType === "PRIMITIVE" ? !/^\d+$/.test(targetId) : !z.string().uuid().safeParse(targetId).success) return NextResponse.json({ error: "Invalid target ID." }, { status: 400 });
  const config = targetType === "PRIMITIVE" ? { source: primitives, versions: primitiveVersions, parent: primitiveVersions.primitiveId, id: Number(targetId) }
    : targetType === "EFFECT" ? { source: effects, versions: effectVersions, parent: effectVersions.effectId, id: targetId }
    : targetType === "CAPABILITY" ? { source: capabilities, versions: capabilityVersions, parent: capabilityVersions.capabilityId, id: targetId }
    : targetType === "ITEM" ? { source: items, versions: itemVersions, parent: itemVersions.itemId, id: targetId }
    : targetType === "CHARACTER" ? { source: characters, versions: characterVersions, parent: characterVersions.characterId, id: targetId }
    : { source: heritage, versions: heritageVersions, parent: heritageVersions.templateId, id: targetId };
  const [row] = await db.select({ userId: config.source.userId, isPublic: config.source.isPublic }).from(config.source).where(and(eq(config.source.id, config.id), targetType.endsWith("_TEMPLATE") ? eq(heritage.kind, targetType.replace("_TEMPLATE", "") as "LINEAGE" | "UPBRINGING" | "MANIFEST") : undefined)).limit(1);
  if (!row) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  const { userId } = await auth();
  const access = await checkVisibility({ targetType, targetId, ownerId: row.userId, isPublic: row.isPublic, viewerId: userId });
  if (!access.allowed) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  const table = config.versions;
  const rows = await db.select({ id: table.id, versionNumber: table.versionNumber, publishedAt: table.publishedAt }).from(table)
    .where(and(eq(config.parent, config.id), before ? lt(table.versionNumber, before) : undefined))
    .orderBy(desc(table.versionNumber)).limit(21);
  const versions = rows.slice(0, 20);
  return NextResponse.json({ versions, nextBefore: rows.length > 20 ? versions.at(-1)!.versionNumber : null });
}
