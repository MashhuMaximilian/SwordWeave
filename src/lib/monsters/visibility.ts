import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { EntityKey } from "@/lib/character/workspace/model";
import { visibilityCondition } from "@/lib/publishing/library-query";
export async function readableMonsterComponents(keys:readonly EntityKey[],viewer:string|null|undefined,audience?:"PUBLIC"|"FOLLOWERS_ONLY"):Promise<Set<EntityKey>>{
 const allowed=new Set<EntityKey>();
 await Promise.all((["primitive","capability","effect","heritage","item"] as const).map(async kind=>{
  const ids=keys.filter(k=>k.startsWith(`${kind}:`)).map(k=>k.slice(kind.length+1));if(!ids.length)return;
  const table=kind==="primitive"?schema.primitives:kind==="capability"?schema.capabilities:kind==="effect"?schema.effects:kind==="heritage"?schema.heritage:schema.items;
  const target=kind==="heritage"?sql`(${table}.kind::text || '_TEMPLATE')::publish_target_type`:kind.toUpperCase();
  const publicVisibility=visibilityCondition(target,sql`${table}.id`,sql`${table}.user_id`,undefined,sql`${table}.is_public`);
  const visibility=audience ? audience==="PUBLIC" ? publicVisibility : sql`(${publicVisibility} OR (${table}.user_id=${viewer} AND EXISTS(SELECT 1 FROM publications p WHERE p.target_type=${target} AND p.target_id=${table}.id::text AND p.visibility='FOLLOWERS_ONLY' AND p.unpublished_at IS NULL)))` : visibilityCondition(target,sql`${table}.id`,sql`${table}.user_id`,viewer??undefined,sql`${table}.is_public`);
  const result=await db.execute(sql`SELECT ${table}.id FROM ${table} WHERE ${table}.id::text IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)}) AND ${visibility}`);
  for(const row of result.rows as {id:string|number}[])allowed.add(`${kind}:${row.id}` as EntityKey);
 }));return allowed;
}

/** Verify every reachable component against the template audience, never owner access. */
export async function assertMonsterAudience(keys:readonly EntityKey[],author:string,audience:"PUBLIC"|"FOLLOWERS_ONLY"|"PRIVATE") {
 if(audience==="PRIVATE"||!keys.length)return;
 const readable=await readableMonsterComponents(keys,author,audience);
 if(keys.some(key=>!readable.has(key)))throw new Error("Every component must be shared with this template's audience. Publish private components first or keep this template private.");
}
