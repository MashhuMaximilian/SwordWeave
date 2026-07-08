/**
 * bulkResolveLatestVersions — Phase 5 (T5.C.2 support).
 *
 * Given a list of (kind, entityId) pairs, return a Map keyed by
 * `${kind}:${entityId}` of the latest version id for each. Lets the
 * character sheet compute "is this slot stale?" in one round trip
 * instead of N+1.
 *
 * Designed to be called server-side (in page.tsx) where the call site
 * already has the entity list. The Map is then handed to the
 * CharacterSheetView component as a prop.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilityVersions,
  effectVersions,
  itemVersions,
  primitiveVersions,
  templateVersions,
} from "@/db/schema";

export type VersionKey = `${"primitive" | "effect" | "capability" | "item" | "template"}:${string | number}`;

export function makeKey(
  kind: "primitive" | "effect" | "capability" | "item" | "template",
  id: string | number,
): VersionKey {
  return `${kind}:${id}` as VersionKey;
}

export async function bulkResolveLatestVersions(
  pairs: ReadonlyArray<{
    kind: "primitive" | "effect" | "capability" | "item" | "template";
    id: string | number;
  }>,
): Promise<Map<VersionKey, string>> {
  const out = new Map<VersionKey, string>();
  if (pairs.length === 0) return out;

  // Group by kind so we can do 1 query per kind.
  const byKind = new Map<string, Array<string | number>>();
  for (const p of pairs) {
    const list = byKind.get(p.kind) ?? [];
    list.push(p.id);
    byKind.set(p.kind, list);
  }

  if (byKind.has("primitive")) {
    const ids = byKind.get("primitive")! as number[];
    const rows = await db
      .select({
        primitiveId: primitiveVersions.primitiveId,
        id: primitiveVersions.id,
      })
      .from(primitiveVersions)
      .where(
        and(
          inArray(primitiveVersions.primitiveId, ids),
          eq(primitiveVersions.isLatest, true),
        ),
      )
      .orderBy(desc(primitiveVersions.versionNumber));
    for (const r of rows) {
      out.set(makeKey("primitive", r.primitiveId), r.id);
    }
  }

  if (byKind.has("effect")) {
    const ids = byKind.get("effect")! as string[];
    const rows = await db
      .select({
        effectId: effectVersions.effectId,
        id: effectVersions.id,
      })
      .from(effectVersions)
      .where(
        and(
          inArray(effectVersions.effectId, ids),
          eq(effectVersions.isLatest, true),
        ),
      )
      .orderBy(desc(effectVersions.versionNumber));
    for (const r of rows) {
      out.set(makeKey("effect", r.effectId), r.id);
    }
  }

  if (byKind.has("capability")) {
    const ids = byKind.get("capability")! as string[];
    const rows = await db
      .select({
        capabilityId: capabilityVersions.capabilityId,
        id: capabilityVersions.id,
      })
      .from(capabilityVersions)
      .where(
        and(
          inArray(capabilityVersions.capabilityId, ids),
          eq(capabilityVersions.isLatest, true),
        ),
      )
      .orderBy(desc(capabilityVersions.versionNumber));
    for (const r of rows) {
      out.set(makeKey("capability", r.capabilityId), r.id);
    }
  }

  if (byKind.has("item")) {
    const ids = byKind.get("item")! as string[];
    const rows = await db
      .select({
        itemId: itemVersions.itemId,
        id: itemVersions.id,
      })
      .from(itemVersions)
      .where(
        and(
          inArray(itemVersions.itemId, ids),
          eq(itemVersions.isLatest, true),
        ),
      )
      .orderBy(desc(itemVersions.versionNumber));
    for (const r of rows) {
      out.set(makeKey("item", r.itemId), r.id);
    }
  }

  if (byKind.has("template")) {
    const ids = byKind.get("template")! as string[];
    const rows = await db
      .select({
        templateId: templateVersions.templateId,
        id: templateVersions.id,
      })
      .from(templateVersions)
      .where(
        and(
          inArray(templateVersions.templateId, ids),
          eq(templateVersions.isLatest, true),
        ),
      )
      .orderBy(desc(templateVersions.versionNumber));
    for (const r of rows) {
      out.set(makeKey("template", r.templateId), r.id);
    }
  }

  return out;
}
