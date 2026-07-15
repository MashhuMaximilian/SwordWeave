// =============================================================================
// Backfill primitive.hard_modifiers[].condition from legacy to v1 shape.
//
// Phase 7 Q-B introduced a new condition shape:
//   { kind: "preset" | "narrative" | "tags", ... }
// The legacy shape lives alongside it:
//   { key: string, operator?: string, value?: unknown }
//
// `HardModifier.condition` accepts both (HardModifierCondition union) so
// legacy rows keep rendering, but the goal is to migrate the DB to v1 so
// the legacy code paths can be deleted.
//
// Algorithm:
//   1. Read every primitive row.
//   2. Walk hardModifiers[*].condition.
//   3. If it looks legacy ({key, operator, value} with no `kind` field),
//      run migrateLegacyCondition() to produce the v1 shape.
//   4. If the migrated value differs from the current, UPDATE the row.
//
// Idempotent — running twice is a no-op because step 3 returns the
// existing v1 shape unchanged.
//
// Dry-run by default (no writes). Pass `--apply` to actually UPDATE.
//
// Usage:
//   pnpm tsx scripts/migrate-primitive-conditions.mts           # dry run
//   pnpm tsx scripts/migrate-primitive-conditions.mts --apply  # write
// =============================================================================

import { db } from "@/db/client";
import { primitives } from "@/db/schema/engine";
import { eq, sql } from "drizzle-orm";
import { migrateLegacyCondition } from "@/lib/primitives/condition";
import type { HardModifier, LegacyModifierCondition } from "@/types/swordweave";

const APPLY = process.argv.includes("--apply");

function isLegacyShape(raw: unknown): raw is LegacyModifierCondition {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  // Legacy: has `key` (string). No `kind` discriminator.
  // v1: has `kind` ("preset" | "narrative" | "tags").
  return typeof r.key === "string" && r.kind === undefined;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  console.log(
    `[${APPLY ? "APPLY" : "DRY-RUN"}] Reading all primitive rows...`,
  );
  const rows = await db
    .select({
      id: primitives.id,
      name: primitives.name,
      hardModifiers: primitives.hardModifiers,
    })
    .from(primitives);

  console.log(`Total rows: ${rows.length}`);
  let rowsScanned = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let conditionsSeen = 0;
  let conditionsMigrated = 0;
  let conditionsAlreadyV1 = 0;
  let conditionsNull = 0;
  let failed = 0;

  for (const row of rows) {
    rowsScanned++;
    const mods = (row.hardModifiers ?? []) as readonly HardModifier[];
    let changed = false;
    const next: HardModifier[] = [];

    for (const mod of mods) {
      const cond = mod.condition;
      if (cond === undefined || cond === null) {
        conditionsNull++;
        next.push(mod);
        continue;
      }
      conditionsSeen++;
      if (isLegacyShape(cond)) {
        const migrated = migrateLegacyCondition({
          key: cond.key,
          operator: cond.operator,
          value: cond.value,
        });
        if (migrated === null) {
          // Empty legacy — drop the condition (or keep null). We drop.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { condition: _drop, ...rest } = mod;
          next.push(rest as HardModifier);
          conditionsMigrated++;
          changed = true;
          continue;
        }
        conditionsMigrated++;
        if (!deepEqual(cond, migrated)) {
          const nextMod: HardModifier = { ...mod, condition: migrated };
          next.push(nextMod);
          if (!deepEqual(nextMod, mod)) changed = true;
        } else {
          next.push(mod);
        }
      } else {
        conditionsAlreadyV1++;
        next.push(mod);
      }
    }

    if (!changed) {
      rowsSkipped++;
      continue;
    }

    if (APPLY) {
      try {
        await db
          .update(primitives)
          .set({ hardModifiers: next })
          .where(eq(primitives.id, row.id));
        rowsUpdated++;
      } catch (e) {
        failed++;
        console.error(
          `row ${row.id} (${row.name}) UPDATE failed:`,
          e instanceof Error ? e.message : e,
        );
      }
    } else {
      // Dry-run: log the would-be change for the first 5 rows.
      if (rowsUpdated < 5) {
        console.log(
          `  would update row ${row.id} (${row.name}): ${mods.length} modifiers`,
        );
      }
      rowsUpdated++;
    }
  }

  console.log(
    `\n[${APPLY ? "APPLY" : "DRY-RUN"}] Done.\n` +
      `  rows scanned:   ${rowsScanned}\n` +
      `  rows updated:   ${rowsUpdated}\n` +
      `  rows skipped:   ${rowsSkipped}\n` +
      `  rows failed:    ${failed}\n` +
      `  conditions seen:           ${conditionsSeen}\n` +
      `  conditions null/undefined: ${conditionsNull}\n` +
      `  conditions already v1:     ${conditionsAlreadyV1}\n` +
      `  conditions migrated:       ${conditionsMigrated}`,
  );

  if (APPLY) {
    // Post-apply: count rows that still have a legacy `key` field somewhere
    // in their hard_modifiers array (defensive — should be zero).
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS legacy_count
      FROM primitives
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(hard_modifiers) m
        WHERE (m->'condition'->>'key') IS NOT NULL
          AND (m->'condition'->>'kind') IS NULL
      )
    `);
    console.log(
      "Post-apply rows with legacy condition shapes:",
      (result as { rows: { legacy_count: number }[] }).rows[0]?.legacy_count,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});