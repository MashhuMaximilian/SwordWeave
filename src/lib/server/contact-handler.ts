import { createHash, randomBytes } from "node:crypto";
import { contactSchema, type ContactMessage } from "@/lib/contact";

const MAX_BODY_BYTES = 32_768;
const WINDOW_MS = 15 * 60_000;
const salt = randomBytes(32);
const buckets = new Map<string, { start: number; count: number }>();

// A bounded backstop per process. Serverless instances do not share this map;
// configure an edge rate rule before public activation.
export function reserveContactAttempt(ip: string, now = Date.now()) {
  for (const [key, bucket] of buckets) if (now - bucket.start >= WINDOW_MS) buckets.delete(key);
  if (buckets.size >= 1024) return false;
  const key = createHash("sha256").update(salt).update(ip).digest("hex");
  const bucket = buckets.get(key) ?? { start: now, count: 0 };
  if (bucket.count >= 5) return false;
  bucket.count++;
  buckets.set(key, bucket);
  return true;
}

function reply(status: number, success = false) {
  return Response.json({ success }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}) } });
}

export async function handleContactRequest(request: Request, options: {
  configured: boolean;
  deliver: (message: ContactMessage) => Promise<void>;
  reserve?: (ip: string) => boolean;
}) {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin, "https://swordweave.quest", "https://www.swordweave.quest"]);
  if (!origin || !allowed.has(origin)) return reply(403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415);
  if (!options.configured) return reply(503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(options.reserve ?? reserveContactAttempt)(ip)) return reply(429);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let input: unknown;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return reply(400); }
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return reply(400);
  try {
    await options.deliver(parsed.data);
    return reply(200, true);
  } catch {
    // No message content, addresses, credentials or SMTP transaction logs.
    // No automatic retries after uncertain delivery.
    return reply(502);
  }
}
