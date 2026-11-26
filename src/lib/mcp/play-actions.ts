import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { clampVitality, loadCharacterMaxVitality } from "@/lib/character/character-vitality";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { logCharacterPlayVitality, writeCharacterPlayVitality } from "@/lib/play-state/character";
import { mutatePlayState, reconcilePlayState } from "@/lib/play-state/service";
import type { McpActor } from "./auth";
import { characterIdSchema, characterSheetUrl, readOnlyCharacterContext, type CharacterActor } from "./context-shared";
import { digestJson, operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, prepareOperation } from "./operations";
import { loadPlayContext } from "./play-context";
import { applyManualConsequence, projectManualConsequence, recordConsequenceAction, resolveConsequenceAction } from "./session-consequences";
import { applyConsequencePackageAction, applyReviewedPackage, projectPackageAction } from "./session-package";

const vitalityAction = z.strictObject({ kind: z.literal("set_current_vitality"), value: z.number().int().nonnegative() });
export const playActionInput = z.discriminatedUnion("kind", [vitalityAction, recordConsequenceAction, resolveConsequenceAction, applyConsequencePackageAction]);
export const previewPlayActionInput = z.strictObject({ characterId: characterIdSchema, action: playActionInput });
export const preparePlayActionInput = previewPlayActionInput.extend({ supersedesOperationId: operationUuid.optional() });
export const applyPlayActionInput = z.strictObject({ operationId: operationUuid });
const approvedPayload = previewPlayActionInput.extend({
  baselineDigest: z.string().regex(/^[a-f0-9]{64}$/), newOccurrenceId: operationUuid.optional(),
}).refine(value => (value.action.kind === "record_consequence") === (value.newOccurrenceId !== undefined));

async function projectVitalityAction(actor: CharacterActor, input: { characterId: string; action: z.output<typeof vitalityAction> }) {
  const { characterId, action } = input;
  const context = await loadPlayContext(actor, characterId);
  const { character, snapshot, view } = context;
  const raw = character.currentVitality;
  const maximum = context.maxVitality;
  const before = { currentVitality: raw ?? maximum, maxVitality: maximum, usesDynamicMaximum: raw === null };
  const historical = view.canonical.nodes.some(node => node.data["workspaceHistoricalVersion"]);
  async function calculate(proposed: number) {
    const { max } = await loadCharacterMaxVitality(characterId, view.canonical, proposed);
    if (historical && (await readDraftSheet(characterId, view.canonical, proposed)).vitality.max !== max) return null;
    return max;
  }

  let after: typeof before | null = null;
  if (maximum !== null) {
    const proposed = clampVitality(action.value, maximum);
    if (proposed === before.currentVitality) after = before;
    else {
      // The website recalculates conditional maximums after changing Vitality.
      const nextMaximum = await calculate(proposed);
      if (nextMaximum !== null) {
        const currentVitality = clampVitality(proposed, nextMaximum);
        const finalMaximum = currentVitality === proposed ? nextMaximum : await calculate(currentVitality);
        if (finalMaximum !== null && currentVitality <= finalMaximum) {
          after = currentVitality === before.currentVitality ? before
            : { currentVitality, maxVitality: finalMaximum, usesDynamicMaximum: false };
        }
      }
    }
  }
  const summary = {
    characterId, characterName: character.name.slice(0, 200), actionKind: action.kind, before, after,
    source: "Manual Vitality adjustment", tableQuestions: [] as string[],
    blockers: after ? [] : ["The current Vitality maximum could not be verified. Review the character sheet to continue."],
  };
  // Bind the field clock, not the whole session revision. If reconciliation is
  // pending, the persisted clock and the canonical input together identify it.
  const baselineDigest = digestJson({
    summary, raw, fieldClock: snapshot.stored.fieldRevisions["currentVitality"] ?? 0,
    persistedVitality: snapshot.stored.overrides["currentVitality"] ?? null,
  });
  return { summary, baselineDigest, context };
}

async function projectAction(actor: CharacterActor, { characterId, action }: z.output<typeof previewPlayActionInput>) {
  if (action.kind === "set_current_vitality") return projectVitalityAction(actor, { characterId, action });
  if (action.kind === "apply_consequence_package") return projectPackageAction(actor, characterId, action);
  return projectManualConsequence(actor, characterId, action);
}

/** Called inside the review's existing locks before returning an approval surface. */
export async function assertPlayReviewCurrent(payload: unknown, actor: CharacterActor) {
  const parsed = approvedPayload.safeParse(payload);
  if (!parsed.success) throw new OperationBlockError("VALIDATION_FAILED");
  const current = await projectAction(actor, parsed.data);
  if (!current.summary.after || current.baselineDigest !== parsed.data.baselineDigest) {
    throw new OperationBlockError("STALE_REVIEW");
  }
}

export async function previewPlayAction(
  actor: CharacterActor, raw: z.input<typeof previewPlayActionInput>, config: { resource: string },
) {
  const input = previewPlayActionInput.parse(raw);
  return readOnlyCharacterContext(async () => {
    const { summary } = await projectAction(actor, input);
    return { ...summary, sheetUrl: characterSheetUrl(config.resource, input.characterId) };
  });
}

export async function preparePlayAction(actor: McpActor, raw: z.input<typeof preparePlayActionInput>) {
  const { supersedesOperationId, ...input } = preparePlayActionInput.parse(raw);
  const { summary, baselineDigest } = await readOnlyCharacterContext(() => projectAction(actor, input));
  if (!summary.after || !baselineDigest) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  return prepareOperation({
    actor, kind: "session_play_action", subject: { kind: "character", characterId: input.characterId },
    payload: { ...input, baselineDigest, ...(input.action.kind === "record_consequence" ? { newOccurrenceId: randomUUID() } : {}) }, summary,
    ...(supersedesOperationId ? { supersedesOperationId } : {}),
  });
}

export async function applyPlayAction(actor: McpActor, raw: z.input<typeof applyPlayActionInput>) {
  const { operationId } = applyPlayActionInput.parse(raw);
  let changedCharacterId: string | undefined;
  return executeApprovedOperation({
    actor, operationId, expectedKind: "session_play_action",
    async execute({ payload, subject }) {
      const parsed = approvedPayload.safeParse(payload);
      if (!parsed.success || !subject.characterId || parsed.data.characterId !== subject.characterId) {
        throw new OperationBlockError("VALIDATION_FAILED");
      }
      const { characterId, action, baselineDigest, newOccurrenceId } = parsed.data;
      if (action.kind === "apply_consequence_package") {
        const receipt = await applyReviewedPackage({ actor, characterId, operationId, action, baselineDigest });
        changedCharacterId = characterId;
        return receipt;
      }
      if (action.kind !== "set_current_vitality") {
        const receipt = await applyManualConsequence({ actor, characterId, operationId, action, baselineDigest, newOccurrenceId });
        changedCharacterId = characterId;
        return receipt;
      }
      const projected = await projectVitalityAction(actor, { characterId, action });
      const { snapshot } = projected.context;
      const { before, after } = projected.summary;
      if (baselineDigest !== projected.baselineDigest) throw new OperationBlockError("STALE_REVIEW");
      const maximum = before.maxVitality;
      if (!after || after.currentVitality === null || maximum === null) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");

      const vitality = after.currentVitality;
      if (vitality === before.currentVitality) {
        return { characterId, appliedRevision: snapshot.stored.revision, vitality };
      }
      const previous = await reconcilePlayState("CHARACTER", characterId, snapshot.values);
      const next = await mutatePlayState("CHARACTER", characterId, {
        opId: operationId, baseRevision: previous.revision, source: "manual",
        changes: [{ field: "currentVitality", value: vitality }],
      }, async state => {
        await writeCharacterPlayVitality(characterId, vitality, state);
        await logCharacterPlayVitality(characterId, previous, state, maximum, "manual");
      });
      changedCharacterId = characterId;
      return { characterId, appliedRevision: next.revision, vitality };
    },
    afterCommit() { if (changedCharacterId) bustResolverCache(changedCharacterId); },
  });
}
