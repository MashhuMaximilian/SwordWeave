// =============================================================================
// Database client — uses Neon's serverless WebSocket Pool driver.
//
// Why Pool, not neon-http? The HTTP driver does not support transactions.
// Every publish/clone/update route uses `db.transaction(...)` for atomicity
// (e.g. create build + link primitives + write version row in one shot).
// Switching to the Pool driver unlocks `db.transaction()` while keeping
// the same `@neondatabase/serverless` package — no new dependency.
//
// Pool uses a single WebSocket per serverless invocation. For Vercel
// functions this is the recommended setup per Neon docs.
// =============================================================================

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize the database client.");
}

// Required for environments where Node's WebSocket constructor isn't
// available globally (e.g. local dev without `ws` polyfill).
if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });