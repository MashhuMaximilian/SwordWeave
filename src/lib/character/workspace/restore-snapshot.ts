import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { WorkspaceGraph } from "./model";
import { materializeWorkspace } from "./materialize";
import { readWorkspace } from "./read";
import { recomputeBuSpent } from "@/lib/engine/recompute-bu-spent";

export function buildFoundationRestore(foundation: Record<string, unknown>): Record<string, unknown> {
  // Explicitly exclude mode, current Vitality, conditions/resources, equipment,
  // sharing and ownership even if an older receipt included them.
  const allowed = new Set(["name", "notes", "backstory", "portraitUrl", "portraitFrame", "lineageName", "lineageDescription", "upbringingName", "upbringingDescription", "manifestName", "level", "startingBu", "dmBonusBu", "attrPhysical", "attrMental", "attrMagical", "attrProficient", "practiceSlices", "size"]);
  return Object.fromEntries(Object.entries(foundation).filter(([key]) => allowed.has(key)));
}
export async function restoreWorkspaceSnapshot(characterId: string, userId: string, snapshot: { foundation: Record<string, unknown>; graph: WorkspaceGraph }) {
  const currentItems = await db.select().from(s.characterItems).where(eq(s.characterItems.characterId, characterId));
  const equipped = new Map(currentItems.map(item => [item.itemId, item.equipped]));
  await db.update(s.characters).set(buildFoundationRestore(snapshot.foundation)).where(eq(s.characters.id, characterId));
  await db.delete(s.characterPrimitives).where(eq(s.characterPrimitives.characterId, characterId));
  await db.delete(s.characterCapabilities).where(eq(s.characterCapabilities.characterId, characterId));
  await db.delete(s.characterEffects).where(eq(s.characterEffects.characterId, characterId));
  await db.delete(s.characterHeritages).where(eq(s.characterHeritages.characterId, characterId));
  await db.delete(s.characterItems).where(eq(s.characterItems.characterId, characterId));
  for (const edge of snapshot.graph.edges.filter(edge => edge.parent === null)) {
    const node = snapshot.graph.nodes.find(node => node.key === edge.child);
    if (!node || !edge.data) throw new Error("The saved build snapshot is incomplete.");
    const table = node.kind === "primitive" ? s.characterPrimitives : node.kind === "capability" ? s.characterCapabilities : node.kind === "effect" ? s.characterEffects : node.kind === "heritage" ? s.characterHeritages : s.characterItems;
    const columns = getTableColumns(table);
    const row: Record<string, unknown> = Object.fromEntries(Object.entries(edge.data).filter(([key]) => key in columns));
    row["characterId"] = characterId;
    for (const field of ["createdAt", "updatedAt"])
      if (typeof row[field] === "string") row[field] = new Date(row[field] as string);
    if (node.kind === "item") row["equipped"] = equipped.get(node.id) ?? false;
    // All values are server-authored snapshot data filtered against the exact
    // junction table columns, never a caller-provided arbitrary row.
    if (node.kind === "primitive") await db.insert(s.characterPrimitives).values(row as typeof s.characterPrimitives.$inferInsert);
    else if (node.kind === "capability") await db.insert(s.characterCapabilities).values(row as typeof s.characterCapabilities.$inferInsert);
    else if (node.kind === "effect") await db.insert(s.characterEffects).values(row as typeof s.characterEffects.$inferInsert);
    else if (node.kind === "heritage") await db.insert(s.characterHeritages).values(row as typeof s.characterHeritages.$inferInsert);
    else await db.insert(s.characterItems).values(row as typeof s.characterItems.$inferInsert);
  }
  await materializeWorkspace(await readWorkspace(characterId), userId, Number(snapshot.foundation["level"]));
  await recomputeBuSpent(characterId);
}
