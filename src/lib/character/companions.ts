import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { characterMonsterCompanions, monsterCopies, playStates } from "@/db/schema";
import { resolveAuthorByClerkId } from "@/lib/auth/author-resolver";
import { prepareMonsterCopy, searchVisibleMonsterTemplates } from "@/lib/monsters/service";
import { canResolveCharacter, CharacterAccessDenied } from "./can-resolve-character";
import {
  MAX_CHARACTER_COMPANIONS,
  type CharacterCompanionAction,
  type CharacterCompanionAttachmentRecord,
  type CharacterCompanionCandidate,
  type CharacterCompanionChange,
  type CharacterCompanionSummary,
} from "./companion-types";

type Copy = typeof monsterCopies.$inferSelect;
type PreparedCopy = Awaited<ReturnType<typeof prepareMonsterCopy>>;
type Ownership = { userId: string | null };
type CompanionOperation = { id: string; payload: CharacterCompanionAction };

export class CharacterCompanionConflict extends Error {}

export async function requireCharacterCompanionOwner(characterId: string, clerkUserId: string | null, lockedCharacter?: Ownership) {
  if (!clerkUserId) throw new CharacterAccessDenied(characterId);
  const character = lockedCharacter ?? (await canResolveCharacter(clerkUserId, characterId)).character;
  // Legacy characters may store a Clerk ID or an internal user ID. An editor
  // or development-only username match cannot attach a copy to another owner.
  if (character.userId !== clerkUserId && (await resolveAuthorByClerkId(clerkUserId))?.id !== character.userId)
    throw new CharacterAccessDenied(characterId);
  return clerkUserId;
}

export async function listOwnerCharacterCompanionCopies(characterId: string, clerkUserId: string | null) {
  let owner: string;
  try {
    owner = await requireCharacterCompanionOwner(characterId, clerkUserId);
  } catch (error) {
    if (error instanceof CharacterAccessDenied) return [];
    throw error;
  }
  // Both values come from one row snapshot. The normal play GET initializes a
  // missing override row, while an export must leave an unopened copy alone.
  return db.select({ copy: monsterCopies, overrides: playStates.overrides })
    .from(characterMonsterCompanions)
    .innerJoin(monsterCopies, eq(monsterCopies.id, characterMonsterCompanions.copyId))
    .leftJoin(playStates, and(eq(playStates.subjectKind, "MONSTER_PLAY_COPY"), eq(playStates.subjectId, monsterCopies.id)))
    .where(and(eq(characterMonsterCompanions.characterId, characterId), eq(monsterCopies.userId, owner)))
    .orderBy(asc(characterMonsterCompanions.position), asc(characterMonsterCompanions.id));
}

async function readCompanionRows(characterId: string, owner?: string) {
  return db.select({
    id: characterMonsterCompanions.id,
    position: characterMonsterCompanions.position,
    copyId: monsterCopies.id,
    copyName: monsterCopies.name,
    owner: monsterCopies.userId,
    templateId: monsterCopies.templateId,
    version: monsterCopies.templateVersion,
  }).from(characterMonsterCompanions)
    .innerJoin(monsterCopies, eq(monsterCopies.id, characterMonsterCompanions.copyId))
    .where(and(eq(characterMonsterCompanions.characterId, characterId), owner ? eq(monsterCopies.userId, owner) : undefined))
    .orderBy(asc(characterMonsterCompanions.position), asc(characterMonsterCompanions.id));
}

async function readBestiaryReference(templateId: string, version: number, viewerClerkId: string): Promise<CharacterCompanionCandidate | null> {
  try {
    const prepared = await prepareMonsterCopy(templateId, viewerClerkId, "", version);
    return { id: templateId, version, name: prepared.name };
  } catch {
    // The play copy may survive independently when the source or any of its
    // components cannot be viewed by this caller.
    return null;
  }
}

export async function listCharacterCompanions(characterId: string, clerkUserId: string): Promise<CharacterCompanionSummary[]> {
  const access = await canResolveCharacter(clerkUserId, characterId);
  if (access.permission === "OWNER") await requireCharacterCompanionOwner(characterId, clerkUserId, access.character);
  const sources = new Map<string, Promise<CharacterCompanionCandidate | null>>();
  const rows = await readCompanionRows(characterId);
  const summaries = await Promise.all(rows.map(async (row): Promise<CharacterCompanionSummary | null> => {
    let reference: CharacterCompanionCandidate | null = null;
    if (row.templateId) {
      const sourceKey = `${row.templateId}:${row.version}`;
      const load = sources.get(sourceKey) ?? readBestiaryReference(row.templateId, row.version, clerkUserId);
      sources.set(sourceKey, load);
      reference = await load;
    }
    if (access.permission === "OWNER" && row.owner === clerkUserId) {
      return { id: row.id, name: row.copyName, playCopyId: row.copyId, ...(reference ? { bestiary: reference } : {}) };
    }
    return reference ? { id: row.id, name: reference.name, bestiary: reference } : null;
  }));
  return summaries.filter((entry): entry is CharacterCompanionSummary => entry !== null);
}

export async function listCharacterCompanionCandidates(characterId: string, clerkUserId: string, query: string) {
  await requireCharacterCompanionOwner(characterId, clerkUserId);
  const templates = await searchVisibleMonsterTemplates(clerkUserId, query);
  const candidates = await Promise.all(templates.map(template => readBestiaryReference(template.id, template.version, clerkUserId)));
  return candidates.filter((entry): entry is CharacterCompanionCandidate => entry !== null);
}

interface CompanionDraftResult {
  before: CharacterCompanionAttachmentRecord[];
  after: CharacterCompanionAttachmentRecord[];
  changes: CharacterCompanionChange[];
}

/** Call with the character locked in the same transaction as the draft receipt. */
export async function executeCharacterCompanionOperations(
  characterId: string,
  clerkUserId: string,
  lockedCharacter: Ownership,
  operations: readonly CompanionOperation[],
  preview: boolean,
): Promise<CompanionDraftResult> {
  await requireCharacterCompanionOwner(characterId, clerkUserId, lockedCharacter);
  const rows = await readCompanionRows(characterId, clerkUserId);
  const before = rows.map(({ id, copyId, position }) => ({ id, copyId, position }));
  const retained = new Map(rows.map(row => [row.id, row]));
  const additions = new Map<string, Extract<CharacterCompanionAction, { action: "add" }>>();
  const changes: CharacterCompanionChange[] = [];
  for (const { id, payload } of operations) {
    if (payload.action === "add") {
      if (rows.some(row => row.id === id)) throw new CharacterCompanionConflict("This companion attachment already exists.");
      additions.set(id, payload);
    } else if (!additions.delete(payload.attachmentId)) {
      const row = retained.get(payload.attachmentId);
      if (!row) throw new CharacterCompanionConflict("The companion changed. Review the saved character again.");
      retained.delete(row.id);
      changes.push({ id: row.id, action: "remove", name: row.copyName });
    }
  }
  if (retained.size + additions.size > MAX_CHARACTER_COMPANIONS)
    throw new CharacterCompanionConflict(`A character can have up to ${MAX_CHARACTER_COMPANIONS} companions.`);

  // Validate all additions before writing, including current visibility and
  // exact template version. The source row is share-locked until the save ends.
  const prepared: { id: string; copy: PreparedCopy }[] = [];
  for (const [id, { templateId, version, name }] of additions) {
    let copy: PreparedCopy;
    try {
      copy = await prepareMonsterCopy(templateId, clerkUserId, name ?? "", version, true);
    } catch {
      throw new CharacterCompanionConflict("A selected monster or one of its rules changed or is unavailable. Choose it again from the Bestiary.");
    }
    prepared.push({ id, copy });
    changes.push({ id, action: "add", name: copy.name });
  }
  if (preview || !changes.length) return { before, after: before, changes };

  const removedIds = changes.flatMap(change => change.action === "remove" ? [change.id] : []);
  if (removedIds.length) await db.delete(characterMonsterCompanions).where(and(
    eq(characterMonsterCompanions.characterId, characterId), inArray(characterMonsterCompanions.id, removedIds),
  ));
  const after = [...retained.values()].map(({ id, copyId, position }) => ({ id, copyId, position }));
  let position = Math.max(-1, ...after.map(row => row.position));
  for (const { id, copy: values } of prepared) {
    const [copy] = await db.insert(monsterCopies).values(values).returning({ id: monsterCopies.id });
    if (!copy) throw new Error("Could not create the monster's play copy.");
    const attachment = { id, copyId: copy.id, position: ++position };
    await db.insert(characterMonsterCompanions).values({ ...attachment, characterId });
    after.push(attachment);
  }
  return { before, after, changes };
}

/** Reverse the latest draft's attachments. Playing either copy after the
 * draft never invalidates Undo and never gets rolled back here. */
export async function undoCharacterCompanionAttachments(
  characterId: string,
  clerkUserId: string,
  lockedCharacter: Ownership,
  before: readonly CharacterCompanionAttachmentRecord[],
  after: readonly CharacterCompanionAttachmentRecord[],
) {
  await requireCharacterCompanionOwner(characterId, clerkUserId, lockedCharacter);
  const rows = await readCompanionRows(characterId, clerkUserId);
  if (rows.length !== after.length || rows.some((row, index) => {
    const expected = after[index];
    return !expected || row.id !== expected.id || row.copyId !== expected.copyId || row.position !== expected.position;
  })) throw new CharacterCompanionConflict("The companions changed since this draft was applied.");
  const removed = after.filter(row => !before.some(prior => row.id === prior.id));
  const restored = before.filter(row => !after.some(later => row.id === later.id));
  const restoredCopyIds = restored.map(row => row.copyId);
  if (restoredCopyIds.length) {
    const available: Pick<Copy, "id">[] = await db.select({ id: monsterCopies.id }).from(monsterCopies)
      .where(and(eq(monsterCopies.userId, clerkUserId), inArray(monsterCopies.id, restoredCopyIds))).for("share");
    if (available.length !== restoredCopyIds.length)
      throw new CharacterCompanionConflict("A detached companion's play copy is no longer available.");
  }
  if (removed.length) await db.delete(characterMonsterCompanions).where(and(
    eq(characterMonsterCompanions.characterId, characterId), inArray(characterMonsterCompanions.id, removed.map(row => row.id)),
  ));
  if (restored.length) await db.insert(characterMonsterCompanions).values(restored.map(row => ({ ...row, characterId })));
}
