import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters, characterWorkspaceState } from "@/db/schema";
import { requireCharacterAccess, type CharacterActor } from "@/lib/mcp/context-shared";

export class ApprovedNoteRejected extends Error {
  constructor(readonly code: "STALE_REVIEW" | "VALIDATION_FAILED") {
    super(code === "STALE_REVIEW" ? "Player Notes changed after review." : "The addition exceeds the Player Notes limit or is empty.");
  }
}

export function playerNotesDigest(notes: string | null) {
  return createHash("sha256").update(notes ?? "", "utf8").digest("hex");
}

export function projectApprovedNoteAppend(original: string | null, text: string) {
  const existing = original ?? "";
  const separator = !existing || /(?:\r?\n){2}$/.test(existing) ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  const addition = separator + text;
  const notes = existing + addition;
  if (!text.trim() || text.includes("\0") || notes.length > 50_000) throw new ApprovedNoteRejected("VALIDATION_FAILED");
  return { notes, separator, addition };
}

export async function readPlayerNotesForAppend(actor: CharacterActor, characterId: string) {
  const { character } = await requireCharacterAccess(actor, characterId, "EDITOR");
  return { notes: character.notes, notesDigest: playerNotesDigest(character.notes) };
}

/** Join the coordinator's transaction so the note and its receipt commit together. */
export function appendApprovedNote(actor: CharacterActor, characterId: string, input: { text: string; notesDigest: string }) {
  return withDatabaseTransaction(async () => {
    await db.select({ id: characters.id }).from(characters).where(eq(characters.id, characterId)).for("update");
    const current = await readPlayerNotesForAppend(actor, characterId);
    if (current.notesDigest !== input.notesDigest) throw new ApprovedNoteRejected("STALE_REVIEW");
    const { notes, addition } = projectApprovedNoteAppend(current.notes, input.text);
    await db.update(characters).set({ notes, updatedAt: new Date() }).where(eq(characters.id, characterId));
    const [workspace] = await db.insert(characterWorkspaceState).values({ characterId, revision: 1 }).onConflictDoUpdate({
      target: characterWorkspaceState.characterId,
      set: { revision: sql`${characterWorkspaceState.revision}+1` },
    }).returning({ revision: characterWorkspaceState.revision });
    if (!workspace) throw new Error("Player Notes revision is unavailable");
    return { characterId, appliedRevision: workspace.revision, appendedDigest: playerNotesDigest(addition) };
  });
}
