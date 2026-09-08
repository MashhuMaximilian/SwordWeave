import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { loadWorkspaceNodes, type LoadedNode } from "./load-nodes";
import type {
  EntityKey,
  EntityKind,
  WorkspaceCategory,
  WorkspaceEdge,
  WorkspaceGraph,
  WorkspaceNode,
} from "./model";

/** Builds memberships from canonical junctions, not the materialization's single origin. */
export async function readWorkspace(
  characterId: string,
  extra: EntityKey[] = [],
): Promise<WorkspaceGraph> {
  const [
    primitiveSlots,
    capabilitySlots,
    heritageSlots,
    itemSlots,
    state,
    effectSlots,
  ] = await Promise.all([
    db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId)),
    db
      .select()
      .from(s.characterCapabilities)
      .where(eq(s.characterCapabilities.characterId, characterId)),
    db
      .select()
      .from(s.characterHeritages)
      .where(eq(s.characterHeritages.characterId, characterId)),
    db
      .select()
      .from(s.characterItems)
      .where(eq(s.characterItems.characterId, characterId)),
    db
      .select()
      .from(s.characterWorkspaceState)
      .where(eq(s.characterWorkspaceState.characterId, characterId)),
    db
      .select()
      .from(s.characterEffects)
      .where(eq(s.characterEffects.characterId, characterId)),
  ]);
  const edges: WorkspaceEdge[] = [];
  const nodes = new Map<EntityKey, WorkspaceNode>();
  const pending = new Set<EntityKey>(extra);
  function edge(
    parent: EntityKey | null,
    kind: EntityKind,
    id: string | number,
    category: WorkspaceCategory,
    data: Record<string, unknown> = {},
  ) {
    const child: EntityKey = `${kind}:${id}`;
    const identity = String(
      data["instanceId"] ??
        `${parent ?? category}:${child}${data["role"] ? `:${data["role"]}` : ""}`,
    );
    edges.push({
      id: identity,
      data,
      parent,
      child,
      category,
      order: Number(data["sortOrder"] ?? edges.length),
      isMirrored: Boolean(data["isMirrored"]),
      ...(typeof data["instanceId"] === "string"
        ? { instanceId: data["instanceId"] }
        : {}),
      ...(typeof data["versionId"] === "string"
        ? { versionId: data["versionId"] }
        : {}),
      ...(typeof data["slotSource"] === "string"
        ? { slotSource: data["slotSource"] }
        : {}),
    });
    pending.add(child);
  }
  for (const slot of heritageSlots)
    edge(null, "heritage", slot.heritageId, "ALL", slot);
  for (const slot of effectSlots)
    edge(
      null,
      "effect",
      slot.effectId,
      slot.category as WorkspaceCategory,
      slot,
    );
  for (const slot of itemSlots) edge(null, "item", slot.itemId, "ITEM", slot);
  for (const slot of capabilitySlots) {
    if (!slot.originHeritageId)
      edge(
        null,
        "capability",
        slot.capabilityId,
        slot.slotTab ?? "MANIFEST",
        slot,
      );
  }
  for (const slot of primitiveSlots) {
    if (
      slot.directSource ||
      (!slot.originHeritageId &&
        !slot.originCapabilityId &&
        !slot.originEffectId &&
        !slot.originItemId)
    )
      edge(
        null,
        "primitive",
        slot.primitiveId,
        (slot.directSource ?? slot.source) === "PERSONAL"
          ? "MANIFEST"
          : ((slot.directSource ?? slot.source) as WorkspaceCategory),
        slot,
      );
  }
  const loaded = new Map<EntityKey, LoadedNode>();
  while (pending.size) {
    const missing = [...pending].filter((k) => !loaded.has(k));
    if (missing.length)
      for (const [key, value] of await loadWorkspaceNodes(missing))
        loaded.set(key, value);
    const key = pending.values().next().value!;
    pending.delete(key);
    if (nodes.has(key)) continue;
    const split = key.indexOf(":");
    const kind = key.slice(0, split) as EntityKind;
    const id = key.slice(split + 1);
    const entry = loaded.get(key);
    const row = entry?.row;
    const links = entry?.links ?? [];
    if (kind === "heritage")
      for (const e of edges)
        if (e.child === key && e.parent === null)
          e.category = row?.["kind"] as WorkspaceCategory;
    if (!row) continue;
    if (kind === "item")
      for (const e of edges)
        if (e.child === key && e.parent === null)
          e.data = { ...e.data, isNotEquippable: row["isNotEquippable"] };
    const latestVersionId =
      entry?.versions
        .filter((v) => v.latest)
        .sort((a, b) => b.number - a.number)[0]?.id ?? null;
    const versionId =
      edges.find((e) => e.child === key && e.parent === null)?.versionId ??
      latestVersionId;
    row["workspaceVersionNumber"] =
      entry?.versions.find((v) => v.id === versionId)?.number ?? null;
    nodes.set(key, {
      key,
      kind,
      id,
      name: String(row["name"]),
      bu: Number(row["buCost"] ?? 0),
      userId: typeof row["userId"] === "string" ? row["userId"] : null,
      versionId,
      latestVersionId,
      description: String(
        row["narrativeRule"] ??
          row["verboseDescription"] ??
          row["narrativeDescription"] ??
          row["description"] ??
          "",
      ),
      data: row,
    });
    const layout = Array.isArray(row["membershipOrder"])
      ? (row["membershipOrder"] as string[])
      : [];
    for (const l of links) {
      const memberKey = `${l.kind}:${l.id}${l.data["role"] ? `:${l.data["role"]}` : ""}`;
      const order = layout.indexOf(memberKey);
      edge(key, l.kind, l.id, kind === "item" ? "ITEM" : "ALL", {
        ...l.data,
        ...(order >= 0 ? { sortOrder: order } : {}),
      });
    }
  }
  const authorIds = [
    ...new Set(
      [...nodes.values()].flatMap((n) => (n.userId ? [n.userId] : [])),
    ),
  ];
  if (authorIds.length) {
    const authors = await db
      .select()
      .from(s.users)
      .where(inArray(s.users.clerkUserId, authorIds));
    for (const node of nodes.values()) {
      const author = authors.find((a) => a.clerkUserId === node.userId);
      node.data["workspaceAuthor"] = author?.isAdmin
        ? "System"
        : (author?.username ?? (node.userId ? "Community author" : "System"));
    }
  }
  return {
    characterId,
    revision: state[0]?.revision ?? 0,
    nodes: [...nodes.values()],
    edges,
  };
}
