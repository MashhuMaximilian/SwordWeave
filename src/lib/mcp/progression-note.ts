import { z } from "zod";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { appendApprovedNote, ApprovedNoteRejected, projectApprovedNoteAppend, readPlayerNotesForAppend } from "@/lib/character/append-approved-note";
import type { McpActor } from "./auth";
import { getMcpConfig } from "./config";
import { operationUuid, permitsOperation } from "./operation-policy";
import { executeApprovedOperation, getApprovedProgressionDocument, OperationBlockError, OperationUnavailableError, prepareOperation } from "./operations";

export const progressionNoteInput = z.strictObject({
  characterId: operationUuid,
  documentId: operationUuid,
  supersedesOperationId: operationUuid.optional(),
});
const reviewedNote = z.object({ text: z.string().min(1).max(6_000), notesDigest: z.string().regex(/^[a-f0-9]{64}$/) });

export function progressionNoteMarkdown(plan: { title: string; ideas: string[] }) {
  const title = plan.title.replace(/\s+/g, " ").replace(/[\\`*_{}\[\]()<>#+.!|~]/g, "\\$&");
  return [`## Progression plan: ${title}`, ...plan.ideas].join("\n\n");
}

export async function prepareProgressionNote(actor: McpActor, { characterId, documentId, supersedesOperationId }: z.infer<typeof progressionNoteInput>) {
  const config = getMcpConfig();
  if (!config || !permitsOperation(config, actor, "progression_note", "write", "mcp")) throw new OperationUnavailableError();
  const document = await getApprovedProgressionDocument(actor, documentId);
  const { notes, notesDigest } = await readPlayerNotesForAppend(actor, characterId);
  const text = progressionNoteMarkdown(document);
  const { addition } = projectApprovedNoteAppend(notes, text);
  return prepareOperation({ actor, kind: "progression_note", subject: { kind: "character", characterId },
    summary: { destination: "Player Notes", characterId, markdownAddition: addition }, payload: reviewedNote.parse({ text, notesDigest }),
    ...(supersedesOperationId ? { supersedesOperationId } : {}) });
}

export async function saveProgressionNote(actor: McpActor, operationId: string) {
  let changedCharacterId: string | undefined;
  return executeApprovedOperation({ actor, operationId, expectedKind: "progression_note", execute: async ({ payload, subject }) => {
    const parsed = reviewedNote.safeParse(payload);
    if (!parsed.success || !subject.characterId) throw new OperationBlockError("VALIDATION_FAILED");
    try {
      const result = await appendApprovedNote(actor, subject.characterId, parsed.data);
      changedCharacterId = result.characterId;
      return result;
    } catch (error) {
      if (error instanceof ApprovedNoteRejected) throw new OperationBlockError(error.code);
      throw error;
    }
  }, afterCommit() { if (changedCharacterId) bustResolverCache(changedCharacterId); } });
}
