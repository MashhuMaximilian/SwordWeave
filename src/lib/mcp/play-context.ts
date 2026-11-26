import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterConsequences, characterLog } from "@/db/schema";
import { loadCharacterMaxVitality } from "@/lib/character/character-vitality";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { activeRestrictions, occurrenceEnabled, type ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { consequenceBehaviorSchema } from "@/lib/character/consequences/validation";
import type { EntityKey, WorkspaceNode } from "@/lib/character/workspace/model";
import { readCharacterPlaySnapshot } from "@/lib/play-state/character";
import { authorizesMaterializedSheetInputs, characterContextInput, graphChildren, hasUnresolvedGraphDependencies, readVisibleGraph } from "./character-context";
import { packageKey, pinnedPackageSources } from "./package-source";
import {
  characterIdSchema, characterSheetUrl, contextCursor, contextCursorSchema, readOnlyCharacterContext,
  requireCharacterAccess, type CharacterActor, type ContextConfig,
} from "./context-shared";

export const characterHistoryInput = z.strictObject({ characterId: characterIdSchema, cursor: contextCursorSchema });
const historyKey = z.strictObject({ timestamp: z.string().min(1).max(50), id: z.number().int().positive() });
const runtimeLimit = 20;
const sourceUuid = z.uuid();
type VisibleGraph = Awaited<ReturnType<typeof readVisibleGraph>>;
type OccurrenceRecord = typeof characterConsequences.$inferSelect;

function hasVisibleRestrictions(occurrence: ConsequenceOccurrence, reachable: ReadonlySet<EntityKey>) {
  return [...occurrence.restrictions ?? [], ...occurrence.applicationSnapshot?.restrictions ?? []]
    .every(restriction => reachable.has(`${restriction.kind}:${restriction.entityId}`));
}

function occurrenceSource(occurrence: ConsequenceOccurrence, nodes: ReadonlyMap<EntityKey, WorkspaceNode>) {
  const key = `${occurrence.sourceEntityType}:${occurrence.sourceEntityId}`;
  const node = packageKey(key) ? nodes.get(key) : undefined;
  if (!node || (occurrence.sourceVersionId ?? null) !== node.versionId) return null;
  return { sourceKey: node.key, name: node.name.slice(0, 180), versionId: node.versionId };
}

const safeOccurrence = (record: OccurrenceRecord, view: VisibleGraph, nodes: ReadonlyMap<EntityKey, WorkspaceNode>) => {
  const occurrence = record.occurrence;
  if (record.occurrenceId !== occurrence.id || occurrence.id.length > 200 || !hasVisibleRestrictions(occurrence, view.reachable)) return null;
  if (occurrence.durationTier !== "manual" && occurrence.durationTier !== "short_rest" && occurrence.durationTier !== "long_rest") return null;
  const source = occurrenceSource(occurrence, nodes);
  if ((occurrence.source !== "custom" || occurrence.sourceEntityId || occurrence.sourceEntityType || occurrence.applicationId) && !source) return null;
  return { occurrenceId: record.occurrenceId, revision: record.revision,
    title: occurrence.title.slice(0, 180), duration: occurrence.durationTier, source };
};

/** The native package follows the complete subtree, even when only a subset of it would be shown. */
function packageProjection(view: VisibleGraph) {
  const children = graphChildren(view.canonical);
  const nodes = new Map(view.graph.nodes.map(node => [node.key, node]));
  const visibleEdges = new Set(view.graph.edges);
  const memo = new Map<EntityKey, { visible: boolean; authored: boolean }>();
  const restricted = { visible: false, authored: false };
  return function project(key: EntityKey, visiting: Set<EntityKey> = new Set(), depth = 0): { visible: boolean; authored: boolean } {
    const cached = memo.get(key);
    if (cached) return cached;
    const node = nodes.get(key);
    if (!node || node.data["templatePrimitiveId"] || visiting.has(key) || depth >= 20) return restricted;
    let authored = false;
    if (node.kind === "primitive" && node.data["consequenceBehavior"]) {
      const behavior = consequenceBehaviorSchema.safeParse(node.data["consequenceBehavior"]);
      if (!behavior.success || !behavior.data.restrictions.every(restriction => view.reachable.has(`${restriction.kind}:${restriction.entityId}`))) return restricted;
      authored = true;
    }
    const next = new Set([...visiting, key]);
    for (const edge of children.get(key) ?? []) {
      if (!visibleEdges.has(edge)) return restricted;
      const child = project(edge.child, next, depth + 1);
      if (!child.visible) return restricted;
      authored ||= child.authored;
    }
    const result = { visible: true, authored };
    memo.set(key, result);
    return result;
  };
}

function availableForPackage(view: VisibleGraph, occurrences: readonly ConsequenceOccurrence[]) {
  const restrictions = activeRestrictions(occurrences);
  const disabled = new Set(restrictions.map(restriction => `${restriction.kind}:${restriction.entityId}`));
  const children = graphChildren(view.graph);
  const queue: (EntityKey | null)[] = [null];
  const available = new Set<EntityKey>();
  for (const parent of queue) {
    for (const edge of children.get(parent) ?? []) {
      if (available.has(edge.child) || disabled.has(edge.child)) continue;
      if (parent === null && edge.child.startsWith("item:") && edge.data?.["equipped"] === false && !edge.data["isNotEquippable"]) continue;
      available.add(edge.child);
      queue.push(edge.child);
    }
  }
  return available;
}

function itemPathContains(view: VisibleGraph, itemKey: EntityKey, target: EntityKey) {
  if (!view.graph.edges.some(edge => edge.parent === null && edge.child === itemKey)) return false;
  const children = graphChildren(view.graph);
  const queue = [itemKey];
  const seen = new Set(queue);
  for (const key of queue) {
    for (const edge of children.get(key) ?? []) {
      if (edge.child === target) return true;
      if (seen.has(edge.child)) continue;
      seen.add(edge.child);
      queue.push(edge.child);
    }
  }
  return false;
}

function runtimeMarkers(overrides: Record<string, unknown>, view: VisibleGraph, nodes: ReadonlyMap<EntityKey, WorkspaceNode>) {
  const toggles: Array<{ kind: string; name: string; itemName?: string; active: boolean }> = [];
  for (const [field, value] of Object.entries(overrides).sort(([left], [right]) => left.localeCompare(right))) {
    if (value !== true) continue;
    const [kind, id, capability] = field.split(":");
    if (kind === "cap" || kind === "eff") {
      const node = nodes.get(`${kind === "cap" ? "capability" : "effect"}:${id}`);
      if (node) toggles.push({ kind: node.kind, name: node.name.slice(0, 180), active: false });
    } else if (kind === "itemcap") {
      const item = nodes.get(`item:${id}`);
      const node = nodes.get(`capability:${capability}`);
      if (item && node && itemPathContains(view, item.key, node.key)) {
        toggles.push({ kind: "item-capability", name: node.name.slice(0, 180), itemName: item.name.slice(0, 180), active: true });
      }
    }
    if (toggles.length > runtimeLimit) break;
  }
  const recovery = overrides["shortRestRecoveryUsed"];
  return { toggles: toggles.slice(0, runtimeLimit), truncated: toggles.length > runtimeLimit,
    shortRestRecoveryUsed: typeof recovery === "number" && Number.isSafeInteger(recovery) && recovery >= 0 ? recovery : null };
}

export async function loadPlayContext(actor: CharacterActor, characterId: string, minimum: "EDITOR" | "OWNER" = "EDITOR") {
  const { character, permission } = await requireCharacterAccess(actor, characterId, minimum);
  const [view, snapshot] = await Promise.all([
    readVisibleGraph(actor, characterId), readCharacterPlaySnapshot(characterId, character.currentVitality),
  ]);
  const nodes = new Map(view.graph.nodes.map(node => [node.key, node]));
  const active = snapshot.records.filter(record => !record.deletedAt && occurrenceEnabled(record.occurrence));
  const summaries = active.map(record => safeOccurrence(record, view, nodes));
  const unknownVitality = view.restricted || hasUnresolvedGraphDependencies(view.canonical) || summaries.some(value => value === null)
    || !await authorizesMaterializedSheetInputs(characterId, view.reachable);
  let maxVitality = unknownVitality ? null : (await loadCharacterMaxVitality(characterId, view.canonical)).max;
  if (maxVitality !== null && view.canonical.nodes.some(node => node.data["workspaceHistoricalVersion"])) {
    const sheet = await readDraftSheet(characterId, view.canonical);
    if (sheet.vitality.max !== maxVitality) maxVitality = null;
  }
  return { character, permission, view, nodes, snapshot, active, summaries, maxVitality };
}

export async function readCharacterPlayState(
  actor: CharacterActor,
  input: z.input<typeof characterContextInput>,
  config: Pick<ContextConfig, "resource">,
) {
  const { characterId } = characterContextInput.parse(input);
  return readOnlyCharacterContext(async () => {
    const { character, permission, view, nodes, snapshot, active, summaries, maxVitality } = await loadPlayContext(actor, characterId);
    const owner = permission === "OWNER";
    const markers = runtimeMarkers(snapshot.state.overrides, view, nodes);
    const occurrences = owner ? summaries.filter(summary => summary !== null) : [];
    const allowed = owner && maxVitality !== null && character.userId === actor.clerkId
      ? availableForPackage(view, active.map(record => record.occurrence)) : new Set<EntityKey>();
    const projectPackage = packageProjection(view);
    const pinnedSource = pinnedPackageSources(view, active.map(record => record.occurrence), snapshot.state.overrides);
    const candidates = view.graph.nodes.filter(node => allowed.has(node.key) && packageKey(node.key) && projectPackage(node.key).authored)
      .sort((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
    const choices = [];
    for (const candidate of candidates) {
      if (pinnedSource(candidate.key)) choices.push(candidate);
      if (choices.length > runtimeLimit) break;
    }
    return {
      characterId, characterName: character.name.slice(0, 200), revision: snapshot.state.revision, permission,
      currentVitality: character.currentVitality ?? maxVitality, maxVitality,
      markers: { toggles: markers.toggles, shortRestRecoveryUsed: markers.shortRestRecoveryUsed },
      ...(owner ? {
        consequences: occurrences.slice(0, runtimeLimit),
        sourceChoices: choices.slice(0, runtimeLimit).map(node => ({ sourceKey: node.key, name: node.name.slice(0, 180), versionId: node.versionId })),
      } : {}),
      partial: maxVitality === null || markers.truncated || choices.length > runtimeLimit || occurrences.length > runtimeLimit,
      sheetUrl: characterSheetUrl(config.resource, characterId),
    };
  });
}

const number = z.number().int().min(-2147483648).max(2147483647);
const vitalityLog = z.object({ prev: number, next: number, delta: number, package: z.string().optional(), source: z.string().optional() });
const restLog = z.object({ restType: z.enum(["short", "long"]), vitalityRestored: number });
const triggerLog = z.object({ capabilityId: sourceUuid, scope: z.enum(["character", "item"]).optional(), itemId: z.string().optional() });

function historyProjection(view: VisibleGraph) {
  const byKey = new Map(view.graph.nodes.map(node => [node.key, node]));
  const projectPackage = packageProjection(view);
  return function project(kind: typeof characterLog.$inferSelect["kind"], payload: unknown) {
    if (kind === "vitality_change") {
      const row = vitalityLog.safeParse(payload);
      if (!row.success || (row.data.source === "consequence" && !row.data.package)) return null;
      const { prev, next } = row.data;
      const key = row.data.package;
      if (key && (!packageKey(key) || !projectPackage(key).visible)) return null;
      return { kind, previous: prev, current: next, delta: next - prev };
    }
    if (kind === "rest") {
      const row = restLog.safeParse(payload);
      return row.success ? { kind, ...row.data } : null;
    }
    if (kind === "capability_trigger") {
      const row = triggerLog.safeParse(payload);
      if (!row.success) return null;
      const capability = byKey.get(`capability:${row.data.capabilityId}`);
      if (!capability || !projectPackage(capability.key).visible) return null;
      if (row.data.scope === "item" || row.data.itemId) {
        const item = row.data.itemId && byKey.get(`item:${row.data.itemId}`);
        if (!item || !itemPathContains(view, item.key, capability.key)) return null;
      }
      return { kind, name: capability.name.slice(0, 180) };
    }
    return null;
  };
}

export async function readCharacterHistory(
  actor: CharacterActor,
  input: z.input<typeof characterHistoryInput>,
  config: ContextConfig,
) {
  const { characterId, cursor } = characterHistoryInput.parse(input);
  const pagination = contextCursor(actor, config, "character-history", historyKey, characterId);
  const after = pagination.parse(cursor);
  const scanLimit = 60;
  return readOnlyCharacterContext(async () => {
    await requireCharacterAccess(actor, characterId, "OWNER");
    const rows = await db.select({
      id: characterLog.id, kind: characterLog.kind, payload: characterLog.payload, createdAt: characterLog.createdAt,
      timestamp: sql<string>`${characterLog.createdAt}::text`,
    }).from(characterLog).where(and(
      eq(characterLog.characterId, characterId),
      inArray(characterLog.kind, ["vitality_change", "rest", "capability_trigger"]),
      after ? sql`(${characterLog.createdAt}, ${characterLog.id}) < (${after.timestamp}::timestamptz, ${after.id}::bigint)` : undefined,
    )).orderBy(desc(characterLog.createdAt), desc(characterLog.id)).limit(scanLimit + 1);
    const project = historyProjection(await readVisibleGraph(actor, characterId));
    const entries = [];
    let consumed = 0;
    for (const row of rows.slice(0, scanLimit)) {
      consumed++;
      const summary = project(row.kind, row.payload);
      if (summary) entries.push({ createdAt: row.createdAt.toISOString(), ...summary });
      if (entries.length >= runtimeLimit) break;
    }
    const last = rows[consumed - 1];
    return { characterId, entries, nextCursor: last && rows.length > consumed
      ? pagination.sign({ timestamp: last.timestamp, id: last.id }) : null,
      sheetUrl: characterSheetUrl(config.resource, characterId) };
  });
}
