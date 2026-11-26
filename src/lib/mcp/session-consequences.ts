import { z } from "zod";
import { loadCharacterMaxVitality } from "@/lib/character/character-vitality";
import { ConsequenceCommandError, saveCharacterConsequences } from "@/lib/character/consequences/mutations";
import type { ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { requireCharacterAccess, type CharacterActor } from "./context-shared";
import { digestJson } from "./operation-policy";
import { OperationBlockError } from "./operations";
import { loadPlayContext } from "./play-context";

export const recordConsequenceAction = z.strictObject({
  kind: z.literal("record_consequence"),
  title: z.string().trim().min(1).max(200).refine(value => !value.includes("\0")),
  description: z.string().transform(value => value.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(2_000).refine(value => !value.includes("\0"))).optional(),
  durationTier: z.enum(["manual", "short_rest", "long_rest"]),
});
export const resolveConsequenceAction = z.strictObject({
  kind: z.literal("resolve_consequence"), occurrenceId: z.string().min(1).max(200).refine(value => !value.includes("\0")),
  expectedRevision: z.number().int().min(1).max(2147483646),
});
export type ManualConsequenceAction = z.output<typeof recordConsequenceAction | typeof resolveConsequenceAction>;

export async function projectManualConsequence(actor: CharacterActor, characterId: string, action: ManualConsequenceAction) {
  const { character } = await requireCharacterAccess(actor, characterId, "OWNER");
  const base = { characterId, characterName: character.name.slice(0, 200),
    tableQuestions: [] as string[] };
  if (action.kind === "record_consequence") {
    const summary = { ...base, actionKind: action.kind, before: null,
      after: { title: action.title, description: action.description ?? "", durationTier: action.durationTier, status: "active" },
      source: "Player note", blockers: [] as string[] };
    return { summary, baselineDigest: digestJson(summary), existing: null };
  }

  const context = await loadPlayContext(actor, characterId);
  const entryIndex = context.active.findIndex(record => record.occurrenceId === action.occurrenceId);
  const record = context.active[entryIndex];
  const visible = context.summaries[entryIndex];
  const unavailable = (blocker: string) => ({ ...base, actionKind: action.kind, before: null, after: null, source: null, blockers: [blocker] });
  if (!record || !visible || record.revision !== action.expectedRevision) {
    return { summary: unavailable("This active consequence is unavailable or has changed."), baselineDigest: null, existing: null };
  }
  const current = record.occurrence;
  const resolved: ConsequenceOccurrence = { ...current, status: "resolved", active: false };
  const restrictionsEnded = (current.restrictions ?? []).map(restriction => {
    const node = context.nodes.get(`${restriction.kind}:${restriction.entityId}`);
    return { kind: restriction.kind, name: node?.name.slice(0, 180) ?? "Unavailable" };
  });
  const graph = context.view.canonical;
  const occurrences = context.snapshot.records.filter(row => !row.deletedAt)
    .map(row => row.occurrenceId === record.occurrenceId ? resolved : row.occurrence);
  let afterMaximum = context.maxVitality === null ? null
    : (await loadCharacterMaxVitality(characterId, graph, undefined, occurrences)).max;
  if (afterMaximum !== null && graph.nodes.some(node => node.data["workspaceHistoricalVersion"])) {
    const pinned = await readDraftSheet(characterId, graph, undefined, occurrences);
    if (pinned.vitality.max !== afterMaximum) afterMaximum = null;
  }
  if (context.maxVitality === null || afterMaximum === null) {
    return { summary: unavailable("The result could not be verified. Resolve the consequence on the character sheet."), baselineDigest: null, existing: null };
  }
  const vitality = (maximum: number) => ({ currentVitality: character.currentVitality ?? maximum,
    maxVitality: maximum, usesDynamicMaximum: character.currentVitality === null });
  const summary = {
    ...base, actionKind: action.kind,
    before: { ...visible, status: "active", vitality: vitality(context.maxVitality) },
    after: { ...visible, revision: record.revision + 1, status: "resolved", restrictionsEnded, vitality: vitality(afterMaximum) },
    source: visible.source, blockers: [] as string[],
  };
  return { summary, baselineDigest: digestJson({ summary, occurrence: current }), existing: current };
}

export async function applyManualConsequence(args: {
  actor: CharacterActor; characterId: string; operationId: string; action: ManualConsequenceAction;
  baselineDigest: string; newOccurrenceId?: string | undefined;
}) {
  const { actor, characterId, operationId, action, baselineDigest, newOccurrenceId } = args;
  const projected = await projectManualConsequence(actor, characterId, action);
  if (projected.baselineDigest !== baselineDigest) throw new OperationBlockError("STALE_REVIEW");
  let occurrence: ConsequenceOccurrence;
  let expectedRevision: number;
  const now = Date.now();
  if (action.kind === "record_consequence" && newOccurrenceId) {
    occurrence = { id: newOccurrenceId, title: action.title, description: action.description ?? "",
      durationTier: action.durationTier, active: true, status: "active", tags: [], modifiers: [],
      createdAt: now, source: "custom" };
    expectedRevision = 0;
  } else if (action.kind === "resolve_consequence" && projected.existing) {
    occurrence = { ...projected.existing, status: "resolved", active: false, resolvedAt: now };
    expectedRevision = action.expectedRevision;
  } else {
    throw new OperationBlockError("VALIDATION_FAILED");
  }
  try {
    const result = await saveCharacterConsequences(characterId, { operation: "save", commandId: operationId,
      changes: [{ id: occurrence.id, expectedRevision, occurrence }] });
    const written = result.records.find(row => row.id === occurrence.id);
    if (!written?.occurrence || written.revision !== expectedRevision + 1 || written.occurrence.status !== occurrence.status) {
      throw new OperationBlockError("STALE_REVIEW");
    }
    return { characterId, occurrenceId: written.id, occurrenceRevision: written.revision };
  } catch (error) {
    if (error instanceof ConsequenceCommandError) {
      throw new OperationBlockError(error.status === 409 ? "STALE_REVIEW" : "VALIDATION_FAILED");
    }
    throw error;
  }
}
