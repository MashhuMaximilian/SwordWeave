import { and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { capabilities, effects, heritage, items, primitives } from "@/db/schema";
import type { EntityKey, EntityKind } from "@/lib/character/workspace/model";
import { visibilityCondition } from "./library-query";

const definitions = {
  primitive: { table: primitives, target: "PRIMITIVE" },
  effect: { table: effects, target: "EFFECT" },
  capability: { table: capabilities, target: "CAPABILITY" },
  item: { table: items, target: "ITEM" },
  heritage: { table: heritage, target: sql`${heritage.kind}::text || '_TEMPLATE'` },
} as const;

export async function visibleDefinitionKeys(clerkId: string, keys: readonly EntityKey[]): Promise<Set<EntityKey>> {
  const grouped = new Map<EntityKind, Set<string>>();
  for (const key of keys) {
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator) as EntityKind;
    const id = key.slice(separator + 1);
    if (!Object.hasOwn(definitions, kind)) continue;
    if (!grouped.has(kind)) grouped.set(kind, new Set());
    grouped.get(kind)!.add(id);
  }
  const visible = await Promise.all([...grouped].map(async ([kind, ids]) => {
    const { table, target } = definitions[kind];
    const rows = await db.select({ id: sql<string>`${table.id}::text` }).from(table).where(and(
      inArray(sql`${table.id}::text`, [...ids]),
      visibilityCondition(typeof target === "string" ? target : sql`(${target})::publish_target_type`,
        sql`${table.id}`, sql`${table.userId}`, clerkId, sql`${table.isPublic}`),
    ));
    return rows.map(row => `${kind}:${row.id}` as EntityKey);
  }));
  return new Set(visible.flat());
}
