/** Repair the missing-owner create bug from the recorded first version.
 * Dry run by default: pnpm exec tsx scripts/repair-heritage-ownership.ts
 * Apply reviewed candidates: add --apply. Existing owners are never replaced.
 */
import { db, pool } from "../src/db/client";
import { sql } from "drizzle-orm";

const idIndex = process.argv.indexOf("--id");
const targetId = idIndex >= 0 ? process.argv[idIndex + 1] : undefined;
if (process.argv.includes("--apply") && !targetId)
  throw new Error("--apply requires a reviewed --id");

const candidates = sql`
 select h.id, h.name, u.clerk_user_id as owner
 from heritage h
 join heritage_versions v on v.template_id = h.id and v.version_number = 1
 join users u on u.id = v.published_by_user_id
 where h.user_id is null
   and (${targetId ?? null}::uuid is null or h.id = ${targetId ?? null}::uuid)
   and u.clerk_user_id is not null
   and v.created_at >= h.created_at
   and v.created_at < h.created_at + interval '1 minute'
   and not exists (
     select 1 from heritage owned where owned.user_id = u.clerk_user_id
       and owned.name = h.name and owned.kind = h.kind
   )`;

async function main() {
  try {
    const preview = await db.execute(
      sql`select id, name from (${candidates}) candidates`,
    );
    console.log("Recoverable templates:", preview.rows);
    if (!process.argv.includes("--apply")) return;
    const repaired = await db.execute(sql`
      update heritage h set user_id = c.owner, updated_at = now()
      from (${candidates}) c where h.id = c.id and h.user_id is null
      returning h.id, h.name`);
    console.log("Repaired templates:", repaired.rows);
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.cause?.message ?? error.message);
  process.exitCode = 1;
});
