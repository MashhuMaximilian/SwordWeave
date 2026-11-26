import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characters, users } from "@/db/schema";
import { recordCharacterForkGrants } from "@/lib/character/workspace/fork-grants";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { WorkspaceConflict } from "@/lib/character/workspace/commands";
import { characterDraftSchema, executeDraftOperations, rollbackWorkspacePreview, workspaceBuildFingerprint } from "@/lib/character/workspace/drafts";
import type { DraftOperation, WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import { splitProgressionSpend } from "@/lib/engine/bu-balance";
import { validateAttributes } from "@/lib/engine/practices";
import { withPublishingTransaction } from "@/lib/publishing/save-transaction";
import type { McpActor } from "./auth";
import { attachmentChange, CharacterEditUnavailable, checkedSlotResult, deriveSlotEdit, mirrorChange, moveChange, removeChange, type SlotEdit } from "./character-edit-slots";
import { authorizesMaterializedSheetInputs, hasUnresolvedGraphDependencies, readVisibleGraph } from "./character-context";
import {
  characterIdSchema, characterSheetUrl, requireCharacterAccess, type CharacterActor,
} from "./context-shared";
import { digestJson, MAX_CHANGED_SLOT_IDS, operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, OperationUnavailableError, prepareOperation } from "./operations";

const prose = z.string().trim().max(4_000).refine(value => !value.includes("\0")).optional();
const backstoryInput = z.strictObject({
  description: prose, personality: prose, origin: prose, motivation: prose, ties: prose, flaw: prose,
}).refine(value => Object.keys(value).length > 0, "Supply at least one backstory field.");
const foundationFields = characterDraftSchema.pick({
  name: true, attrPhysical: true, attrMental: true, attrMagical: true, attrProficient: true, size: true,
}).extend({ backstory: backstoryInput.optional() })
  .refine(value => Object.keys(value).length > 0, "Supply at least one foundation field.");
export const foundationChange = z.strictObject({ kind: z.literal("set_foundation"), fields: foundationFields });
export const workspaceEditChange = z.discriminatedUnion("kind", [foundationChange, attachmentChange, mirrorChange, moveChange, removeChange]);
const editFields = z.strictObject({
  characterId: characterIdSchema, expectedRevision: z.number().int().min(0).max(2147483646),
  intent: z.literal("apply"), changes: z.array(workspaceEditChange).min(1).max(12),
});
function boundedRequest(input: unknown) {
  return Buffer.byteLength(JSON.stringify(input), "utf8") <= 65_536;
}
export const previewCharacterEditInput = editFields.refine(boundedRequest, "The edit exceeds 64 KiB.");
export const prepareCharacterEditInput = editFields.extend({ supersedesOperationId: operationUuid.optional() })
  .refine(boundedRequest, "The edit exceeds 64 KiB.");
export const applyCharacterEditInput = z.strictObject({ operationId: operationUuid });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const approvedEdit = z.strictObject({ input: previewCharacterEditInput, baseFingerprint: digest, semanticDigest: digest });

type EditInput = z.output<typeof previewCharacterEditInput>;
type Character = typeof characters.$inferSelect;
type FoundationOperation = Extract<DraftOperation, { type: "character" }>;
type Difference = { field: string; before: string | number | null; after: string | number | null };

async function deriveEdits(actor: CharacterActor, character: Character, graph: Awaited<ReturnType<typeof readVisibleGraph>>["graph"], changes: EditInput["changes"], alsoVisibleTo?: string) {
  const operations: DraftOperation[] = [];
  const reviewedChanges: ({ kind: "set_foundation"; fields: Difference[] } | SlotEdit["review"])[] = [];
  const slotEdits: SlotEdit[] = [];
  const touchedDefinitions = new Set<string>();
  let current = character;
  for (const change of changes) {
    if (change.kind !== "set_foundation") {
      const slot = await deriveSlotEdit(actor, graph, change, alsoVisibleTo);
      if (!slot) continue;
      const touched = [slot.replacedEdgeId ?? slot.child, ...(slot.containers ?? []).map(container => container.rootId)];
      if (touched.some(key => touchedDefinitions.has(key))) throw new CharacterEditUnavailable("Review each placement or container only once per edit.");
      for (const key of touched) touchedDefinitions.add(key);
      operations.push(slot.operation);
      reviewedChanges.push(slot.review);
      slotEdits.push(slot);
      continue;
    }
    const { backstory, ...values } = change.fields;
    const differences: Difference[] = [];
    const payload: FoundationOperation["payload"] = {};
    for (const field of ["name", "attrPhysical", "attrMental", "attrMagical", "attrProficient", "size"] as const) {
      const target = values[field];
      if (target === undefined || target === current[field]) continue;
      Object.assign(payload, { [field]: target });
      differences.push({ field, before: current[field], after: target });
    }
    if (backstory) {
      const old = z.record(z.string(), z.string()).safeParse(current.backstory);
      if (!old.success) throw new CharacterEditUnavailable("Review the existing backstory on the sheet before changing it here.");
      const merged = { ...old.data };
      for (const field of ["description", "personality", "origin", "motivation", "ties", "flaw"] as const) {
        const target = backstory[field];
        if (target === undefined || target === old.data[field]) continue;
        merged[field] = target;
        differences.push({ field: `backstory.${field}`, before: old.data[field] ?? null, after: target });
      }
      if (differences.some(diff => diff.field.startsWith("backstory."))) payload.backstory = merged;
    }
    if (differences.length === 0) continue;
    current = { ...current, ...payload };
    const attributes = validateAttributes({ physical: current.attrPhysical, mental: current.attrMental, magical: current.attrMagical });
    if (!attributes.valid) throw new CharacterEditUnavailable(attributes.errors.join(" "));
    if (!characterDraftSchema.safeParse(payload).success) throw new CharacterEditUnavailable("Review the foundation fields before applying this change.");
    operations.push({ id: randomUUID(), type: "character", payload });
    reviewedChanges.push({ kind: change.kind, fields: differences });
  }
  if (operations.length === 0) throw new CharacterEditUnavailable("The submitted values already match the character.");
  return { operations, reviewedChanges, slotEdits, expected: current };
}

function reviewEditResult(actor: CharacterActor, character: Character, plan: Awaited<ReturnType<typeof deriveEdits>>, result: WorkspaceDraftPreview) {
  if (!result.beforeSnapshot || !result.afterSnapshot) throw new CharacterEditUnavailable("The reviewed character snapshot is unavailable.");
  const savedFoundation = result.afterSnapshot.foundation;
  for (const field of new Set(plan.operations.flatMap(operation => operation.type === "character" ? Object.keys(operation.payload) : []))) {
    if (!Object.hasOwn(savedFoundation, field) || digestJson(savedFoundation[field]) !== digestJson(plan.expected[field as keyof Character])) {
      throw new CharacterEditUnavailable("The final sheet differs from the reviewed foundation.");
    }
  }
  const budget = (sheet: WorkspaceDraftPreview["sheet"]) => {
    const { progressionSpent: spent, progressionPool: pool, itemBuSpent: itemSpent } = sheet.buBalance;
    const { rating, ceiling } = sheet.volatility;
    const { remaining, debtUsed, uncoveredExcess } = splitProgressionSpend(spent, pool, rating);
    const debtAvailable = Math.max(0, Math.min(rating, ceiling) - debtUsed);
    return { spent, remaining, pool, itemSpent,
      ...(rating || uncoveredExcess ? { debtUsed, debtAvailable, uncoveredExcess } : {}),
    };
  };
  const summary = {
    characterId: character.id, characterName: character.name.slice(0, 200), revision: result.beforeSnapshot.graph.revision,
    changes: plan.reviewedChanges, budgetDelta: { before: budget(result.beforeSheet), after: budget(result.sheet) },
    resultRevision: result.revision, warnings: result.warnings ?? [], tableQuestions: [] as string[],
    blockers: result.sheet.volatility.exceeded ? ["This draft exceeds the character’s drawback credit limit."] : [],
  };
  const slots = plan.slotEdits.length ? checkedSlotResult(result.beforeSnapshot.graph, result.afterSnapshot.graph, plan.slotEdits, result.results, actor) : null;
  if (slots && slots.changedSlotIds.length > MAX_CHANGED_SLOT_IDS) throw new CharacterEditUnavailable("Split these placements into smaller reviewed edits.");
  return { summary, forkGrants: slots?.forkGrants ?? [], semanticDigest: digestJson(slots ? { summary, slots: slots.slotDigest } : summary), changedSlotIds: slots?.changedSlotIds ?? [] };
}

async function readEditBase(actor: CharacterActor, characterId: string, expectedRevision: number, minimum: "EDITOR" | "SUGGESTER") {
  const { character, permission } = await requireCharacterAccess(actor, characterId, minimum);
  const view = await readVisibleGraph(actor, characterId);
  if (view.canonical.revision !== expectedRevision) throw new WorkspaceConflict("The character changed. Reopen the current sheet to review the edit.");
  if (view.restricted || hasUnresolvedGraphDependencies(view.canonical)
    || !await authorizesMaterializedSheetInputs(characterId, view.reachable)) {
    throw new CharacterEditUnavailable("Some sheet dependencies could not be verified. Review the edit on SwordWeave.");
  }
  return { character, permission, view, baseFingerprint: workspaceBuildFingerprint(view.canonical, character) };
}

async function planCharacterEdit(actor: CharacterActor, input: EditInput, minimum: "EDITOR" | "SUGGESTER" = "EDITOR") {
  const { characterId, expectedRevision } = input;
  const { character, permission, view, baseFingerprint } = await readEditBase(actor, characterId, expectedRevision, minimum);
  let ownerClerkId: string | undefined;
  const nested = input.changes.some(change => "path" in change && (change.path.length > 1 || change.kind === "move_reference"));
  if (permission !== "OWNER" && (nested || input.changes.some(change => change.kind === "attach_library_piece"))) {
    const owner = character.userId;
    if (!owner) throw new CharacterEditUnavailable("The character owner must be able to open newly attached pieces.");
    const accounts = await db.select({ id: users.id, clerkId: users.clerkUserId }).from(users).where(and(
      or(eq(users.clerkUserId, owner), eq(sql`${users.id}::text`, owner)), eq(users.isAnonymized, false), isNull(users.deletedAt),
    )).limit(2);
    ownerClerkId = accounts.length === 1 ? accounts[0]?.clerkId ?? undefined : undefined;
    if (!ownerClerkId || !accounts[0]) throw new CharacterEditUnavailable("The character owner must be able to open the reviewed pieces.");
    if (nested) await readEditBase({ id: accounts[0].id, clerkId: ownerClerkId }, characterId, expectedRevision, "EDITOR");
  }
  const plan = await deriveEdits(actor, character, view.graph, input.changes, ownerClerkId);
  return { character, graph: view.canonical, scopedForks: view.scopedForks, plan, baseFingerprint };
}

function previewEdit(actor: CharacterActor, input: EditInput, minimum: "EDITOR" | "SUGGESTER" = "EDITOR") {
  return rollbackWorkspacePreview(async () => {
    await requireCharacterAccess(actor, input.characterId, minimum);
    await db.select({ id: characters.id }).from(characters).where(eq(characters.id, input.characterId)).for("update");
    return withPublishingTransaction(async () => {
      const { character, graph, scopedForks, plan, baseFingerprint } = await planCharacterEdit(actor, input, minimum);
      const result = await executeDraftOperations(input.characterId, actor.clerkId, input.expectedRevision, plan.operations, true, { character, graph, scopedForks, verifiedAuthorId: actor.clerkId });
      const { summary, semanticDigest } = reviewEditResult(actor, character, plan, result);
      return { summary, baseFingerprint, semanticDigest, operations: plan.operations };
    });
  });
}

export function previewWorkspaceSuggestion(actor: CharacterActor, raw: unknown) {
  return previewEdit(actor, previewCharacterEditInput.parse(raw), "SUGGESTER");
}

export async function verifyWorkspaceSuggestion(actor: CharacterActor, raw: unknown) {
  const { baseFingerprint, plan } = await planCharacterEdit(actor, previewCharacterEditInput.parse(raw), "SUGGESTER");
  return { baseFingerprint, operations: plan.operations };
}

export async function verifyWorkspaceSuggestionBase(actor: CharacterActor, characterId: string, revision: number) {
  const { character, view, baseFingerprint } = await readEditBase(actor, characterId, revision, "SUGGESTER");
  return { character, graph: view.canonical, scopedForks: view.scopedForks, baseFingerprint };
}

/** Browser callers hold the character and publishing locks before showing stored prose. */
export async function assertCharacterEditReviewCurrent(payload: unknown, actor: CharacterActor) {
  const parsed = approvedEdit.safeParse(payload);
  if (!parsed.success) throw new OperationUnavailableError();
  try {
    const { baseFingerprint } = await planCharacterEdit(actor, parsed.data.input);
    if (baseFingerprint !== parsed.data.baseFingerprint) throw new OperationUnavailableError();
  } catch (error) {
    if (error instanceof CharacterEditUnavailable || error instanceof WorkspaceConflict) throw new OperationUnavailableError();
    throw error;
  }
}

export async function previewCharacterEdit(
  actor: CharacterActor, raw: z.input<typeof previewCharacterEditInput>, config: { resource: string },
) {
  const input = previewCharacterEditInput.parse(raw);
  const sheetUrl = characterSheetUrl(config.resource, input.characterId);
  try {
    return { ...(await previewEdit(actor, input)).summary, sheetUrl };
  } catch (error) {
    if (!(error instanceof WorkspaceConflict) && !(error instanceof CharacterEditUnavailable)) throw error;
    return { characterId: input.characterId, revision: input.expectedRevision, changes: [], budgetDelta: null,
      blockers: [error.message], tableQuestions: [], sheetUrl };
  }
}

export async function prepareCharacterEdit(actor: McpActor, raw: z.input<typeof prepareCharacterEditInput>) {
  const { supersedesOperationId, ...input } = prepareCharacterEditInput.parse(raw);
  let proposed: Awaited<ReturnType<typeof previewEdit>>;
  try {
    proposed = await previewEdit(actor, input);
  } catch (error) {
    if (error instanceof WorkspaceConflict) throw new OperationBlockError("STALE_REVIEW");
    if (error instanceof CharacterEditUnavailable) throw new OperationBlockError("VALIDATION_FAILED");
    throw error;
  }
  if (proposed.summary.blockers.length) throw new OperationBlockError("VALIDATION_FAILED");
  return prepareOperation({
    actor, kind: "character_edit", subject: { kind: "character", characterId: input.characterId },
    summary: proposed.summary, payload: { input, baseFingerprint: proposed.baseFingerprint, semanticDigest: proposed.semanticDigest },
    ...(supersedesOperationId ? { supersedesOperationId } : {}),
  });
}

export async function applyCharacterEdit(actor: McpActor, raw: z.input<typeof applyCharacterEditInput>) {
  const { operationId } = applyCharacterEditInput.parse(raw);
  let updatedCharacterId: string | undefined;
  return executeApprovedOperation({
    actor, operationId, expectedKind: "character_edit",
    async execute({ payload, subject }) {
      const parsed = approvedEdit.safeParse(payload);
      if (!parsed.success || parsed.data.input.characterId !== subject.characterId) throw new OperationBlockError("VALIDATION_FAILED");
      const { input, semanticDigest, baseFingerprint } = parsed.data;
      try {
        return await withPublishingTransaction(async () => {
          const { character, graph, scopedForks, plan, baseFingerprint: current } = await planCharacterEdit(actor, input);
          if (current !== baseFingerprint) throw new OperationBlockError("STALE_REVIEW");
          const result = await executeDraftOperations(input.characterId, actor.clerkId, input.expectedRevision, plan.operations, false, { character, graph, scopedForks, verifiedAuthorId: actor.clerkId });
          const verified = reviewEditResult(actor, character, plan, result);
          if (verified.semanticDigest !== semanticDigest) throw new OperationBlockError("STALE_REVIEW");
          await recordCharacterForkGrants(input.characterId, verified.forkGrants);
          updatedCharacterId = input.characterId;
          return { characterId: input.characterId, appliedRevision: result.revision, changedSlotIds: verified.changedSlotIds };
        });
      } catch (error) {
        if (error instanceof WorkspaceConflict) throw new OperationBlockError("STALE_REVIEW");
        if (error instanceof CharacterEditUnavailable) throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
        throw error;
      }
    },
    afterCommit() { if (updatedCharacterId) bustResolverCache(updatedCharacterId); },
  });
}
