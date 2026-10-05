import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { visibleEntries } from "@/lib/collections/service";
type Ref = { targetType: string; targetId: string };
const links: Record<
  string,
  { table: string; owner: string; column: string; type: string }[]
> = {
  EFFECT: [
    {
      table: "effect_primitives",
      owner: "effect_id",
      column: "primitive_id",
      type: "PRIMITIVE",
    },
  ],
  CAPABILITY: [
    {
      table: "capability_primitives",
      owner: "capability_id",
      column: "primitive_id",
      type: "PRIMITIVE",
    },
    {
      table: "capability_effects",
      owner: "capability_id",
      column: "effect_id",
      type: "EFFECT",
    },
  ],
  ITEM: [
    {
      table: "item_primitives",
      owner: "item_id",
      column: "primitive_id",
      type: "PRIMITIVE",
    },
    {
      table: "item_capabilities",
      owner: "item_id",
      column: "capability_id",
      type: "CAPABILITY",
    },
    {
      table: "item_effects",
      owner: "item_id",
      column: "effect_id",
      type: "EFFECT",
    },
  ],
  HERITAGE: [
    {
      table: "heritage_primitives",
      owner: "template_id",
      column: "primitive_id",
      type: "PRIMITIVE",
    },
    {
      table: "heritage_capabilities",
      owner: "template_id",
      column: "capability_id",
      type: "CAPABILITY",
    },
  ],
};
export function authoringReferences(data: Record<string, unknown>): Ref[] {
  const refs: Ref[] = [];
  for (const [type, field, slots, idField] of [
    ["PRIMITIVE", "primitiveIds", "primitiveSlots", "primitiveId"],
    ["EFFECT", "effectIds", "effectSlots", "effectId"],
    ["CAPABILITY", "capabilityIds", "capabilitySlots", "capabilityId"],
  ] as const) {
    const add = (id: unknown) => {
      if (typeof id === "string" || typeof id === "number")
        refs.push({ targetType: type, targetId: String(id) });
    };
    if (Array.isArray(data[field])) data[field].forEach(add);
    if (Array.isArray(data[slots]))
      for (const row of data[slots])
        if (row && typeof row === "object") add(row[idField]);
  }
  return [
    ...new Map(refs.map((r) => [`${r.targetType}:${r.targetId}`, r])).values(),
  ];
}
/** Existing server-side links survive edits/forks; only newly attached references need independent access. */
export async function assertAuthoringReferenceAccess(
  request: Request,
  type: string,
  data: Record<string, unknown>,
  userId: string,
) {
  const requested = authoringReferences(data);
  if (!requested.length) return;
  const prior = new Set<string>();
  const sourceId =
    request.method === "PATCH"
      ? new URL(request.url).pathname.split("/").at(-1)
      : typeof (data["sourceId"] ?? data["id"]) === "string"
        ? String(data["sourceId"] ?? data["id"])
        : null;
  if (sourceId && links[type]) {
    let sourceType = type;
    if (type === "HERITAGE") {
      const row = await db.execute(
        sql`SELECT kind FROM heritage WHERE id::text=${sourceId}`,
      );
      sourceType = `${row.rows[0]?.["kind"]}_TEMPLATE`;
    }
    if (
      (
        await visibleEntries(
          [{ targetType: sourceType, targetId: sourceId }],
          userId,
        )
      ).length
    ) {
      const rows = await Promise.all(
        links[type]!.map(async (link) => {
          const result = await db.execute(
            sql`SELECT ${sql.identifier(link.column)}::text AS id FROM ${sql.identifier(link.table)} WHERE ${sql.identifier(link.owner)}::text=${sourceId}`,
          );
          return result.rows.map((r) => `${link.type}:${r["id"]}`);
        }),
      );
      for (const key of rows.flat()) prior.add(key);
    }
  }
  const added = requested.filter(
    (r) => !prior.has(`${r.targetType}:${r.targetId}`),
  );
  if (!added.length) return;
  const visible = await visibleEntries(added, userId);
  const allowed = new Set(visible.map((r) => `${r.targetType}:${r.targetId}`));
  if (added.some((r) => !allowed.has(`${r.targetType}:${r.targetId}`)))
    throw new Error(
      "A newly selected component is private or no longer available.",
    );
}
