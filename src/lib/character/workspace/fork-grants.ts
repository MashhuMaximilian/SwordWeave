import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { characterCapabilities, characterWorkspaceForkGrants as grants } from "@/db/schema";
import { visibleDefinitionKeys } from "@/lib/publishing/definition-visibility";
import type { EntityKey, WorkspaceGraph } from "./model";

export type CharacterForkGrant = Pick<typeof grants.$inferSelect, "capabilityId" | "versionId" | "rootEdgeId" | "sourceCapabilityId">;

/** Called only after the native replacement, authorship, pin and members were checked. */
export async function recordCharacterForkGrants(characterId: string, forks: readonly CharacterForkGrant[]) {
  if (forks.length) await db.insert(grants).values(forks.map(({ capabilityId, sourceCapabilityId, versionId, rootEdgeId }) =>
    ({ characterId, capabilityId, sourceCapabilityId, versionId, rootEdgeId })));
}

export async function currentForkGrants(characterId: string, capabilityIds: string[]) {
  if (!capabilityIds.length) return [];
  const attached = await db.select({ slotTab: characterCapabilities.slotTab, capabilityId: grants.capabilityId, versionId: grants.versionId,
    rootEdgeId: grants.rootEdgeId, sourceCapabilityId: grants.sourceCapabilityId }).from(grants)
    .innerJoin(characterCapabilities, and(eq(characterCapabilities.characterId, grants.characterId),
      eq(characterCapabilities.capabilityId, grants.capabilityId), eq(characterCapabilities.versionId, grants.versionId),
      isNull(characterCapabilities.originHeritageId)))
    .where(and(eq(grants.characterId, characterId), inArray(grants.capabilityId, capabilityIds)));
  return attached.filter(row => row.rootEdgeId === `${row.slotTab ?? "MANIFEST"}:capability:${row.capabilityId}`);
}

/** The caller authorizes access to the character. This grant never authorizes a library lookup. */
export async function visibleCharacterForks(clerkId: string, graph: WorkspaceGraph, library: ReadonlySet<EntityKey>) {
  const roots = graph.edges.filter(edge => edge.parent === null && edge.child.startsWith("capability:") && !library.has(edge.child));
  const candidates = await currentForkGrants(graph.characterId, roots.map(edge => edge.child.slice("capability:".length)));
  const anchors = await visibleDefinitionKeys(clerkId, candidates.map((grant): EntityKey => `capability:${grant.sourceCapabilityId}`));
  return candidates.filter(grant => {
    const key = `capability:${grant.capabilityId}` as const;
    const node = graph.nodes.find(value => value.key === key);
    const placements = graph.edges.filter(edge => edge.child === key);
    return anchors.has(`capability:${grant.sourceCapabilityId}`) && node?.versionId === grant.versionId
      && node.latestVersionId === grant.versionId && !node.data["workspaceVersionIssue"]
      && placements.length === 1 && placements[0]?.parent === null
      && placements[0].id === grant.rootEdgeId && placements[0].versionId === grant.versionId;
  });
}
