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
  type WorkspaceGraph,
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

export class ConsequencePackageConflictError extends Error {}

export const consequencePackageKeySchema = z.string().regex(/^(capability|effect|primitive):.+$/);
export const consequencePackageApplySchema = z.object({
  key: consequencePackageKeySchema,
  commandId: z.string().uuid(),
  expectedHash: z.string(),
  expectedVitality: z.number().nullable(),
  commit: z.literal(true),
});

export async function readCharacterConsequencePackage(id: string, userId: string, key: EntityKey) {
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
  const occurrences = records.map((record) => record.occurrence);
  const { max } = await loadCharacterMaxVitality(id, graph, undefined, occurrences);
  return projectConsequencePackage(graph, key, occurrences, character.currentVitality, max);
}

/** Shared with the authorized Companion snapshot so native and reviewed Vitality agree. */
export function projectConsequencePackage(
  graph: WorkspaceGraph,
  key: EntityKey,
  occurrences: readonly ConsequenceOccurrence[],
  currentVitality: number | null,
  max: number,
) {
  const availability = effectiveAvailability(
    key,
    supplyPaths(graph, key),
    activeRestrictions(occurrences),
  );
  if (!availability.available)
    throw new Error(
      availability.reasons.join("; ") || "This action is unavailable.",
    );
  const pkg = consequencePackage(graph, key);
  const previous = currentVitality ?? max;
  return {
    ...pkg,
    currentVitality,
    previous,
    next: clampVitality(previous + pkg.vitalityDelta, max),
    max,
  };
}
export function consequencePackageOccurrences(
  pieces: ReturnType<typeof consequencePackage>["pieces"],
  applicationId: string,
  occurrenceId: () => string = randomUUID,
  createdAt = Date.now(),
): ConsequenceOccurrence[] {
  return pieces.map((p) => ({
    id: occurrenceId(),
    title: p.title,
    description: p.description,
    tags: [],
    modifiers: p.modifiers,
    active: true,
    status: "active",
    durationTier: "manual",
    createdAt,
    source: "custom",
    sourceEntityId: String(p.id),
    sourceEntityType: "primitive",
    sourceVersionId: p.versionId,
    recovery: p.behavior.recovery,
    restrictions: p.behavior.restrictions,
    applicationId,
    applicationSnapshot: {
      vitalityDelta: p.behavior.vitalityDelta,
      modifiers: p.modifiers,
      restrictions: p.behavior.restrictions,
    },
  }));
}

export async function applyCharacterConsequencePackage(
  id: string, userId: string, raw: z.input<typeof consequencePackageApplySchema>, expectedMax?: number,
) {
  const body = consequencePackageApplySchema.parse(raw);
  const hash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return withDatabaseTransaction(async () => {
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
        throw new ConsequencePackageConflictError("Application ID already used for another action.");
      return receipt.result;
    }
    const pkg = await readCharacterConsequencePackage(id, userId, body.key as EntityKey);
    if (
      pkg.hash !== body.expectedHash ||
      character.currentVitality !== body.expectedVitality ||
      (expectedMax !== undefined && pkg.max !== expectedMax)
    )
      throw new ConsequencePackageConflictError(
        "The package or vitality changed. Preview the action again. No changes were applied.",
      );
    if (!pkg.pieces.length)
      throw new Error("This action has no authored consequence package.");
    const occurrences = consequencePackageOccurrences(pkg.pieces, body.commandId);
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
          delta: pkg.next - pkg.previous,
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
}
