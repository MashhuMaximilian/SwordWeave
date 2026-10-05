import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { visibilityCondition } from "@/lib/publishing/library-query";

/** Upload owners can preview unattached drafts. Other viewers need a readable
 * entry (or its immutable version) referencing the file. Never cache this decision. */
export async function canReadUploadedArtwork(pathname: string, viewer: string | null): Promise<boolean> {
  if (viewer && pathname.startsWith(`user-uploads/${viewer}/`)) return true;
  const proxyUrl = `/api/icons/blob/${pathname}`;
  const branches = [
    ["PRIMITIVE", "primitives", ["icon_url", "icon_proposed_url"]],
    ["CAPABILITY", "capabilities", ["icon_url", "icon_proposed_url"]],
    ["EFFECT", "effects", ["icon_url", "icon_proposed_url"]],
    ["ITEM", "items", ["icon_url", "icon_proposed_url"]],
    ["CHARACTER", "characters", ["portrait_url"]],
    ["BUILD_TEMPLATE", "builds", ["icon_url", "icon_proposed_url", "portrait_url"]],
    ["LINEAGE_TEMPLATE", "heritage", ["icon_url", "icon_proposed_url", "image_url"]],
    ["UPBRINGING_TEMPLATE", "heritage", ["icon_url", "icon_proposed_url", "image_url"]],
    ["MANIFEST_TEMPLATE", "heritage", ["icon_url", "icon_proposed_url", "image_url"]],
  ] as const;
  const queries = branches.map(([type, table, fields]) => {
    const matches = sql.join(fields.map(field => sql`e.${sql.identifier(field)} IN (${pathname}, ${proxyUrl})`), sql` OR `);
    const visible = visibilityCondition(type, sql`e.id`, sql`e.user_id`, viewer ?? undefined, sql`e.is_public`);
    const shared = type === "CHARACTER" && viewer
      ? sql`OR EXISTS (SELECT 1 FROM character_shares cs JOIN users u ON u.id=cs.shared_with_user_id WHERE cs.character_id=e.id AND cs.revoked_at IS NULL AND u.clerk_user_id=${viewer})`
      : sql``;
    const kind = table === "heritage" ? sql`AND e.kind=${type.replace("_TEMPLATE", "")}` : sql``;
    const versionTable = table === "heritage" ? "heritage_versions" : table === "builds" ? null : `${type.toLowerCase()}_versions`;
    const fk = table === "heritage" ? "template_id" : `${type.toLowerCase()}_id`;
    const snapshotMatches = sql.join(fields.map(field => {
      const jsonKey=field.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase());
      return sql`(v.snapshot->>${jsonKey} IN (${pathname},${proxyUrl}) OR v.snapshot->'row'->>${jsonKey} IN (${pathname},${proxyUrl}))`;
    }),sql` OR `);
    const historic = versionTable ? sql`OR EXISTS (SELECT 1 FROM ${sql.identifier(versionTable)} v WHERE v.${sql.identifier(fk)}=e.id AND (${snapshotMatches}))` : sql``;
    return sql`SELECT 1 AS allowed FROM ${sql.identifier(table)} e WHERE ((${matches}) ${historic}) AND (${visible} ${shared}) ${kind}`;
  });
  const result = await db.execute(sql`SELECT 1 FROM (${sql.join(queries, sql` UNION ALL `)}) readable LIMIT 1`);
  return result.rows.length > 0;
}
