/**
 * migrate-bu-market.ts — Seed all BU Market primitives into Neon DB
 *
 * Usage:
 *   npm run db:migrate-bu-market
 *
 * Reads from data/bu-market-primitives.ts (the canonical BU Market catalog
 * extracted from Notion page 37eed8479ccd8155b917c373194dbdf4).
 *
 * Behavior:
 *   - INSERT ... ON CONFLICT (name, category, user_id) DO UPDATE:
 *     - Updates bu_cost, cost_tier, narrative_rule, mirror flags, is_public
 *   - is_public = true (these are core library primitives, public by default)
 *   - user_id = NULL (core library, no owner)
 *
 * Safe to run multiple times.
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { BU_MARKET_PRIMITIVES, BU_MARKET_META } from "../data/bu-market-primitives";

// Load .env.local explicitly (seed/migration scripts don't get Next.js env loading)
config({ path: ".env.local" });

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const sql = neon(process.env["DATABASE_URL"]);

async function migrate() {
  console.log("=".repeat(70));
  console.log("BU Market Migration");
  console.log("=".repeat(70));
  console.log(`Source: ${BU_MARKET_META.sourcePageTitle}`);
  console.log(`Source ID: ${BU_MARKET_META.sourcePageId}`);
  console.log(`Extracted: ${BU_MARKET_META.extractedOn}`);
  console.log(`Primitives to seed: ${BU_MARKET_PRIMITIVES.length}`);
  console.log("");

  let inserted = 0;
    let updated = 0;
    let failed = 0;

    // Group by category for summary
    const byCategory = new Map<string, number>();
    for (const p of BU_MARKET_PRIMITIVES) {
      byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
    }
    console.log("By category:");
    for (const [cat, count] of byCategory.entries()) {
      console.log(`  ${cat}: ${count}`);
    }
    console.log("");

    for (const prim of BU_MARKET_PRIMITIVES) {
      try {
        // Check if exists first (Postgres treats NULL as distinct in unique indexes,
        // so we can't rely on ON CONFLICT with NULL user_id)
        const existing = await sql`
          SELECT id FROM primitives
          WHERE name = ${prim.name} AND category = ${prim.category}::primitive_category AND user_id IS NULL
          LIMIT 1
        `;

        if (existing.length > 0) {
          // Update existing record
          const id = existing[0]?.["id"];
          await sql`
            UPDATE primitives SET
              is_public = TRUE,
              cost_tier = ${prim.tier},
              bu_cost = ${prim.buCost},
              narrative_rule = ${prim.description},
              is_mirrorable = ${prim.isMirrorable},
              mirror_vector = ${prim.mirrorVector},
              mirror_bu_credit = ${prim.mirrorBuCredit},
              mirror_eligibility_notes = ${prim.isMirrorable ? "Mirrorable - " + prim.mirrorVector : "Not mirrorable - permission vector"},
              updated_at = NOW()
            WHERE id = ${id}
          `;
          updated++;
          console.log(`  ~ ${prim.name} (${prim.buCost} BU, ${prim.category}) — updated`);
        } else {
          // Insert new record
          await sql`
            INSERT INTO primitives (
              name, user_id, is_public, category, cost_tier, bu_cost,
              mechanical_output_text, narrative_rule,
              is_mirrorable, mirror_vector, mirror_bu_credit, mirror_eligibility_notes,
              hard_modifiers
            )
            VALUES (
              ${prim.name},
              NULL,
              TRUE,
              ${prim.category}::primitive_category,
              ${prim.tier},
              ${prim.buCost},
              ${""},
              ${prim.description},
              ${prim.isMirrorable},
              ${prim.mirrorVector},
              ${prim.mirrorBuCredit},
              ${prim.isMirrorable ? "Mirrorable - " + prim.mirrorVector : "Not mirrorable - permission vector"},
              ${"[]"}::jsonb
            )
          `;
          inserted++;
          console.log(`  + ${prim.name} (${prim.buCost} BU, ${prim.category})`);
        }
      } catch (err) {
        failed++;
        console.error(`  ✗ ${prim.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

  console.log("");
  console.log("=".repeat(70));
  console.log(`Migration complete:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Total:    ${BU_MARKET_PRIMITIVES.length}`);
  console.log("=".repeat(70));

  // Verify
  const count = await sql`SELECT COUNT(*) as count FROM primitives WHERE user_id IS NULL`;
  console.log(`\nCore library primitives (user_id IS NULL): ${count[0]?.["count"] ?? 0}`);

  if (failed > 0) {
    process.exit(1);
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});