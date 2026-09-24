import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterWorkspaceCommands } from "@/db/schema";

/** Role extensions are tied to a concrete active grant, never a username. Existing viewer grants remain read-only. */
export async function saveSuggestionGrant(characterId: string, shareId: string, canSuggest: boolean) {
  const result = { canSuggest };
  await db.insert(characterWorkspaceCommands).values({ characterId, commandId: `share-role:${shareId}`, kind: "share-role", requestHash: shareId, result }).onConflictDoUpdate({ target: [characterWorkspaceCommands.characterId, characterWorkspaceCommands.commandId], set: { result, updatedAt: new Date() } });
}
export async function getSuggestionGrants(characterId: string): Promise<Set<string>> {
  const rows = await db.select().from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId, characterId), eq(characterWorkspaceCommands.kind, "share-role")));
  return new Set(rows.filter(row => row.result["canSuggest"] === true).map(row => row.commandId.slice("share-role:".length)));
}
