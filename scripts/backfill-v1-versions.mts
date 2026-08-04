#!/usr/bin/env node
/**
 * Backfill v1 version rows for every entity that has a
 * content_hash but NO existing row in its version table.
 *
 * Per Mashu 2026-08-03 (round 7): "If there is anything in
 * db (whatever it may be primitive capability, effect,
 * heritage, item, etc), if it has no version, mark that as
 * version 1. Because something cannot have no version, if
 * it's in db it has at least one version."
 *
 * Idempotent: skips entities that already have at least one
 * version row. Safe to run multiple times.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is missing");
  process.exit(1);
}
const sql = neon(url);

interface BackfillRow {
  id: string | number;
  content_hash: string | null;
  source_origin: string | null;
}

async function getMissing(opts: {
  table: string;
  idCol: string;
  hashCol: string;
  originCol: string;
  versionTable: string;
  versionFk: string;
}): Promise<BackfillRow[]> {
  const { table, idCol, hashCol, originCol, versionTable, versionFk } = opts;
  return (await sql.query(
    `SELECT t.${idCol} AS id, t.${hashCol} AS content_hash, t.${originCol} AS source_origin
     FROM ${table} t
     LEFT JOIN ${versionTable} v ON v.${versionFk} = t.${idCol}
     WHERE v.id IS NULL AND t.${hashCol} IS NOT NULL`,
  )) as BackfillRow[];
}

async function backfillPrimitive() {
  console.log("\n=== Primitives ===");
  const rows = await getMissing({
    table: "primitives",
    idCol: "id",
    hashCol: "content_hash",
    originCol: "source_origin",
    versionTable: "primitive_versions",
    versionFk: "primitive_id",
  });
  console.log(`Found ${rows.length} primitives without a version row`);
  for (const r of rows) {
    await sql.query(
      `INSERT INTO primitive_versions (primitive_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, true, 'FULL', $2::jsonb, NULL)`,
      [r.id as number, JSON.stringify({
        id: r.id,
        content_hash: r.content_hash,
        sourceOrigin: r.source_origin ?? "system",
      })],
    );
  }
  console.log(`Inserted ${rows.length} primitive v1 rows`);
}

async function backfillCapability() {
  console.log("\n=== Capabilities ===");
  const rows = await getMissing({
    table: "capabilities",
    idCol: "id",
    hashCol: "content_hash",
    originCol: "source_origin",
    versionTable: "capability_versions",
    versionFk: "capability_id",
  });
  console.log(`Found ${rows.length} capabilities without a version row`);
  for (const r of rows) {
    await sql.query(
      `INSERT INTO capability_versions (capability_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, true, 'FULL', $2::jsonb, NULL)`,
      [r.id as string, JSON.stringify({
        id: r.id,
        content_hash: r.content_hash,
        sourceOrigin: r.source_origin ?? "system",
      })],
    );
  }
  console.log(`Inserted ${rows.length} capability v1 rows`);
}

async function backfillEffect() {
  console.log("\n=== Effects ===");
  const rows = await getMissing({
    table: "effects",
    idCol: "id",
    hashCol: "content_hash",
    originCol: "source_origin",
    versionTable: "effect_versions",
    versionFk: "effect_id",
  });
  console.log(`Found ${rows.length} effects without a version row`);
  for (const r of rows) {
    await sql.query(
      `INSERT INTO effect_versions (effect_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, true, 'FULL', $2::jsonb, NULL)`,
      [r.id as string, JSON.stringify({
        id: r.id,
        content_hash: r.content_hash,
        sourceOrigin: r.source_origin ?? "system",
      })],
    );
  }
  console.log(`Inserted ${rows.length} effect v1 rows`);
}

async function backfillItem() {
  console.log("\n=== Items ===");
  const rows = await getMissing({
    table: "items",
    idCol: "id",
    hashCol: "content_hash",
    originCol: "source_origin",
    versionTable: "item_versions",
    versionFk: "item_id",
  });
  console.log(`Found ${rows.length} items without a version row`);
  for (const r of rows) {
    await sql.query(
      `INSERT INTO item_versions (item_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, true, 'FULL', $2::jsonb, NULL)`,
      [r.id as string, JSON.stringify({
        id: r.id,
        content_hash: r.content_hash,
        sourceOrigin: r.source_origin ?? "system",
      })],
    );
  }
  console.log(`Inserted ${rows.length} item v1 rows`);
}

async function backfillHeritage() {
  console.log("\n=== Heritages ===");
  const rows = await getMissing({
    table: "heritage",
    idCol: "id",
    hashCol: "content_hash",
    originCol: "source_origin",
    versionTable: "heritage_versions",
    versionFk: "template_id",
  });
  console.log(`Found ${rows.length} heritages without a version row`);
  for (const r of rows) {
    await sql.query(
      `INSERT INTO heritage_versions (template_id, version_number, is_latest, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, true, 'FULL', $2::jsonb, NULL)`,
      [r.id as string, JSON.stringify({
        id: r.id,
        content_hash: r.content_hash,
        sourceOrigin: r.source_origin ?? "system",
      })],
    );
  }
  console.log(`Inserted ${rows.length} heritage v1 rows`);
}

async function main() {
  await backfillHeritage();
  await backfillCapability();
  await backfillEffect();
  await backfillItem();
  await backfillPrimitive();
  console.log("\n✓ Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});