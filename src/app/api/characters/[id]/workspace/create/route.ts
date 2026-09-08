import { validateDraftReferences } from "@/lib/character/workspace/reference-access";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import * as s from "@/db/schema";
import { createWorkspaceEntity } from "@/lib/character/workspace/save-entity";
import {
  executeWorkspaceCommand,
  WorkspaceConflict,
} from "@/lib/character/workspace/commands";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { readWorkspace } from "@/lib/character/workspace/read";
import { materializeWorkspace } from "@/lib/character/workspace/materialize";
import { resolveSlotSource } from "@/lib/versions/slot-source";
import { recomputeBuSpent } from "@/lib/engine/recompute-bu-spent";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import type { EntityKey } from "@/lib/character/workspace/model";
const schema = z.object({
  commandId: z.string().uuid(),
  expectedRevision: z.number().int(),
  kind: z.enum(["primitive", "effect", "capability", "heritage", "item"]),
  category: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]),
  draft: z.record(z.string(), z.unknown()),
  existingId: z.string().optional(),
  target: z.string().optional(),
  path: z.array(z.string()).optional(),
  expectedHash: z.string().nullable().optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const body = schema.parse(await request.json());
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const result = await withDatabaseTransaction(async () => {
      const [character] = await db
        .select()
        .from(s.characters)
        .where(eq(s.characters.id, id))
        .for("update");
      if (!character || character.userId !== userId)
        throw new Error("You do not own this character.");
      if (character.mode !== "BUILD")
        throw new Error("Switch to BUILD to author pieces.");
      const [receipt] = await db
        .select()
        .from(s.characterWorkspaceCommands)
        .where(
          and(
            eq(s.characterWorkspaceCommands.characterId, id),
            eq(s.characterWorkspaceCommands.commandId, body.commandId),
          ),
        );
      if (receipt) {
        if (receipt.requestHash !== hash)
          throw new WorkspaceConflict("Command identity reused.");
        return receipt.result;
      }
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('swordweave:publishing', 0))`,
      );
      if (!body.target && (body.category === "ITEM") !== (body.kind === "item"))
        throw new Error(
          "Items belong in the Items tab. Add their contents inside an item.",
        );
      const before = await readWorkspace(id);
      if (before.revision !== body.expectedRevision)
        throw new WorkspaceConflict(
          "The character changed. Your composer input is retained.",
        );
      let created;
      if (body.existingId) {
        const selected = await readWorkspace(id, [
          `${body.kind}:${body.existingId}`,
        ]);
        const node = selected.nodes.find(
          (n) => n.key === `${body.kind}:${body.existingId}`,
        );
        if (!node) throw new Error("Library piece not found.");
        const type =
          node.kind === "heritage"
            ? `${node.data["kind"]}_TEMPLATE`
            : node.kind.toUpperCase();
        const access = await db.execute(
          sql`select ${visibilityCondition(type, sql`${node.id}`, sql`${node.userId}`, userId)} as allowed`,
        );
        if (
          !before.edges.some((e) => e.child === node.key) &&
          !access.rows[0]?.["allowed"]
        )
          throw new Error("This piece is private.");
        created = {
          id: node.id,
          result: {
            [body.kind]: node.data,
            dispatchOutcome: { kind: "no-op", newId: node.id },
          },
        };
      } else {
        await validateDraftReferences(id, userId, body.draft, before);
        created = await createWorkspaceEntity(body.kind, body.draft);
      }
      const child: EntityKey = `${body.kind}:${created.id}`;
      if (body.target) {
        await executeWorkspaceCommand(id, userId, {
          commandId: crypto.randomUUID(),
          expectedRevision: before.revision,
          operation: "add-reference",
          target: body.target,
          path: body.path,
          expectedHash: body.expectedHash,
          child,
        });
      } else if (
        !body.existingId ||
        !before.edges.some(
          (e) =>
            e.parent === null &&
            e.child === child &&
            e.category === body.category,
        )
      ) {
        const graph = await readWorkspace(id, [child]);
        const node = graph.nodes.find((n) => n.key === child)!;
        if (body.kind === "heritage" && node.data["kind"] !== body.category)
          throw new Error("Choose the category that matches this heritage.");
        const versionId = node.latestVersionId;
        const slotSource = resolveSlotSource({
          entity: {
            userId: node.userId,
            sourceOrigin:
              typeof node.data["sourceOrigin"] === "string"
                ? node.data["sourceOrigin"]
                : null,
          },
          callerUserId: userId,
        });
        if (body.kind === "primitive") {
          const existing = body.existingId
            ? await db.query.characterPrimitives.findFirst({
                where: and(
                  eq(s.characterPrimitives.characterId, id),
                  eq(s.characterPrimitives.primitiveId, Number(created.id)),
                  eq(s.characterPrimitives.isMirrored, false),
                ),
              })
            : undefined;
          const source = body.category === "ITEM" ? "PERSONAL" : body.category;
          if (
            existing &&
            (existing.originHeritageId ||
              existing.originCapabilityId ||
              existing.originEffectId ||
              existing.originItemId)
          )
            await db
              .update(s.characterPrimitives)
              .set({ directSource: source })
              .where(eq(s.characterPrimitives.instanceId, existing.instanceId));
          else if (!existing)
            await db.insert(s.characterPrimitives).values({
              characterId: id,
              primitiveId: Number(created.id),
              source,
              acquiredAtLevel: character.level,
              versionId,
              slotSource,
            });
        }
        if (body.kind === "capability")
          await db
            .insert(s.characterCapabilities)
            .values({
              characterId: id,
              capabilityId: created.id,
              acquiredAtLevel: character.level,
              slotTab: body.category === "ITEM" ? "MANIFEST" : body.category,
              versionId,
              slotSource,
            })
            .onConflictDoNothing();
        if (body.kind === "heritage")
          await db
            .insert(s.characterHeritages)
            .values({
              characterId: id,
              heritageId: created.id,
              acquiredAtLevel: character.level,
              versionId,
              slotSource,
            })
            .onConflictDoNothing();
        if (body.kind === "item")
          await db
            .insert(s.characterItems)
            .values({
              characterId: id,
              itemId: created.id,
              versionId,
              slotSource,
            })
            .onConflictDoNothing();
        if (body.kind === "effect")
          await db
            .insert(s.characterEffects)
            .values({
              characterId: id,
              effectId: created.id,
              category: body.category,
              versionId,
              slotSource,
            })
            .onConflictDoNothing();
        await materializeWorkspace(
          await readWorkspace(id),
          userId,
          character.level,
        );
        await recomputeBuSpent(id);
        await db
          .insert(s.characterWorkspaceState)
          .values({ characterId: id, revision: before.revision + 1 })
          .onConflictDoUpdate({
            target: s.characterWorkspaceState.characterId,
            set: { revision: before.revision + 1 },
          });
      }
      const refreshed = await readWorkspace(id);
      const [totals] = await db
        .select({ buSpent: s.characters.buSpent })
        .from(s.characters)
        .where(eq(s.characters.id, id));
      const savedResult = {
        ...created.result,
        savedKey: child,
        revision: refreshed.revision,
        memberships: refreshed.edges,
        buSpent: totals?.buSpent ?? character.buSpent,
      };
      await db.insert(s.characterWorkspaceCommands).values({
        characterId: id,
        commandId: body.commandId,
        kind: "create",
        requestHash: hash,
        result: savedResult,
      });
      return savedResult;
    });
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed." },
      { status: error instanceof WorkspaceConflict ? 409 : 400 },
    );
  }
}
