import { getFullAncestry, resolveTargetName } from "./fork-lineage";
import {
  listBySourcePage,
  type ForkTargetType,
} from "./forks-query";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { primitiveVersions } from "@/db/schema";

export interface ForkMapNode {
  key: string;
  targetType: ForkTargetType;
  targetId: string;
  name: string | null;
  relation: "ancestor" | "selected" | "child";
  authorName: string | null;
  forkedAt: string | null;
}

export interface ForkMapResult {
  ancestry: ForkMapNode[];
  selected: ForkMapNode;
  children: ForkMapNode[];
  edges: Array<{ from: string; to: string; sourceVersionId?: string | null; sourceVersionLabel?: string | null }>;
  totalChildren: number;
  totalDescendants?: number;
  nextCursor: string | null;
}

export async function getForkMap(
  targetType: ForkTargetType,
  targetId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<ForkMapResult> {
  const [ancestry, selectedName, childPage, descendantsResult] = await Promise.all([
    getFullAncestry(targetType, targetId),
    resolveTargetName(targetType, targetId),
    listBySourcePage(
      targetType,
      targetId,
      options?.limit ?? 20,
      options?.cursor,
    ),
    db.execute<{ total: number }>(sql`
      WITH RECURSIVE descendants(target_type,target_id) AS (
        SELECT forked_target_type::text,forked_target_id FROM forks
        WHERE source_target_type=${targetType} AND source_target_id=${targetId}
        UNION
        SELECT f.forked_target_type::text,f.forked_target_id FROM forks f
        JOIN descendants d ON f.source_target_type::text=d.target_type AND f.source_target_id=d.target_id
      ) SELECT count(*)::int total FROM descendants
    `),
  ]);

  const selectedKey = `${targetType}:${targetId}`;
  const ancestorNodes = [...ancestry]
    .reverse()
    .filter(
      (ancestor) =>
        `${ancestor.sourceTargetType}:${ancestor.sourceTargetId}` !== selectedKey,
    )
    .map((ancestor) => ({
      key: `${ancestor.sourceTargetType}:${ancestor.sourceTargetId}`,
      targetType: ancestor.sourceTargetType,
      targetId: ancestor.sourceTargetId,
      name: ancestor.sourceTargetName,
      relation: "ancestor" as const,
      authorName:
        ancestor.sourceAuthorDisplayName ?? ancestor.sourceAuthorUsername,
      forkedAt: ancestor.forkedAt.toISOString(),
    }));
  const children = childPage.forks.map((fork) => ({
    key: `${fork.forkedTargetType}:${fork.forkedTargetId}`,
    targetType: fork.forkedTargetType,
    targetId: fork.forkedTargetId,
    name: fork.forkedTargetName,
    relation: "child" as const,
    authorName: fork.forkerDisplayName ?? fork.forkerUsername,
    forkedAt: fork.forkedAt.toISOString(),
  }));
  const lineageKeys = [...ancestorNodes.map((node) => node.key), selectedKey];
  const orderedAncestry=[...ancestry].reverse();
  const descendantRows=(descendantsResult as unknown as {rows:Array<{total:number}>}).rows ?? descendantsResult;

  const edges = [
    ...lineageKeys.slice(1).map((to, index) => ({
      from: lineageKeys[index]!,
      to,
      sourceVersionId: orderedAncestry[index]?.sourceVersionId || null,
    })),
    ...children.map((node, index) => ({ from: selectedKey, to: node.key, sourceVersionId: childPage.forks[index]?.sourceVersionId ?? null })),
  ];
  const primitiveVersionIds = [...new Set(edges
    .filter(edge => edge.from.startsWith("PRIMITIVE:") && edge.sourceVersionId)
    .map(edge => edge.sourceVersionId!))];
  const versionRows = primitiveVersionIds.length
    ? await db.select({id: primitiveVersions.id, versionNumber: primitiveVersions.versionNumber})
      .from(primitiveVersions)
      .where(inArray(primitiveVersions.id, primitiveVersionIds))
    : [];
  const versionLabels = new Map(versionRows.map(row => [row.id, `v${row.versionNumber}`]));

  return {
    ancestry: ancestorNodes,
    selected: {
      key: selectedKey,
      targetType,
      targetId,
      name: selectedName,
      relation: "selected",
      authorName: null,
      forkedAt: null,
    },
    children,
    edges: edges.map(edge => ({...edge, sourceVersionLabel: edge.sourceVersionId ? versionLabels.get(edge.sourceVersionId) ?? null : null})),
    totalChildren: childPage.totalForks,
    totalDescendants: Number(descendantRows[0]?.total ?? childPage.totalForks),
    nextCursor: childPage.nextCursor,
  };
}
