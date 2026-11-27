import { z } from "zod";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { characterCompanionBestiaryPath } from "@/lib/character/companion-types";
import { CharacterCompanionConflict } from "@/lib/character/companions";
import { WorkspaceConflict } from "@/lib/character/workspace/commands";
import { executeDraftOperations } from "@/lib/character/workspace/drafts";
import { readWorkspace } from "@/lib/character/workspace/read";
import { monsterDefinitionSchema, referenceSchema } from "@/lib/monsters/model";
import { createMonster, prepareMonster } from "@/lib/monsters/service";
import type { McpActor } from "./auth";
import { readOnlyCharacterContext, requireCharacterAccess } from "./context-shared";
import { digestJson, operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, prepareOperation } from "./operations";

const reference = referenceSchema.extend({ versionId: operationUuid }).refine(
  ({ kind, id }) => kind === "PRIMITIVE" ? /^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 2147483647 : z.uuid().safeParse(id).success,
  "Use the exact entity ID and version from the catalogue.",
);
const definition = z.strictObject({
  name: z.string().trim().min(1).max(200),
  sourceOrigin: z.string().trim().max(1000).optional(),
  concept: z.string().max(12000).optional(),
  budget: z.number().int().positive().max(10000),
  size: z.enum(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]),
  attributes: z.strictObject({ physical: z.number().int().nonnegative(), mental: z.number().int().nonnegative(), magical: z.number().int().nonnegative() }),
  proficientAttribute: z.enum(["physical", "mental", "magical"]),
  imageUrl: z.string().max(2048).optional(),
  references: z.array(reference).min(1).max(50),
});
export const previewCompanionInput = z.strictObject({ definition });
export const prepareCompanionInput = previewCompanionInput.extend({
  characterId: operationUuid,
  expectedRevision: z.number().int().nonnegative(),
  supersedesOperationId: operationUuid.optional(),
});
const boundReview = prepareCompanionInput.omit({ supersedesOperationId: true }).extend({ fingerprint: z.string().length(64) });

async function resolveCompanion(actor: McpActor, input: z.infer<typeof definition>, allowOverBudget = false) {
  // The private pilot accepts artwork already uploaded by the same linked player.
  if (input.imageUrl && (!input.imageUrl.startsWith(`/api/icons/blob/user-uploads/${actor.clerkId}/`) ||
      !/^\/api\/icons\/blob\/user-uploads\/[\w-]+\/[\w./-]+$/.test(input.imageUrl) ||
      input.imageUrl.split("/").some(part => part === ".." || part === "."))) {
    throw new OperationBlockError("VALIDATION_FAILED");
  }
  const parsed = monsterDefinitionSchema.safeParse(input);
  if (!parsed.success) throw new OperationBlockError("VALIDATION_FAILED");
  return prepareMonster(parsed.data, actor.clerkId, { allowOverBudget });
}

function summarize({ definition, sheet }: Awaited<ReturnType<typeof prepareMonster>>) {
  return {
    name: definition.name,
    description: definition.concept,
    size: definition.size,
    attributes: definition.attributes,
    proficientAttribute: definition.proficientAttribute,
    baseBudget: definition.budget,
    spentBu: sheet.spent,
    availableBu: sheet.availableBudget,
    overBudget: sheet.spent > sheet.availableBudget,
    weaknessCreditBu: sheet.mirrorCredit,
    debtUsedBu: sheet.debtUsed,
    itemBu: sheet.itemBu,
    rank: sheet.rank,
    startingVitality: sheet.maximum,
    visibility: "PRIVATE",
    portrait: definition.imageUrl ?? null,
    components: definition.references.map(ref => ({
      ...ref,
      name: definition.componentPins.find(pin =>
        pin.kind.toUpperCase() === ref.kind && pin.id === ref.id && pin.versionId === ref.versionId)?.name ?? ref.id,
    })),
  };
}

export async function previewCompanion(actor: McpActor, input: z.infer<typeof previewCompanionInput>) {
  return readOnlyCharacterContext(async () => summarize(await resolveCompanion(actor, input.definition, true)));
}

async function requireCurrentCharacter(actor: McpActor, characterId: string, expectedRevision: number) {
  const { character } = await requireCharacterAccess(actor, characterId, "OWNER");
  if ((await readWorkspace(characterId)).revision !== expectedRevision) throw new OperationBlockError("STALE_REVIEW");
  return character;
}

export async function prepareCompanion(actor: McpActor, input: z.infer<typeof prepareCompanionInput>) {
  const { characterId, expectedRevision, definition, supersedesOperationId } = input;
  const character = await requireCurrentCharacter(actor, characterId, expectedRevision);
  const resolved = await resolveCompanion(actor, definition);
  return prepareOperation({
    actor, kind: "companion_create", subject: { kind: "character", characterId },
    summary: { character: character.name, ...summarize(resolved) },
    payload: { characterId, expectedRevision, definition, fingerprint: digestJson(resolved.definition) },
    ...(supersedesOperationId ? { supersedesOperationId } : {}),
  });
}

export async function assertCompanionReviewCurrent(actor: McpActor, characterId: string | null, payload: unknown) {
  const reviewed = boundReview.safeParse(payload);
  if (!reviewed.success || reviewed.data.characterId !== characterId) throw new OperationBlockError("VALIDATION_FAILED");
  await requireCurrentCharacter(actor, reviewed.data.characterId, reviewed.data.expectedRevision);
  try {
    const resolved = await resolveCompanion(actor, reviewed.data.definition);
    if (digestJson(resolved.definition) === reviewed.data.fingerprint) return reviewed.data;
  } catch {
    throw new OperationBlockError("STALE_REVIEW");
  }
  throw new OperationBlockError("STALE_REVIEW");
}

export async function applyCompanion(actor: McpActor, operationId: string) {
  let changedCharacter: string | undefined;
  return executeApprovedOperation({
    actor, operationId, expectedKind: "companion_create",
    async execute({ subject, payload }) {
      const reviewed = await assertCompanionReviewCurrent(actor, subject.characterId, payload);
      const { characterId, expectedRevision, definition, fingerprint } = reviewed;
      try {
        const monster = await createMonster(actor.clerkId, definition, false, undefined, undefined, "PRIVATE");
        if (digestJson(monster.definition) !== fingerprint) throw new OperationBlockError("STALE_REVIEW");
        const result = await executeDraftOperations(characterId, actor.clerkId, expectedRevision, [
          { id: operationId, type: "companion", payload: { action: "add", templateId: monster.id, version: monster.version } },
        ]);
        changedCharacter = characterId;
        return { characterId, monsterId: monster.id, version: monster.version, appliedRevision: result.revision };
      } catch (error) {
        if (error instanceof WorkspaceConflict || error instanceof CharacterCompanionConflict) throw new OperationBlockError("STALE_REVIEW");
        throw error;
      }
    },
    afterCommit() { if (changedCharacter) bustResolverCache(changedCharacter); },
  });
}

export function companionBestiaryUrl(resource: string, monsterId: string, version: number) {
  return new URL(characterCompanionBestiaryPath(monsterId, version), resource).href;
}
