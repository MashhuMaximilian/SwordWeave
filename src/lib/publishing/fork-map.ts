import { getFullAncestry, resolveTargetName } from "./fork-lineage";
import type { ForkTargetType } from "./forks-query";
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
  _options?: { limit?: number; cursor?: string | null },
): Promise<ForkMapResult> {
  const [ancestry, selectedName] = await Promise.all([
    getFullAncestry(targetType, targetId),
    resolveTargetName(targetType, targetId),
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
  // Always render the whole tree from its actual root. A deep fork therefore
  // opens the same graph as its root and merely changes the selected focus.
  const root = ancestorNodes[0] ?? { targetType, targetId };
  type EdgeRow = { source_type: ForkTargetType; source_id:string; child_type:ForkTargetType; child_id:string; source_version_id:string; forked_at:Date; author_name:string|null };
  const graphResult = await db.execute<EdgeRow>(sql`
    WITH RECURSIVE branch AS (
      SELECT f.source_target_type::text source_type,f.source_target_id source_id,
        f.forked_target_type::text child_type,f.forked_target_id child_id,
        f.source_version_id,f.created_at forked_at,ARRAY[f.source_target_type::text || ':' || f.source_target_id,
          f.forked_target_type::text || ':' || f.forked_target_id]::text[] path,
        f.forked_by_user_id
      FROM forks f
      WHERE f.source_target_type=${root.targetType} AND f.source_target_id=${root.targetId}
      UNION ALL
      SELECT f.source_target_type::text,f.source_target_id,f.forked_target_type::text,f.forked_target_id,
        f.source_version_id,f.created_at,b.path || (f.forked_target_type::text || ':' || f.forked_target_id),f.forked_by_user_id
      FROM forks f JOIN branch b
        ON f.source_target_type::text=b.child_type AND f.source_target_id=b.child_id
      WHERE NOT (f.forked_target_type::text || ':' || f.forked_target_id = ANY(b.path))
    )
    SELECT DISTINCT ON(source_type,source_id,child_type,child_id)
      branch.source_type,branch.source_id,branch.child_type,branch.child_id,
      branch.source_version_id,branch.forked_at,COALESCE(u.display_name,u.username) author_name
    FROM branch LEFT JOIN users u ON u.id=branch.forked_by_user_id
    ORDER BY source_type,source_id,child_type,child_id,branch.forked_at
  `);
  const graphRows=(graphResult as unknown as {rows:EdgeRow[]}).rows ?? graphResult;
  const nodeIdentities = [...new Map(graphRows.map(row => [`${row.child_type}:${row.child_id}`, {type:row.child_type,id:row.child_id,authorName:row.author_name,forkedAt:row.forked_at}])).entries()]
    .filter(([key]) => key !== selectedKey);
  const names = await Promise.all(nodeIdentities.map(([,node]) => resolveTargetName(node.type,node.id)));
  const children = nodeIdentities.map(([key,node],index) => ({
    key,targetType:node.type,targetId:node.id,name:names[index] ?? null,relation:"child" as const,
    authorName:node.authorName,forkedAt:node.forkedAt ? new Date(node.forkedAt).toISOString() : null,
  }));
  const edges = graphRows.map(row => ({
    from:`${row.source_type}:${row.source_id}`,to:`${row.child_type}:${row.child_id}`,sourceVersionId:row.source_version_id,
  }));
  const descendantsOfSelected = new Set<string>();
  let frontier = [selectedKey];
  while (frontier.length) {
    const next = edges.filter(edge => frontier.includes(edge.from)).map(edge => edge.to).filter(key => !descendantsOfSelected.has(key));
    next.forEach(key => descendantsOfSelected.add(key));
    frontier = next;
  }
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
    totalChildren: graphRows.filter(row => row.source_type===targetType && row.source_id===targetId).length,
    totalDescendants: descendantsOfSelected.size,
    nextCursor: null,
  };
}
