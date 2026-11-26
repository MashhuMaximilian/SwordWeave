import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { capabilities, effects, heritage, items, primitives, primitiveVersions } from "@/db/schema";
import { loadAttachableContainers } from "@/lib/character/attachable-container";
import { loadCreationCapabilities } from "@/lib/character/creation-capability";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { visibilityCondition } from "@/lib/publishing/library-query";
import type { McpActor } from "./auth";

const scanLimit = 40;
const pageSize = 8;
const cursorLifetimeMs = 10 * 60 * 1000;
const minimumSecretBytes = 32;
const cursorSize = 8192;
const startingCategory = z.enum(["VERB_TIER", "DOMAIN", "RANGE", "INTENSITY_DICE"]);

export const findCreationsInput = z.strictObject({
  query: z.string().max(160),
  kind: z.enum(["primitive", "effect", "capability", "heritage", "item"]),
  startingCategory: startingCategory.optional(),
  minBu: z.number().int().min(-2147483648).max(2147483647).optional(),
  maxBu: z.number().int().min(-2147483648).max(2147483647).optional(),
  cursor: z.string().min(1).max(cursorSize).optional(),
}).refine(value => value.minBu === undefined || value.maxBu === undefined || value.minBu <= value.maxBu, {
  message: "The minimum BU cannot exceed the maximum BU.",
}).refine(value => value.startingCategory === undefined || value.kind === "primitive", {
  message: "Starting access categories apply to primitives.",
});

type FindCreationsInput = z.infer<typeof findCreationsInput>;
type CreationKind = FindCreationsInput["kind"];
type CatalogueActor = Pick<McpActor, "id" | "clerkId">;

export class CatalogueCursorError extends Error {
  constructor() {
    super("Invalid catalogue cursor.");
  }
}

const orderingKey = z.strictObject({
  rank: z.number().int().min(0).max(2),
  normalizedName: z.string(),
  id: z.string().min(1).max(36),
});
type OrderingKey = z.infer<typeof orderingKey>;

const cursorPayload = z.strictObject({
  purpose: z.literal("swordweave-find-creations-v1"),
  viewer: z.string().regex(/^[a-f0-9]{64}$/),
  query: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
  after: orderingKey,
});
type CursorPayload = z.infer<typeof cursorPayload>;

const rootTables = {
  primitive: { table: primitives, target: "PRIMITIVE" },
  effect: { table: effects, target: "EFFECT" },
  capability: { table: capabilities, target: "CAPABILITY" },
  heritage: { table: heritage, target: sql`(${heritage.kind}::text || '_TEMPLATE')::publish_target_type` },
  item: { table: items, target: "ITEM" },
} as const;

type RootRow = OrderingKey & Record<string, unknown> & {
  name: string;
  publicationType: string;
  buCost: number | null;
  versionId: string | null;
};

export function getCatalogueCursorSecret(env: Readonly<Record<string, string | undefined>> = globalThis.process.env): string | null {
  const secret = env["MCP_CURSOR_HMAC_SECRET"];
  return secret?.trim() && Buffer.byteLength(secret) >= minimumSecretBytes ? secret : null;
}

function signCursor(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

function parseCursor(raw: string, secret: string, viewer: string, query: string, now: number): OrderingKey {
  const syntax = /^([\w-]+)\.([\w-]{43})$/.exec(raw);
  if (!syntax) throw new CatalogueCursorError();
  const encoded = syntax[1]!;
  const signature = Buffer.from(syntax[2]!, "base64url");
  const expected = signCursor(encoded, secret);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new CatalogueCursorError();
  }
  let parsed: CursorPayload;
  try {
    parsed = cursorPayload.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    throw new CatalogueCursorError();
  }
  if (parsed.viewer !== viewer || parsed.query !== query || parsed.expiresAt <= now) {
    throw new CatalogueCursorError();
  }
  return parsed.after;
}

function createCursor(payload: CursorPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signCursor(encoded, secret).toString("base64url")}`;
}

async function scanRoots(kind: CreationKind, query: string, clerkId: string, after: OrderingKey | null,
  category?: z.infer<typeof startingCategory>) {
  const { table, target } = rootTables[kind];
  const visible = visibilityCondition(target, sql`${table.id}`, sql`${table.userId}`, clerkId, sql`${table.isPublic}`);
  const keyset = after
    ? sql`WHERE (rank, "normalizedName" COLLATE "C", id COLLATE "C")
      > (${after.rank}::integer, ${after.normalizedName}::text COLLATE "C", ${after.id}::text COLLATE "C")`
    : sql.empty();
  const isPrimitive = kind === "primitive";
  const categoryCondition = category ? sql`AND ${primitives.category} = ${category}` : sql.empty();
  // Primitive BU is authored directly. A primitive backed by another template
  // and any container have no independently verified cost in this query.
  const buCost = isPrimitive ? sql`CASE WHEN ${primitives.templatePrimitiveId} IS NULL THEN ${primitives.buCost} END` : sql`NULL::integer`;
  const pin = isPrimitive ? sql`(
    SELECT ${primitiveVersions.id}::text
      FROM ${primitiveVersions}
      JOIN ${primitives} ON ${primitives.id} = ${primitiveVersions.primitiveId}
      WHERE ${primitives.id} = matched.id::integer AND ${directPrimitivePinCondition}
  )` : sql`NULL::text`;
  const result = await db.execute<RootRow>(sql`
    WITH visible AS (
      SELECT ${table.id}::text AS id, ${table.name} AS name, ${target}::text AS "publicationType",
        lower(btrim(regexp_replace(${table.name}, '[[:space:]]+', ' ', 'g'))) AS "normalizedName",
        ${buCost} AS "buCost"
      FROM ${table}
      WHERE ${visible} ${categoryCondition}
    ), matches AS (
      SELECT visible.*, CASE
        WHEN "normalizedName" = ${query} THEN 0
        WHEN ${query} <> '' AND strpos("normalizedName", ${query}) = 1 THEN 1
        ELSE 2
      END AS rank
      FROM visible WHERE strpos("normalizedName", ${query}) > 0
    ), matched AS (
      SELECT * FROM matches ${keyset}
      ORDER BY rank, "normalizedName" COLLATE "C", id COLLATE "C" LIMIT ${scanLimit}
    )
    SELECT matched.*, ${pin} AS "versionId" FROM matched
    ORDER BY rank, "normalizedName" COLLATE "C", id COLLATE "C"
  `);
  if (isPrimitive) return result.rows;
  const ids = result.rows.map(row => row.id).filter(id => z.uuid().safeParse(id).success);
  if (!ids.length) return result.rows;
  const roots = kind === "capability"
    ? (await loadCreationCapabilities(clerkId, ids)).map(root => ({ ...root,
      buCost: root.members.reduce((total, member) => total + member.primitive.buCost, 0) }))
    : await loadAttachableContainers(kind, ids, clerkId);
  const byId = new Map(roots.map(root => [root.id, root]));
  return result.rows.map(row => {
    const root = byId.get(row.id);
    return root?.name === row.name ? { ...row, versionId: root.versionId, buCost: root.buCost } : row;
  });
}

export async function findCreations(
  input: FindCreationsInput,
  actor: CatalogueActor,
  options: { resource: string; cursorSecret: string },
) {
  const { kind, minBu, maxBu, cursor, startingCategory: category } = findCreationsInput.parse(input);
  const query = input.query.trim().replace(/\s+/gu, " ").toLowerCase();
  const { cursorSecret, resource } = options;
  if (!getCatalogueCursorSecret({ MCP_CURSOR_HMAC_SECRET: cursorSecret }) || !actor.id || !actor.clerkId) {
    throw new Error("Catalogue discovery is unavailable.");
  }
  const viewer = createHmac("sha256", cursorSecret).update(JSON.stringify([actor.id, actor.clerkId])).digest("hex");
  const queryDigest = createHash("sha256").update(JSON.stringify([resource, kind, query, minBu ?? null, maxBu ?? null, category ?? null])).digest("hex");
  const now = Date.now();
  const after = cursor ? parseCursor(cursor, cursorSecret, viewer, queryDigest, now) : null;
  const rows = await scanRoots(kind, query, actor.clerkId, after, category);
  const items: Array<{
    name: string;
    kind: CreationKind;
    id: string;
    source: string;
    matchReason: string;
    buCost?: number;
    pin?: { kind: CreationKind; id: string; versionId: string };
    versionStatus: "PINNED" | "UNAVAILABLE";
  }> = [];
  let examined = 0;
  let last: OrderingKey | undefined;
  for (const row of rows) {
    examined++;
    last = { rank: row.rank, normalizedName: row.normalizedName, id: row.id };
    const cost = row.buCost;
    const knownCost = typeof cost === "number" && Number.isFinite(cost);
    if ((minBu !== undefined || maxBu !== undefined) &&
        (!knownCost || (minBu !== undefined && cost < minBu) || (maxBu !== undefined && cost > maxBu))) continue;
    items.push({
      name: row.name,
      kind,
      id: row.id,
      source: new URL(`/library/item/${row.publicationType}:${encodeURIComponent(row.id)}`, resource).href,
      matchReason: row.rank === 0 ? "Exact name match" : row.rank === 1 ? "Name starts with the query" :
        query ? "Name contains the query" : "Visible catalogue entry",
      ...(knownCost ? { buCost: cost } : {}),
      ...(row.versionId ? { pin: { kind, id: row.id, versionId: row.versionId }, versionStatus: "PINNED" as const } :
        { versionStatus: "UNAVAILABLE" as const }),
    });
    if (items.length === pageSize) break;
  }
  const nextCursor = last && (items.length === pageSize || examined === scanLimit)
    ? createCursor({
      purpose: "swordweave-find-creations-v1", viewer, query: queryDigest,
      expiresAt: now + cursorLifetimeMs, after: last,
    }, cursorSecret)
    : null;
  return {
    items,
    coverage: nextCursor ? "MORE" as const : "EXHAUSTED" as const,
    nextCursor,
  };
}
