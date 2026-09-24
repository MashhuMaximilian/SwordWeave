import { canonicalJsonStringify } from "@/lib/publishing/hash-content";
import { pinnedOperationIssue } from "./pinned-versions";
import { relocateWorkspacePiece } from "./relocate";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import * as s from "@/db/schema";
import { canResolveCharacter, CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { readWorkspace } from "./read";
import { executeWorkspaceCommand, WorkspaceConflict } from "./commands";
import { executeWorkspaceCreate } from "./create";
import { withDraftExecution } from "./draft-scope";
import { mapDraftIdentities, registerDraftIdentities } from "./draft-aliases";
import { readDraftSheet } from "./draft-sheet";
import type { DraftOperation, WorkspaceDraft, WorkspaceDraftPreview } from "./draft-types";
import type { WorkspaceGraph } from "./model";

const characterDraftSchema = z.object({
  portraitUrl: z.string().trim().max(8192).transform(value => value || null).nullable().optional(),
  portraitFrame: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(0.5).max(3) }).strict().optional(),
  name: z.string().trim().min(1).max(200).optional(), notes: z.string().max(50000).nullable().optional(),
  backstory: z.record(z.string(), z.string().max(50000)).optional(),
  attrPhysical: z.number().int().min(-1).max(5).optional(), attrMental: z.number().int().min(-1).max(5).optional(), attrMagical: z.number().int().min(-1).max(5).optional(),
  attrProficient: z.enum(["PHYSICAL", "MENTAL", "MAGICAL"]).nullable().optional(),
  level: z.number().int().min(1).max(2147483647).optional(), startingBu: z.number().int().min(0).max(2147483647).optional(),
  size: z.enum(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]).optional(),
  lineageName: z.string().max(200).nullable().optional(), lineageDescription: z.string().max(50000).nullable().optional(),
  upbringingName: z.string().max(200).nullable().optional(), upbringingDescription: z.string().max(50000).nullable().optional(),
  manifestName: z.string().max(200).nullable().optional(),
}).strict();
export const draftOperationsSchema = z.array(z.discriminatedUnion("type", [
  z.object({ id: z.string().uuid(), groupId: z.string().uuid().optional(), type: z.literal("relocate"), label: z.string().max(200).optional(), path: z.array(z.string()).min(1).max(20), destinationPath: z.array(z.string()).max(20).optional(), category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]) }),
  z.object({ id: z.string().uuid(), groupId: z.string().uuid().optional(), type: z.literal("character"), label: z.string().max(200).optional(), payload: characterDraftSchema }),
  z.object({ id: z.string().uuid(), groupId: z.string().uuid().optional(), type: z.literal("create"), label: z.string().max(200).optional(), payload: z.object({
    kind: z.enum(["primitive", "effect", "capability", "heritage", "item"]), category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]),
    draft: z.record(z.string(), z.unknown()), mirrored: z.boolean().optional(), existingId: z.string().optional(), target: z.string().optional(), path: z.array(z.string()).optional(), expectedHash: z.string().nullable().optional(),
  }) }),
  z.object({ id: z.string().uuid(), groupId: z.string().uuid().optional(), type: z.literal("command"), label: z.string().max(200).optional(), payload: z.record(z.string(), z.unknown()) }),
  z.object({ id: z.string().uuid(), groupId: z.string().uuid().optional(), type: z.literal("move-root"), label: z.string().max(200).optional(), target: z.string().regex(/^(primitive|effect|capability|heritage|item):.+$/), path: z.array(z.string()).length(1), category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]) }),
])).max(100).superRefine((ops, ctx) => {
  if (new Set(ops.map(op => op.id)).size !== ops.length) ctx.addIssue({ code: "custom", message: "Each draft action needs a unique ID." });
});
const draftKind = "workspace-draft";
type StoredDraft = WorkspaceDraft & { baseHash: string; appliedResult?: WorkspaceDraftPreview };
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function workspaceBuildFingerprint(graph: WorkspaceGraph, character: Record<string, unknown>): string {
  // Runtime toggles, vitality, conditions and equipment are deliberately not
  // part of this build guard. Preview incorporates their current values.
  return hash(canonicalJsonStringify(JSON.parse(JSON.stringify({
    foundation: Object.fromEntries(["name", "notes", "backstory", "portraitUrl", "portraitFrame", "lineageName", "lineageDescription", "upbringingName", "upbringingDescription", "manifestName", "level", "startingBu", "dmBonusBu", "attrPhysical", "attrMental", "attrMagical", "attrProficient", "practiceSlices", "size"].map(k => [k, character[k]])),
    nodes: graph.nodes.map(n => [n.key, n.data["contentHash"] ?? null, n.versionId, n.name, n.bu, n.description, n.data]).sort(),
    edges: graph.edges.map(e => [e.id, e.parent, e.child, e.category, e.isMirrored, e.versionId, e.order,
      Object.fromEntries(Object.entries(e.data ?? {}).filter(([key]) => !["createdAt", "updatedAt", "isToggledOn", "isToggledOff", "equipped", "isEquipped", "currentCharges", "chargesRemaining"].includes(key))),
    ]).sort(),
  }))));
}
async function access(characterId: string, userId: string, apply = false) {
  const result = await canResolveCharacter(userId, characterId);
  if (result.permission === "VIEWER" || (apply && result.permission !== "OWNER" && result.permission !== "EDITOR"))
    throw new CharacterAccessDenied(characterId);
  return result;
}
async function lockCharacter(characterId: string) {
  const [character] = await db.select().from(s.characters).where(eq(s.characters.id, characterId)).for("update");
  if (!character) throw new Error("Character not found.");
  return character;
}
export async function getWorkspaceDraft(characterId: string, userId: string): Promise<WorkspaceDraft | null> {
  await access(characterId, userId);
  const rows = await db.select().from(s.characterWorkspaceCommands).where(and(
    eq(s.characterWorkspaceCommands.characterId, characterId), eq(s.characterWorkspaceCommands.kind, draftKind),
    sql`${s.characterWorkspaceCommands.result}->>'authorId' = ${userId}`,
    sql`${s.characterWorkspaceCommands.result}->>'status' = 'editing'`,
  ));
  return rows.map(row => row.result as unknown as StoredDraft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
export async function saveWorkspaceDraft(characterId: string, userId: string, raw: unknown): Promise<WorkspaceDraft> {
  const body = z.object({ draftId: z.string().uuid().optional(), expectedVersion: z.number().int().nonnegative(), baseRevision: z.number().int().nonnegative(), operations: draftOperationsSchema }).parse(raw);
  await access(characterId, userId);
  return withDatabaseTransaction(async () => {
    const character = await lockCharacter(characterId);
    await access(characterId, userId);
    const existing = body.draftId ? await readStoredDraft(characterId, userId, body.draftId) : null;
    if (!body.draftId && await getWorkspaceDraft(characterId, userId))
      throw new WorkspaceConflict("There is already a saved draft for this character. Reload it to continue safely.");
    if (existing && (existing.version !== body.expectedVersion || existing.status !== "editing"))
      throw new WorkspaceConflict("This draft changed in another tab. Reload it before saving.");
    if (!existing && body.expectedVersion !== 0) throw new WorkspaceConflict("This draft no longer exists.");
    const graph = await readWorkspace(characterId);
    if (!existing && graph.revision !== body.baseRevision)
      throw new WorkspaceConflict("The character changed. Reload it before starting a draft.");
    const draft: StoredDraft = {
      id: existing?.id ?? randomUUID(), authorId: userId, version: (existing?.version ?? 0) + 1,
      baseRevision: existing?.baseRevision ?? body.baseRevision, baseHash: existing?.baseHash ?? workspaceBuildFingerprint(graph, character),
      status: "editing", updatedAt: new Date().toISOString(), operations: body.operations as DraftOperation[],
    };
    await db.insert(s.characterWorkspaceCommands).values({ characterId, commandId: draft.id, kind: draftKind, requestHash: hash(draft.operations), result: draft as unknown as Record<string, unknown> })
      .onConflictDoUpdate({ target: [s.characterWorkspaceCommands.characterId, s.characterWorkspaceCommands.commandId], set: { result: draft as unknown as Record<string, unknown>, requestHash: hash(draft.operations), updatedAt: new Date() } });
    return draft;
  });
}
async function readStoredDraft(characterId: string, userId: string, draftId: string): Promise<StoredDraft> {
  const [row] = await db.select().from(s.characterWorkspaceCommands).where(and(eq(s.characterWorkspaceCommands.characterId, characterId), eq(s.characterWorkspaceCommands.commandId, draftId), eq(s.characterWorkspaceCommands.kind, draftKind)));
  const draft = row?.result as unknown as StoredDraft | undefined;
  if (!draft || draft.authorId !== userId) throw new Error("Draft not found.");
  return draft;
}
async function moveRoot(characterId: string, operation: Extract<DraftOperation, { type: "move-root" }>, graph: WorkspaceGraph) {
  const edge = graph.edges.find(e => e.id === operation.path[0] && e.parent === null && e.child === operation.target);
  const node = graph.nodes.find(n => n.key === operation.target);
  if (!edge || !node) throw new WorkspaceConflict("This direct piece has changed. Review its destination.");
  if (node.kind === "heritage" || node.kind === "item" || operation.category === "ITEM")
    throw new Error("Move individual rules, effects, or capabilities between heritage channels. Item contents belong inside an item.");
  if (node.kind === "primitive") {
    await db.update(s.characterPrimitives).set(edge.data?.["directSource"] ? { directSource: operation.category } : { source: operation.category })
      .where(and(eq(s.characterPrimitives.characterId, characterId), eq(s.characterPrimitives.instanceId, edge.instanceId!)));
  } else if (node.kind === "capability") {
    await db.update(s.characterCapabilities).set({ slotTab: operation.category })
      .where(and(eq(s.characterCapabilities.characterId, characterId), eq(s.characterCapabilities.capabilityId, node.id)));
  } else {
    await db.update(s.characterEffects).set({ category: operation.category })
      .where(and(eq(s.characterEffects.characterId, characterId), eq(s.characterEffects.effectId, node.id)));
  }
  await db.insert(s.characterWorkspaceState).values({ characterId, revision: graph.revision + 1 }).onConflictDoUpdate({ target: s.characterWorkspaceState.characterId, set: { revision: graph.revision + 1 } });
  return { id: node.id, target: node.key, revision: graph.revision + 1 };
}

/** Called after permission validation by owner apply / proposal approval. Every
 * child service joins this ONE transaction through AsyncLocalStorage. */
export async function executeDraftOperations(characterId: string, userId: string, baseRevision: number, rawOperations: DraftOperation[], preview = false): Promise<WorkspaceDraftPreview> {
  const operations = draftOperationsSchema.parse(rawOperations) as DraftOperation[];
  return withDatabaseTransaction(async () => withDraftExecution(characterId, userId, async () => {
    const initialCharacter = await lockCharacter(characterId);
    const initial = await readWorkspace(characterId);
    if (initial.revision !== baseRevision) throw new WorkspaceConflict("The character changed. Review the current sheet before applying this draft.");
    const beforeSheet = await readDraftSheet(characterId);
    const aliases = new Map<string, string>();
    const results: WorkspaceDraftPreview["results"] = [];
    const changedKeys = new Set<string>();
    for (const operation of operations) {
      const current = await readWorkspace(characterId);
      const op = mapDraftIdentities(operation, aliases);
      const pinIssue = pinnedOperationIssue(current, op, true);
      if (pinIssue) throw new WorkspaceConflict(pinIssue);
      let result: Record<string, unknown>;
      if (op.type === "relocate") result = await relocateWorkspacePiece(characterId, userId, current, op);
      else if (op.type === "character") {
        const character = await lockCharacter(characterId);
        const updated = { ...character, ...op.payload };
        if (updated.attrPhysical + updated.attrMental + updated.attrMagical !== 10) throw new Error("Base attribute scores must total 10.");
        await db.update(s.characters).set(op.payload).where(eq(s.characters.id, characterId));
        await db.insert(s.characterWorkspaceState).values({ characterId, revision: current.revision + 1 }).onConflictDoUpdate({ target: s.characterWorkspaceState.characterId, set: { revision: current.revision + 1 } });
        result = { revision: current.revision + 1 };
      } else if (op.type === "move-root") result = await moveRoot(characterId, op, current);
      else {
        const payload: Record<string, unknown> = { ...op.payload };
        // An earlier action may have forked the same container. Refresh hashes
        // only for entities changed by this draft; untouched hashes still gate.
        for (const field of ["target", "destination"] as const) {
          if (typeof payload[field] === "string" && changedKeys.has(payload[field] as string)) {
            const node = current.nodes.find(n => n.key === payload[field]);
            payload[field === "target" ? "expectedHash" : "destinationHash"] = node?.data["contentHash"] ?? null;
          }
        }
        result = op.type === "create"
          ? await executeWorkspaceCreate(characterId, userId, { ...payload, commandId: randomUUID(), expectedRevision: current.revision,
              draft: { ...(payload["draft"] as Record<string, unknown>), isPublic: false, visibility: "PRIVATE" } })
          : await executeWorkspaceCommand(characterId, userId, { ...payload, commandId: randomUUID(), expectedRevision: current.revision });
      }
      const after = await readWorkspace(characterId);
      // Only authored/forked nodes need virtual IDs; existing library entries
      // added by reference retain their real identity.
      const createdIds = new Set<string>();
      if (!(op.type === "create" && op.payload.existingId)) {
        if (typeof result["savedKey"] === "string") createdIds.add((result["savedKey"] as string).split(":").slice(1).join(":"));
        if (typeof result["id"] === "string" || typeof result["id"] === "number") createdIds.add(String(result["id"]));
      }
      for (const replacement of Object.values((result["replacements"] ?? {}) as Record<string, string>)) createdIds.add(replacement.split(":").slice(1).join(":"));
      registerDraftIdentities(current, after, operation.id, aliases, createdIds);
      for (const node of after.nodes) {
        const before = current.nodes.find(n => n.key === node.key);
        if (!before || before.data["contentHash"] !== node.data["contentHash"]) changedKeys.add(node.key);
      }
      results.push({ operationId: operation.id, result });
    }
    const graph = await readWorkspace(characterId);
    const sheet = await readDraftSheet(characterId);
    // Existing character rules allow an over-budget build with a visible warning.
    const warnings = sheet.buLedger.netSpent > sheet.buBalance.progressionPool ? ["This build exceeds the available Build Units. Review the excess with your group."] : [];
    if (graph.nodes.some(n => n.data["workspaceVersionIssue"]))
      warnings.push("This character has conflicting or unavailable pinned versions. Choose a valid version for those pieces before editing their rules or memberships.");
    if (!preview && sheet.volatility.exceeded) throw new Error("This draft exceeds the character’s drawback credit limit.");
    const output: WorkspaceDraftPreview = { graph, revision: graph.revision, buSpent: sheet.buBalance.progressionSpent, beforeSheet, sheet, results, applied: !preview, warnings };
    {
      const finalCharacter = await lockCharacter(characterId);
      const snapshotFields = ["name", "notes", "backstory", "portraitUrl", "portraitFrame", "lineageName", "lineageDescription", "upbringingName", "upbringingDescription", "manifestName", "level", "startingBu", "dmBonusBu", "attrPhysical", "attrMental", "attrMagical", "attrProficient", "practiceSlices", "size"];
      const foundation = (row: Record<string, unknown>) => Object.fromEntries(snapshotFields.map(key => [key, row[key]]));
      output.beforeSnapshot = { foundation: foundation(initialCharacter), graph: initial };
      output.afterSnapshot = { foundation: foundation(finalCharacter), graph };
      if (!preview) return output;
    }
    const reverse = new Map([...aliases].map(([alias, actual]) => [actual, alias]));
    return { ...output, graph: mapDraftIdentities(graph, reverse), results: mapDraftIdentities(results, reverse), afterSnapshot: mapDraftIdentities(output.afterSnapshot, reverse) };
  }));
}
class PreviewRollback extends Error { constructor(readonly result: WorkspaceDraftPreview) { super("Rollback successful draft preview"); } }
export async function previewWorkspaceDraft(characterId: string, userId: string, draftId: string, expectedVersion: number): Promise<WorkspaceDraftPreview> {
  await access(characterId, userId);
  try {
    await withDatabaseTransaction(async () => {
      const character = await lockCharacter(characterId);
      await access(characterId, userId);
      const draft = await readStoredDraft(characterId, userId, draftId);
      if (draft.version !== expectedVersion || draft.status !== "editing") throw new WorkspaceConflict("The saved draft changed. Reload it.");
      const graph = await readWorkspace(characterId);
      if (workspaceBuildFingerprint(graph, character) !== draft.baseHash) throw new WorkspaceConflict("The character or a referenced rule changed. Your draft is saved; review it before applying.");
      throw new PreviewRollback(await executeDraftOperations(characterId, userId, draft.baseRevision, draft.operations, true));
    });
  } catch (error) { if (error instanceof PreviewRollback) return error.result; throw error; }
  throw new Error("Draft preview did not complete.");
}
export async function applyWorkspaceDraft(characterId: string, userId: string, draftId: string, expectedVersion: number): Promise<WorkspaceDraftPreview> {
  await access(characterId, userId, true);
  return withDatabaseTransaction(async () => {
    const character = await lockCharacter(characterId);
    await access(characterId, userId, true);
    const draft = await readStoredDraft(characterId, userId, draftId);
    if (draft.version !== expectedVersion) throw new WorkspaceConflict("The draft changed. Review it again.");
    if (draft.status === "applied" && draft.appliedResult) return draft.appliedResult;
    const graph = await readWorkspace(characterId);
    if (workspaceBuildFingerprint(graph, character) !== draft.baseHash) throw new WorkspaceConflict("The character or a referenced rule changed. Your draft is saved; review it before applying.");
    const result = await executeDraftOperations(characterId, userId, draft.baseRevision, draft.operations);
    const saved: StoredDraft = { ...draft, status: "applied", updatedAt: new Date().toISOString(), appliedResult: result };
    await db.update(s.characterWorkspaceCommands).set({ result: saved as unknown as Record<string, unknown>, updatedAt: new Date() }).where(and(eq(s.characterWorkspaceCommands.characterId, characterId), eq(s.characterWorkspaceCommands.commandId, draftId)));
    return result;
  });
}


/** Archives the draft only. The saved character and command history are untouched. */
export async function discardWorkspaceDraft(characterId: string, userId: string, draftId: string, expectedVersion: number) {
  return withDatabaseTransaction(async () => {
    await lockCharacter(characterId);
    await access(characterId, userId);
    const draft = await readStoredDraft(characterId, userId, draftId);
    if (draft.version !== expectedVersion || draft.status !== "editing") throw new WorkspaceConflict("The draft changed in another tab. Reload it before discarding.");
    await db.update(s.characterWorkspaceCommands).set({ kind: "workspace-draft-discarded", updatedAt: new Date() }).where(and(eq(s.characterWorkspaceCommands.characterId, characterId), eq(s.characterWorkspaceCommands.commandId, draftId)));
    return { discarded: true };
  });
}

/** Undo is a new audited revision, never deletion of the applied transaction.
 * Only the last unchanged build can be restored; runtime state is left intact. */
export async function undoWorkspaceDraft(characterId: string, userId: string, draftId: string, expectedVersion: number): Promise<WorkspaceDraftPreview> {
  return withDatabaseTransaction(async () => {
    const character = await lockCharacter(characterId);
    await access(characterId, userId, true);
    const draft = await readStoredDraft(characterId, userId, draftId);
    if (draft.version !== expectedVersion || draft.status !== "applied" || !draft.appliedResult?.beforeSnapshot || !draft.appliedResult.afterSnapshot)
      throw new WorkspaceConflict("This applied draft cannot be restored from a complete snapshot.");
    const receiptId = `undo-draft:${draftId}`;
    const [receipt] = await db.select().from(s.characterWorkspaceCommands).where(and(eq(s.characterWorkspaceCommands.characterId, characterId), eq(s.characterWorkspaceCommands.commandId, receiptId)));
    if (receipt) return receipt.result as unknown as WorkspaceDraftPreview;
    const graph = await readWorkspace(characterId);
    if (graph.revision !== draft.appliedResult.revision || workspaceBuildFingerprint(graph, character) !== workspaceBuildFingerprint(draft.appliedResult.afterSnapshot.graph, draft.appliedResult.afterSnapshot.foundation))
      throw new WorkspaceConflict("The character changed since this draft was applied. Make a new draft to revise it safely.");
    const beforeSheet = await readDraftSheet(characterId);
    const { restoreWorkspaceSnapshot } = await import("./restore-snapshot");
    await restoreWorkspaceSnapshot(characterId, userId, draft.appliedResult.beforeSnapshot);
    const revision = graph.revision + 1;
    await db.insert(s.characterWorkspaceState).values({ characterId, revision }).onConflictDoUpdate({ target: s.characterWorkspaceState.characterId, set: { revision } });
    const restored = await readWorkspace(characterId);
    const sheet = await readDraftSheet(characterId);
    const result: WorkspaceDraftPreview = { graph: restored, revision, buSpent: sheet.buBalance.progressionSpent, beforeSheet, sheet, results: [], applied: true };
    await db.insert(s.characterWorkspaceCommands).values({ characterId, commandId: receiptId, kind: "workspace-draft-undo", requestHash: hash({ draftId, expectedVersion }), result: result as unknown as Record<string, unknown> });
    return result;
  });
}
