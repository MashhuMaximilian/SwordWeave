import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { primitiveVersions } from "@/db/schema";
import { resolvePinnedNode } from "./pinned-versions";
import type { LoadedNode } from "./load-nodes";

export function effectivePrimitiveDefinition<P extends Record<string, unknown>>(
  primitive: P, versionId: string | null | undefined, versions: LoadedNode["versions"],
): P {
  if (!versionId) return primitive;
  const effective = resolvePinnedNode("primitive", { row: primitive, links: [], versions }, [versionId]);
  if (!effective.row["workspaceHistoricalVersion"]) return primitive;
  // Optional mechanics absent in an older snapshot must not leak in from its
  // newer live definition. Identity/audit fields remain the slotted entity's.
  return { ...primitive, ...effective.row, hardModifiers: effective.row["hardModifiers"] ?? [],
    consequenceBehavior: effective.row["consequenceBehavior"] ?? null } as P;
}

/** One batched version read for the entire character, including both copies of
 * a definition when separate occurrences intentionally use different pins. */
export async function effectivePrimitiveLinks<P extends Record<string, unknown>, L extends { primitiveId: number; versionId?: string | null; primitive: P }>(links: readonly L[]): Promise<L[]> {
  const ids = [...new Set(links.filter(link => link.versionId).map(link => link.primitiveId))];
  if (!ids.length) return [...links];
  const rows = await db.select().from(primitiveVersions).where(inArray(primitiveVersions.primitiveId, ids));
  const grouped = new Map<number, LoadedNode["versions"]>();
  for (const row of rows) {
    const versions = grouped.get(row.primitiveId) ?? [];
    versions.push({ id: row.id, number: row.versionNumber, latest: row.isLatest, deltaKind: row.deltaKind, snapshot: row.snapshot as Record<string, unknown> });
    grouped.set(row.primitiveId, versions);
  }
  return links.map(link => ({ ...link, primitive: effectivePrimitiveDefinition(link.primitive, link.versionId, grouped.get(link.primitiveId) ?? []) }));
}
