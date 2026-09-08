import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  characters,
  characterConsequences,
  characterWorkspaceCommands,
  characterLog,
} from "@/db/schema";
import { readWorkspace } from "@/lib/character/workspace/read";
import {
  effectiveAvailability,
  supplyPaths,
  type EntityKey,
} from "@/lib/character/workspace/model";
import {
  activeRestrictions,
  type ConsequenceOccurrence,
} from "@/lib/character/consequences/types";
import { consequencePackage } from "@/lib/character/consequences/package";
import {
  loadCharacterMaxVitality,
  clampVitality,
} from "@/lib/character/character-vitality";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
const keySchema = z.string().regex(/^(capability|effect|primitive):.+$/);
const applySchema = z.object({
  key: keySchema,
  commandId: z.string().uuid(),
  expectedHash: z.string(),
  expectedVitality: z.number().nullable(),
  commit: z.literal(true),
});
async function preview(id: string, userId: string, key: EntityKey) {
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    columns: { userId: true, currentVitality: true },
  });
  if (!character || character.userId !== userId)
    throw new Error("You do not own this character.");
  const graph = await readWorkspace(id);
  const records = await db
    .select()
    .from(characterConsequences)
    .where(
      and(
        eq(characterConsequences.characterId, id),
        isNull(characterConsequences.deletedAt),
      ),
    );
  const availability = effectiveAvailability(
    key,
    supplyPaths(graph, key),
    activeRestrictions(records.map((r) => r.occurrence)),
  );
  if (!availability.available)
    throw new Error(
      availability.reasons.join("; ") || "This action is unavailable.",
    );
  const pkg = consequencePackage(graph, key);
  const { max } = await loadCharacterMaxVitality(id);
  const previous = character.currentVitality ?? max;
  return {
    ...pkg,
    currentVitality: character.currentVitality,
    previous,
    next: clampVitality(previous + pkg.vitalityDelta, max),
    max,
  };
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const key = keySchema.parse(
      new URL(request.url).searchParams.get("key"),
    ) as EntityKey;
    return NextResponse.json(await preview(id, userId, key));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed." },
      { status: 400 },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const body = applySchema.parse(await request.json());
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
          throw new Error("Application ID already used for another action.");
        return receipt.result;
      }
      const pkg = await preview(id, userId, body.key as EntityKey);
      if (
        pkg.hash !== body.expectedHash ||
        character.currentVitality !== body.expectedVitality
      )
        throw new Error(
          "The package or vitality changed. Preview the action again; nothing was applied.",
        );
      if (!pkg.pieces.length)
        throw new Error("This action has no authored consequence package.");
      const occurrences: ConsequenceOccurrence[] = pkg.pieces.map((p) => ({
        id: randomUUID(),
        title: p.title,
        description: p.description,
        tags: [],
        modifiers: p.modifiers,
        active: true,
        status: "active",
        durationTier: "manual",
        createdAt: Date.now(),
        source: "custom",
        sourceEntityId: String(p.id),
        sourceEntityType: "primitive",
        sourceVersionId: p.versionId,
        recovery: p.behavior.recovery,
        restrictions: p.behavior.restrictions,
        applicationId: body.commandId,
        applicationSnapshot: {
          vitalityDelta: p.behavior.vitalityDelta,
          modifiers: p.modifiers,
          restrictions: p.behavior.restrictions,
        },
      }));
      for (const occurrence of occurrences)
        await db
          .insert(characterConsequences)
          .values({ characterId: id, occurrenceId: occurrence.id, occurrence });
      await db
        .update(characters)
        .set({ currentVitality: pkg.next })
        .where(eq(characters.id, id));
      await db
        .insert(characterLog)
        .values({
          characterId: id,
          kind: "vitality_change",
          payload: {
            delta: pkg.vitalityDelta,
            prev: pkg.previous,
            next: pkg.next,
            source: "consequence",
            applicationId: body.commandId,
            package: body.key,
            occurrences: occurrences.map((c) => c.id),
          },
        });
      if (body.key.startsWith("capability:"))
        await db
          .insert(characterLog)
          .values({
            characterId: id,
            kind: "capability_trigger",
            payload: {
              capabilityId: body.key.slice(11),
              capabilityName: pkg.name,
              scope: "character",
              applicationId: body.commandId,
            },
          });
      const result = {
        applicationId: body.commandId,
        occurrences,
        previous: pkg.previous,
        currentVitality: pkg.next,
        applied: pkg.next - pkg.previous,
      };
      await db
        .insert(characterWorkspaceCommands)
        .values({
          characterId: id,
          commandId: body.commandId,
          kind: "apply-package",
          requestHash: hash,
          result,
        });
      return result;
    });
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Application failed." },
      { status: 400 },
    );
  }
}
