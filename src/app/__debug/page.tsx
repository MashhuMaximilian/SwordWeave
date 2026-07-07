import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DebugPage() {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env;
  return (
    <div style={{padding: 32, fontFamily: "monospace"}}>
      <h1>Debug Page</h1>
      <p>process type: {typeof proc}</p>
      <p>env type: {typeof env}</p>
      <p>DATABASE_URL: {env?.["DATABASE_URL"] ? "set (" + env["DATABASE_URL"]!.length + " chars)" : "undefined"}</p>
      <p>NODE_ENV: {String(env?.["NODE_ENV"])}</p>
      <p>VERCEL_ENV: {String(env?.["VERCEL_ENV"])}</p>
      <p>runtime: {proc === undefined ? "EDGE (no process)" : "nodejs (process exists)"}</p>
      <p>headers: {JSON.stringify(Object.fromEntries(Object.entries(headers()).slice(0,5)))}</p>
    </div>
  );
}
