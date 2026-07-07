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
import { loadEnvConfig } from "@next/env";
import * as schema from "@/db/schema";

// =============================================================================
// IMPORTANT: do NOT rely on `process.env` directly.
//
// In some Next.js / Turbopack builds, `process.env.X` references can be
// transformed into `defaultImport.env.X` (treating `process` as an ES module
// default import of the `process` module, where the default export is `{}`),
// making env vars undefined at runtime even when they're correctly configured
// in Vercel / .env.local. We've seen this happen on the `/library/item/[id]`
// page in particular (probably because of how Clerk's dev-browser handshake
// affects the runtime).
//
// Use `loadEnvConfig` at module load to ensure `.env.local` (and friends)
// are populated into `process.env` from disk, then read via globalThis.process
// (which bypasses any bundler-side rewriting of `process`).
// =============================================================================

// Load env vars from .env files. This is idempotent — already-populated
// vars are left alone. Safe to call at module load.
try {
  loadEnvConfig(process.cwd());
} catch {
  // loadEnvConfig can throw on serverless platforms if there's no .env file
  // (e.g. Vercel reads env vars from the platform directly). That's fine.
}

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
  // transform this into a broken default-import reference (Turbopack was
  // rewriting `process.env.X` into `defaultImport.env.X`, where the default
  // import of the `process` module is `{}`, making `process.env` undefined
  // in some bundles). globalThis.process bypasses the transformation.
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
