import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterCapabilities, characterItems, characterPrimitives, characters, characterShares, characterWorkspaceCommands } from "@/db/schema";
import { permissionFromShare } from "@/lib/character/permission-policy";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import type { EntityKey, WorkspaceEdge, WorkspaceGraph, WorkspaceNode } from "@/lib/character/workspace/model";
import { visibleCharacterForks } from "@/lib/character/workspace/fork-grants";
import { readWorkspace } from "@/lib/character/workspace/read";
import { visibleDefinitionKeys } from "@/lib/publishing/definition-visibility";
import { splitProgressionSpend } from "@/lib/engine/bu-balance";
import {
  activeCharacterShare, assertCharacterActor, characterIdSchema, characterShareRole, characterSheetUrl,
  contextCursor, contextCursorSchema, ownsCharacter, readOnlyCharacterContext, requireCharacterAccess,
  type CharacterActor, type ContextConfig,
} from "./context-shared";

export { CharacterContextUnavailable, ContextCursorError } from "./context-shared";
export const listAccessibleCharactersInput = z.strictObject({ cursor: contextCursorSchema });
export const characterContextInput = z.strictObject({ characterId: characterIdSchema });
const rosterKey = z.strictObject({ name: z.string(), id: characterIdSchema });

export async function listAccessibleCharacters(
  actor: CharacterActor,
  input: z.input<typeof listAccessibleCharactersInput>,
  config: ContextConfig,
) {
  const { cursor } = listAccessibleCharactersInput.parse(input);
  const pagination = contextCursor(actor, config, "character-roster", rosterKey);
  const after = pagination.parse(cursor);
  const pageSize = 8;
  const sortedName = sql<string>`lower(${characters.name}) COLLATE "C"`;
  return readOnlyCharacterContext(async () => {
    await assertCharacterActor(actor);
    const rows = await db.select({
      id: characters.id, name: characters.name, userId: characters.userId, level: characters.level,
      sortedName, canEdit: characterShares.canEdit, shareRole: characterWorkspaceCommands.result,
    }).from(characters)
      .leftJoin(characterShares, activeCharacterShare(actor))
      .leftJoin(characterWorkspaceCommands, characterShareRole())
      .where(and(
        or(inArray(characters.userId, [actor.id, actor.clerkId]), sql`${characterShares.id} IS NOT NULL`),
        after ? sql`(${sortedName}, ${characters.id}) > (${after.name}::text COLLATE "C", ${after.id}::uuid)` : undefined,
      ))
      .orderBy(sortedName, characters.id).limit(pageSize + 1);
    const items = rows.slice(0, pageSize).map(row => ({
      characterId: row.id,
      name: row.name.slice(0, 180),
      level: row.level,
      permission: ownsCharacter(actor, row.userId) ? "OWNER" as const
        : permissionFromShare(row.canEdit === true, row.shareRole?.["canSuggest"] === true),
      sheetUrl: characterSheetUrl(config.resource, row.id),
    }));
    const last = rows[pageSize - 1];
    return { items, nextCursor: rows.length > pageSize && last
      ? pagination.sign({ name: last.sortedName, id: last.id }) : null };
  });
}

export function graphChildren(graph: WorkspaceGraph) {
  const children = new Map<EntityKey | null, WorkspaceEdge[]>();
  for (const edge of graph.edges) {
    if (!children.has(edge.parent)) children.set(edge.parent, []);
    children.get(edge.parent)!.push(edge);
  }
  return children;
}

/** A definition's current publication and a visible route from the root are both required. */
export function projectVisibleGraph(graph: WorkspaceGraph, allowed: ReadonlySet<EntityKey>) {
  const children = graphChildren(graph);
  const nodes = new Map(graph.nodes.filter(node => allowed.has(node.key) && !node.data["workspaceVersionIssue"])
    .map(node => [node.key, node]));
  const reachable = new Set<EntityKey>();
  const edges: WorkspaceEdge[] = [];
  const queue: (EntityKey | null)[] = [null];
  for (const parent of queue) {
    const siblings = children.get(parent) ?? [];
    const counts = new Map<string, number>();
    for (const edge of siblings) counts.set(edge.id, (counts.get(edge.id) ?? 0) + 1);
    for (const edge of siblings) {
      if (!nodes.has(edge.child) || !edge.id || edge.id.length > 200 || counts.get(edge.id) !== 1) continue;
      edges.push(edge);
      if (reachable.has(edge.child)) continue;
      reachable.add(edge.child);
      queue.push(edge.child);
    }
  }
  const projected = { ...graph, edges, nodes: [...nodes.values()].filter(node => reachable.has(node.key)) };
  const restricted = edges.length !== graph.edges.length || reachable.size !== graph.nodes.length;
  return { graph: projected, reachable, restricted };
}

export async function readVisibleGraph(actor: CharacterActor, characterId: string, existing?: WorkspaceGraph) {
  const canonical = existing ?? await readWorkspace(characterId);
  const visible = await visibleDefinitionKeys(actor.clerkId, canonical.nodes.map(node => node.key));
  const scopedForks = await visibleCharacterForks(actor.clerkId, canonical, visible);
  if (scopedForks.length) {
    await requireCharacterAccess(actor, characterId);
    for (const fork of scopedForks) visible.add(`capability:${fork.capabilityId}`);
  }
  return { canonical, scopedForks, ...projectVisibleGraph(canonical, visible) };
}

export function hasUnresolvedGraphDependencies(graph: WorkspaceGraph) {
  return graph.nodes.some(node => node.data["workspaceVersionIssue"] || node.data["templatePrimitiveId"]);
}

/** The sheet engine also consumes materialized rows. A stale row may have no graph path. */
export async function authorizesMaterializedSheetInputs(characterId: string, known: ReadonlySet<EntityKey>) {
  const [primitiveLinks, capabilityLinks, itemLinks] = await Promise.all([
    db.select({ id: characterPrimitives.primitiveId }).from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId)),
    db.select({ id: characterCapabilities.capabilityId }).from(characterCapabilities).where(eq(characterCapabilities.characterId, characterId)),
    db.select({ id: characterItems.itemId }).from(characterItems).where(eq(characterItems.characterId, characterId)),
  ]);
  return primitiveLinks.every(row => known.has(`primitive:${row.id}`))
    && capabilityLinks.every(row => known.has(`capability:${row.id}`))
    && itemLinks.every(row => known.has(`item:${row.id}`));
}

const locations = new Set(["ALL", "LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]);
const maxSlots = 40;
const maxEdges = 20;

export function projectBuildSlots(graph: WorkspaceGraph, permission: "OWNER" | "EDITOR" | "SUGGESTER" | "VIEWER") {
  const nodes = new Map(graph.nodes.map(node => [node.key, node]));
  const children = graphChildren(graph);
  for (const siblings of children.values()) siblings.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  const slots: ReturnType<typeof slot>[] = [];
  let partial = false;
  function slot(node: WorkspaceNode, edge: WorkspaceEdge, path: string[], location: string) {
    return {
      path, occurrenceId: edge.instanceId ?? null, kind: node.kind, name: node.name.slice(0, 180),
      pin: edge.versionId ?? node.versionId, location, isMirrored: edge.isMirrored,
      canSelectDestination: permission !== "VIEWER" && node.kind !== "primitive" && !node.data["workspaceHistoricalVersion"],
    };
  }
  function visit(parent: EntityKey | null, path: string[], ancestors: Set<EntityKey>, location: string) {
    for (const edge of children.get(parent) ?? []) {
      if (slots.length >= maxSlots) { partial = true; break; }
      const node = nodes.get(edge.child);
      if (!node || ancestors.has(edge.child) || path.length >= maxEdges) { partial = true; continue; }
      const place = edge.category !== "ALL" && locations.has(edge.category) ? edge.category : location;
      const next = [...path, edge.id];
      slots.push(slot(node, edge, next, place));
      visit(edge.child, next, new Set([...ancestors, edge.child]), place);
    }
  }
  visit(null, [], new Set(), "ALL");
  return { slots, partial };
}

export async function readCharacterBuild(
  actor: CharacterActor,
  input: z.input<typeof characterContextInput>,
  config: ContextConfig,
) {
  const { characterId } = characterContextInput.parse(input);
  return readOnlyCharacterContext(async () => {
    const { character, permission } = await requireCharacterAccess(actor, characterId);
    const view = await readVisibleGraph(actor, characterId);
    const slots = projectBuildSlots(view.graph, permission);
    const budgetRestricted = view.restricted || hasUnresolvedGraphDependencies(view.canonical)
      || !await authorizesMaterializedSheetInputs(characterId, view.reachable);
    const sheet = budgetRestricted ? null : await readDraftSheet(characterId, view.canonical);
    let budget = null;
    if (sheet) {
      const { progressionPool, progressionSpent, itemBuSpent } = sheet.buBalance;
      const { rating: drawbackCredit, ceiling: debtCeiling, exceeded: debtExceeded } = sheet.volatility;
      const { remaining, ordinarySpent, debtUsed, uncoveredExcess } = splitProgressionSpend(progressionSpent, progressionPool, drawbackCredit);
      budget = {
        progressionPool, progressionSpent, progressionRemaining: remaining, itemSpent: itemBuSpent,
        ordinarySpent, netSpent: progressionSpent - drawbackCredit, drawbackCredit, debtUsed,
        debtAvailable: Math.max(0, Math.min(drawbackCredit, debtCeiling) - debtUsed), debtCeiling, debtExceeded, uncoveredExcess,
      };
    }
    return {
      characterId, name: character.name.slice(0, 180), permission, revision: view.canonical.revision,
      foundation: {
        size: character.size, level: character.level,
        attributes: { physical: character.attrPhysical, mental: character.attrMental, magical: character.attrMagical },
        proficientAttribute: character.attrProficient,
      },
      slots: slots.slots,
      budget,
      partial: budgetRestricted || slots.partial, sheetUrl: characterSheetUrl(config.resource, characterId),
    };
  });
}
