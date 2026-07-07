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
//
// Initialization is LAZY. We do NOT throw at module-load time if
// DATABASE_URL is missing — instead we throw on first query. This keeps
// routes that don't touch the DB (and the error boundary itself) rendering
// normally even when env vars are misconfigured in a preview deployment,
// turning "the whole site is 500" into "this query failed with a clear
// message".
// =============================================================================

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

// =============================================================================
// IMPORTANT: do NOT use `process.env` directly here.
//
// Some Next.js / Turbopack builds transform `process.env.X` references into
// `defaultImport.env.X` (because they're treated as ES module default imports
// of the `process` module). When that happens, `process.env` becomes
// `({}).env` and resolves to `undefined`, even though the global `process`
// object is fully populated at runtime.
//
// Use `globalThis.process.env` to bypass the transformation — the bundler
// can't replace a member access on `globalThis` with a module-import stub.
// =============================================================================

// Required for environments where Node's WebSocket constructor isn't
// available globally (e.g. local dev without `ws` polyfill).
if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDatabaseUrl(): string {
  // Use globalThis.process.env instead of process.env so Turbopack doesn't
  // transform this into a broken default-import reference.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const url = proc?.env?.["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to initialize the database client. " +
        "Set it in Vercel → Project Settings → Environment Variables, " +
        "or in your local .env.local for development.",
    );
  }
  return url;
}

function ensureClient() {
  if (_db) return _db;
  const url = getDatabaseUrl();
  _pool = new Pool({ connectionString: url });
  _db = drizzle({ client: _pool, schema });
  return _db;
}

/**
 * Lazy-initialized database client. Calling this on the first DB query
 * initializes the underlying Neon Pool. Subsequent calls reuse the same
 * instance for the lifetime of the serverless invocation.
 *
 * Throws a descriptive error if DATABASE_URL is missing.
 */
export function getDb() {
  return ensureClient();
}

/**
 * Backwards-compatible proxy: `db.select()...` still works for any caller
 * that previously imported `db` directly. Each property access goes through
 * the proxy and lazily initializes the underlying client on first use.
 *
 * New code should prefer `getDb()` for clarity.
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop, _receiver) {
      const client = ensureClient() as unknown as Record<PropertyKey, unknown>;
      const value = client[prop];
      return typeof value === "function" ? (value as Function).bind(client) : value;
    },
  },
) as unknown as ReturnType<typeof drizzle<typeof schema>>;

export const pool = new Proxy({} as Pool, {
  get(_target, prop, _receiver) {
    if (!_pool) ensureClient();
    return (_pool as unknown as Record<PropertyKey, unknown>)[prop];
  },
});
