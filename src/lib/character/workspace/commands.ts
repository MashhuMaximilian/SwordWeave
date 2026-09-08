import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  characters,
  characterEffects,
  characterPrimitives,
  characterCapabilities,
  characterHeritages,
  characterItems,
  characterWorkspaceCommands,
  characterWorkspaceState,
} from "@/db/schema";
import {
  resolveLatestVersionId,
  resolveSlotSource,
} from "@/lib/versions/slot-source";
import { validateDraftReferences } from "./reference-access";
import { containerPayload, saveWorkspaceEntity } from "./save-entity";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { readWorkspace } from "./read";
import {
  validateReference,
  supplyPaths,
  type EntityKey,
  type WorkspaceNode,
  type WorkspaceEdge,
} from "./model";
import { materializeWorkspace } from "./materialize";
import { recomputeBuSpent } from "@/lib/engine/recompute-bu-spent";
const key = z
  .string()
  .regex(/^(primitive|effect|capability|heritage|item):.+$/);
export const workspaceCommandSchema = z.object({
  commandId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  operation: z.enum([
    "add-reference",
    "remove-reference",
    "edit",
    "reorder",
    "undo",
    "move-reference",
    "mirror-reference",
    "mirror-instance",
    "detach",
  ]),
  target: key,
  path: z.array(z.string()).min(1).max(20),
  expectedHash: z.string().nullable(),
  destination: key.optional(),
  destinationPath: z.array(z.string()).optional(),
  destinationHash: z.string().nullable().optional(),
  membership: z.record(z.string(), z.unknown()).optional(),
  order: z.array(z.string()).optional(),
  undoCommandId: z.string().uuid().optional(),
  child: key.optional(),
  edgeId: z.string().optional(),
  draft: z.record(z.string(), z.unknown()).optional(),
});
export class WorkspaceConflict extends Error {}
async function replaceRoot(
  characterId: string,
  root: WorkspaceEdge,
  node: WorkspaceNode,
  newId: string,
  userId: string,
) {
  const versionId = await resolveLatestVersionId(
    node.kind === "heritage" ? "template" : node.kind,
    newId,
  );
  const owned =
    newId !== node.id
      ? { userId, sourceOrigin: `fork:${node.id}` }
      : {
          userId: node.userId,
          sourceOrigin:
            typeof node.data["sourceOrigin"] === "string"
              ? node.data["sourceOrigin"]
              : null,
        };
  const slotSource = resolveSlotSource({ entity: owned, callerUserId: userId });
  if (node.kind === "primitive")
    await db
      .update(characterPrimitives)
      .set({ primitiveId: Number(newId), versionId, slotSource })
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.instanceId, root.instanceId!),
        ),
      );
  if (node.kind === "capability")
    await db
      .update(characterCapabilities)
      .set({ capabilityId: newId, versionId, slotSource })
      .where(
        and(
          eq(characterCapabilities.characterId, characterId),
          eq(characterCapabilities.capabilityId, node.id),
        ),
      );
  if (node.kind === "heritage")
    await db
      .update(characterHeritages)
      .set({ heritageId: newId, versionId, slotSource })
      .where(
        and(
          eq(characterHeritages.characterId, characterId),
          eq(characterHeritages.heritageId, node.id),
        ),
      );
  if (node.kind === "item")
    await db
      .update(characterItems)
      .set({ itemId: newId, versionId, slotSource })
      .where(
        and(
          eq(characterItems.characterId, characterId),
          eq(characterItems.itemId, node.id),
        ),
      );
  if (node.kind === "effect")
    await db
      .update(characterEffects)
      .set({ effectId: newId, versionId, slotSource })
      .where(
        and(
          eq(characterEffects.characterId, characterId),
          eq(characterEffects.effectId, node.id),
        ),
      );
  if (node.kind === "effect" && newId !== node.id)
    await db
      .update(characterPrimitives)
      .set({ originEffectId: newId })
      .where(
        and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.originEffectId, node.id),
        ),
      );
}
export async function executeWorkspaceCommand(
  characterId: string,
  userId: string,
  raw: unknown,
): Promise<Record<string, unknown>> {
  const command = workspaceCommandSchema.parse(raw);
  const hash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  return withDatabaseTransaction(async () => {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for("update");
    if (!character || character.userId !== userId)
      throw new Error("You do not own this character.");
    if (character.mode !== "BUILD")
      throw new Error("Switch to BUILD to edit membership.");
    const [receipt] = await db
      .select()
      .from(characterWorkspaceCommands)
      .where(
        and(
          eq(characterWorkspaceCommands.characterId, characterId),
          eq(characterWorkspaceCommands.commandId, command.commandId),
        ),
      );
    if (receipt) {
      if (receipt.requestHash !== hash)
        throw new WorkspaceConflict(
          "Command ID already used for different content.",
        );
      return receipt.result;
    }
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('swordweave:publishing', 0))`,
    );
    const graph = await readWorkspace(
      characterId,
      command.child
        ? [command.child as EntityKey]
        : command.operation === "undo"
          ? [command.target as EntityKey]
          : [],
    );
    if (graph.revision !== command.expectedRevision)
      throw new WorkspaceConflict(
        "The character changed. Your draft is retained; review the latest character before saving.",
      );
    const target = graph.nodes.find((n) => n.key === command.target);
    if (!target)
      throw new WorkspaceConflict("This entity is no longer on the character.");
    if ((target.data["contentHash"] ?? null) !== command.expectedHash)
      throw new WorkspaceConflict(
        "This entity has a newer version. Your draft is retained.",
      );
    const undoReceipt =
      command.operation === "undo" && command.undoCommandId
        ? (
            await db
              .select()
              .from(characterWorkspaceCommands)
              .where(
                and(
                  eq(characterWorkspaceCommands.characterId, characterId),
                  eq(
                    characterWorkspaceCommands.commandId,
                    command.undoCommandId,
                  ),
                ),
              )
          )[0]
        : undefined;
    const mirroredRoot = undoReceipt?.result["mirroredRoot"] as
      { before: WorkspaceEdge; instanceId: string; split: boolean } | undefined;
    if (command.operation === "mirror-instance" || mirroredRoot) {
      const root =
        mirroredRoot?.before ??
        graph.edges.find(
          (edge) =>
            edge.parent === null &&
            edge.id === command.path[0] &&
            edge.child === target.key,
        );
      if (
        !root?.instanceId ||
        root.child !== target.key ||
        target.kind !== "primitive" ||
        !target.data["isMirrorable"] ||
        (!mirroredRoot && command.path.length !== 1)
      )
        throw new Error("Choose a direct mirrorable primitive instance.");
      const instanceId = mirroredRoot?.instanceId ?? root.instanceId;
      const instance = await db.query.characterPrimitives.findFirst({
        where: and(
          eq(characterPrimitives.characterId, characterId),
          eq(characterPrimitives.instanceId, instanceId),
        ),
      });
      if (
        !instance ||
        (mirroredRoot && instance.isMirrored === root.isMirrored)
      )
        throw new WorkspaceConflict("This primitive instance has changed.");
      let savedInstanceId = instanceId;
      const split = Boolean(root.data?.["directSource"]);
      if (mirroredRoot?.split) {
        await db
          .delete(characterPrimitives)
          .where(eq(characterPrimitives.instanceId, instanceId));
        const original = await db.query.characterPrimitives.findFirst({
          where: and(
            eq(characterPrimitives.characterId, characterId),
            eq(characterPrimitives.instanceId, root.instanceId),
          ),
        });
        if (!original)
          throw new WorkspaceConflict(
            "The original supply changed; review it before undoing.",
          );
        await db
          .update(characterPrimitives)
          .set({
            directSource: root.data!["directSource"] as typeof original.source,
          })
          .where(eq(characterPrimitives.instanceId, original.instanceId));
      } else if (!mirroredRoot && split) {
        // A reused direct piece shares its materialized row with the bundle.
        // Mirroring the direct supply must not change the bundle's reference.
        await db
          .update(characterPrimitives)
          .set({ directSource: null })
          .where(eq(characterPrimitives.instanceId, instanceId));
        savedInstanceId = randomUUID();
        await db
          .insert(characterPrimitives)
          .values({
            ...instance,
            instanceId: savedInstanceId,
            source: instance.directSource!,
            directSource: null,
            originHeritageId: null,
            originCapabilityId: null,
            originEffectId: null,
            originItemId: null,
            isMirrored: !instance.isMirrored,
          });
      } else {
        await db
          .update(characterPrimitives)
          .set({
            isMirrored: mirroredRoot ? root.isMirrored : !instance.isMirrored,
          })
          .where(eq(characterPrimitives.instanceId, instanceId));
      }
      await materializeWorkspace(
        await readWorkspace(characterId),
        userId,
        character.level,
      );
      const buSpent = await recomputeBuSpent(characterId);
      const revision = graph.revision + 1;
      await db
        .insert(characterWorkspaceState)
        .values({ characterId, revision })
        .onConflictDoUpdate({
          target: characterWorkspaceState.characterId,
          set: { revision },
        });
      const result = {
        id: target.id,
        target: target.key,
        revision,
        buSpent,
        memberships: (await readWorkspace(characterId)).edges,
        ...(!mirroredRoot
          ? {
              mirroredRoot: {
                before: root,
                instanceId: savedInstanceId,
                split,
              },
            }
          : {}),
      };
      await db
        .insert(characterWorkspaceCommands)
        .values({
          characterId,
          commandId: command.commandId,
          kind: command.operation,
          requestHash: hash,
          result,
        });
      return result;
    }
    const detached = undoReceipt?.result["detached"] as
      WorkspaceEdge | undefined;
    if (command.operation === "detach" || detached) {
      const root =
        detached ??
        graph.edges.find(
          (edge) =>
            edge.id === command.path[0] &&
            edge.parent === null &&
            edge.child === target.key,
        );
      if (
        !root ||
        root.child !== target.key ||
        (!detached && command.path.length !== 1)
      )
        throw new Error("Choose a direct character membership.");
      if (detached && graph.edges.some((edge) => edge.id === root.id))
        throw new WorkspaceConflict(
          "This reference has already been restored.",
        );
      const row = { ...root.data };
      for (const field of ["createdAt", "updatedAt"])
        if (typeof row[field] === "string")
          row[field] = new Date(row[field] as string);
      if (detached) {
        if (target.kind === "primitive") {
          const existing = await db.query.characterPrimitives.findFirst({
            where: eq(characterPrimitives.instanceId, root.instanceId!),
          });
          if (existing)
            await db
              .update(characterPrimitives)
              .set({
                directSource: (row["directSource"] ??
                  row["source"]) as typeof existing.source,
              })
              .where(eq(characterPrimitives.instanceId, existing.instanceId));
          else
            await db
              .insert(characterPrimitives)
              .values(row as typeof characterPrimitives.$inferInsert);
        }
        if (target.kind === "effect")
          await db
            .insert(characterEffects)
            .values(row as typeof characterEffects.$inferInsert);
        if (target.kind === "capability") {
          const restored = row as typeof characterCapabilities.$inferInsert;
          await db
            .insert(characterCapabilities)
            .values(restored)
            .onConflictDoUpdate({
              target: [
                characterCapabilities.characterId,
                characterCapabilities.capabilityId,
              ],
              set: {
                originHeritageId: null,
                slotTab: restored.slotTab,
                versionId: restored.versionId,
                slotSource: restored.slotSource,
                acquiredAtLevel: restored.acquiredAtLevel,
              },
            });
        }
        if (target.kind === "heritage")
          await db
            .insert(characterHeritages)
            .values(row as typeof characterHeritages.$inferInsert);
        if (target.kind === "item")
          await db
            .insert(characterItems)
            .values(row as typeof characterItems.$inferInsert);
      } else {
        if (target.kind === "primitive") {
          if (row["directSource"])
            await db
              .update(characterPrimitives)
              .set({ directSource: null })
              .where(eq(characterPrimitives.instanceId, root.instanceId!));
          else
            await db
              .delete(characterPrimitives)
              .where(
                and(
                  eq(characterPrimitives.characterId, characterId),
                  eq(characterPrimitives.instanceId, root.instanceId!),
                ),
              );
        }
        if (target.kind === "effect")
          await db
            .delete(characterEffects)
            .where(
              and(
                eq(characterEffects.characterId, characterId),
                eq(characterEffects.effectId, target.id),
              ),
            );
        if (target.kind === "capability")
          await db
            .delete(characterCapabilities)
            .where(
              and(
                eq(characterCapabilities.characterId, characterId),
                eq(characterCapabilities.capabilityId, target.id),
              ),
            );
        if (target.kind === "heritage")
          await db
            .delete(characterHeritages)
            .where(
              and(
                eq(characterHeritages.characterId, characterId),
                eq(characterHeritages.heritageId, target.id),
              ),
            );
        if (target.kind === "item")
          await db
            .delete(characterItems)
            .where(
              and(
                eq(characterItems.characterId, characterId),
                eq(characterItems.itemId, target.id),
              ),
            );
      }
      await materializeWorkspace(
        await readWorkspace(characterId),
        userId,
        character.level,
      );
      const buSpent = await recomputeBuSpent(characterId);
      const revision = graph.revision + 1;
      await db
        .insert(characterWorkspaceState)
        .values({ characterId, revision })
        .onConflictDoUpdate({
          target: characterWorkspaceState.characterId,
          set: { revision },
        });
      const result = {
        id: target.id,
        outcome: detached ? "restored" : "detached",
        revision,
        buSpent,
        memberships: (await readWorkspace(characterId)).edges,
        ...(!detached ? { detached: root } : {}),
        target: target.key,
      };
      await db.insert(characterWorkspaceCommands).values({
        characterId,
        commandId: command.commandId,
        kind: command.operation,
        requestHash: hash,
        result,
      });
      return result;
    }
    const path = command.path.map((id) => graph.edges.find((e) => e.id === id));
    if (
      path.some((e) => !e) ||
      path[0]!.parent !== null ||
      path.at(-1)!.child !== target.key ||
      path.some((e, i) => i > 0 && e!.parent !== path[i - 1]!.child)
    )
      throw new Error("Invalid membership path.");
    if (command.operation === "move-reference") {
      const membership = graph.edges.find(
        (e) => e.id === command.edgeId && e.parent === target.key,
      );
      const destination = graph.nodes.find(
        (n) => n.key === command.destination,
      );
      if (!membership || !destination || destination.key === target.key)
        throw new Error("Choose a different containing destination.");
      if ((destination.data["contentHash"] ?? null) !== command.destinationHash)
        throw new WorkspaceConflict(
          "The destination changed. Review the move again.",
        );
      const error = validateReference(graph, destination.key, membership.child);
      if (error) throw new Error(error);
      const destinationPath = command.destinationPath ?? [];
      const validDestination = supplyPaths(graph, destination.key).some(
        (p) =>
          JSON.stringify(p.edges.map((e) => e.id)) ===
          JSON.stringify(destinationPath),
      );
      if (!validDestination) throw new Error("Invalid destination path.");
      const sourceCommandId = randomUUID();
      const removed = await executeWorkspaceCommand(characterId, userId, {
        ...command,
        commandId: sourceCommandId,
        operation: "remove-reference",
      });
      const afterRemoval = await readWorkspace(characterId);
      const replacements = (removed["replacements"] ?? {}) as Record<
        string,
        EntityKey
      >;
      const currentDestination = afterRemoval.nodes.find(
        (n) => n.key === (replacements[destination.key] ?? destination.key),
      );
      if (!currentDestination)
        throw new WorkspaceConflict(
          "The destination changed during this move. Nothing was saved.",
        );
      const destinationNodes = destinationPath
        .map((id) => graph.edges.find((e) => e.id === id)!.child)
        .map((key) => replacements[key] ?? key);
      const relocatedPath = supplyPaths(
        afterRemoval,
        currentDestination.key,
      ).find(
        (p) => JSON.stringify(p.nodes) === JSON.stringify(destinationNodes),
      );
      if (!relocatedPath)
        throw new WorkspaceConflict(
          "The destination membership changed. Nothing was saved.",
        );
      const destinationCommandId = randomUUID();
      const added = await executeWorkspaceCommand(characterId, userId, {
        commandId: destinationCommandId,
        operation: "add-reference",
        expectedRevision: afterRemoval.revision,
        target: currentDestination.key,
        path: relocatedPath.edges.map((e) => e.id),
        expectedHash: currentDestination.data["contentHash"] ?? null,
        child: membership.child,
        membership: { ...membership.data, isMirrored: membership.isMirrored },
      });
      const result = {
        ...removed,
        revision: added["revision"],
        buSpent: added["buSpent"],
        memberships: added["memberships"],
        move: {
          sourceCommandId,
          destinationCommandId,
          destination: `${destination.kind}:${added["id"]}`,
        },
      };
      await db.insert(characterWorkspaceCommands).values({
        characterId,
        commandId: command.commandId,
        kind: command.operation,
        requestHash: hash,
        result,
      });
      return result;
    }
    if (command.operation === "undo" && command.undoCommandId) {
      const [receipt] = await db
        .select()
        .from(characterWorkspaceCommands)
        .where(
          and(
            eq(characterWorkspaceCommands.characterId, characterId),
            eq(characterWorkspaceCommands.commandId, command.undoCommandId),
          ),
        );
      const move = receipt?.result["move"] as
        | {
            sourceCommandId: string;
            destinationCommandId: string;
            destination: EntityKey;
          }
        | undefined;
      if (move) {
        if (String(receipt!.result["id"]) !== target.id)
          throw new Error("Select the source bundle to undo this move.");
        const destination = graph.nodes.find((n) => n.key === move.destination);
        const destPath = destination && supplyPaths(graph, destination.key)[0];
        if (!destination || !destPath)
          throw new WorkspaceConflict(
            "The moved membership changed. Review it before undoing.",
          );
        await executeWorkspaceCommand(characterId, userId, {
          commandId: randomUUID(),
          operation: "undo",
          undoCommandId: move.destinationCommandId,
          expectedRevision: graph.revision,
          target: destination.key,
          path: destPath.edges.map((e) => e.id),
          expectedHash: destination.data["contentHash"] ?? null,
        });
        const fresh = await readWorkspace(characterId);
        const source = fresh.nodes.find((n) => n.key === target.key);
        const sourcePath = source && supplyPaths(fresh, source.key)[0];
        if (!source || !sourcePath)
          throw new WorkspaceConflict("The source changed. Nothing was saved.");
        const result = await executeWorkspaceCommand(characterId, userId, {
          commandId: randomUUID(),
          operation: "undo",
          undoCommandId: move.sourceCommandId,
          expectedRevision: fresh.revision,
          target: source.key,
          path: sourcePath.edges.map((e) => e.id),
          expectedHash: source.data["contentHash"] ?? null,
        });
        await db.insert(characterWorkspaceCommands).values({
          characterId,
          commandId: command.commandId,
          kind: "undo",
          requestHash: hash,
          result,
        });
        return result;
      }
    }
    let edges = graph.edges;
    if (command.operation === "add-reference") {
      if (!command.child) throw new Error("Choose a piece to add.");
      const error = validateReference(
        graph,
        target.key,
        command.child as EntityKey,
      );
      if (error) throw new Error(error);
      const child = graph.nodes.find((n) => n.key === command.child)!;
      if (!graph.edges.some((e) => e.child === child.key)) {
        const type =
          child.kind === "heritage"
            ? `${child.data["kind"]}_TEMPLATE`
            : child.kind.toUpperCase();
        const access = await db.execute(
          sql`select ${visibilityCondition(type, sql`${child.id}`, sql`${child.userId}`, userId)} as allowed`,
        );
        if (!access.rows[0]?.["allowed"])
          throw new Error("This piece is private.");
      }
      if (
        !edges.some((e) => e.parent === target.key && e.child === command.child)
      )
        edges = [
          ...edges,
          {
            id: command.commandId,
            parent: target.key,
            child: command.child as EntityKey,
            category: "ALL",
            order: edges.length,
            isMirrored: Boolean(command.membership?.["isMirrored"]),
            data: command.membership ?? {},
          },
        ];
    } else if (command.operation === "mirror-reference") {
      const membership = edges.find(
        (e) => e.id === command.edgeId && e.parent === target.key,
      );
      const primitive = graph.nodes.find((n) => n.key === membership?.child);
      if (
        !membership ||
        primitive?.kind !== "primitive" ||
        !primitive.data["isMirrorable"]
      )
        throw new Error("Only mirrorable primitives can be mirrored.");
      edges = edges.map((e) =>
        e.id === membership.id ? { ...e, isMirrored: !e.isMirrored } : e,
      );
    } else if (command.operation === "remove-reference") {
      if (
        !edges.some((e) => e.id === command.edgeId && e.parent === target.key)
      )
        throw new Error("This membership no longer exists.");
      edges = edges.filter((e) => e.id !== command.edgeId);
    }
    const before = containerPayload(target, graph.edges);
    let undoDraft: Record<string, unknown> | undefined;
    if (command.operation === "undo") {
      const [previous] = await db
        .select()
        .from(characterWorkspaceCommands)
        .where(
          and(
            eq(characterWorkspaceCommands.characterId, characterId),
            eq(
              characterWorkspaceCommands.commandId,
              command.undoCommandId ?? "",
            ),
          ),
        );
      if (!previous || String(previous.result["id"]) !== target.id)
        throw new Error(
          "This command cannot be undone on the selected entity.",
        );
      if (
        previous.result["afterHash"] !== undefined &&
        previous.result["afterHash"] !== target.data["contentHash"]
      )
        throw new WorkspaceConflict(
          "This bundle changed after that command. Review its newer version before undoing.",
        );
      undoDraft = previous.result["before"] as Record<string, unknown>;
      if (!undoDraft)
        throw new Error("This command has no reversible membership snapshot.");
    }
    if (command.operation === "reorder") {
      const members = graph.edges.filter((e) => e.parent === target.key);
      const order = command.order ?? [];
      if (
        new Set(order).size !== members.length ||
        order.length !== members.length ||
        members.some((e) => !order.includes(e.id))
      )
        throw new Error(
          "Reordering must include every membership exactly once.",
        );
      edges = edges.map((e) =>
        e.parent === target.key ? { ...e, order: order.indexOf(e.id) } : e,
      );
    }
    const payload =
      command.operation === "edit"
        ? { ...before, ...command.draft, intent: "load" }
        : containerPayload(target, edges);
    if (command.operation === "undo") Object.assign(payload, undoDraft);
    if (command.operation === "reorder")
      payload["membershipOrder"] = edges
        .filter((e) => e.parent === target.key)
        .sort((a, b) => a.order - b.order)
        .map(
          (e) => `${e.child}${e.data?.["role"] ? `:${e.data["role"]}` : ""}`,
        );
    if (command.operation === "edit")
      await validateDraftReferences(characterId, userId, payload, graph);
    let saved = await saveWorkspaceEntity(target, payload);
    const savedTarget = {
      id: saved.id,
      outcome: saved.outcome,
      entityResponse: saved.result,
    };
    if (saved.outcome === "no-op") {
      const result = {
        ...savedTarget,
        revision: graph.revision,
        buSpent: character.buSpent,
        memberships: graph.edges,
        before,
        target: target.key,
      };
      await db.insert(characterWorkspaceCommands).values({
        characterId,
        commandId: command.commandId,
        kind: command.operation,
        requestHash: hash,
        result,
      });
      return result;
    }
    const replacements: Record<string, EntityKey> = {};
    if (saved.id !== target.id)
      replacements[target.key] = `${target.kind}:${saved.id}`;
    let current = target;
    for (let index = path.length - 1; index >= 0; index--) {
      const edge = path[index]!;
      if (!edge!.parent) {
        await replaceRoot(characterId, edge!, current, saved.id, userId);
        break;
      }
      if (saved.id === current.id) break;
      const parent = graph.nodes.find((n) => n.key === edge!.parent)!;
      const replaced = graph.edges.map((e) =>
        e.id === edge!.id
          ? { ...e, child: `${current.kind}:${saved.id}` as EntityKey }
          : e,
      );
      saved = await saveWorkspaceEntity(
        parent,
        containerPayload(parent, replaced),
      );
      if (saved.id !== parent.id)
        replacements[parent.key] = `${parent.kind}:${saved.id}`;
      current = parent;
    }
    const updated = await readWorkspace(characterId);
    await materializeWorkspace(updated, userId, character.level);
    const buSpent = await recomputeBuSpent(characterId);
    const revision = graph.revision + (savedTarget.outcome === "no-op" ? 0 : 1);
    await db
      .insert(characterWorkspaceState)
      .values({ characterId, revision })
      .onConflictDoUpdate({
        target: characterWorkspaceState.characterId,
        set: { revision },
      });
    const result = {
      ...savedTarget,
      revision,
      buSpent,
      memberships: updated.edges,
      replacements,
      before,
      afterHash:
        updated.nodes.find((n) => n.key === `${target.kind}:${savedTarget.id}`)
          ?.data["contentHash"] ?? null,
      target: target.key,
    };
    await db.insert(characterWorkspaceCommands).values({
      characterId,
      commandId: command.commandId,
      kind: command.operation,
      requestHash: hash,
      result,
    });
    return result;
  });
}
