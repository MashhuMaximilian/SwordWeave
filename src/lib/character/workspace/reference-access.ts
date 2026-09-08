import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { readWorkspace } from "./read";
import type { EntityKey, WorkspaceGraph, WorkspaceNode } from "./model";
export async function assertReferenceAccess(
  graph: WorkspaceGraph,
  node: WorkspaceNode,
  userId: string,
) {
  if (graph.edges.some((e) => e.child === node.key)) return;
  const type =
    node.kind === "heritage"
      ? `${node.data["kind"]}_TEMPLATE`
      : node.kind.toUpperCase();
  const access = await db.execute(
    sql`select ${visibilityCondition(type, sql`${node.id}`, sql`${node.userId}`, userId)} as allowed`,
  );
  if (!access.rows[0]?.["allowed"]) throw new Error("This piece is private.");
}
/** Validate explicit composer inputs before invoking the established save handler. */
export async function validateDraftReferences(
  characterId: string,
  userId: string,
  draft: Record<string, unknown>,
  existingGraph?: WorkspaceGraph,
) {
  const keys = new Set<EntityKey>();
  for (const [field, kind, idField] of [
    ["primitiveSlots", "primitive", "primitiveId"],
    ["effectSlots", "effect", "effectId"],
  ] as const) {
    const slots = draft[field];
    if (Array.isArray(slots))
      for (const slot of slots) {
        if (slot && typeof slot === "object" && idField in slot)
          keys.add(`${kind}:${String(slot[idField])}`);
      }
  }
  for (const [field, kind] of [
    ["primitiveIds", "primitive"],
    ["effectIds", "effect"],
    ["capabilityIds", "capability"],
  ] as const) {
    const ids = draft[field];
    if (Array.isArray(ids))
      for (const id of ids) keys.add(`${kind}:${String(id)}`);
  }
  if (!keys.size) return;
  const existing = existingGraph ?? (await readWorkspace(characterId));
  const missing = [...keys].filter(
    (key) => !existing.nodes.some((n) => n.key === key),
  );
  const expanded = missing.length
    ? await readWorkspace(characterId, missing)
    : existing;
  for (const key of keys) {
    const node = expanded.nodes.find((n) => n.key === key);
    if (!node) throw new Error("A selected piece no longer exists.");
    await assertReferenceAccess(existing, node, userId);
  }
}
