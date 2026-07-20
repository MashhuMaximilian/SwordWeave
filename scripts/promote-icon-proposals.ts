// =============================================================================
// promote-icon-proposals.ts — copy icon_proposed_* → icon_* for every row
// the user has accepted.
//
// The user reviewed the CSV from backfill-icons.ts and said "I'm ok with the
// icons — you can copy proposed to icon_*". This script promotes the
// proposals in bulk.
//
// Idempotent: re-running is a no-op once the columns are aligned (the
// "proposed X already equals committed X" check in promoteRows() prevents
// redundant writes). Safe to re-run.
//
// What it does NOT do:
//   - Touch rows where the user has already picked a committed icon
//     (iconSource != null AND iconSource != iconProposedSource). Those
//     are the rows the user customized; we leave their choice alone.
//   - Touch the proposed columns themselves — once a proposal is
//     accepted, the proposed columns are left in place so the user can
//     see what was auto-suggested in case they want to revert.
//
// Run with:  pnpm tsx scripts/promote-icon-proposals.ts
//
// Output: scripts/output/icon-promote-<timestamp>.csv with one row per
// entity promoted (type, id, name, source, color) for the audit log.
// =============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  primitives,
  effects,
  capabilities,
} from "@/db/schema/engine";
import { items } from "@/db/schema/items";
import { heritage, builds } from "@/db/schema/characters";

// One icon column set is shared across all six tables. The shape of
// the per-table icon columns is identical; the only thing that varies
// is which icon-prop the table exposes (icons for primitives/effects/
// capabilities/heritage/items/builds are all the same shape thanks to
// migrations 0027/0028/0029). The minimal type we need for the SELECT
// and UPDATE is `any` because Drizzle's column-typing is too narrow
// for a heterogeneous union of six tables.
type IconTable = PgTable & {
  id: any;
  name: any;
  iconSource: any;
  iconKey: any;
  iconUrl: any;
  iconColor: any;
  iconProposedSource: any;
  iconProposedKey: any;
  iconProposedUrl: any;
  iconProposedColor: any;
};

// -----------------------------------------------------------------------------
// Per-table promoter
// -----------------------------------------------------------------------------
type CsvRow = {
  type: string;
  id: string;
  name: string;
  category: string;
  promoted_source: string;
  promoted_key: string | null;
  promoted_url: string | null;
  promoted_color: string;
  had_committed_already: boolean;
};

// Generic helper: returns the rows to promote (rows with a proposal but
// no committed icon). Keeping this small and Drizzle-friendly: the
// per-table runner is responsible for selecting the columns it needs.
// We use Drizzle's getTableName/getTableColumns to keep the SQL strongly
// typed, and we splice the right isNotNull check.
async function selectPromotableRows(
  table: IconTable,
  categoryCol: any | undefined,
): Promise<
  Array<{
    id: unknown;
    name: string | null;
    category: string | null;
    iconSource: string | null;
    iconKey: string | null;
    iconUrl: string | null;
    iconProposedSource: string;
    iconProposedKey: string | null;
    iconProposedUrl: string | null;
    iconProposedColor: string | null;
  }>
> {
  const selectFields: Record<string, any> = {
    id: table.id,
    name: table.name,
    iconSource: table.iconSource,
    iconKey: table.iconKey,
    iconUrl: table.iconUrl,
    iconProposedSource: table.iconProposedSource,
    iconProposedKey: table.iconProposedKey,
    iconProposedUrl: table.iconProposedUrl,
    iconProposedColor: table.iconProposedColor,
  };
  if (categoryCol) {
    selectFields["category"] = categoryCol;
  } else {
    // Constant `null` aliased as `category` — Drizzle needs a concrete
    // expression in the SELECT shape, not an undefined field.
    selectFields["category"] = sql<string>`null::text`;
  }
  return (await db
    .select(selectFields)
    .from(table)
    .where(
      and(
        isNotNull(table.iconProposedSource),
        sql`${table.iconSource} IS NULL`,
      ),
    )) as any;
}

async function promoteTable(
  type: string,
  table: IconTable,
  // Optional extra column to surface in the CSV "category" slot
  categoryCol?: any,
): Promise<CsvRow[]> {
  const rows = await selectPromotableRows(table, categoryCol);
  const out: CsvRow[] = [];
  for (const r of rows) {
    if (!r.iconProposedSource) continue;
    await db
      .update(table)
      .set({
        iconSource: r.iconProposedSource,
        iconKey: r.iconProposedKey,
        iconUrl: r.iconProposedUrl,
        iconColor: r.iconProposedColor ?? "#ffffff",
      })
      .where(eq(table.id, r.id as any));
    out.push({
      type,
      id: String(r.id),
      name: r.name ?? "",
      category: r.category ?? "",
      promoted_source: r.iconProposedSource,
      promoted_key: r.iconProposedKey,
      promoted_url: r.iconProposedUrl,
      promoted_color: r.iconProposedColor ?? "#ffffff",
      had_committed_already: r.iconSource !== null,
    });
  }
  return out;
}

async function countCommitted(table: any): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(isNotNull(table.iconSource));
  return rows[0]?.n ?? 0;
}

// -----------------------------------------------------------------------------
// CSV writer
// -----------------------------------------------------------------------------
function toCsv(rows: CsvRow[]): string {
  const header = [
    "type",
    "id",
    "name",
    "category",
    "promoted_source",
    "promoted_key",
    "promoted_url",
    "promoted_color",
    "had_committed_already",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const fields = [
      r.type,
      r.id,
      csvField(r.name),
      r.category,
      r.promoted_source,
      r.promoted_key ?? "",
      r.promoted_url ?? "",
      r.promoted_color,
      String(r.had_committed_already),
    ];
    lines.push(fields.join(","));
  }
  return lines.join("\n") + "\n";
}

function csvField(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  console.log("Promoting proposed icons to committed state...\n");

  // primitives also expose a category column
  const primitiveRows = await promoteTable("primitive", primitives, primitives.category);
  // effects have no first-class category
  const effectRows = await promoteTable("effect", effects);
  // capabilities use `type` as the category
  const capabilityRows = await promoteTable("capability", capabilities, capabilities.type);
  // heritage use `kind`
  const templateRows = await promoteTable("template", heritage, heritage.kind);
  // items use `itemType`
  const itemRows = await promoteTable("item", items, items.itemType);
  // builds — no category column, just use the level
  const buildRows = await promoteTable("build", builds);

  const all = [
    ...primitiveRows,
    ...effectRows,
    ...capabilityRows,
    ...templateRows,
    ...itemRows,
    ...buildRows,
  ];

  // Write audit log
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `icon-promote-${stamp}.csv`);
  await writeFile(outPath, toCsv(all), "utf8");

  // Final committed counts
  const counts = {
    primitive: await countCommitted(primitives),
    effect: await countCommitted(effects),
    capability: await countCommitted(capabilities),
    template: await countCommitted(heritage),
    item: await countCommitted(items),
    build: await countCommitted(builds),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log("=== Promote summary ===");
  console.log(`Rows promoted: ${all.length}`);
  console.log("Committed icons per table:");
  for (const [type, n] of Object.entries(counts)) {
    console.log(`  ${type}: ${n}`);
  }
  console.log(`  total: ${total}`);
  console.log("");
  console.log(`Audit log: ${outPath}`);
  console.log("");
  console.log("Note: rows where the user had already picked an icon were");
  console.log("left alone. Re-run is a no-op.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Promote failed:", err);
  process.exit(1);
});
