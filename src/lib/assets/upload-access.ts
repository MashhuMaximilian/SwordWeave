import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { verifiedUploadAliases } from "@/lib/runtime/deployment";
import { isUploadKey } from "./upload-path";

/** Upload owners can preview unattached drafts. Other viewers need a readable
 * entry (or its immutable version) referencing the file. Never cache this decision. */
export async function canReadUploadedArtwork(pathname: string, viewer: string | null): Promise<boolean> {
  if (!isUploadKey(pathname)) return false;
  if (viewer && pathname.startsWith(`user-uploads/${viewer}/`)) return true;
  const proxyUrl = `/api/icons/blob/${pathname}`;
  const aliases = verifiedUploadAliases().get(pathname) ?? [];
  const matchesReference = (value: SQL) => {
    const canonical = sql`${value} IN (${pathname}, ${proxyUrl})`;
    if (aliases.length === 0) return canonical;
    const legacy = sql.join(aliases.map(alias => sql`${alias}`), sql`, `);
    return sql`(${canonical} OR split_part(split_part(${value}, '?', 1), '#', 1) IN (${legacy}))`;
  };
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
    const matches = sql.join(fields.map(field => matchesReference(sql`e.${sql.identifier(field)}`)), sql` OR `);
    const visible = visibilityCondition(type, sql`e.id`, sql`e.user_id`, viewer ?? undefined, sql`e.is_public`);
    const shared = type === "CHARACTER" && viewer
      ? sql`OR EXISTS (SELECT 1 FROM character_shares cs JOIN users u ON u.id=cs.shared_with_user_id WHERE cs.character_id=e.id AND cs.revoked_at IS NULL AND u.clerk_user_id=${viewer})`
      : sql``;
    const kind = table === "heritage" ? sql`AND e.kind=${type.replace("_TEMPLATE", "")}` : sql``;
    const versionTable = table === "heritage" ? "heritage_versions" : table === "builds" ? null : `${type.toLowerCase()}_versions`;
    const fk = table === "heritage" ? "template_id" : `${type.toLowerCase()}_id`;
    const snapshotMatches = sql.join(fields.map(field => {
      const jsonKey=field.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase());
      return sql`(${matchesReference(sql`v.snapshot->>${jsonKey}`)} OR ${matchesReference(sql`v.snapshot->'row'->>${jsonKey}`)})`;
    }),sql` OR `);
    const historic = versionTable ? sql`OR EXISTS (SELECT 1 FROM ${sql.identifier(versionTable)} v WHERE v.${sql.identifier(fk)}=e.id AND (${snapshotMatches}))` : sql``;
    return sql`SELECT 1 AS allowed FROM ${sql.identifier(table)} e WHERE ((${matches}) ${historic}) AND (${visible} ${shared}) ${kind}`;
  });
  queries.push(sql`
    SELECT 1 AS allowed FROM monsters m
    WHERE (m.visibility = 'PUBLIC' OR m.user_id = ${viewer}
      OR (m.visibility = 'FOLLOWERS_ONLY' AND EXISTS (
        SELECT 1 FROM follows f
        JOIN users a ON a.id = f.following_id
        JOIN users v ON v.id = f.follower_id
        WHERE a.clerk_user_id = m.user_id AND v.clerk_user_id = ${viewer}
      )))
    AND (${matchesReference(sql`m.definition->>'imageUrl'`)} OR EXISTS (
      SELECT 1 FROM monster_versions mv WHERE mv.monster_id = m.id
      AND ${matchesReference(sql`mv.definition->>'imageUrl'`)}
    ))
  `);
  if (viewer) queries.push(sql`
    SELECT 1 AS allowed FROM monster_copies mc
    LEFT JOIN monster_versions mv ON mv.id = mc.template_version_id
    WHERE mc.user_id = ${viewer}
    AND ${matchesReference(sql`CASE WHEN mc.template_version_id IS NULL
      THEN mc.definition->>'imageUrl' ELSE mv.definition->>'imageUrl' END`)}
  `);
  const result = await db.execute(sql`SELECT 1 FROM (${sql.join(queries, sql` UNION ALL `)}) readable LIMIT 1`);
  return result.rows.length > 0;
}
