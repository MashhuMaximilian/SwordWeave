/**
 * migrate-capabilities.ts — Seed compiled capabilities from Blueprint Ledger
 *
 * Usage:
 *   npm run db:migrate-capabilities
 *
 * Reads from data/capability-library.ts (extracted from Notion's Blueprint
 * Ledger page 38eed8479ccd80909bc1d206ed4afe8a).
 *
 * For each capability:
 *   1. Create the capability record (or update if exists by name+source_origin)
 *   2. Look up primitive IDs by name+category from the primitives table
 *   3. Create capability_primitives join rows
 *
 * Safe to run multiple times (idempotent).
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { CAPABILITY_LIBRARY, CAPABILITY_LIBRARY_META } from "../data/capability-library";

config({ path: ".env.local" });

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const sql = neon(process.env["DATABASE_URL"]);

const SOURCE_ORIGIN = "Blueprint Ledger (Notion)";

async function migrate() {
  console.log("=".repeat(70));
  console.log("Capability Library Migration");
  console.log("=".repeat(70));
  console.log(`Source: ${CAPABILITY_LIBRARY_META.sourcePageTitle}`);
  console.log(`Source ID: ${CAPABILITY_LIBRARY_META.sourcePageId}`);
  console.log(`Capabilities to seed: ${CAPABILITY_LIBRARY_META.totalCapabilities}`);
  console.log(`  Part 1 (Level I):    ${CAPABILITY_LIBRARY_META.part1Count}`);
  console.log(`  Part 2 (Level II):   ${CAPABILITY_LIBRARY_META.part2Count}`);
  console.log(`  Part 3 (Level III):  ${CAPABILITY_LIBRARY_META.part3Count}`);
  console.log("");

  let capabilitiesInserted = 0;
  let capabilitiesUpdated = 0;
  let primitivesLinked = 0;
  let primitivesFailed = 0;

  for (const cap of CAPABILITY_LIBRARY) {
    // Find or create capability
    const existing = await sql`
      SELECT id FROM capabilities
      WHERE name = ${cap.name} AND source_origin = ${SOURCE_ORIGIN}
      LIMIT 1
    `;

    let capabilityId: string;
    if (existing.length > 0 && existing[0]) {
      capabilityId = existing[0]["id"] as string;
      // Update verbose description
      await sql`
        UPDATE capabilities SET
          verbose_description = ${cap.verboseDescription},
          type = ${cap.type}::capability_type,
          source_type = ${cap.sourceType}::source_type,
          is_public = TRUE,
          metadata = ${JSON.stringify({ totalBu: cap.totalBu, tier: cap.tier })}::jsonb,
          updated_at = NOW()
        WHERE id = ${capabilityId}
      `;
      capabilitiesUpdated++;
      console.log(`  ~ ${cap.name} (${cap.totalBu} BU) — updated`);
    } else {
      const insertResult = await sql`
        INSERT INTO capabilities (
          name, type, source_type, verbose_description, is_public, source_origin,
          tags, metadata
        )
        VALUES (
          ${cap.name},
          ${cap.type}::capability_type,
          ${cap.sourceType}::source_type,
          ${cap.verboseDescription},
          TRUE,
          ${SOURCE_ORIGIN},
          ${[]}::text[],
          ${JSON.stringify({ totalBu: cap.totalBu, tier: cap.tier })}::jsonb
        )
        RETURNING id
      `;
      const row = insertResult[0];
      if (!row) {
        console.error(`  ✗ ${cap.name}: insert returned no row`);
        continue;
      }
      capabilityId = row["id"] as string;
      capabilitiesInserted++;
      console.log(`  + ${cap.name} (${cap.totalBu} BU) — created`);
    }

    // Delete existing primitive links for this capability (clean slate)
    await sql`DELETE FROM capability_primitives WHERE capability_id = ${capabilityId}`;

    // Link primitives
    for (let i = 0; i < cap.primitives.length; i++) {
      const primRef = cap.primitives[i];
      if (!primRef) continue;

      // Look up primitive by name + category (with NULL user_id)
      const primResult = await sql`
        SELECT id FROM primitives
        WHERE name = ${primRef.name}
          AND category = ${primRef.category}::primitive_category
          AND user_id IS NULL
        LIMIT 1
      `;

      if (primResult.length === 0) {
        console.warn(`    ⚠ Primitive not found: ${primRef.name} (${primRef.category})`);
        primitivesFailed++;
        continue;
      }

      const primId = primResult[0]?.["id"];
      if (!primId) {
        primitivesFailed++;
        continue;
      }

      try {
        await sql`
          INSERT INTO capability_primitives (
            capability_id, primitive_id, role, quantity, sort_order, slot_label
          )
          VALUES (
            ${capabilityId},
            ${primId},
            ${primRef.role}::capability_primitive_role,
            1,
            ${i},
            ${primRef.name}
          )
        `;
        primitivesLinked++;
      } catch (err) {
        // Likely a duplicate (capability_id, primitive_id, role) — update instead
        await sql`
          UPDATE capability_primitives SET
            quantity = 1,
            sort_order = ${i},
            slot_label = ${primRef.name}
          WHERE capability_id = ${capabilityId}
            AND primitive_id = ${primId}
            AND role = ${primRef.role}::capability_primitive_role
        `;
        primitivesLinked++;
      }
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log(`Migration complete:`);
  console.log(`  Capabilities inserted: ${capabilitiesInserted}`);
  console.log(`  Capabilities updated:  ${capabilitiesUpdated}`);
  console.log(`  Primitives linked:     ${primitivesLinked}`);
  console.log(`  Primitives failed:     ${primitivesFailed}`);
  console.log("=".repeat(70));

  // Verify
  const capCount = await sql`
    SELECT COUNT(*) as count FROM capabilities WHERE source_origin = ${SOURCE_ORIGIN}
  `;
  console.log(`\nCapabilities with source_origin='${SOURCE_ORIGIN}': ${capCount[0]?.["count"] ?? 0}`);

  const linkCount = await sql`
    SELECT COUNT(*) as count FROM capability_primitives cp
    INNER JOIN capabilities c ON cp.capability_id = c.id
    WHERE c.source_origin = ${SOURCE_ORIGIN}
  `;
  console.log(`Primitive links for those capabilities: ${linkCount[0]?.["count"] ?? 0}`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});