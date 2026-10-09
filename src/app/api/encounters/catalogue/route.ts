import { sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { monsters } from "@/db/schema/monsters";
import { encounterRequest } from "@/lib/encounters/http";
export const GET = (request: Request) =>
  encounterRequest(async (owner) => {
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").slice(0, 200),
      env = (p.get("environment") ?? "").slice(0, 100),
      role = (p.get("role") ?? "").slice(0, 100);
    const numeric = (key: string, fallback: number) => {
      const raw = p.get(key);
      const n = raw ? Number(raw) : fallback;
      return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
    };
    const min = numeric("min", 0),
      max = Math.max(min, numeric("max", Number.MAX_SAFE_INTEGER)),
      offset = Math.min(1000000, numeric("offset", 0));
    const rows = await db
      .select({
        id: monsters.id,
        name: monsters.name,
        version: monsters.version,
        budget: sql<number>`(${monsters.definition}->>'budget')::double precision`,
        concept: sql<string>`left(${monsters.definition}->>'concept', 1000)`,
        catalogue: sql<NonNullable<
          import("@/lib/monsters/model").MonsterDefinition["catalogue"]
        > | null>`${monsters.definition}->'catalogue'`,
      })
      .from(monsters)
      .where(
        sql`(${monsters.visibility}='PUBLIC' OR ${monsters.userId}=${owner} OR (${monsters.visibility}='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=${monsters.userId} AND v.clerk_user_id=${owner}))) AND ${monsters.name} ILIKE ${"%" + q + "%"} AND (${monsters.definition}->>'budget')::numeric BETWEEN ${min} AND ${max} AND (${env}='' OR ${monsters.definition}->'catalogue'->>'environment'=${env}) AND (${role}='' OR ${monsters.definition}->'catalogue'->>'role'=${role})`,
      )
      .orderBy(desc(monsters.updatedAt), monsters.id)
      .limit(25)
      .offset(offset);
    return { monsters: rows.slice(0, 24), hasMore: rows.length > 24 };
  });
