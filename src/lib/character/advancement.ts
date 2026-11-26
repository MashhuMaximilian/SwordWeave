import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { characterLog, characters, characterWorkspaceState } from "@/db/schema";
import { cumulativeBuForLevel } from "@/lib/engine/bu";
import { computeProgressionPool } from "@/lib/engine/bu-balance";
import { captureCharacterSnapshot } from "./capture-character-snapshot";
import type { LevelUpPayload } from "./character-log";

export const maxStoredCharacterLevel = 2_147_483_647;

export function advancementLevels(from: number, to: number) {
  return Array.from({ length: to - from }, (_, index) => {
    const level = from + index + 1;
    const cumulativeBu = cumulativeBuForLevel(level);
    return { level, cumulativeBu, gainedBu: cumulativeBu - cumulativeBuForLevel(level - 1) };
  });
}

/** The caller holds the authorized character row lock in the write transaction. */
export async function writeCharacterAdvancement(
  current: typeof characters.$inferSelect,
  targetLevel: number,
  actorClerkId: string,
  currentVitality?: number,
) {
  if (!Number.isInteger(targetLevel) || targetLevel <= current.level || targetLevel > maxStoredCharacterLevel) {
    throw new Error("Choose a level above the character's current level.");
  }
  const [updated] = await db.update(characters).set({
    level: targetLevel, dmBonusBu: 0, updatedAt: new Date(),
    ...(currentVitality === undefined ? {} : { currentVitality }),
  }).where(eq(characters.id, current.id)).returning();
  if (!updated) throw new Error("The character could not be advanced.");

  const [workspace] = await db.insert(characterWorkspaceState).values({ characterId: current.id, revision: 1 }).onConflictDoUpdate({
    target: characterWorkspaceState.characterId,
    set: { revision: sql`${characterWorkspaceState.revision} + 1` },
  }).returning({ revision: characterWorkspaceState.revision });
  if (!workspace) throw new Error("The advanced character revision is unavailable.");

  const payload: LevelUpPayload = {
    prevLevel: current.level, newLevel: targetLevel, dmBonusAwarded: current.dmBonusBu,
    buAwarded: computeProgressionPool(current.startingBu, targetLevel, 0) - computeProgressionPool(current.startingBu, current.level, 0),
  };
  await db.insert(characterLog).values({ characterId: current.id, kind: "level_up", payload });
  await captureCharacterSnapshot({ characterId: current.id, publishedByUserId: actorClerkId });
  return { character: updated, revision: workspace.revision };
}
