import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { getVercelOidcToken } from "@vercel/oidc";
import type { CharacterPdfSnapshot } from "./types";
import type { CharacterPdfOptions } from "./options";

export const CHARACTER_PDF_TIMEOUT_MS = 45_000;
export const CHARACTER_PDF_MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;
export const CHARACTER_PDF_MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
// Both hops are Vercel Functions. Stay below their 4.5 MB body limit.
export const CHARACTER_PDF_HOSTED_MAX_BYTES = 4_300_000;
const MAX_CONCURRENT_EXPORTS = 2;
let activeExports = 0;

export class CharacterPdfRenderError extends Error {
  constructor(public readonly code: "BUSY" | "UNAVAILABLE" | "TOO_LARGE" | "TIMEOUT" | "CANCELLED", message: string,
    public readonly status: number) { super(message); this.name = "CharacterPdfRenderError"; }
}
const unavailable = () => new CharacterPdfRenderError("UNAVAILABLE", "PDF export is temporarily unavailable. Please try again.", 503);
const cancelled = () => new CharacterPdfRenderError("CANCELLED", "PDF export was cancelled.", 499);
const tooLarge = () => new CharacterPdfRenderError("TOO_LARGE", "This character exceeds the hosted PDF export size limit. No rules were omitted.", 413);

export type CharacterPdfRenderContext = {
  signal?: AbortSignal;
  requestUrl?: string;
  cookieHeader?: string | null;
};

type HostedFailure = "invalid_deployment_host" | "missing_signing_secret" | "upstream_response" | "missing_body" | "invalid_pdf" | "network";
function hostedUnavailable(category: HostedFailure, status?: number, responseType?: "pdf" | "html" | "json" | "other") {
  // Fixed categories only: never log a URL, cookie, response body, exception,
  // snapshot, environment value or signed request header.
  console.error("[character-pdf] hosted renderer unavailable", { category, ...(status === undefined ? {} : { status }), ...(responseType ? { responseType } : {}) });
  return unavailable();
}

/** Vercel documents forwarding the existing protection cookie for same-origin
 * server requests. Its cookie is URL-bound, so aliases are deliberately not
 * interchangeable. This is solely for an already authenticated preview visit.
 * https://vercel.com/docs/deployment-protection */
function previewProtectionCookie(endpoint: URL, context: CharacterPdfRenderContext): string | undefined {
  if (process.env["VERCEL_ENV"] !== "preview" || !context.requestUrl || !context.cookieHeader) return;
  let source: URL;
  try { source = new URL(context.requestUrl); } catch { return; }
  if (source.protocol !== "https:" || source.username || source.password || source.origin !== endpoint.origin) return;
  const cookieHeader = context.cookieHeader;
  if (cookieHeader.length > 32_768 || /[\r\n]/.test(cookieHeader)) return;
  const matches = cookieHeader.split(";").map(pair => pair.trim()).filter(pair => {
    const separator = pair.indexOf("=");
    return separator >= 0 && pair.slice(0, separator).trim() === "_vercel_jwt";
  });
  if (matches.length !== 1) return;
  // JWT/base64url cookie characters only; no separators, quoting or decoding.
  const match = /^_vercel_jwt=([A-Za-z0-9._~-]{1,8192})$/.exec(matches[0]!);
  return match ? `_vercel_jwt=${match[1]}` : undefined;
}

/** Read Vercel's platform request context through its SDK, never a token from
 * the client body, render context, raw request headers or a module-level cache.
 * Default Trusted Sources self-access preserves matching-environment policy.
 * https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources */
async function workloadIdentity(signal: AbortSignal): Promise<string | undefined> {
  return await new Promise(resolve => {
    const finish = (value?: unknown) => {
      signal.removeEventListener("abort", abort);
      resolve(typeof value === "string" && value.length <= 16_384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ? value : undefined);
    };
    const abort = () => finish();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { finish(); return; }
    // The SDK refreshes where appropriate. Read it anew for each invocation.
    Promise.resolve().then(() => getVercelOidcToken()).then(finish, () => finish());
  });
}

/** Only Vercel's server-owned deployment hostname can receive a snapshot.
 * A custom domain could point at another release during promotion. */
function hostedEndpoint(): URL {
  const host = process.env["VERCEL_URL"] ?? "";
  if (host.length > 253 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(host)) throw hostedUnavailable("invalid_deployment_host");
  return new URL(`https://${host}/api/character-pdf-render`);
}

async function renderHosted(payload: string, context: CharacterPdfRenderContext): Promise<Buffer> {
  const signal = context.signal;
  const endpoint = hostedEndpoint();
  const secret = process.env["SWORDWEAVE_PDF_RENDER_SECRET"];
  if (!secret || secret.length < 32) throw hostedUnavailable("missing_signing_secret");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}\n`).update(payload).digest("hex");
  const headers: Record<string, string> = {
    "Content-Type": "application/json", "X-SwordWeave-PDF-Timestamp": timestamp,
    "X-SwordWeave-PDF-Signature": signature,
  };
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, CHARACTER_PDF_TIMEOUT_MS);
  try {
    if (signal?.aborted) throw cancelled();
    const oidc = await workloadIdentity(controller.signal);
    if (controller.signal.aborted) throw cancelled();
    if (oidc) headers["x-vercel-trusted-oidc-idp-token"] = oidc;
    else {
      const bypass = process.env["VERCEL_AUTOMATION_BYPASS_SECRET"];
      if (bypass) headers["x-vercel-protection-bypass"] = bypass;
      else {
        const cookie = previewProtectionCookie(endpoint, context);
        if (cookie) headers["cookie"] = cookie;
      }
    }
    const response = await fetch(endpoint, {
      method: "POST", headers, body: payload, redirect: "manual", cache: "no-store", signal: controller.signal,
    });
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    const responseType = contentType === "application/pdf" ? "pdf" : contentType === "text/html" ? "html" : contentType === "application/json" ? "json" : "other";
    let responseError: CharacterPdfRenderError | undefined;
    if (response.status === 413) responseError = tooLarge();
    else if (response.status === 429) responseError = new CharacterPdfRenderError("BUSY", "The PDF renderer is busy. Please try again shortly.", 429);
    else if (!response.ok || contentType !== "application/pdf") responseError = hostedUnavailable("upstream_response", response.status, responseType);
    if (responseError) { await response.body?.cancel().catch(() => {}); throw responseError; }
    const announced = Number(response.headers.get("content-length"));
    if (Number.isFinite(announced) && announced > CHARACTER_PDF_HOSTED_MAX_BYTES) {
      await response.body?.cancel(); throw tooLarge();
    }
    if (!response.body) throw hostedUnavailable("missing_body");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > CHARACTER_PDF_HOSTED_MAX_BYTES) { await reader.cancel(); throw tooLarge(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks, size);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw hostedUnavailable("invalid_pdf");
    if (signal?.aborted) throw cancelled();
    return bytes;
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    if (timedOut) throw new CharacterPdfRenderError("TIMEOUT", "PDF export took too long. Please try again.", 503);
    if (error instanceof CharacterPdfRenderError) throw error;
    throw hostedUnavailable("network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function executable(path: string) {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}
async function pythonCommand(root: string) {
  const configured = process.env["SWORDWEAVE_PDF_PYTHON"]?.trim();
  if (configured) return configured;
  for (const candidate of [join(root, ".venv", "bin", "python3"), join(root, ".venv", "bin", "python")]) {
    if (await executable(candidate)) return candidate;
  }
  if (process.env.NODE_ENV === "development") {
    const bundled = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "bin", "python3");
    if (await executable(bundled)) return bundled;
  }
  return "python3";
}

/** No shell, no HTTP fetch and no snapshot file. A cancelled or timed-out child
 * is killed before its temporary directory is removed. Child output is never
 * logged: Python diagnostics may contain private authored character text. */
async function runRenderer(command: string, root: string, output: string, payload: string, signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled();
  await new Promise<void>((resolve, reject) => {
    let terminalError: CharacterPdfRenderError | null = null;
    let settled = false;
    const child = spawn(command, [join(root, "scripts", "render-character-pdf.py"), "--output", output], {
      cwd: root, shell: false, windowsHide: true, stdio: ["pipe", "ignore", "ignore"],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    const finish = (error?: CharacterPdfRenderError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    const stop = (error: CharacterPdfRenderError) => {
      if (settled || terminalError) return;
      terminalError = error;
      child.kill("SIGKILL");
    };
    const abort = () => stop(cancelled());
    const timeout = setTimeout(() => stop(new CharacterPdfRenderError("TIMEOUT", "PDF export took too long. Please try again.", 503)), CHARACTER_PDF_TIMEOUT_MS);
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", () => finish(terminalError ?? unavailable()));
    child.once("close", code => finish(terminalError ?? (code === 0 ? undefined : unavailable())));
    // A Python import error or cancellation can close stdin before end().
    // Its close/error event above determines the safe public error response.
    child.stdin.on("error", () => {});
    child.stdin.end(payload);
    if (signal?.aborted) abort();
  });
}

export async function renderCharacterPdf(character: CharacterPdfSnapshot, options: CharacterPdfOptions,
  context: CharacterPdfRenderContext = {}): Promise<Buffer> {
  if (context.signal?.aborted) throw cancelled();
  if (activeExports >= MAX_CONCURRENT_EXPORTS) throw new CharacterPdfRenderError("BUSY", "Two character PDFs are already being prepared. Please try again shortly.", 429);
  const payload = JSON.stringify({ character, options });
  const hosted = process.env["VERCEL"] === "1";
  if (hosted && Buffer.byteLength(payload, "utf8") > CHARACTER_PDF_HOSTED_MAX_BYTES) throw tooLarge();
  if (!hosted && Buffer.byteLength(payload, "utf8") > CHARACTER_PDF_MAX_SNAPSHOT_BYTES) {
    throw new CharacterPdfRenderError("TOO_LARGE", "This character is too large for PDF export. No rules were omitted.", 413);
  }
  activeExports++;
  let directory: string | undefined;
  try {
    if (hosted) return await renderHosted(payload, context);
    const root = process.cwd();
    await access(join(root, "scripts", "render-character-pdf.py"), constants.R_OK);
    const command = await pythonCommand(root);
    if (context.signal?.aborted) throw cancelled();
    directory = await mkdtemp(join(tmpdir(), "swordweave-character-pdf-"));
    const output = join(directory, "sheet.pdf");
    await runRenderer(command, root, output, payload, context.signal);
    const file = await stat(output);
    if (!file.isFile() || file.size < 5) throw unavailable();
    if (file.size > CHARACTER_PDF_MAX_OUTPUT_BYTES) throw new CharacterPdfRenderError("TOO_LARGE", "The generated character PDF exceeds the export size limit. No partial PDF was returned.", 413);
    const bytes = await readFile(output);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw unavailable();
    if (context.signal?.aborted) throw cancelled();
    return bytes;
  } catch (error) {
    if (error instanceof CharacterPdfRenderError) throw error;
    throw unavailable();
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
    } finally { activeExports--; }
  }
}
