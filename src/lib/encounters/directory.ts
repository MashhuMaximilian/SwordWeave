import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { directVisibilityCondition } from "./access";
import { resolveMonster } from "@/lib/monsters/resolve";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { EncounterDefinition } from "./model";
import type { Visibility } from "@/lib/publishing/visibility";

export type EncounterDirectoryEntry = {
  id: string;
  ownerId: string;
  name: string;
  revision: number;
  visibility: Visibility;
  isOwner: boolean;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
  authorIsAdmin?: boolean;
  note: string;
  updatedAt: string;
  partyBu: number | null;
  partyItemBu: number | null;
  partySize: number | null;
  enemyBu: number;
  enemyItemBu: number | null;
  creatureCount: number;
  templateCount: number;
  creatures: {
    name: string;
    quantity: number;
    budget: number;
    role?: string;
    environment?: string;
  }[];
  unavailable: boolean;
  runCount: number;
  latestRunId: string | null;
};
export async function listEncounterDirectory(
  viewer: string | null,
  options: {
    ownOnly?: boolean;
    search?: string;
    offset?: number;
    limit?: number;
    ids?: string[];
    author?: string;
    visibility?: Visibility;
  } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 24, 100));
  const offset = Math.max(0, options.offset ?? 0);
  const access = directVisibilityCondition(
    sql`e.owner_id`,
    sql`e.visibility`,
    viewer,
  );
  const conditions = [access];
  if (options.ownOnly) conditions.push(sql`e.owner_id=${viewer}`);
  if (options.search)
    conditions.push(
      sql`(e.name ILIKE ${`%${options.search}%`} OR e.definition->>'note' ILIKE ${`%${options.search}%`})`,
    );
  if (options.ids) {
    if (!options.ids.length) return [];
    conditions.push(
      sql`e.id::text IN (${sql.join(
        options.ids.map((id) => sql`${id}`),
        sql`,`,
      )})`,
    );
  }
  if (options.author) conditions.push(sql`e.owner_id=${options.author}`);
  if (options.visibility)
    conditions.push(sql`e.visibility=${options.visibility}`);
  // Collection membership is applied by the common Library query, using its readable collection gate.
  const monsterAccess = directVisibilityCondition(
    sql`m.user_id`,
    sql`m.visibility`,
    viewer,
  );
  const result =
    await db.execute(sql`SELECT e.id,e.name,e.owner_id,e.revision,e.visibility,e.definition,e.updated_at,
    CASE WHEN u.is_anonymized THEN NULL ELSE u.username END AS author_username, CASE WHEN u.is_anonymized THEN NULL ELSE u.display_name END AS author_display_name, u.is_admin AS author_is_admin,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('quantity',x.quantity,'definition',CASE WHEN ${monsterAccess} THEN v.definition ELSE NULL END)), '[]'::jsonb) FROM encounter_entries x JOIN monster_versions v ON v.id=x.version_id JOIN monsters m ON m.id=x.template_id WHERE x.encounter_id=e.id) AS pins,
    (SELECT count(*)::int FROM encounter_runs r WHERE r.encounter_id=e.id AND r.owner_id=${viewer}) AS run_count,
    (SELECT r.id FROM encounter_runs r WHERE r.encounter_id=e.id AND r.owner_id=${viewer} ORDER BY r.created_at DESC LIMIT 1) AS latest_run_id
    FROM encounters e LEFT JOIN users u ON u.clerk_user_id=e.owner_id WHERE ${sql.join(conditions, sql` AND `)} ORDER BY e.updated_at DESC,e.id LIMIT ${limit} OFFSET ${offset}`);
  return result.rows.map((row) => {
    const definition = row["definition"] as Omit<
      EncounterDefinition,
      "entries"
    >;
    const pins = row["pins"] as {
      quantity: number;
      definition: PinnedDefinition | null;
    }[];
    let enemyBu = 0,
      enemyItemBu: number | null = 0,
      creatureCount = 0,
      unavailable = false;
    const creatures: EncounterDirectoryEntry["creatures"] = [];
    for (const pin of pins) {
      creatureCount += pin.quantity;
      if (!pin.definition) {
        unavailable = true;
        enemyItemBu = null;
        continue;
      }
      const d = pin.definition;
      enemyBu += d.budget * pin.quantity;
      if (d.resolvedSlots) {
        try {
          if (enemyItemBu !== null)
            enemyItemBu +=
              resolveMonster(d, d.resolvedSlots).itemBu * pin.quantity;
        } catch {
          enemyItemBu = null;
        }
      } else enemyItemBu = null;
      creatures.push({
        name: d.name,
        quantity: pin.quantity,
        budget: d.budget,
        ...(d.catalogue?.role ? { role: d.catalogue.role } : {}),
        ...(d.catalogue?.environment
          ? { environment: d.catalogue.environment }
          : {}),
      });
    }
    return {
      id: String(row["id"]),
      ownerId: String(row["owner_id"]),
      name: String(row["name"]),
      revision: Number(row["revision"]),
      visibility: row["visibility"] as Visibility,
      isOwner: row["owner_id"] === viewer,
      authorUsername: row["author_username"] as string | null,
      authorDisplayName:
        (row["author_display_name"] as string | null) ??
        (String(row["owner_id"]).startsWith("system:") ? "System" : null),
      authorIsAdmin: !!row["author_is_admin"],
      note: definition.note ?? "",
      updatedAt: new Date(row["updated_at"] as string).toISOString(),
      partyBu: definition.partyBu ?? null,
      partyItemBu: definition.partyItemBu ?? null,
      partySize: definition.partySize ?? null,
      enemyBu,
      enemyItemBu,
      creatureCount,
      templateCount: pins.length,
      creatures,
      unavailable,
      runCount: Number(row["run_count"]),
      latestRunId: row["latest_run_id"] as string | null,
    } satisfies EncounterDirectoryEntry;
  });
}
