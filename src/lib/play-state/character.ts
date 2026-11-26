import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterConsequences, characters, playStates } from "@/db/schema";
import { appendCharacterLog } from "@/lib/character/character-log";
import { emptyPlayState, projectCanonicalPlayState, type PlayState } from "./model";

type ConditionRecord = typeof characterConsequences.$inferSelect;

export function canonicalCharacterPlayValues(stored: PlayState, currentVitality: number | null, records: readonly ConditionRecord[]) {
  const values: Record<string, unknown> = { currentVitality };
  for (const key of Object.keys(stored.overrides)) if (key.startsWith("consequence:")) values[key] = null;
  for (const record of records) values[`consequence:${record.occurrenceId}`] = record.deletedAt ? null : record.occurrence;
  return values;
}

/** Read after authorization inside the caller's read-only snapshot or mutation transaction. */
export async function readCharacterPlaySnapshot(characterId: string, currentVitality: number | null) {
  const [[row], records] = await Promise.all([
    db.select({ revision: playStates.revision, overrides: playStates.overrides, fieldRevisions: playStates.fieldRevisions })
      .from(playStates).where(and(eq(playStates.subjectKind, "CHARACTER"), eq(playStates.subjectId, characterId))).limit(1),
    db.select().from(characterConsequences).where(eq(characterConsequences.characterId, characterId)),
  ]);
  const stored = row ?? emptyPlayState();
  const values = canonicalCharacterPlayValues(stored, currentVitality, records);
  return { stored, state: projectCanonicalPlayState(stored, values), values, records };
}

export async function writeCharacterPlayVitality(characterId: string, value: number | null, next: PlayState) {
  if (value === null) delete next.overrides["currentVitality"];
  else next.overrides["currentVitality"] = value;
  await db.update(characters).set({ currentVitality: value }).where(eq(characters.id, characterId));
}

export async function logCharacterPlayVitality(
  characterId: string, previous: PlayState, next: PlayState, max: number,
  source: "manual" | "long_rest" | "short_rest",
) {
  const prev = typeof previous.overrides["currentVitality"] === "number" ? previous.overrides["currentVitality"] : max;
  const current = typeof next.overrides["currentVitality"] === "number" ? next.overrides["currentVitality"] : max;
  await appendCharacterLog(characterId, "vitality_change", { prev, next: current, delta: current - prev, source });
}
