import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type PublicCollection = {
  id: string;
  name: string;
  origin: "system" | "community";
  authorName: string;
  authorUsername: string | null;
};

export type CollectionDirectoryQuery = {
  q?: string;
  origin?: string;
  sort?: string;
  page?: string;
};

export const PUBLIC_COLLECTION_PAGE_SIZE = 24;

export function directoryFilters(query: CollectionDirectoryQuery) {
  const parsedPage = Number(query.page ?? 1);
  return {
    q: typeof query.q === "string" ? query.q.trim().slice(0, 100) : "",
    origin: query.origin === "system" || query.origin === "community" ? query.origin : "all",
    sort: query.sort === "name" ? "name" : "recent",
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1,
  };
}

/** Public discovery is independent of the viewer's own/followed collection index. */
export async function publicCollectionDirectory(query: CollectionDirectoryQuery = {}) {
  const filters = directoryFilters(query);
  const system = sql`c.owner_id LIKE 'system:%'`;
  const conditions = [sql`c.visibility = 'PUBLIC'`, sql`c.system_kind IS NULL`];
  if (filters.origin === "system") conditions.push(system);
  if (filters.origin === "community") conditions.push(sql`NOT (${system})`);
  if (filters.q) {
    // Literal name search: '%' and '_' from user input do not become wildcards.
    conditions.push(sql`strpos(lower(c.name), lower(${filters.q})) > 0`);
  }
  const where = sql.join(conditions, sql` AND `);
  const result = await db.execute(sql`
    SELECT c.id, c.name,
      CASE WHEN ${system} THEN 'system' ELSE 'community' END AS origin,
      CASE WHEN ${system} THEN 'SwordWeave'
        ELSE coalesce(nullif(u.display_name, ''), nullif(u.username, ''), 'Community curator') END AS "authorName",
      u.username AS "authorUsername"
    FROM collections c
    LEFT JOIN users u ON u.clerk_user_id = c.owner_id AND u.is_public = true
    WHERE ${where}
    ORDER BY ${filters.sort === "name" ? sql`lower(c.name) ASC, c.id ASC` : sql`c.created_at DESC, c.id DESC`}
    LIMIT ${PUBLIC_COLLECTION_PAGE_SIZE + 1}
    OFFSET ${(filters.page - 1) * PUBLIC_COLLECTION_PAGE_SIZE}
  `);
  // Do not return owner IDs, parent metadata, memberships, or private entry counts.
  return {
    filters,
    collections: result.rows.slice(0, PUBLIC_COLLECTION_PAGE_SIZE) as unknown as PublicCollection[],
    hasMore: result.rows.length > PUBLIC_COLLECTION_PAGE_SIZE,
  };
}
