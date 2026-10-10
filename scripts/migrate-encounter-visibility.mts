/** Scoped additive release migration. Default rolls back; --apply commits. */
import { config } from "dotenv";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync } from "node:fs";
config({ path: ".env.local", quiet: true });
neonConfig.webSocketConstructor = ws;
const client = new Client({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    readFileSync("src/db/migrations/0074_encounter_visibility.sql", "utf8"),
  );
  const journal = JSON.parse(
    readFileSync("src/db/migrations/meta/_journal.json", "utf8"),
  ).entries.find((e: { idx: number }) => e.idx === 74);
  if (process.argv.includes("--apply")) {
    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations(id,hash,created_at) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
      [74, journal.tag, journal.when],
    );
    await client.query("COMMIT");
    console.log("Applied only 0074_encounter_visibility.");
  } else {
    await client.query("ROLLBACK");
    console.log("Migration rollback dry run passed; no changes retained.");
  }
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
