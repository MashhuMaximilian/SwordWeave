import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { loadWorkspaceNodes, type LoadedNode } from "./load-nodes";
import { resolvePinnedNode } from "./pinned-versions";
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
  const pins = new Map<EntityKey, string[]>();
  for (const [kind, slots, field] of [
    ["primitive", primitiveSlots, "primitiveId"], ["capability", capabilitySlots, "capabilityId"],
    ["heritage", heritageSlots, "heritageId"], ["item", itemSlots, "itemId"], ["effect", effectSlots, "effectId"],
  ] as const) for (const slot of slots) {
    const data = slot as unknown as Record<string, unknown>;
    if (typeof data["versionId"] !== "string") continue;
    const key: EntityKey = `${kind}:${data[field]}`;
    pins.set(key, [...(pins.get(key) ?? []), data["versionId"]]);
  }
  const rootPins = new Map([...pins].map(([key, values]) => [key, [...new Set(values)]]));
  const inheritedPins = new Map<EntityKey, Map<EntityKey, string[]>>();
  const processedPins = new Map<EntityKey, string>();
  const pinSignature = (key: EntityKey) => [...new Set(pins.get(key) ?? [])].sort().join("|");
  function refreshPins(children: Iterable<EntityKey>) {
    for (const child of children) {
      const values = new Set(rootPins.get(child) ?? []);
      for (const memberships of inheritedPins.values()) for (const pin of memberships.get(child) ?? []) values.add(pin);
      const before = pinSignature(child);
      pins.set(child, [...values]);
      if (before !== pinSignature(child)) pending.add(child);
    }
  }
  function reachableKeys() {
    const reachable = new Set<EntityKey>(extra);
    const queue = edges.filter(e => e.parent === null).map(e => e.child).concat(extra);
    for (let i = 0; i < queue.length; i++) {
      const key = queue[i]!; if (reachable.has(key) && !extra.includes(key)) continue;
      reachable.add(key);
      for (const child of edges.filter(e => e.parent === key).map(e => e.child)) if (!reachable.has(child)) queue.push(child);
    }
    return reachable;
  }
  const loaded = new Map<EntityKey, LoadedNode>();
  const attempted = new Set<EntityKey>();
  let resolutionSteps = 0;
  while (pending.size) {
    if (++resolutionSteps > 50000) throw new Error("Version dependencies do not converge. Resolve conflicting or cyclic component versions before opening this build.");
    if (attempted.size > 5000) throw new Error("This build exceeds the supported component graph size.");
    const key = pending.values().next().value!;
    // Drain already-loaded siblings before fetching their children. This keeps
    // the existing queue/edge order, while batching the next whole frontier.
    // Remember absent keys too, so dangling references are not queried again.
    if (!loaded.has(key) && !attempted.has(key)) {
      const missing = [...pending].filter((k) => !attempted.has(k));
      for (const missingKey of missing) attempted.add(missingKey);
      for (const [key, value] of await loadWorkspaceNodes(missing))
        loaded.set(key, value);
    }
    pending.delete(key);
    const signature = pinSignature(key);
    if (processedPins.get(key) === signature) continue;
    processedPins.set(key, signature);
    const split = key.indexOf(":");
    const kind = key.slice(0, split) as EntityKind;
    const id = key.slice(split + 1);
    const entry = loaded.get(key);
    const effective = entry ? resolvePinnedNode(kind, entry, pins.get(key) ?? []) : null;
    const row = effective?.row;
    const links = effective?.links ?? [];
    if (kind === "heritage")
      for (const e of edges)
        if (e.child === key && e.parent === null)
          e.category = row?.["kind"] as WorkspaceCategory;
    if (!row) continue;
    if (kind === "item")
      for (const e of edges)
        if (e.child === key && e.parent === null)
          e.data = { ...e.data, isNotEquippable: row["isNotEquippable"] };
    const latestVersionId = effective!.latestVersionId;
    const versionId = effective!.versionId;
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
    const oldChildren = new Set(inheritedPins.get(key)?.keys() ?? []);
    const memberships = new Map<EntityKey, string[]>();
    inheritedPins.set(key, memberships);
    // A newly discovered pin may select different memberships. Replace the old
    // outgoing edges rather than retaining live descendants beside the snapshot.
    for (let i = edges.length - 1; i >= 0; i--) if (edges[i]!.parent === key) edges.splice(i, 1);
    const layout = Array.isArray(row["membershipOrder"])
      ? (row["membershipOrder"] as string[])
      : [];
    for (const l of links) {
      const childKey: EntityKey = `${l.kind}:${l.id}`;
      oldChildren.add(childKey);
      const inheritedVersion = "versionId" in l ? l.versionId : l.data["versionId"];
      if (typeof inheritedVersion === "string") memberships.set(childKey, [...(memberships.get(childKey) ?? []), inheritedVersion]);
      const memberKey = `${l.kind}:${l.id}${l.data["role"] ? `:${l.data["role"]}` : ""}`;
      const order = layout.indexOf(memberKey);
      edge(key, l.kind, l.id, kind === "item" ? "ITEM" : "ALL", {
        ...l.data,
        ...(typeof inheritedVersion === "string" ? { versionId: inheritedVersion } : {}),
        ...(order >= 0 ? { sortOrder: order } : {}),
      });
    }
    refreshPins(oldChildren);
    // Obsolete descendants cannot keep contributing pins after their supplier
    // changes version and no other root still reaches them.
    const reachable = reachableKeys();
    const orphanChildren = new Set<EntityKey>();
    for (const [parent, supplied] of inheritedPins) if (!reachable.has(parent)) {
      for (const child of supplied.keys()) orphanChildren.add(child);
      inheritedPins.delete(parent);
      nodes.delete(parent);
      processedPins.delete(parent);
      pending.delete(parent);
      for (let i = edges.length - 1; i >= 0; i--) if (edges[i]!.parent === parent) edges.splice(i, 1);
    }
    refreshPins(orphanChildren);
  }
  const reachable = reachableKeys();
  for (const key of nodes.keys()) if (!reachable.has(key)) nodes.delete(key);
  for (let i = edges.length - 1; i >= 0; i--) if (edges[i]!.parent !== null && !reachable.has(edges[i]!.parent!)) edges.splice(i, 1);
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
