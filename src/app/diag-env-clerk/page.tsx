import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function DiagEnvClerkPage() {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env;
  let clerkAuth = "not called";
  try {
    const a = await auth();
    clerkAuth = `userId=${a.userId} sessionId=${a.sessionId}`;
  } catch (e) {
    clerkAuth = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  return (
    <div style={{padding: 32, fontFamily: "monospace", fontSize: 14}}>
      <h1>Env + Clerk Diagnostic</h1>
      <p><b>process type:</b> {typeof proc}</p>
      <p><b>env type:</b> {typeof env}</p>
      <p><b>DATABASE_URL set:</b> {env?.["DATABASE_URL"] ? "YES (" + env["DATABASE_URL"]!.length + " chars)" : "NO"}</p>
      <p><b>NODE_ENV:</b> {String(env?.["NODE_ENV"])}</p>
      <p><b>runtime inferred:</b> {proc === undefined ? "EDGE (no process)" : "NODEJS (process exists)"}</p>
      <p><b>Clerk auth:</b> {clerkAuth}</p>
      <p><b>db client import test:</b></p>
      <DbTest />
    </div>
  );
}

// Try importing the actual db client and probing its getDatabaseUrl()
async function DbTest() {
  try {
    const mod = await import("@/db/client");
    // Try executing a query
    const r = await mod.db.execute("SELECT 1 as ok");
    return (
      <span style={{color: "green"}}>
        DB query OK: {JSON.stringify((r as { rows?: unknown[] }).rows?.length ?? r)}
      </span>
    );
  } catch (e) {
    return (
      <span style={{color: "red"}}>
        DB query FAILED: {e instanceof Error ? e.message : String(e)}
      </span>
    );
  }
}
