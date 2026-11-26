import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db/client";
import { characterConsequences, characterWorkspaceCommands } from "@/db/schema";
import { consequenceMutationSchema, parseOccurrence } from "./validation";

export class ConsequenceCommandError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readCharacterConsequences(id: string) {
  const records = await db
    .select()
    .from(characterConsequences)
    .where(eq(characterConsequences.characterId, id));
  return {
    records: records.map((r) => ({
      id: r.occurrenceId,
      revision: r.revision,
      occurrence: r.deletedAt ? null : r.occurrence,
    })),
  };
}

/** Call inside the authorized character lock so the command and occurrences are atomic. */
export async function saveCharacterConsequences(id: string, body: z.infer<typeof consequenceMutationSchema>) {
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const commandWhere = and(
    eq(characterWorkspaceCommands.characterId, id),
    eq(characterWorkspaceCommands.commandId, body.commandId),
  );
  const [receipt] = await db
    .select()
    .from(characterWorkspaceCommands)
    .where(commandWhere);
  if (receipt) {
    if (receipt.requestHash !== hash)
      throw new ConsequenceCommandError(
        "This command ID was already used for different content.",
        409,
      );
    return readCharacterConsequences(id);
  }
  if (body.operation === "import") {
    for (const raw of body.occurrences) {
      const occurrence = parseOccurrence(raw);
      await db
        .insert(characterConsequences)
        .values({
          characterId: id,
          occurrenceId: occurrence.id,
          occurrence,
        })
        .onConflictDoNothing();
    }
  } else {
    for (const change of body.changes) {
      const where = and(
        eq(characterConsequences.characterId, id),
        eq(characterConsequences.occurrenceId, change.id),
      );
      const [existing] = await db
        .select()
        .from(characterConsequences)
        .where(where);
      if ((existing?.revision ?? 0) !== change.expectedRevision)
        throw new ConsequenceCommandError(
          "Consequences changed on another device. Your edits are retained; reload the current state before retrying.",
          409,
        );
      if (change.occurrence === null) {
        if (existing)
          await db
            .update(characterConsequences)
            .set({
              deletedAt: new Date(),
              revision: sql`${characterConsequences.revision} + 1`,
            })
            .where(where);
        continue;
      }
      const parsed = parseOccurrence(change.occurrence);
      if (parsed.id !== change.id)
        throw new ConsequenceCommandError("Occurrence identity cannot change.", 400);
      // Application snapshots and promotion links are server-owned and immutable here.
      const occurrence = {
        ...parsed,
        ...(existing?.occurrence.applicationId
          ? {
              applicationId: existing.occurrence.applicationId,
              applicationSnapshot: existing.occurrence.applicationSnapshot,
              sourceEntityId: existing.occurrence.sourceEntityId,
              sourceEntityType: existing.occurrence.sourceEntityType,
              sourceVersionId: existing.occurrence.sourceVersionId,
            }
          : {}),
        ...(existing?.occurrence.applicationSnapshot
          ? { applicationSnapshot: existing.occurrence.applicationSnapshot }
          : {}),
        ...(existing?.occurrence.promotedPrimitiveId
          ? { promotedPrimitiveId: existing.occurrence.promotedPrimitiveId }
          : {}),
      };
      if (existing)
        await db
          .update(characterConsequences)
          .set({
            occurrence,
            deletedAt: null,
            revision: existing.revision + 1,
          })
          .where(where);
      else
        await db
          .insert(characterConsequences)
          .values({ characterId: id, occurrenceId: change.id, occurrence });
    }
  }
  await db
    .insert(characterWorkspaceCommands)
    .values({
      characterId: id,
      commandId: body.commandId,
      kind: `consequence:${body.operation}`,
      requestHash: hash,
      result: { operation: body.operation },
    });
  return readCharacterConsequences(id);
}
