import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterConsequences, publications } from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { isPublicCharacterPreview } from "@/lib/character/public-preview-policy";
import { checkVisibility } from "@/lib/publishing/visibility";
import type { CharacterPermission } from "@/lib/character/permission-policy";
import { parseBackstory } from "@/lib/character/character-backstory";
import { effectivePrimitiveLinks } from "@/lib/character/workspace/effective-primitives";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { readWorkspace } from "@/lib/character/workspace/read";
import type { EntityKey, WorkspaceEdge, WorkspaceGraph, WorkspaceNode } from "@/lib/character/workspace/model";
import { supplyPaths } from "@/lib/character/workspace/model";
import { loadWorkspaceNodes, type LoadedNode } from "@/lib/character/workspace/load-nodes";
import { resolvePinnedNode } from "@/lib/character/workspace/pinned-versions";
import { flipOperation } from "@/lib/engine/mirror";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import type { HardModifier } from "@/types/swordweave";
import type { CharacterSheet } from "@/lib/engine/sheet";
import { restRecoveryAllowance } from "@/lib/play-state/rest-recovery";
import { computeLoad, computeEquipSlotsUsed, SIZE_LOAD, type CharacterSize } from "@/lib/engine/encumbrance";
import type { CharacterPdfPrimitiveLink, CharacterPdfRecord, CharacterPdfSnapshot } from "./types";

type SourcePrimitiveLink = CharacterPdfRecord & {
  primitiveId: number;
  primitive: CharacterPdfRecord;
  isMirrored?: boolean;
};
export type CharacterPdfSource = typeof characters.$inferSelect & {
  primitiveLinks: SourcePrimitiveLink[];
  capabilityLinks: Array<CharacterPdfRecord & { capabilityId: string }>;
  itemLinks: Array<CharacterPdfRecord & { itemId: string }>;
  heritageLinks: Array<CharacterPdfRecord & { heritageId: string }>;
};

/** Defense in depth for arbitrary historical snapshots/nested entity JSON. */
function printableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Set) return [...value].map(printableValue);
  if (Array.isArray(value)) return value.map(printableValue);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/^(dm_?notes|private_?dm_?notes)$/i.test(key))
      .map(([key, entry]) => [key, printableValue(entry)]),
  );
  return value;
}
function record(value: unknown): CharacterPdfRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as CharacterPdfRecord : {};
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

/** Match the mirrored wording displayed by the character workspace. The
 * stored definition/modifiers stay intact for resolver and provenance use. */
export function characterPdfRuleText(primitive: CharacterPdfRecord, mirrored: boolean): string {
  const stored = text(primitive["mechanicalOutputText"]) || text(primitive["mechanicalDescription"]);
  if (!mirrored) return stored || text(primitive["narrativeRule"]);
  const modifiers = primitive["hardModifiers"];
  if (!Array.isArray(modifiers) || !modifiers.length) return stored || text(primitive["narrativeRule"]);
  const inverse = modifiers.map((entry) => {
    const modifier = record(entry) as unknown as HardModifier;
    return { ...modifier, operation: flipOperation(String(modifier.operation)) ?? modifier.operation };
  });
  return mechanicalDescriptionFromModifiers(inverse as HardModifier[]) || stored || text(primitive["narrativeRule"]);
}

function primitiveDefinition(data: CharacterPdfRecord, mirrored: boolean): CharacterPdfPrimitiveLink["primitive"] {
  return {
    ...data,
    id: Number(data["id"]), name: text(data["name"]),
    originalMechanicalOutputText: text(data["mechanicalOutputText"]),
    mechanicalOutputText: characterPdfRuleText(data, mirrored),
    narrativeRule: text(data["narrativeRule"]),
  };
}

/** Pure projection allows fixture tests without opening a DB connection or
 * performing mutations. Actual purchases remain occurrence rows; references
 * live in the graph and do not add extra character acquisitions. */
export function createCharacterPdfSnapshot(
  row: CharacterPdfSource,
  graph: WorkspaceGraph,
  sheet: CharacterSheet,
  permission: CharacterPermission,
  conditions: unknown[] = [],
  conflictingNodes: ReadonlyMap<EntityKey, LoadedNode> = new Map(),
): CharacterPdfSnapshot {
  const nodes = new Map(graph.nodes.map(node => [node.key, node]));
  const children = new Map<EntityKey, WorkspaceEdge[]>();
  for (const edge of graph.edges) if (edge.parent) children.set(edge.parent, [...(children.get(edge.parent) ?? []), edge]);
  for (const edges of children.values()) edges.sort((a, b) => a.order - b.order);

  function definition(node: WorkspaceNode, mirrored = false, ancestors: EntityKey[] = [], versionId?: string | null): CharacterPdfRecord {
    const versions = conflictingNodes.get(node.key);
    const effective = versions && versionId ? resolvePinnedNode(node.kind, versions, [versionId]) : null;
    const data = effective?.row ?? node.data;
    if (data["workspaceVersionIssue"]) throw new Error("Resolve the character's unavailable pinned version before exporting its rules.");
    const scalar: CharacterPdfRecord = { ...data, id: node.kind === "primitive" ? Number(node.id) : node.id, name: text(data["name"]) || node.name };
    if (node.kind === "primitive") return primitiveDefinition(scalar, mirrored);
    if (ancestors.includes(node.key)) return scalar;
    const memberships: WorkspaceEdge[] = effective ? effective.links.map((link, order) => ({
      id: `pdf:${node.key}:${link.kind}:${link.id}:${order}`, parent: node.key,
      child: `${link.kind}:${link.id}`, category: node.kind === "item" ? "ITEM" : "ALL",
      order, isMirrored: link.data["isMirrored"] === true, data: link.data,
      versionId: typeof (record(link)["versionId"] ?? link.data["versionId"]) === "string"
        ? String(record(link)["versionId"] ?? link.data["versionId"]) : null,
    })) : children.get(node.key) ?? [];
    const members = memberships.flatMap(edge => {
      const child = nodes.get(edge.child);
      if (!child) throw new Error("A referenced character rule is unavailable. Restore it before exporting the complete character.");
      const isMirrored = mirrored || edge.isMirrored;
      const value = definition(child, isMirrored, [...ancestors, node.key], edge.versionId);
      return [{ ...edge.data, isMirrored, versionId: edge.versionId ?? child.versionId,
        [`${child.kind}Id`]: child.kind === "primitive" ? Number(child.id) : child.id,
        [child.kind]: value, kind: child.kind }];
    });
    return {
      ...scalar,
      description: text(scalar["description"]) || text(scalar["narrativeDescription"]) ||
        text(scalar["verboseDescription"]) || (effective ? "" : node.description),
      primitiveLinks: members.filter(member => member.kind === "primitive"),
      capabilityLinks: members.filter(member => member.kind === "capability"),
      effectLinks: members.filter(member => member.kind === "effect").map(member => {
        const effect = record(member["effect"]);
        return { ...member, effect: { ...effect, description: text(effect["narrativeDescription"]) || text(effect["description"]) } };
      }),
    };
  }
  const primitiveLinks = row.primitiveLinks.map(link => ({
    ...link,
    isMirrored: link.isMirrored === true,
    primitive: primitiveDefinition(link.primitive, link.isMirrored === true),
  }));
  const capabilities = row.capabilityLinks.flatMap(link => {
    const node = nodes.get(`capability:${link.capabilityId}`);
    if (!node) throw new Error("A character capability is unavailable. Restore it before exporting the complete character.");
    const capability = definition(node, false, [], typeof link["versionId"] === "string" ? link["versionId"] : null);
    return [{ ...link, capability, effectLinks: capability["effectLinks"] ?? [] }];
  });
  const itemLinks = row.itemLinks.flatMap(link => {
    const node = nodes.get(`item:${link.itemId}`);
    if (!node) throw new Error("A character item is unavailable. Restore it before exporting the complete character.");
    const item = definition(node, false, [], typeof link["versionId"] === "string" ? link["versionId"] : null);
    const size = text(item["size"]) as CharacterSize;
    const encumbranceItem = { size: size in SIZE_LOAD ? size : "SMALL" as CharacterSize,
      loadValue: SIZE_LOAD[size] ?? SIZE_LOAD.SMALL, slotCount: Number(item["slotCost"] ?? 1),
      isTwoHanded: item["isTwoHanded"] === true, quantity: Number(link["quantity"] ?? 1),
      equipped: link["equipped"] === true, capacityBonus: 0, ignoreLoadBonus: 0 };
    return [{ ...link, item, load: computeLoad([encumbranceItem]), equippedSlotCost: computeEquipSlotsUsed([encumbranceItem]) }];
  });
  const heritageLinks = row.heritageLinks.flatMap(link => {
    const node = nodes.get(`heritage:${link.heritageId}`);
    if (!node) throw new Error("A character heritage is unavailable. Restore it before exporting the complete character.");
    return [{ ...link, heritage: definition(node, link["isMirrored"] === true, [], typeof link["versionId"] === "string" ? link["versionId"] : null) }];
  });
  // Independent effects and capability effects share their definitions. Item-
  // only effects stay below itemLinks; the renderer must not imply ownership.
  const effectLinks = graph.nodes.filter(node => node.kind === "effect" &&
    supplyPaths(graph, node.key).some(path => !path.item),
  ).map(node => ({ effectId: node.id, effect: definition(node) }));
  const practices = sheet.practices.map(practice => ({ ...practice }));
  const saves = Object.fromEntries(sheet.savingThrows.map(save => [save.attribute.toLowerCase(), save.bonus])) as CharacterPdfSnapshot["pdfDerived"]["saves"];
  const custom = { proficiency_bonus: sheet.proficiencyBonus, ...Object.fromEntries(sheet.savingThrows.map(save => [`${save.attribute.toLowerCase()}_saving_throw`, save.bonus])) };
  const readOnlyGraph: WorkspaceGraph = { ...graph, edges: graph.edges.map(edge => {
    const node = nodes.get(edge.child);
    return node?.kind === "primitive" ? { ...edge, data: { ...edge.data, pdfMechanicalOutputText: characterPdfRuleText(node.data, edge.isMirrored) } } : edge;
  }) };
  const snapshot = printableValue({
    id: row.id, name: row.name, level: row.level, size: sheet.resolvedSize || row.size,
    portraitUrl: row.portraitUrl, portraitFrame: row.portraitFrame,
    notes: permission === "OWNER" || permission === "EDITOR" ? row.notes : null,
    dmNotes: null, viewerPermission: permission,
    lineageName: row.lineageName, lineageDescription: row.lineageDescription,
    upbringingName: row.upbringingName, upbringingDescription: row.upbringingDescription,
    manifestName: row.manifestName, backstory: parseBackstory(row.backstory), mode: row.mode,
    attrPhysical: row.attrPhysical, attrMental: row.attrMental, attrMagical: row.attrMagical,
    attrProficient: row.attrProficient, startingBu: row.startingBu, buSpent: row.buSpent,
    dmBonusBu: row.dmBonusBu, currentVitality: row.currentVitality, enforceTemplateCaps: row.enforceTemplateCaps,
    primitiveLinks, capabilityLinks: capabilities, effectLinks, itemLinks, heritageLinks,
    readOnlyGraph, readOnlyConditions: conditions,
    practices, vitality: sheet.vitality, encumbrance: sheet.encumbrance,
    speedByType: sheet.speedByType, carryCapacity: sheet.carryCapacity,
    behaviorVariables: sheet.behaviorVariables, buBalance: sheet.buBalance,
    volatility: sheet.volatility, dc: sheet.dc, proficiencyBonus: sheet.proficiencyBonus,
    savingThrows: sheet.savingThrows,
    conditionContext: { character: {
      attributes: sheet.attributes, practices: Object.fromEntries(practices.map(p => [p.practice, p.total])),
      vitality: sheet.vitality.current ?? sheet.vitality.max, vitalityMax: sheet.vitality.max,
      saveDc: sheet.dc, proficiencies: practices.filter(p => p.training > 0).map(p => p.practice), flags: [], custom,
    } },
    pdfDerived: {
      rollMarkers: sheet.rollMarkers ?? {},
      attributes: sheet.attributes, saves, practices, pb: sheet.proficiencyBonus, dc: sheet.dc,
      movement: { walk: sheet.speedByType["WALKING_SPEED"] ?? 0, climb: sheet.speedByType["CLIMBING_SPEED"] ?? 0,
        swim: sheet.speedByType["SWIMMING_SPEED"] ?? 0, fly: sheet.speedByType["FLYING_SPEED"] ?? 0, burrow: sheet.speedByType["BURROWING_SPEED"] ?? 0 },
      restCap: restRecoveryAllowance(sheet.vitality.max, {}).allowance,
      slotCapacity: sheet.encumbrance.equipSlotsAvailable, carryCapacity: sheet.carryCapacity,
      equippedSlotsUsed: sheet.encumbrance.equipSlotsUsed, currentLoad: sheet.encumbrance.load,
    },
  }) as CharacterPdfSnapshot;
  return { ...snapshot, dmNotes: null };
}

/** Authorization happens before any component graph, narrative or conditions
 * are loaded. This path only selects data; it never bumps versions, restores
 * state, publishes a character or writes a snapshot to the DB. */
export async function loadCharacterPdfSnapshot(characterId: string, clerkUserId: string | null): Promise<CharacterPdfSnapshot> {
  let permission: CharacterPermission;
  try {
    permission = (await resolveCharacterAccess(clerkUserId, characterId)).permission;
  } catch (error) {
    if (!(error instanceof CharacterAccessDenied)) throw error;
    // The public sheet allows catalogue/follower readers as well as explicit
    // shares. Resolve the same visibility grant before loading private fields.
    const preview = await db.query.characters.findFirst({
      where: eq(characters.id, characterId), columns: { id: true, userId: true, isPublic: true },
    });
    if (!preview) throw error;
    const publication = await db.query.publications.findFirst({
      where: and(eq(publications.targetType, "CHARACTER"), eq(publications.targetId, characterId)),
      columns: { visibility: true, unpublishedAt: true }, orderBy: desc(publications.publishedAt),
    });
    const readable = isPublicCharacterPreview(preview.isPublic, publication) || (await checkVisibility({
      targetType: "CHARACTER", targetId: characterId, ownerId: preview.userId,
      isPublic: preview.isPublic, viewerId: clerkUserId,
    })).allowed;
    if (!readable) throw error;
    permission = "VIEWER";
  }
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
      heritageLinks: { with: { heritage: true } },
    },
  });
  if (!row) throw new Error("Character not found.");
  const [graph, primitiveLinks, conditionRows] = await Promise.all([
    readWorkspace(characterId), effectivePrimitiveLinks(row.primitiveLinks),
    db.select({ occurrence: characterConsequences.occurrence }).from(characterConsequences)
      .where(and(eq(characterConsequences.characterId, characterId), isNull(characterConsequences.deletedAt))),
  ]);
  const [sheet, conflictingNodes] = await Promise.all([
    readDraftSheet(characterId, graph),
    loadWorkspaceNodes(graph.nodes.filter(node => node.data["workspaceVersionIssue"]).map(node => node.key)),
  ]);
  return createCharacterPdfSnapshot({ ...row, primitiveLinks } as unknown as CharacterPdfSource,
    graph, sheet, permission, conditionRows.map(entry => entry.occurrence), conflictingNodes);
}
