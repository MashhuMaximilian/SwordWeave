import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  characters,
  characterConsequences,
  characterWorkspaceCommands,
} from "@/db/schema";
import { createWorkspaceEntity } from "@/lib/character/workspace/save-entity";
const schema = z.object({
  commandId: z.string().uuid(),
  expectedRevision: z.number().int(),
  draft: z.record(z.string(), z.unknown()),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> },
) {
  const { userId } = await auth.protect();
  const { id, occurrenceId } = await params;
  try {
    const body = schema.parse(await request.json());
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const result = await withDatabaseTransaction(async () => {
      const [character] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, id))
        .for("update");
      if (!character || character.userId !== userId)
        throw new Error("You do not own this character.");
      const [receipt] = await db
        .select()
        .from(characterWorkspaceCommands)
        .where(
          and(
            eq(characterWorkspaceCommands.characterId, id),
            eq(characterWorkspaceCommands.commandId, body.commandId),
          ),
        );
      if (receipt) {
        if (receipt.requestHash !== hash)
          throw new Error("Command identity already used.");
        return receipt.result;
      }
      const where = and(
        eq(characterConsequences.characterId, id),
        eq(characterConsequences.occurrenceId, occurrenceId),
      );
      const [record] = await db
        .select()
        .from(characterConsequences)
        .where(where);
      if (!record || record.deletedAt)
        throw new Error("Consequence no longer exists.");
      if (record.revision !== body.expectedRevision)
        throw new Error(
          "Consequence changed. Your composer input is retained. Refresh before promoting.",
        );
      if (record.occurrence.promotedPrimitiveId)
        throw new Error(
          "This consequence already has a promoted definition. Open that definition to edit it.",
        );
      const saved = await createWorkspaceEntity("primitive", body.draft);
      const occurrence = {
        ...record.occurrence,
        promotedPrimitiveId: Number(saved.id),
        applicationSnapshot: record.occurrence.applicationSnapshot ?? {
          vitalityDelta: 0,
          modifiers: record.occurrence.modifiers,
          restrictions: record.occurrence.restrictions ?? [],
        },
      };
      await db
        .update(characterConsequences)
        .set({ occurrence, revision: record.revision + 1 })
        .where(where);
      await db
        .insert(characterWorkspaceCommands)
        .values({
          characterId: id,
          commandId: body.commandId,
          kind: "promote-consequence",
          requestHash: hash,
          result: saved.result,
        });
      return saved.result;
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Promotion failed." },
      { status: 400 },
    );
  }
}
