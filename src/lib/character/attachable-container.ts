import { createHash } from "node:crypto";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { effectConditions, effectEffects, primitives, primitiveVersions } from "@/db/schema";
import { loadCreationCapabilities } from "@/lib/character/creation-capability";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { loadWorkspaceNodes, type LoadedNode } from "@/lib/character/workspace/load-nodes";
import type { EntityKey } from "@/lib/character/workspace/model";
import {
  buildCanonicalEffectPayload, buildCanonicalItemPayload, buildCanonicalTemplatePayload, canonicalJsonStringify,
} from "@/lib/publishing/hash-content";
import { visibleDefinitionKeys } from "@/lib/publishing/definition-visibility";
import { dependencyReferences, readDependencyPins } from "@/lib/versions/dependency-pins";

export type AttachableContainerKind = "effect" | "heritage" | "item";
const maxMembers = 24;
const maxBundleNodes = 64;
const heritageChannel = z.enum(["LINEAGE", "UPBRINGING", "MANIFEST"]);
const storedVersion = z.uuid();
const text = (value: unknown) => typeof value === "string" ? value : "";
const nullableText = (value: unknown) => typeof value === "string" ? value : null;
const digest = (value: unknown) => createHash("sha256").update(canonicalJsonStringify(value)).digest("hex");

export function attachmentMemberDetails(data: Record<string, unknown> = {}) {
  return {
    isMirrored: data["isMirrored"] === true, role: typeof data["role"] === "string" ? data["role"] : "OTHER",
    quantity: Number(data["quantity"] ?? 1), notes: text(data["notes"]), slotLabel: text(data["slotLabel"]),
    targetWho: text(data["targetWho"]) || "self",
  };
}

export type ContainerAttachmentMember = ReturnType<typeof attachmentMemberDetails> & { child: EntityKey; pin: string; name: string };
export type ContainerAttachmentGraph = { parent: EntityKey; members: ContainerAttachmentMember[] }[];

function canonicalContainer(kind: AttachableContainerKind, entry: LoadedNode, isPublic: boolean) {
  const { row, links } = entry;
  const common = {
    name: text(row["name"]), isPublic, membershipOrder: row["membershipOrder"] == null ? null : z.array(z.string()).parse(row["membershipOrder"]),
    iconSource: nullableText(row["iconSource"]), iconKey: nullableText(row["iconKey"]), iconUrl: nullableText(row["iconUrl"]),
    iconColor: text(row["iconColor"]),
  };
  const primitiveSlots = links.filter(link => link.kind === "primitive").map(link => ({
    primitiveId: Number(link.id), ...attachmentMemberDetails(link.data),
  }));
  const primitiveIds = primitiveSlots.map(slot => slot.primitiveId);
  const capabilityIds = links.filter(link => link.kind === "capability").map(link => String(link.id));
  const effectIds = links.filter(link => link.kind === "effect").map(link => String(link.id));
  if (kind === "heritage") return buildCanonicalTemplatePayload({ ...common, kind: text(row["kind"]),
    description: text(row["description"]), suggestedTraits: text(row["suggestedTraits"]), defaultSize: nullableText(row["defaultSize"]),
    primitiveSlots: primitiveSlots.map(({ primitiveId, isMirrored }) => ({ primitiveId, isMirrored })), primitiveIds, capabilityIds });
  const tags = z.array(z.string()).parse(row["tags"]);
  if (kind === "effect") return buildCanonicalEffectPayload({ ...common, tags, narrativeDescription: text(row["narrativeDescription"]), primitiveSlots });
  return buildCanonicalItemPayload({ ...common, tags, itemType: text(row["itemType"]), rarity: text(row["rarity"]), size: text(row["size"]),
    buCost: z.number().int().nonnegative().parse(row["buCost"]), description: text(row["description"]),
    slotCost: z.number().int().nonnegative().parse(row["slotCost"]), quantity: z.number().int().positive().parse(row["quantity"]),
    isTwoHanded: row["isTwoHanded"] === true, isConsumable: row["isConsumable"] === true, actsAsFocus: row["actsAsFocus"] === true,
    isNotEquippable: row["isNotEquippable"] === true,
    primitiveSlots: primitiveSlots.map(({ primitiveId, isMirrored }) => ({ primitiveId, isMirrored })), primitiveIds, capabilityIds, effectIds });
}

function inspectContainer(key: EntityKey, entry: LoadedNode) {
  const kind = key.split(":")[0] as AttachableContainerKind;
  const [current] = entry.versions;
  if (entry.versions.length !== 1 || current?.deltaKind !== "FULL" || entry.links.length > maxMembers) return null;
  const snapshot = current.snapshot;
  const { dependencyPins: rawPins, ...content } = snapshot;
  if (typeof content["isPublic"] !== "boolean" || typeof content["name"] !== "string" || !content["name"]) return null;
  const type = kind === "heritage" ? heritageChannel.safeParse(entry.row["kind"]).data : undefined;
  if (kind === "heritage" && !type) return null;
  // Canonical versions intentionally omit some junction fields. If a live
  // membership uses one of those fields, the old snapshot cannot promise it.
  let canonical: Record<string, unknown>;
  try { canonical = { ...canonicalContainer(kind, entry, content["isPublic"]) }; }
  catch { return null; }
  if (canonicalJsonStringify(content) !== canonicalJsonStringify(canonical)) return null;
  const references = dependencyReferences(canonical);
  const pins = readDependencyPins(snapshot) ?? [];
  if ((rawPins !== undefined && (!Array.isArray(rawPins) || rawPins.length !== pins.length))
    || pins.length !== references.length || pins.length !== entry.links.length) return null;
  const byKey = new Map(pins.map(pin => [`${pin.kind}:${pin.id}`, pin]));
  if (byKey.size !== pins.length) return null;
  const live = new Map(entry.links.map(link => [`${link.kind}:${link.id}`, link]));
  if (live.size !== entry.links.length) return null;
  for (const ref of references) {
    const key = `${ref.kind}:${ref.id}`;
    const pin = byKey.get(key);
    const actual = live.get(key);
    if (!pin || !actual || pin.id !== ref.id || !storedVersion.safeParse(pin.versionId).success ||
      canonicalJsonStringify(pin.data) !== canonicalJsonStringify({ ...ref.data, versionId: pin.versionId })) return null;
    const details = attachmentMemberDetails(pin.data);
    if (details.isMirrored || details.targetWho !== "self" || !Number.isSafeInteger(details.quantity) || details.quantity < 1 ||
      canonicalJsonStringify(details) !== canonicalJsonStringify(attachmentMemberDetails(actual.data))) return null;
  }
  const layout = (canonical["membershipOrder"] as string[] | undefined) ?? [];
  if (new Set(layout).size !== layout.length || layout.some(member => !byKey.has(member))) return null;
  const order = new Map(layout.map((member, index) => [member, index]));
  const members = pins.map((pin, ordinal) => ({
    child: `${pin.kind}:${pin.id}` as EntityKey, pin: pin.versionId!,
    position: order.get(`${pin.kind}:${pin.id}`) ?? layout.length + ordinal, ...attachmentMemberDetails(pin.data),
  })).sort((left, right) => left.position - right.position).map(({ position: _position, ...member }) => member);
  return { key, name: content["name"], versionId: current.id, snapshotDigest: digest(snapshot), members,
    ...(type ? { channel: type } : {}), buCost: kind === "item" ? Number(canonical["buCost"]) : null };
}

async function loadContainers(keys: readonly EntityKey[], clerkId: string) {
  const visible = [...await visibleDefinitionKeys(clerkId, keys)];
  if (!visible.length) return [];
  const effects = visible.flatMap(key => key.startsWith("effect:") ? [key.slice(7)] : []);
  const [entries, nestedEffects, conditions] = await Promise.all([
    loadWorkspaceNodes(visible, true),
    effects.length ? db.select({ id: effectEffects.parentEffectId }).from(effectEffects).where(inArray(effectEffects.parentEffectId, effects)) : [],
    effects.length ? db.select({ id: effectConditions.effectId }).from(effectConditions).where(inArray(effectConditions.effectId, effects)) : [],
  ]);
  const unsupported = new Set([...nestedEffects, ...conditions].map(({ id }) => `effect:${id}`));
  return [...entries].flatMap(([key, entry]) => {
    if (unsupported.has(key)) return [];
    const checked = inspectContainer(key, entry);
    return checked ? [checked] : [];
  });
}

/** Resolve only a small, currently visible graph that the native workspace
 * can recreate exactly. Effects are leaves apart from their primitives. */
export async function loadAttachableContainers(kind: AttachableContainerKind, ids: readonly string[], clerkId: string) {
  const roots = await loadContainers(ids.map<EntityKey>(id => `${kind}:${id}`), clerkId);
  if (!roots.length) return [];
  const related = [...new Set(roots.flatMap(root => root.members.map(member => member.child)))];
  const [effectMembers, capabilities] = await Promise.all([
    loadContainers(related.filter(key => key.startsWith("effect:")), clerkId),
    loadCreationCapabilities(clerkId, related.flatMap(key => key.startsWith("capability:") ? [key.slice(11)] : [])),
  ]);
  const nested = new Map([...effectMembers, ...capabilities.map(cap => ({
    key: `capability:${cap.id}` as EntityKey, name: cap.name, versionId: cap.versionId, snapshotDigest: cap.snapshotDigest,
    members: cap.members.map(({ primitive, ...member }) => ({
      child: `primitive:${member.id}` as EntityKey, pin: primitive.versionId, isMirrored: false,
      role: member.role, quantity: member.quantity, notes: member.notes, slotLabel: member.slotLabel, targetWho: member.targetWho,
    })),
  }))].map(node => [node.key, node]));
  const primitiveKeys = [...new Set([...roots, ...nested.values()].flatMap(node =>
    node.members.flatMap(member => member.child.startsWith("primitive:") ? [member.child] : [])))];
  const visiblePrimitives = await visibleDefinitionKeys(clerkId, primitiveKeys);
  const primitiveRows = visiblePrimitives.size ? await db.select({ id: primitives.id, name: primitives.name, buCost: primitives.buCost,
    versionId: primitiveVersions.id, snapshot: primitiveVersions.snapshot,
  }).from(primitives).innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id)).where(and(
    inArray(primitives.id, [...visiblePrimitives].map(key => Number(key.slice(10)))), gte(primitives.buCost, 0), directPrimitivePinCondition,
  )) : [];
  const definitions = new Map(primitiveRows.map(({ snapshot, ...row }) => [`primitive:${row.id}` as EntityKey, { ...row, snapshotDigest: digest(snapshot) }]));
  return roots.flatMap(root => {
    const graph: ContainerAttachmentGraph = [];
    const pins = new Map<EntityKey, { versionId: string; snapshotDigest: string }>();
    const append = (container: typeof root | NonNullable<ReturnType<typeof nested.get>>) => {
      const members: ContainerAttachmentMember[] = [];
      for (const member of container.members) {
        const definition = definitions.get(member.child) ?? nested.get(member.child);
        if (!definition || definition.versionId !== member.pin || (pins.get(member.child)?.versionId ?? member.pin) !== member.pin) return false;
        pins.set(member.child, { versionId: definition.versionId, snapshotDigest: definition.snapshotDigest });
        members.push({ ...member, name: definition.name });
      }
      graph.push({ parent: container.key, members });
      return true;
    };
    if (!append(root)) return [];
    for (const key of new Set(root.members.map(member => member.child))) {
      const container = nested.get(key);
      if (container && !append(container)) return [];
    }
    if (pins.size > maxBundleNodes) return [];
    const buCost = root.buCost ?? [...pins.keys()].reduce((total, key) => total + (definitions.get(key)?.buCost ?? 0), 0);
    return [{ id: root.key.slice(kind.length + 1), name: root.name, versionId: root.versionId, channel: root.channel, buCost,
      graph, snapshotDigest: digest([root.snapshotDigest, [...pins]]) }];
  });
}
