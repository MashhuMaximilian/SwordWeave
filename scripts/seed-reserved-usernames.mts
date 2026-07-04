/**
 * Seed the reserved_usernames table from the canonical list.
 * Idempotent: ON CONFLICT DO NOTHING so re-running is safe.
 *
 * Usage:
 *   npx tsx scripts/seed-reserved-usernames.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { reservedUsernames } from "../src/db/schema/profiles";
import { RESERVED_USERNAMES } from "../src/lib/profiles/reserved-usernames";

const rows = RESERVED_USERNAMES.map((r) => ({
  username: r.username,
  reason: r.reason,
}));

console.log(`Seeding ${rows.length} reserved usernames...`);
const inserted = await db
  .insert(reservedUsernames)
  .values(rows)
  .onConflictDoNothing({ target: reservedUsernames.username })
  .returning({ username: reservedUsernames.username });

const existing = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(reservedUsernames);

console.log(
  `Inserted ${inserted.length} new rows. Total in DB: ${existing[0]?.count ?? 0}`,
);
process.exit(0);