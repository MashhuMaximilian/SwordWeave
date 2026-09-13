import { getFullAncestry, resolveTargetName } from "./fork-lineage";
import {
  listBySourcePage,
  type ForkTargetType,
} from "./forks-query";

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
  edges: Array<{ from: string; to: string }>;
  totalChildren: number;
  nextCursor: string | null;
}

export async function getForkMap(
  targetType: ForkTargetType,
  targetId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<ForkMapResult> {
  const [ancestry, selectedName, childPage] = await Promise.all([
    getFullAncestry(targetType, targetId),
    resolveTargetName(targetType, targetId),
    listBySourcePage(
      targetType,
      targetId,
      options?.limit ?? 20,
      options?.cursor,
    ),
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
    edges: [
      ...lineageKeys.slice(1).map((to, index) => ({
        from: lineageKeys[index]!,
        to,
      })),
      ...children.map((node) => ({ from: selectedKey, to: node.key })),
    ],
    totalChildren: childPage.totalForks,
    nextCursor: childPage.nextCursor,
  };
}
