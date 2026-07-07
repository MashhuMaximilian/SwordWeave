import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function DiagEnvPage() {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env;
  return (
    <div style={{padding: 32, fontFamily: "monospace", fontSize: 14}}>
      <h1>Env Diagnostic</h1>
      <p><b>process type:</b> {typeof proc}</p>
      <p><b>env type:</b> {typeof env}</p>
      <p><b>DATABASE_URL set:</b> {env?.["DATABASE_URL"] ? "YES (" + env["DATABASE_URL"]!.length + " chars)" : "NO"}</p>
      <p><b>NODE_ENV:</b> {String(env?.["NODE_ENV"])}</p>
      <p><b>VERCEL_ENV:</b> {String(env?.["VERCEL_ENV"])}</p>
      <p><b>runtime inferred:</b> {proc === undefined ? "EDGE (no process)" : "NODEJS (process exists)"}</p>
      <hr />
      <p><b>Headers (first 8):</b></p>
      <pre>{JSON.stringify(Object.fromEntries(Object.entries(headers()).slice(0,8)), null, 2)}</pre>
    </div>
  );
}
