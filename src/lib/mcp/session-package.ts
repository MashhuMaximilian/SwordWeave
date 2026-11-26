import { z } from "zod";
import { applyCharacterConsequencePackage, ConsequencePackageConflictError, consequencePackageOccurrences, projectConsequencePackage } from "@/lib/character/consequences/apply-package";
import { loadCharacterMaxVitality } from "@/lib/character/character-vitality";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { CharacterContextUnavailable, type CharacterActor } from "./context-shared";
import { digestJson } from "./operation-policy";
import { OperationBlockError } from "./operations";
import { packageKey, pinnedPackageSources, type PackageSourceKey } from "./package-source";
import { loadPlayContext } from "./play-context";

export const applyConsequencePackageAction = z.strictObject({
  kind: z.literal("apply_consequence_package"),
  sourceKey: z.string().max(48).refine(packageKey, "Choose a package source listed on the character.")
    .transform(key => key as PackageSourceKey),
});
type PackageAction = z.output<typeof applyConsequencePackageAction>;

export async function projectPackageAction(actor: CharacterActor, characterId: string, action: PackageAction) {
  const context = await loadPlayContext(actor, characterId, "OWNER");
  const { character, snapshot, view } = context;
  if (character.userId !== actor.clerkId) throw new CharacterContextUnavailable();
  const base = { characterId, characterName: character.name.slice(0, 200), actionKind: action.kind, tableQuestions: [] as string[] };
  const blocked = () => ({
    summary: { ...base, before: null, after: null, source: null,
      blockers: ["This package could not be verified. Review the action on the character sheet."] },
    baselineDigest: null, packagePreview: null,
  });
  const max = context.maxVitality;
  if (max === null || !Number.isSafeInteger(character.currentVitality ?? max) || (character.currentVitality ?? max) < 0) return blocked();
  const occurrences = snapshot.records.filter(row => !row.deletedAt).map(row => row.occurrence);
  const selected = pinnedPackageSources(view, occurrences, snapshot.state.overrides)(action.sourceKey);
  if (!selected) return blocked();
  const graph = view.canonical;
  const preview = projectConsequencePackage(graph, selected.key, occurrences, character.currentVitality, max);
  let index = 0;
  const predicted = consequencePackageOccurrences(preview.pieces, "review-preview", () => `review-${++index}`, 0);
  const nextOccurrences = [...occurrences, ...predicted];
  const { max: afterMaximum } = await loadCharacterMaxVitality(characterId, graph, preview.next, nextOccurrences);
  if (preview.next > afterMaximum) return blocked();
  if (graph.nodes.some(node => node.data["workspaceHistoricalVersion"]) &&
      (await readDraftSheet(characterId, graph, preview.next, nextOccurrences)).vitality.max !== afterMaximum) return blocked();
  const summary = {
    ...base,
    source: { sourceKey: selected.key, name: preview.name.slice(0, 180), versionId: selected.versionId },
    before: { currentVitality: preview.previous, maxVitality: max, usesDynamicMaximum: character.currentVitality === null },
    after: { currentVitality: preview.next, maxVitality: afterMaximum, usesDynamicMaximum: false,
      appliedVitality: preview.next - preview.previous, occurrences: selected.effects },
    blockers: [] as string[],
  };
  return {
    summary, packagePreview: preview,
    baselineDigest: digestJson({
      summary, dependencies: selected.dependencies, hash: preview.hash, rawVitality: character.currentVitality,
      vitalityRevision: snapshot.stored.fieldRevisions["currentVitality"] ?? 0,
      persistedVitality: snapshot.stored.overrides["currentVitality"] ?? null,
    }),
  };
}

const packageResult = z.object({
  applicationId: z.uuid(),
  occurrences: z.array(z.object({ id: z.uuid() })).min(1).max(20),
  previous: z.number().int().nonnegative(),
  currentVitality: z.number().int().nonnegative(),
  applied: z.number().int(),
});

/** The approved action holds the character and publishing locks until its receipt commits. */
export async function applyReviewedPackage(args: {
  actor: CharacterActor; characterId: string; action: PackageAction; operationId: string; baselineDigest: string;
}) {
  const { actor, characterId, action, operationId, baselineDigest } = args;
  const projected = await projectPackageAction(actor, characterId, action);
  const preview = projected.packagePreview;
  if (!preview || projected.baselineDigest !== baselineDigest) throw new OperationBlockError("STALE_REVIEW");
  let saved: unknown;
  try {
    saved = await applyCharacterConsequencePackage(characterId, actor.clerkId, {
      key: action.sourceKey, commandId: operationId, expectedHash: preview.hash, expectedVitality: preview.currentVitality, commit: true,
    }, preview.max);
  } catch (error) {
    if (error instanceof ConsequencePackageConflictError) throw new OperationBlockError("STALE_REVIEW");
    throw error;
  }
  const result = packageResult.safeParse(saved);
  if (!result.success || result.data.applicationId !== operationId || result.data.occurrences.length !== preview.pieces.length ||
      result.data.currentVitality !== preview.next || result.data.previous !== preview.previous || result.data.applied !== preview.next - preview.previous) {
    throw new OperationBlockError("STALE_REVIEW");
  }
  return {
    characterId, applicationId: operationId, occurrenceIds: result.data.occurrences.map(occurrence => occurrence.id),
    previousVitality: result.data.previous, currentVitality: result.data.currentVitality, applied: result.data.applied,
  };
}
