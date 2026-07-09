/**
 * bulkResolveLatestVersionNumbers — Phase 5+.
 *
 * Companion to `bulkResolveLatestVersions` (which returns the version's
 * UUID). This one returns the human-facing `versionNumber` (e.g. 3 for v3)
 * so the UI can render a small "v3" chip next to a referenced entity.
 *
 * Used by:
 *   - /library/item/[id] source pages — show "v3" next to each composed
 *     primitive/effect/capability in the capability/effect/template/item
 *     detail bodies.
 *   - Sandbox preview modals — same chip on the same composed-entity
 *     lists.
 *
 * Same shape as bulkResolveLatestVersions so the call sites can swap
 * freely if they want both (number for display, uuid for links).
 *
 * Behaviour:
 *   - Returns Map keyed by `${kind}:${id}` → number (1-based).
 *   - Entities with no published version yet are absent from the map.
 *   - Items/templates have their own version tables (`item_versions`,
 *     `template_versions`) queried separately. Templates: kind="template"
 *     covers all 3 (RACE/BACKGROUND/ARCHETYPE) — there's one table.
 *   - Single query per kind using `inArray` + `isLatest=true` so it's
 *     O(kinds) round trips, not O(refs).
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

export type VersionNumberKey =
  | `primitive:${number}`
  | `effect:${string}`
  | `capability:${string}`
  | `item:${string}`
  | `template:${string}`;

export type VersionKind = "primitive" | "effect" | "capability" | "item" | "template";

export interface VersionRef {
  kind: VersionKind;
  id: string | number;
}

export async function bulkResolveLatestVersionNumbers(
  refs: ReadonlyArray<VersionRef>,
): Promise<Map<VersionNumberKey, number>> {
  const out = new Map<VersionNumberKey, number>();
  if (refs.length === 0) return out;

  // Group by kind so we can do 1 query per kind.
  const byKind = new Map<VersionKind, Array<string | number>>();
  for (const r of refs) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r.id);
    byKind.set(r.kind, list);
  }

  if (byKind.has("primitive")) {
    const ids = byKind.get("primitive")! as number[];
    const rows = await db
      .select({
        primitiveId: primitiveVersions.primitiveId,
        versionNumber: primitiveVersions.versionNumber,
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
      out.set(`primitive:${r.primitiveId}`, r.versionNumber);
    }
  }

  if (byKind.has("effect")) {
    const ids = byKind.get("effect")! as string[];
    const rows = await db
      .select({
        effectId: effectVersions.effectId,
        versionNumber: effectVersions.versionNumber,
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
      out.set(`effect:${r.effectId}`, r.versionNumber);
    }
  }

  if (byKind.has("capability")) {
    const ids = byKind.get("capability")! as string[];
    const rows = await db
      .select({
        capabilityId: capabilityVersions.capabilityId,
        versionNumber: capabilityVersions.versionNumber,
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
      out.set(`capability:${r.capabilityId}`, r.versionNumber);
    }
  }

  if (byKind.has("item")) {
    const ids = byKind.get("item")! as string[];
    const rows = await db
      .select({
        itemId: itemVersions.itemId,
        versionNumber: itemVersions.versionNumber,
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
      out.set(`item:${r.itemId}`, r.versionNumber);
    }
  }

  if (byKind.has("template")) {
    const ids = byKind.get("template")! as string[];
    const rows = await db
      .select({
        templateId: templateVersions.templateId,
        versionNumber: templateVersions.versionNumber,
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
      out.set(`template:${r.templateId}`, r.versionNumber);
    }
  }

  return out;
}

/**
 * Lookup helper for callers that already have a Map.
 * Returns the version number for a ref, or null if the entity hasn't
 * been published yet (i.e. no version row exists).
 */
export function getVersionNumber(
  map: ReadonlyMap<VersionNumberKey, number>,
  kind: VersionKind,
  id: string | number,
): number | null {
  return map.get(`${kind}:${id}` as VersionNumberKey) ?? null;
}