import { z } from "zod";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { advancementLevels, maxStoredCharacterLevel, writeCharacterAdvancement } from "@/lib/character/advancement";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { workspaceBuildFingerprint } from "@/lib/character/workspace/drafts";
import { splitProgressionSpend } from "@/lib/engine/bu-balance";
import type { McpActor } from "./auth";
import { authorizesMaterializedSheetInputs, hasUnresolvedGraphDependencies, readVisibleGraph } from "./character-context";
import { characterIdSchema, readOnlyCharacterContext, requireCharacterAccess, type CharacterActor } from "./context-shared";
import { digestJson, operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, prepareOperation } from "./operations";

export const previewCharacterAdvancementInput = z.strictObject({
  characterId: characterIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  targetLevel: z.number().int().min(2).max(maxStoredCharacterLevel),
});
export const prepareCharacterAdvancementInput = previewCharacterAdvancementInput.extend({ supersedesOperationId: operationUuid.optional() });
const approvedAdvancement = z.strictObject({ input: previewCharacterAdvancementInput, digest: z.string().regex(/^[a-f0-9]{64}$/) });
const maxLevelsPerReview = 20;

function projectSheet(sheet: Awaited<ReturnType<typeof readDraftSheet>>, level: number) {
  const { progressionPool, progressionSpent, itemBuSpent, dmBonusBu } = sheet.buBalance;
  const { remaining, ...spend } = splitProgressionSpend(progressionSpent, progressionPool, sheet.volatility.rating);
  return { level, progressionPool, progressionSpent, progressionRemaining: remaining, dmBonusBu, itemBuSpent, ...spend,
    proficiencyBonus: sheet.proficiencyBonus, maxVitality: sheet.vitality.max,
    volatilityCeiling: sheet.volatility.ceiling,
  };
}

async function projectAdvancement(actor: CharacterActor, input: z.output<typeof previewCharacterAdvancementInput>, reviewed = false) {
  const { characterId, expectedRevision, targetLevel } = input;
  const { character } = await requireCharacterAccess(actor, characterId, "OWNER");
  if (targetLevel <= character.level || targetLevel - character.level > maxLevelsPerReview) {
    throw new OperationBlockError(reviewed ? "STALE_REVIEW" : "VALIDATION_FAILED");
  }
  const view = await readVisibleGraph(actor, characterId);
  if (view.canonical.revision !== expectedRevision) throw new OperationBlockError("STALE_REVIEW");
  if (view.restricted || hasUnresolvedGraphDependencies(view.canonical) ||
    !await authorizesMaterializedSheetInputs(characterId, view.reachable)) {
    throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  }
  const [beforeSheet, afterSheet] = await Promise.all([
    readDraftSheet(characterId, view.canonical),
    readDraftSheet(characterId, view.canonical, undefined, undefined, { level: targetLevel, dmBonusBu: 0 }),
  ]);
  const summary = {
    characterId, characterName: character.name.slice(0, 200), revision: expectedRevision,
    before: projectSheet(beforeSheet, character.level), after: projectSheet(afterSheet, targetLevel),
    levelThresholds: advancementLevels(character.level, targetLevel),
    currentVitality: character.currentVitality === null ? "Track as full" : character.currentVitality,
    existingPurchases: "Keep all acquired pieces. Leave new Build Units unspent.",
  };
  const digest = digestJson({ summary, build: workspaceBuildFingerprint(view.canonical, character) });
  return { character, summary, digest };
}

export async function previewCharacterAdvancement(actor: CharacterActor, raw: z.input<typeof previewCharacterAdvancementInput>) {
  const input = previewCharacterAdvancementInput.parse(raw);
  return readOnlyCharacterContext(async () => (await projectAdvancement(actor, input)).summary);
}

export async function prepareCharacterAdvancement(actor: McpActor, raw: z.input<typeof prepareCharacterAdvancementInput>) {
  const { supersedesOperationId, ...input } = prepareCharacterAdvancementInput.parse(raw);
  const { summary, digest } = await readOnlyCharacterContext(() => projectAdvancement(actor, input));
  const review = await prepareOperation({ actor, kind: "character_advancement", subject: { kind: "character", characterId: input.characterId },
    payload: { input, digest }, summary, ...(supersedesOperationId ? { supersedesOperationId } : {}) });
  return { ...review, summary };
}

async function currentAdvancement(payload: unknown, actor: CharacterActor) {
  const parsed = approvedAdvancement.safeParse(payload);
  if (!parsed.success) throw new OperationBlockError("VALIDATION_FAILED");
  const { input, digest } = parsed.data;
  const current = await projectAdvancement(actor, input, true);
  if (current.digest !== digest) throw new OperationBlockError("STALE_REVIEW");
  return current;
}

export async function assertAdvancementReviewCurrent(payload: unknown, actor: CharacterActor) {
  await currentAdvancement(payload, actor);
}

export function applyApprovedAdvancement(actor: McpActor, operationId: string) {
  let modifiedId: string | undefined;
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_advancement",
    async execute({ payload, subject }) {
      const { character, summary } = await currentAdvancement(payload, actor);
      if (character.id !== subject.characterId) throw new OperationBlockError("VALIDATION_FAILED");
      const { revision } = await writeCharacterAdvancement(character, summary.after.level, actor.clerkId);
      modifiedId = character.id;
      return { characterId: character.id, appliedRevision: revision, fromLevel: summary.before.level, ...summary.after };
    },
    afterCommit() { if (modifiedId) bustResolverCache(modifiedId); },
  });
}
