import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterPrimitives, characters } from "@/db/schema";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { captureCharacterSnapshot } from "@/lib/character/capture-character-snapshot";
import { CharacterCapabilityConflictError, loadCreationCapabilityPrimitives,
  preparePrivateCreationCapability, savePrivateCreationCapability } from "@/lib/character/creation-capability";
import { executeWorkspaceCreate } from "@/lib/character/workspace/create";
import { withDraftExecution } from "@/lib/character/workspace/draft-scope";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { rollbackWorkspacePreview, workspaceBuildFingerprint } from "@/lib/character/workspace/drafts";
import { readWorkspace } from "@/lib/character/workspace/read";
import { splitProgressionSpend } from "@/lib/engine/bu-balance";
import { withPublishingTransaction } from "@/lib/publishing/save-transaction";
import type { McpActor } from "./auth";
import { authorizesMaterializedSheetInputs, hasUnresolvedGraphDependencies, readVisibleGraph } from "./character-context";
import { CharacterContextUnavailable, characterIdSchema, requireCharacterAccess, type CharacterActor } from "./context-shared";
import { CharacterPrimitiveConflictError, prepareCharacterPrimitive, savePrivateCharacterPrimitive } from "./creation-authoring";
import { composedPieceSchemas, planComposedCharacterPiece } from "./character-piece-composition";
import { authoredPrimitiveFields, type PinnedRef } from "./draft";
import { digestJson, operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, prepareOperation } from "./operations";

const compositionInput = z.strictObject({
  characterId: characterIdSchema, expectedRevision: z.number().int().min(0).max(2147483646),
  channel: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]),
  piece: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("primitive"), fields: authoredPrimitiveFields }),
    ...composedPieceSchemas,
  ]),
});
export const prepareCharacterPieceInput = compositionInput.extend({ supersedesOperationId: operationUuid.optional() });

const digest = z.string().regex(/^[0-9a-f]{64}$/);
const approvedPiece = z.strictObject({ input: compositionInput, baseDigest: digest, resultDigest: digest });
type CompositionInput = z.output<typeof compositionInput>;

function budget(sheet: Awaited<ReturnType<typeof readDraftSheet>>) {
  const { progressionPool: pool, progressionSpent: spent, itemBuSpent } = sheet.buBalance;
  return { pool, spent, itemBuSpent, ...splitProgressionSpend(spent, pool, sheet.volatility.rating) };
}

async function planPiece(actor: CharacterActor, input: CompositionInput, graph: Awaited<ReturnType<typeof readWorkspace>>) {
  const { piece, channel } = input;
  if ((channel === "ITEM") !== (piece.kind === "item") ||
      (piece.kind === "heritage" && piece.fields.kind !== channel)) throw new OperationBlockError("VALIDATION_FAILED");
  if (piece.kind === "primitive") {
    const recipe = prepareCharacterPrimitive(piece.fields, actor.clerkId);
    if (!recipe) throw new OperationBlockError("VALIDATION_FAILED");
    const { name, narrativeRule, mechanicalOutputText, buCost } = recipe.snapshot;
    return { root: { kind: piece.kind, name, narrativeRule, mechanicalOutputText, buCost, isPublic: false },
      recipeDigest: recipe.snapshotDigest, save: () => savePrivateCharacterPrimitive(recipe, actor.clerkId) };
  }

  if (piece.kind !== "capability" || piece.members.some(member => member.pin.kind !== "primitive")) {
    return planComposedCharacterPiece(input.characterId, actor.clerkId, piece, graph);
  }
  const pins = await loadCreationCapabilityPrimitives(actor.clerkId, piece.members.map(({ pin }) => Number(pin.id)));
  const selected = piece.members.map(({ pin, role, quantity }) => {
    const primitive = pins.get(Number(pin.id));
    const attached = graph.nodes.find(node => node.key === `primitive:${pin.id}`);
    if (!role) throw new OperationBlockError("VALIDATION_FAILED");
    if (!primitive || primitive.versionId !== pin.versionId || (attached && attached.versionId !== pin.versionId)) {
      throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
    }
    return { primitive, role, quantity: quantity ?? 1 };
  });
  const recipe = preparePrivateCreationCapability(piece.fields, selected, actor.clerkId);
  if (!recipe) throw new OperationBlockError("VALIDATION_FAILED");
  const members = selected.map(({ primitive, role, quantity }) => ({
    name: primitive.name, pin: { kind: "primitive", id: String(primitive.id), versionId: primitive.versionId } satisfies PinnedRef, role, quantity,
  }));
  return { root: { kind: piece.kind, name: recipe.name, description: recipe.description, buCost: recipe.totalBu, members, isPublic: false },
    recipeDigest: digestJson([recipe.snapshotDigest, selected.map(({ primitive }) => primitive.snapshotDigest)]),
    save: () => savePrivateCreationCapability(recipe, actor.clerkId) };
}

async function readPiecePlan(actor: CharacterActor, input: CompositionInput) {
  const { characterId, expectedRevision } = input;
  const { character } = await requireCharacterAccess(actor, characterId, "OWNER");
  const { canonical: graph, restricted, reachable } = await readVisibleGraph(actor, characterId);
  if (graph.revision !== expectedRevision) throw new OperationBlockError("STALE_REVIEW");
  if (restricted || hasUnresolvedGraphDependencies(graph) || !await authorizesMaterializedSheetInputs(characterId, reachable)) {
    throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
  }
  const [piece, sheet] = await Promise.all([planPiece(actor, input, graph), readDraftSheet(characterId, graph)]);
  const before = budget(sheet);
  return { characterName: character.name.slice(0, 200), piece, before,
    baseDigest: digestJson([workspaceBuildFingerprint(graph, character), piece.recipeDigest, before]) };
}

async function attachCreatedPiece(actor: CharacterActor, input: CompositionInput, plan: Awaited<ReturnType<typeof readPiecePlan>>, commandId: string) {
  let saved: Awaited<ReturnType<typeof plan.piece.save>>;
  try {
    saved = await plan.piece.save();
  } catch (error) {
    if (error instanceof CharacterPrimitiveConflictError || error instanceof CharacterCapabilityConflictError) throw new OperationBlockError("CONFLICT");
    throw error;
  }
  const { characterId, expectedRevision, channel } = input;
  await withDraftExecution(characterId, actor.clerkId, () => executeWorkspaceCreate(characterId, actor.clerkId, {
    commandId, expectedRevision, kind: saved.entityKind, category: channel,
    existingId: saved.entityId, expectedVersionId: saved.versionPin, draft: {},
  }), true);
  const graph = await readWorkspace(characterId);
  const attached = graph.edges.find(edge => edge.parent === null && edge.child === `${saved.entityKind}:${saved.entityId}`);
  if (attached?.versionId !== saved.versionPin || attached.category !== channel || graph.revision !== expectedRevision + 1) {
    throw new OperationBlockError("STALE_REVIEW");
  }
  if ("members" in plan.piece.root && plan.piece.root.members) {
    const root = plan.piece.root;
    const expected = root.members;
    const actual = graph.edges.filter(edge => edge.parent === attached.child).sort((left, right) => left.order - right.order);
    const materialized = await db.select({ primitiveId: characterPrimitives.primitiveId, versionId: characterPrimitives.versionId })
      .from(characterPrimitives).where(eq(characterPrimitives.characterId, characterId));
    if (actual.length !== expected.length || expected.some(({ pin, role, quantity }, index) => {
      const edge = actual[index];
      return edge?.child !== `${pin.kind}:${pin.id}` || edge.versionId !== pin.versionId || edge.isMirrored ||
        (role !== undefined && edge.data?.["role"] !== role) || Number(edge.data?.["quantity"] ?? 1) !== quantity ||
        (pin.kind === "primitive" && !materialized.some(slot => slot.primitiveId === Number(pin.id) && slot.versionId === pin.versionId));
    }) || ("dependencies" in root && root.dependencies.some(({ pin }) =>
      !graph.nodes.some(node => node.key === `${pin.kind}:${pin.id}` && node.versionId === pin.versionId) ||
      (pin.kind === "primitive" && !materialized.some(slot => slot.primitiveId === Number(pin.id) && slot.versionId === pin.versionId))
    ))) throw new OperationBlockError("STALE_REVIEW");
  }
  const sheet = await readDraftSheet(characterId, graph);
  const after = budget(sheet);
  if (after.uncoveredExcess || sheet.volatility.exceeded) throw new OperationBlockError("VALIDATION_FAILED");
  const summary = { characterId, characterName: plan.characterName, channel, piece: plan.piece.root,
    budget: { before: plan.before, after }, resultRevision: graph.revision };
  return { summary, resultDigest: digestJson(summary), saved };
}

export async function prepareCharacterPiece(actor: McpActor, raw: z.input<typeof prepareCharacterPieceInput>) {
  const { supersedesOperationId, ...input } = prepareCharacterPieceInput.parse(raw);
  const proposal = await rollbackWorkspacePreview(async () => {
    await requireCharacterAccess(actor, input.characterId, "OWNER");
    await db.select({ id: characters.id }).from(characters).where(eq(characters.id, input.characterId)).for("update");
    return withPublishingTransaction(async () => {
      const plan = await readPiecePlan(actor, input);
      const result = await attachCreatedPiece(actor, input, plan, randomUUID());
      return { summary: result.summary, payload: { input, baseDigest: plan.baseDigest, resultDigest: result.resultDigest } };
    });
  });
  const review = await prepareOperation({ actor, kind: "character_piece", subject: { kind: "character", characterId: input.characterId },
    ...proposal, ...(supersedesOperationId ? { supersedesOperationId } : {}) });
  return { ...review, summary: proposal.summary };
}

async function currentPiecePlan(payload: unknown, actor: CharacterActor) {
  const parsed = approvedPiece.safeParse(payload);
  if (!parsed.success) throw new OperationBlockError("VALIDATION_FAILED");
  const { input, baseDigest, resultDigest } = parsed.data;
  const plan = await readPiecePlan(actor, input);
  if (plan.baseDigest !== baseDigest) throw new OperationBlockError("STALE_REVIEW");
  return { input, plan, resultDigest };
}

export async function assertCharacterPieceReviewCurrent(payload: unknown, actor: CharacterActor) {
  await currentPiecePlan(payload, actor);
}

export function applyCharacterPiece(actor: McpActor, operationId: string) {
  let changedCharacter: string | undefined;
  return executeApprovedOperation({ actor, operationId, expectedKind: "character_piece",
    async execute({ payload, subject }) {
      try {
        const { input, plan, resultDigest } = await currentPiecePlan(payload, actor);
        if (input.characterId !== subject.characterId) throw new OperationBlockError("VALIDATION_FAILED");
        const result = await attachCreatedPiece(actor, input, plan, operationId);
        if (result.resultDigest !== resultDigest) throw new OperationBlockError("STALE_REVIEW");
        await captureCharacterSnapshot({ characterId: input.characterId, publishedByUserId: actor.clerkId });
        changedCharacter = input.characterId;
        return { characterId: input.characterId, appliedRevision: result.summary.resultRevision, ...result.saved };
      } catch (error) {
        if (error instanceof CharacterContextUnavailable) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
        throw error;
      }
    },
    afterCommit() { if (changedCharacter) bustResolverCache(changedCharacter); },
  });
}
