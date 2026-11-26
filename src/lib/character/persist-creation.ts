import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { characterCapabilities, characterPrimitives, characters, companionOperationSteps } from "@/db/schema";
import { bindCreationCapabilityMembers, currentPrivateCreationCapability, savePrivateCreationCapability } from "@/lib/character/creation-capability";
import { currentPrivateCharacterPrimitive, savePrivateCharacterPrimitive } from "@/lib/mcp/creation-authoring";
import { draftV1 } from "@/lib/mcp/draft";
import { withPublishingTransaction } from "@/lib/publishing/save-transaction";
import { z } from "zod";
import { orderedCreationAuthors, planCreation, type PinnedCharacterCreation } from "./prepare-creation";

type Actor = { id: string; clerkId: string };
type CreationReview = Awaited<ReturnType<typeof currentReview>>;
type NativePin = { kind: "primitive"; id: number; versionId: string } | { kind: "capability"; id: string; versionId: string };
const capabilityId = z.uuid();
const reviewedCreation = z.strictObject({
  draft: draftV1.refine(draft => draft.portraitPrompt === undefined),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export class StaleCharacterCreationError extends Error {
  readonly code = "STALE_REVIEW";

  constructor() {
    super("The character review has changed. Prepare a new review before saving.");
  }
}

async function currentReview(payload: unknown, actor: Actor) {
  const approved = reviewedCreation.safeParse(payload);
  if (!approved.success) throw new StaleCharacterCreationError();
  const result = await planCreation(approved.data.draft, actor);
  if (!result.prepared || result.prepared.fingerprint !== approved.data.fingerprint) throw new StaleCharacterCreationError();
  return result;
}

/** A stored summary can reveal pieces the player could see when it was prepared. */
export async function assertPinnedCreationReviewCurrent(payload: unknown, actor: Actor): Promise<void> {
  await currentReview(payload, actor);
}

export function creationStepKinds(approved: PinnedCharacterCreation) {
  return [...orderedCreationAuthors(approved.draft).map(({ kind }, index) => `${kind}_${index}`), "character"];
}

async function saveReviewedCharacter(review: CreationReview, actor: Actor, authoredPins: ReadonlyMap<string, NativePin>) {
  const { preview, slots, capabilities } = review;
  const { normalized, budget } = preview;
  const { name, size, attributes, backstory } = normalized;
  const { physical, mental, magical, proficient } = attributes;
  if (!name || physical === undefined || mental === undefined || magical === undefined) throw new StaleCharacterCreationError();
  const nativeCapabilities = new Map<string, { id: string; versionId: string }>();
  for (const { pieceKey, capability } of capabilities) {
    const native = capability.versionId ? capability : authoredPins.get(pieceKey);
    if (!native?.versionId || typeof native.id !== "string") throw new StaleCharacterCreationError();
    nativeCapabilities.set(capability.id, { id: native.id, versionId: native.versionId });
  }
  const placements = slots.map(({ pieceKey, primitive, source, isMirrored, originCapabilityId, directSource }) => {
    const native = primitive.versionId === null ? authoredPins.get(pieceKey ?? "") : primitive;
    const origin = originCapabilityId ? nativeCapabilities.get(originCapabilityId) : undefined;
    if (!native?.versionId || typeof native.id !== "number" || (originCapabilityId && !origin)) throw new StaleCharacterCreationError();
    return {
      primitiveId: native.id, versionId: native.versionId, source, isMirrored, originCapabilityId: origin?.id, directSource,
      acquiredAtLevel: budget.level, slotSource: "PINNED" as const,
    };
  });
  const tx = getDb();
  const [character] = await tx.insert(characters).values({
    userId: actor.clerkId, name, size, level: budget.level,
    attrPhysical: physical, attrMental: mental, attrMagical: magical, attrProficient: proficient,
    backstory, startingBu: budget.startingBu, buSpent: budget.positiveSpent, isPublic: false, sourceOrigin: "manual",
  }).returning({ id: characters.id });
  if (!character) throw new Error("Character creation returned no result.");

  if (capabilities.length) await tx.insert(characterCapabilities).values(capabilities.map(({ capability, source }) => {
    const { id, versionId } = nativeCapabilities.get(capability.id)!;
    return { characterId: character.id, capabilityId: id, versionId, slotTab: source,
      slotSource: "PINNED" as const, acquiredAtLevel: budget.level };
  }));
  await tx.insert(characterPrimitives).values(placements.map(slot => ({ characterId: character.id, ...slot })));
  return { characterId: character.id };
}

/** Called only by the approval coordinator, which commits the result and receipt together. */
export async function persistApprovedPinnedCharacterCreation(
  approved: PinnedCharacterCreation,
  actor: Actor,
): Promise<{ characterId: string }> {
  return withPublishingTransaction(async () => saveReviewedCharacter(await currentReview(approved, actor), actor, new Map()));
}

/** Run exactly one step with the approval coordinator holding the operation row. */
export async function performPinnedCharacterCreationStep(approved: PinnedCharacterCreation, actor: Actor, operationId: string, stepKind: string) {
  return withPublishingTransaction(async () => {
    const current = await currentReview(approved, actor);
    const kinds = creationStepKinds(approved);
    const index = kinds.indexOf(stepKind);
    if (index < 0 || kinds.length !== current.authored.length + 1) throw new StaleCharacterCreationError();

    const pins = new Map<string, NativePin>();
    if (index > 0) {
      const tx = getDb();
      const completed = await tx.select().from(companionOperationSteps).where(and(
        eq(companionOperationSteps.operationId, operationId), eq(companionOperationSteps.status, "committed"),
      )).orderBy(companionOperationSteps.ordinal);
      if (completed.length !== index) throw new StaleCharacterCreationError();
      for (const [ordinal, previous] of completed.entries()) {
        const author = current.authored[ordinal];
        if (!author || previous.ordinal !== ordinal || previous.kind !== kinds[ordinal] || previous.entityKind !== author.kind ||
            !previous.entityId || !previous.versionPin) {
          throw new StaleCharacterCreationError();
        }
        if (author.kind === "primitive") {
          if (!/^[1-9][0-9]{0,9}$/.test(previous.entityId) || Number(previous.entityId) > 2147483647) throw new StaleCharacterCreationError();
          const pin = await currentPrivateCharacterPrimitive(author.recipe, actor.clerkId, Number(previous.entityId), previous.versionPin);
          if (!pin) throw new StaleCharacterCreationError();
          pins.set(author.pieceKey, { kind: author.kind, ...pin });
        } else {
          if (!capabilityId.safeParse(previous.entityId).success) throw new StaleCharacterCreationError();
          const recipe = bindCreationCapabilityMembers(author.recipe, actor.clerkId, pins);
          if (!recipe) throw new StaleCharacterCreationError();
          const pin = await currentPrivateCreationCapability(recipe, actor.clerkId, previous.entityId, previous.versionPin);
          if (!pin) throw new StaleCharacterCreationError();
          pins.set(author.pieceKey, { kind: author.kind, ...pin });
        }
      }
    }

    if (stepKind === "character") return saveReviewedCharacter(current, actor, pins);
    const next = current.authored[index];
    if (!next) throw new StaleCharacterCreationError();
    if (next.kind === "primitive") return savePrivateCharacterPrimitive(next.recipe, actor.clerkId);
    const recipe = bindCreationCapabilityMembers(next.recipe, actor.clerkId, pins);
    if (!recipe) throw new StaleCharacterCreationError();
    return savePrivateCreationCapability(recipe, actor.clerkId);
  });
}
