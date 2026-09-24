import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, characters } from "@/db/schema";
import { executeWorkspaceCommand, WorkspaceConflict } from "./commands";
import { executeWorkspaceCreate } from "./create";
import { readWorkspace } from "./read";
import { supplyPaths, type WorkspaceGraph, type WorkspaceCategory, type EntityKey } from "./model";

/** Attach before removing the old path inside the enclosing draft transaction.
 * This preserves the last supply, including mirrored instance metadata. */
export async function relocateWorkspacePiece(characterId: string, userId: string, graph: WorkspaceGraph, operation: {
  path: string[]; destinationPath?: string[]; category: Exclude<WorkspaceCategory, "ALL">;
}): Promise<Record<string, unknown>> {
  const source = graph.edges.find(e => e.id === operation.path.at(-1));
  if (!source || !supplyPaths(graph, source.child).some(p => JSON.stringify(p.edges.map(e => e.id)) === JSON.stringify(operation.path)))
    throw new WorkspaceConflict("This piece moved. Review its location before moving it again.");
  const node = graph.nodes.find(n => n.key === source.child)!;
  const destination = operation.destinationPath?.length ? graph.edges.find(e => e.id === operation.destinationPath!.at(-1)) : null;
  if (operation.destinationPath?.length && !destination) throw new Error("Choose a destination on this character.");
  if (source.parent === destination?.child || (!source.parent && !destination && source.category === operation.category))
    return { id: node.id, revision: graph.revision, outcome: "no-op" };
  if (destination && operation.destinationPath!.includes(source.id)) throw new Error("A piece cannot be moved inside itself.");
  let attached: Record<string, unknown> = {};
  if (destination) {
    const parent = graph.nodes.find(n => n.key === destination.child)!;
    if (graph.edges.some(e => e.parent === parent.key && e.child === source.child)) throw new Error("That destination already contains this piece. Remove the duplicate source separately if intended.");
    attached = await executeWorkspaceCommand(characterId, userId, {
      commandId: randomUUID(), expectedRevision: graph.revision, operation: "add-reference", target: parent.key,
      expectedHash: parent.data["contentHash"] ?? null, path: operation.destinationPath,
      child: source.child, membership: { ...source.data, isMirrored: source.isMirrored },
    });
  } else if (node.kind === "primitive") {
    if (operation.category === "ITEM") throw new Error("Choose an item to contain this primitive.");
    const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
    // Retain a direct occurrence as an explicit instance; no dedup by definition.
    await db.insert(characterPrimitives).values({
      characterId, primitiveId: Number(node.id), source: operation.category,
      acquiredAtLevel: Number(source.data?.["acquiredAtLevel"] ?? character!.level),
      isMirrored: source.isMirrored, versionId: source.versionId ?? node.versionId,
      slotSource: source.slotSource === "OWNED" || source.slotSource === "FORKED" ? source.slotSource : "PINNED",
    });
  } else {
    attached = await executeWorkspaceCreate(characterId, userId, {
      commandId: randomUUID(), expectedRevision: graph.revision, kind: node.kind,
      existingId: node.id, category: operation.category, draft: {},
    });
  }
  const replacements = (attached["replacements"] ?? {}) as Record<string, EntityKey>;
  const fresh = await readWorkspace(characterId);
  if (source.parent) {
    const parentKey = replacements[source.parent] ?? source.parent;
    const parent = fresh.nodes.find(n => n.key === parentKey);
    const priorParentNodes = operation.path.slice(0, -1).map(id => graph.edges.find(e => e.id === id)!.child).map(key => replacements[key] ?? key);
    const parentPath = parent && supplyPaths(fresh, parent.key).find(p => JSON.stringify(p.nodes) === JSON.stringify(priorParentNodes));
    const membership = fresh.edges.find(e => e.parent === parentKey && e.child === source.child && (e.data?.["role"] ?? null) === (source.data?.["role"] ?? null));
    if (!parent || !parentPath || !membership) throw new WorkspaceConflict("The containing path changed. Nothing was moved.");
    const removed = await executeWorkspaceCommand(characterId, userId, {
      commandId: randomUUID(), expectedRevision: fresh.revision, operation: "remove-reference", target: parent.key,
      path: parentPath.edges.map(e => e.id), expectedHash: parent.data["contentHash"] ?? null, edgeId: membership.id,
    });
    return { ...removed, replacements: { ...replacements, ...((removed["replacements"] ?? {}) as object) } };
  }
  const updatedNode = fresh.nodes.find(n => n.key === source.child);
  if (!updatedNode) throw new WorkspaceConflict("The source changed. Nothing was moved.");
  const detached = await executeWorkspaceCommand(characterId, userId, {
    commandId: randomUUID(), expectedRevision: fresh.revision, operation: "detach", target: updatedNode.key,
    path: [source.id], expectedHash: updatedNode.data["contentHash"] ?? null,
  });
  return { ...detached, replacements };
}
