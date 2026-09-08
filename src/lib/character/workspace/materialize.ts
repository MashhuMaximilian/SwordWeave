import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characterPrimitives, characterCapabilities } from "@/db/schema";
import { resolveSlotSource } from "@/lib/versions/slot-source";
import { supplyPaths, type WorkspaceGraph } from "./model";

/** Reconcile inherited rows in place. Explicit purchases and their instance IDs
 * survive; alternate supply paths keep the inherited baseline alive. */
export async function materializeWorkspace(
  graph: WorkspaceGraph,
  userId: string,
  level: number,
) {
  const id = graph.characterId;
  const existing = await db
    .select()
    .from(characterPrimitives)
    .where(eq(characterPrimitives.characterId, id));
  for (const row of existing) {
    if (!(
      row.originHeritageId ||
      row.originCapabilityId ||
      row.originEffectId ||
      row.originItemId
    ))
      continue;
    const paths = supplyPaths(graph, `primitive:${row.primitiveId}`).filter(
      (p) =>
        p.nodes.length > 1 &&
        p.edges.some((e) => e.isMirrored) === row.isMirrored,
    );
    if (!paths.length) {
      if (row.directSource)
        await db
          .update(characterPrimitives)
          .set({
            source: row.directSource,
            directSource: null,
            originHeritageId: null,
            originCapabilityId: null,
            originEffectId: null,
            originItemId: null,
          })
          .where(eq(characterPrimitives.instanceId, row.instanceId));
      else
        await db
          .delete(characterPrimitives)
          .where(eq(characterPrimitives.instanceId, row.instanceId));
    }
  }
  for (const node of graph.nodes.filter((n) => n.kind === "primitive")) {
    for (const mirrored of [false, true]) {
      const paths = supplyPaths(graph, node.key).filter(
        (p) =>
          p.nodes.length > 1 && p.edges.some((e) => e.isMirrored) === mirrored,
      );
      if (!paths.length) continue;
      const path = paths.find((p) => !p.item) ?? paths[0]!;
      const origin = (kind: string) =>
        path.nodes
          .find((key) => key.startsWith(`${kind}:`))
          ?.slice(kind.length + 1) ?? null;
      const category = path.edges[0]!.category;
      const values = {
        source:
          category === "LINEAGE" ||
          category === "UPBRINGING" ||
          category === "MANIFEST"
            ? category
            : ("PERSONAL" as const),
        originHeritageId: origin("heritage"),
        originCapabilityId: origin("capability"),
        originEffectId: origin("effect"),
        originItemId: origin("item"),
        isMirrored: mirrored,
      };
      const prior = existing.find(
        (r) =>
          r.primitiveId === Number(node.id) &&
          r.isMirrored === mirrored &&
          (r.originHeritageId ||
            r.originCapabilityId ||
            r.originEffectId ||
            r.originItemId),
      );
      if (prior)
        await db
          .update(characterPrimitives)
          .set(values)
          .where(eq(characterPrimitives.instanceId, prior.instanceId));
      else {
        const direct =
          !mirrored &&
          existing.find(
            (r) =>
              r.primitiveId === Number(node.id) &&
              !r.isMirrored &&
              !r.originHeritageId &&
              !r.originCapabilityId &&
              !r.originEffectId &&
              !r.originItemId,
          );
        if (direct)
          await db
            .update(characterPrimitives)
            .set({ ...values, directSource: direct.source })
            .where(eq(characterPrimitives.instanceId, direct.instanceId));
        else
          await db
            .insert(characterPrimitives)
            .values({
              ...values,
              characterId: id,
              primitiveId: Number(node.id),
              acquiredAtLevel: level,
              versionId: node.latestVersionId,
              slotSource: resolveSlotSource({
                entity: {
                  userId: node.userId,
                  sourceOrigin:
                    typeof node.data["sourceOrigin"] === "string"
                      ? node.data["sourceOrigin"]
                      : null,
                },
                callerUserId: userId,
              }),
            });
      }
    }
  }
  const caps = await db
    .select()
    .from(characterCapabilities)
    .where(eq(characterCapabilities.characterId, id));
  for (const row of caps.filter((c) => c.originHeritageId)) {
    if (
      !supplyPaths(graph, `capability:${row.capabilityId}`).some((p) => !p.item)
    )
      await db
        .delete(characterCapabilities)
        .where(
          and(
            eq(characterCapabilities.characterId, id),
            eq(characterCapabilities.capabilityId, row.capabilityId),
          ),
        );
  }
  for (const node of graph.nodes.filter((n) => n.kind === "capability")) {
    const path = supplyPaths(graph, node.key).find((p) => !p.item);
    if (!path) continue;
    const originHeritageId =
      path.nodes.find((k) => k.startsWith("heritage:"))?.slice(9) ?? null;
    if (!originHeritageId) continue;
    const prior = caps.find((c) => c.capabilityId === node.id);
    if (prior) {
      if (prior.originHeritageId)
        await db
          .update(characterCapabilities)
          .set({ originHeritageId })
          .where(
            and(
              eq(characterCapabilities.characterId, id),
              eq(characterCapabilities.capabilityId, node.id),
            ),
          );
    } else
      await db
        .insert(characterCapabilities)
        .values({
          characterId: id,
          capabilityId: node.id,
          originHeritageId,
          acquiredAtLevel: level,
          versionId: node.latestVersionId,
          slotSource: resolveSlotSource({
            entity: {
              userId: node.userId,
              sourceOrigin:
                typeof node.data["sourceOrigin"] === "string"
                  ? node.data["sourceOrigin"]
                  : null,
            },
            callerUserId: userId,
          }),
        });
  }
}
