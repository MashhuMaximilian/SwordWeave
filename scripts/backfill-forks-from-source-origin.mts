/**
 * scripts/backfill-forks-from-source-origin.mts
 *
 * One-shot script: for every entity whose source_origin starts with
 * "fork:" and that does NOT already have a row in the `forks` engagement
 * table, insert a synthetic row representing the legacy fork.
 *
 * The `forks` schema requires NOT NULL on sourceVersionId and
 * forkedVersionId. Since pre-engagement-system forks don't have real
 * version IDs, we synthesize deterministic UUID v5s using the
 * resolveContentVersionId helper, with a sentinel content hash of
 * "legacy-fork-v1". Same input → same UUID forever, so re-running the
 * script is idempotent.
 *
 * Use:
 *   pnpm tsx scripts/backfill-forks-from-source-origin.mts
 *   pnpm tsx scripts/backfill-forks-from-source-origin.mts --dry-run   # print only
 *
 * Verified safe to re-run: it queries for existing rows by
 * (forkedTargetType, forkedTargetId) before inserting.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

// Hardcoded namespace from src/lib/versions/content-hash.ts — must match
// or we'll get different UUIDs from the runtime helper.
const SWORDWEAVE_CONTENT_VERSION_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const sql = neon(process.env.DATABASE_POSTGRES_URL_NON_POOLING!);

const isDryRun = process.argv.includes("--dry-run");

/**
 * Synthesize a stable UUID v5 for a legacy fork row. We use the same
 * algorithm as resolveContentVersionId but with a sentinel content hash.
 */
function legacyForkId(
  role: "source" | "forked",
  targetType: string,
  targetId: string,
): string {
  const name = `legacy-fork:${role}:${targetType}:${targetId}`;
  const nameBytes = Buffer.from(name, "utf8");
  const nsHex = SWORDWEAVE_CONTENT_VERSION_NAMESPACE.replace(/-/g, "");
  const nsBytes = Buffer.from(nsHex, "hex");
  const hash = createHash("sha1").update(nsBytes).update(nameBytes).digest();
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

interface EntityToBackfill {
  entityKind: "primitive" | "effect" | "capability" | "item" | "template";
  targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "RACE_TEMPLATE" | "BACKGROUND_TEMPLATE" | "ARCHETYPE_TEMPLATE";
  targetId: string;
  sourceOrigin: string;
  userId: string | null; // Clerk ID of the fork owner
}

async function findForkCandidates(): Promise<EntityToBackfill[]> {
  // Query all 5 entity tables for rows with source_origin starting with
  // 'fork:'. We use a UNION ALL with a discriminator column.

  const primitives = await sql`
    SELECT id::text AS target_id, source_origin, user_id::text AS user_id
    FROM primitives
    WHERE source_origin LIKE 'fork:%'
  `;
  const effects = await sql`
    SELECT id::text AS target_id, source_origin, user_id::text AS user_id
    FROM effects
    WHERE source_origin LIKE 'fork:%'
  `;
  const capabilities = await sql`
    SELECT id AS target_id, source_origin, user_id::text AS user_id
    FROM capabilities
    WHERE source_origin LIKE 'fork:%'
  `;
  const items = await sql`
    SELECT id AS target_id, source_origin, user_id::text AS user_id
    FROM items
    WHERE source_origin LIKE 'fork:%'
  `;
  const templates = await sql`
    SELECT id AS target_id, kind, source_origin, user_id::text AS user_id
    FROM templates
    WHERE source_origin LIKE 'fork:%'
  `;

  const out: EntityToBackfill[] = [];

  for (const r of primitives) {
    out.push({
      entityKind: "primitive",
      targetType: "PRIMITIVE",
      targetId: r.target_id,
      sourceOrigin: r.source_origin,
      userId: r.user_id,
    });
  }
  for (const r of effects) {
    out.push({
      entityKind: "effect",
      targetType: "EFFECT",
      targetId: r.target_id,
      sourceOrigin: r.source_origin,
      userId: r.user_id,
    });
  }
  for (const r of capabilities) {
    out.push({
      entityKind: "capability",
      targetType: "CAPABILITY",
      targetId: r.target_id,
      sourceOrigin: r.source_origin,
      userId: r.user_id,
    });
  }
  for (const r of items) {
    out.push({
      entityKind: "item",
      targetType: "ITEM",
      targetId: r.target_id,
      sourceOrigin: r.source_origin,
      userId: r.user_id,
    });
  }
  for (const r of templates) {
    // Map template.kind to the correct targetType
    const kindToType: Record<string, EntityToBackfill["targetType"]> = {
      RACE: "RACE_TEMPLATE",
      BACKGROUND: "BACKGROUND_TEMPLATE",
      ARCHETYPE: "ARCHETYPE_TEMPLATE",
    };
    const targetType = kindToType[r.kind];
    if (!targetType) continue; // unknown kind
    out.push({
      entityKind: "template",
      targetType,
      targetId: r.target_id,
      sourceOrigin: r.source_origin,
      userId: r.user_id,
    });
  }

  return out;
}

/**
 * Parse source_origin like "fork:PRIMITIVE:425" or "fork:25" into a
 * (sourceType, sourceId) pair. Returns null if malformed.
 */
function parseForkMarker(
  sourceOrigin: string,
  defaultType: EntityToBackfill["targetType"],
): { sourceType: EntityToBackfill["targetType"]; sourceId: string } | null {
  if (!sourceOrigin.startsWith("fork:")) return null;
  const rest = sourceOrigin.slice("fork:".length);
  if (!rest) return null;
  const parts = rest.split(":");
  const knownTypes: EntityToBackfill["targetType"][] = [
    "PRIMITIVE",
    "EFFECT",
    "CAPABILITY",
    "ITEM",
    "RACE_TEMPLATE",
    "BACKGROUND_TEMPLATE",
    "ARCHETYPE_TEMPLATE",
  ];
  if (
    parts.length >= 2 &&
    knownTypes.includes(parts[0] as EntityToBackfill["targetType"])
  ) {
    return {
      sourceType: parts[0] as EntityToBackfill["targetType"],
      sourceId: parts[1] ?? "",
    };
  }
  if (parts[0]) {
    return { sourceType: defaultType, sourceId: parts[0] };
  }
  return null;
}

/**
 * Resolve Clerk user ID to internal users.id UUID. Returns null if the
 * user doesn't exist in our DB yet (this is fine — we'll just leave
 * sourceAuthorId as null which is allowed for system content).
 */
async function resolveInternalUserId(
  clerkUserId: string | null,
): Promise<string | null> {
  if (!clerkUserId) return null;
  const rows = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}`;
  return rows[0]?.id ?? null;
}

async function alreadyExists(
  forkedTargetType: string,
  forkedTargetId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM forks
    WHERE forked_target_type = ${forkedTargetType as never}
      AND forked_target_id = ${forkedTargetId}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function ensureForkAggregate(
  sourceType: string,
  sourceId: string,
  sourceVersionId: string,
): Promise<boolean> {
  // Try to insert a new aggregate row, or no-op if one already exists
  // for this (type, id, version) triple. We DO NOT bump the count on
  // conflict — that would double-count if a fork was recorded both
  // via the engagement path AND the backfill.
  const result = await sql`
    INSERT INTO fork_aggregates (
      source_target_type, source_target_id, source_version_id,
      fork_count, updated_at
    ) VALUES (
      ${sourceType as never},
      ${sourceId},
      ${sourceVersionId},
      1,
      NOW()
    )
    ON CONFLICT (source_target_type, source_target_id, source_version_id)
    DO NOTHING
    RETURNING source_target_id
  `;
  return result.length > 0;
}

async function main() {
  console.log(
    isDryRun
      ? "=== DRY RUN — no changes will be made ===\n"
      : "=== Backfilling forks engagement table ===\n",
  );

  const candidates = await findForkCandidates();
  console.log(`Found ${candidates.length} entities with fork: markers.\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    const parsed = parseForkMarker(c.sourceOrigin, c.targetType);
    if (!parsed || !parsed.sourceId) {
      console.log(
        `  SKIP ${c.targetType}:${c.targetId} — malformed source_origin: ${c.sourceOrigin}`,
      );
      skipped++;
      continue;
    }

    // Build the synthetic version IDs up front. Used by both the
    // already-exists branch (aggregate ensure) and the main INSERT.
    const sourceVersionId = legacyForkId(
      "source",
      parsed.sourceType,
      parsed.sourceId,
    );
    const forkedVersionId = legacyForkId(
      "forked",
      c.targetType,
      c.targetId,
    );

    if (await alreadyExists(c.targetType, c.targetId)) {
      console.log(
        `  SKIP fork ${c.targetType}:${c.targetId} (already in forks) — but ensure aggregate`,
      );
      // Fork row exists. Just make sure the aggregate is up to date.
      if (!isDryRun) {
        await ensureForkAggregate(parsed.sourceType, parsed.sourceId, sourceVersionId);
      }
      skipped++;
      continue;
    }

    // Resolve the forker's internal user.id. Fall back to NULL — the
    // schema allows null for sourceAuthorId (system content) but
    // forkedByUserId is NOT NULL. If we can't resolve, we have to skip.
    const forkerInternalId = await resolveInternalUserId(c.userId);
    if (!forkerInternalId) {
      console.log(
        `  SKIP ${c.targetType}:${c.targetId} — forker user not found in users table (clerk: ${c.userId})`,
      );
      skipped++;
      continue;
    }

    // Resolve the source's author (for sourceAuthorId). null is OK.
    const sourceAuthorInternalId = await resolveSourceAuthor(
      parsed.sourceType,
      parsed.sourceId,
    );

    console.log(`  INSERT ${c.targetType}:${c.targetId} <- ${parsed.sourceType}:${parsed.sourceId}`);
    console.log(`    sourceAuthorId:     ${sourceAuthorInternalId ?? "null"}`);

    if (!isDryRun) {
      try {
        await sql`
          INSERT INTO forks (
            forked_by_user_id, source_target_type, source_target_id,
            source_version_id, source_author_id,
            forked_target_type, forked_target_id, forked_version_id,
            metadata, created_at, updated_at
          ) VALUES (
            ${forkerInternalId},
            ${parsed.sourceType as never},
            ${parsed.sourceId},
            ${sourceVersionId},
            ${sourceAuthorInternalId},
            ${c.targetType as never},
            ${c.targetId},
            ${forkedVersionId},
            ${JSON.stringify({ backfilled: true, sourceOrigin: c.sourceOrigin, backfilledAt: new Date().toISOString() })},
            NOW(),
            NOW()
          )
        `;

        // UPSERT the aggregate count (idempotent — ON CONFLICT DO NOTHING).
        await ensureForkAggregate(parsed.sourceType, parsed.sourceId, sourceVersionId);

        inserted++;
      } catch (err) {
        console.log(`    ERROR: ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    } else {
      inserted++; // count as "would insert"
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Candidates:  ${candidates.length}`);
  console.log(`  ${isDryRun ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`  Skipped:     ${skipped}`);
  console.log(`  Errors:      ${errors}`);
}

async function resolveSourceAuthor(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  let userClerkId: string | null = null;
  switch (targetType) {
    case "PRIMITIVE": {
      const rows = await sql`SELECT user_id::text AS uid FROM primitives WHERE id = ${targetId}::bigint`;
      userClerkId = rows[0]?.uid ?? null;
      break;
    }
    case "EFFECT": {
      const rows = await sql`SELECT user_id::text AS uid FROM effects WHERE id = ${targetId}::uuid`;
      userClerkId = rows[0]?.uid ?? null;
      break;
    }
    case "CAPABILITY": {
      const rows = await sql`SELECT user_id::text AS uid FROM capabilities WHERE id = ${targetId}::uuid`;
      userClerkId = rows[0]?.uid ?? null;
      break;
    }
    case "ITEM": {
      const rows = await sql`SELECT user_id::text AS uid FROM items WHERE id = ${targetId}::uuid`;
      userClerkId = rows[0]?.uid ?? null;
      break;
    }
    case "RACE_TEMPLATE":
    case "BACKGROUND_TEMPLATE":
    case "ARCHETYPE_TEMPLATE": {
      const kind = targetType.replace(/_TEMPLATE$/, "");
      const rows = await sql`SELECT user_id::text AS uid FROM templates WHERE kind = ${kind}::template_kind AND id = ${targetId}::uuid`;
      userClerkId = rows[0]?.uid ?? null;
      break;
    }
    default:
      return null;
  }
  if (!userClerkId) return null;
  const rows = await sql`SELECT id FROM users WHERE clerk_user_id = ${userClerkId}`;
  return rows[0]?.id ?? null;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
