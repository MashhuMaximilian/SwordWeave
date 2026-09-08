import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  characters,
  characterConsequences,
  characterWorkspaceCommands,
} from "@/db/schema";
import {
  consequenceMutationSchema,
  parseOccurrence,
} from "@/lib/character/consequences/validation";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";

class CommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function requireOwner(id: string, userId: string, lock = false) {
  const rows = lock
    ? await db
        .select({ userId: characters.userId })
        .from(characters)
        .where(eq(characters.id, id))
        .for("update")
    : await db
        .select({ userId: characters.userId })
        .from(characters)
        .where(eq(characters.id, id));
  if (!rows[0]) throw new CommandError("Character not found.", 404);
  if (rows[0].userId !== userId)
    throw new CommandError("You do not own this character.", 403);
}
async function read(id: string) {
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
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Consequence save failed.",
    },
    { status: error instanceof CommandError ? error.status : 400 },
  );
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    await requireOwner(id, userId);
    return NextResponse.json(await read(id));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body = consequenceMutationSchema.parse(await request.json());
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const result = await withDatabaseTransaction(async () => {
      await requireOwner(id, userId, true);
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
          throw new CommandError(
            "This command ID was already used for different content.",
            409,
          );
        return read(id);
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
            throw new CommandError(
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
            throw new CommandError("Occurrence identity cannot change.", 400);
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
      return read(id);
    });
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}
