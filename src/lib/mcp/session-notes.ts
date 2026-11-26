import { z } from "zod";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendApprovedNote, ApprovedNoteRejected, playerNotesDigest, projectApprovedNoteAppend, readPlayerNotesForAppend } from "@/lib/character/append-approved-note";
import type { McpActor } from "./auth";
import { characterIdSchema, characterSheetUrl, readOnlyCharacterContext, requireCharacterAccess, type CharacterActor } from "./context-shared";
import { operationUuid } from "./operation-policy";
import { executeApprovedOperation, OperationBlockError, prepareOperation } from "./operations";

const noteText = z.string().transform(value => value.replace(/\r\n/g, "\n").trim())
  .pipe(z.string().min(1).max(2_000).refine(value => !value.includes("\0")));
export const previewSessionNoteInput = z.strictObject({ characterId: characterIdSchema, text: noteText });
export const prepareSessionNoteInput = previewSessionNoteInput.extend({ supersedesOperationId: operationUuid.optional() });
export const saveSessionNoteInput = z.strictObject({ operationId: operationUuid });
const approvedNote = previewSessionNoteInput.extend({ notesDigest: z.string().regex(/^[a-f0-9]{64}$/) });

/** The coordinator holds the character lock when it displays or accepts an exact review. */
export async function assertSessionNoteReviewCurrent(payload: unknown, actor: CharacterActor) {
  const parsed = approvedNote.safeParse(payload);
  if (!parsed.success) throw new OperationBlockError("VALIDATION_FAILED");
  const current = await readPlayerNotesForAppend(actor, parsed.data.characterId);
  if (current.notesDigest !== parsed.data.notesDigest) throw new OperationBlockError("STALE_REVIEW");
}

async function projectSessionNote(actor: CharacterActor, characterId: string, text: string) {
  return readOnlyCharacterContext(async () => {
    const { character } = await requireCharacterAccess(actor, characterId, "EDITOR");
    let addition: string;
    try {
      ({ addition } = projectApprovedNoteAppend(character.notes, text));
    } catch (error) {
      if (error instanceof ApprovedNoteRejected) throw new OperationBlockError(error.code);
      throw error;
    }
    return {
      baseline: { characterId, text, notesDigest: playerNotesDigest(character.notes) },
      summary: { characterId, characterName: character.name.slice(0, 200), destination: "Player Notes", text, addition },
    };
  });
}

export async function previewSessionNote(
  actor: CharacterActor, raw: z.input<typeof previewSessionNoteInput>, config: { resource: string },
) {
  const { characterId, text } = previewSessionNoteInput.parse(raw);
  const { summary } = await projectSessionNote(actor, characterId, text);
  return { ...summary, sheetUrl: characterSheetUrl(config.resource, characterId) };
}

export async function prepareSessionNote(actor: McpActor, raw: z.input<typeof prepareSessionNoteInput>) {
  const { characterId, text, supersedesOperationId } = prepareSessionNoteInput.parse(raw);
  const { baseline, summary } = await projectSessionNote(actor, characterId, text);
  return prepareOperation({
    actor, kind: "session_note", subject: { kind: "character", characterId }, payload: baseline, summary,
    ...(supersedesOperationId ? { supersedesOperationId } : {}),
  });
}

export async function saveSessionNote(actor: McpActor, raw: z.input<typeof saveSessionNoteInput>) {
  const { operationId } = saveSessionNoteInput.parse(raw);
  let modifiedCharacterId: string | undefined;
  return executeApprovedOperation({
    actor, operationId, expectedKind: "session_note",
    async execute({ payload, subject }) {
      const parsed = approvedNote.safeParse(payload);
      if (!parsed.success || !subject.characterId || parsed.data.characterId !== subject.characterId) {
        throw new OperationBlockError("VALIDATION_FAILED");
      }
      const { characterId, text, notesDigest } = parsed.data;
      try {
        const receipt = await appendApprovedNote(actor, characterId, { text, notesDigest });
        modifiedCharacterId = characterId;
        return receipt;
      } catch (error) {
        if (error instanceof ApprovedNoteRejected) throw new OperationBlockError(error.code);
        throw error;
      }
    },
    afterCommit() { if (modifiedCharacterId) bustResolverCache(modifiedCharacterId); },
  });
}
