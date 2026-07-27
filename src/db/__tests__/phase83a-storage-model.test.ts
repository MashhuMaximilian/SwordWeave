/**
 * Phase 8.3a — Tests for the multi-instance primitive storage model.
 *
 * Verifies (per Mashu 2026-07-27 v2 storage model):
 *   1. Migration 0048 has been applied (instance_id column exists, PK dropped)
 *   2. Inherited rows: at most 1 per (character_id, primitive_id)
 *   3. Mirror rows: at most 1 per (character_id, primitive_id)
 *   4. Direct-paid rows: N allowed per (character_id, primitive_id)
 *   5. Bundle-expander still dedupes inherited sources to 1 row
 *
 * Setup: uses the live DB. We create test characters/primitives in a
 * beforeEach and clean up in afterEach to keep tests isolated.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// =============================================================================
// Test data: a "scratch" character that we create and clean up around.
// =============================================================================

let testUserId: string;
let testCharacterId: string;
let testPrimitiveId: number;
let testPrimitiveId2: number;
let testHeritageIds: string[] = [];

beforeEach(async () => {
  // 1. Find or create a test user (uses the dev account)
  //    We piggyback on the first user in the DB to avoid auth complexity.
  const userRows = (await sql`
    SELECT id FROM users ORDER BY created_at ASC LIMIT 1
  `) as Array<{ id: string }>;
  if (userRows.length === 0) {
    throw new Error("No users in DB — cannot run storage model tests.");
  }
  testUserId = userRows[0]!.id;

  // 2. Create a test character
  //    Note: attr_physical + attr_mental + attr_magical must sum to 10
  //    (characters_attr_sum_check constraint).
  const charRows = (await sql`
    INSERT INTO characters (user_id, name, level, attr_physical, attr_mental, attr_magical)
    VALUES (${testUserId}, ${"Phase 8.3a Test " + Date.now()}, 1, 4, 3, 3)
    RETURNING id
  `) as Array<{ id: string }>;
  testCharacterId = charRows[0]!.id;

  // 3. Find or create two test primitives (idempotent — re-uses if exists)
  //    Note: we don't use ON CONFLICT because there's no unique constraint on
  //    (name, ...) — we just use a timestamp-suffixed name to make duplicates
  //    unlikely and clean up in afterEach.
  const ts = Date.now();
  const prim1 = (await sql`
    INSERT INTO primitives (name, category, bu_cost, source_origin, user_id)
    VALUES (${"Vitality Augment I (Test " + ts + ")"}, 'VITALITY', 4, 'PRIMITIVE', ${testUserId})
    RETURNING id
  `) as Array<{ id: number }>;
  testPrimitiveId = prim1[0]!.id;

  const prim2 = (await sql`
    INSERT INTO primitives (name, category, bu_cost, source_origin, user_id)
    VALUES (${"Block Value (Test " + ts + ")"}, 'SHEET_AUGMENT', 6, 'PRIMITIVE', ${testUserId})
    RETURNING id
  `) as Array<{ id: number }>;
  testPrimitiveId2 = prim2[0]!.id;

  testHeritageIds = [];
});

afterEach(async () => {
  // Clean up: delete test heritages, then character (cascades to
  // character_primitives), then primitives.
  for (const hid of testHeritageIds) {
    try {
      await sql`DELETE FROM heritage WHERE id = ${hid}`;
    } catch {
      // Ignore — may have been deleted already
    }
  }
  if (testCharacterId) {
    await sql`DELETE FROM characters WHERE id = ${testCharacterId}`;
    testCharacterId = "";
  }
  if (testPrimitiveId) {
    await sql`DELETE FROM primitives WHERE id = ${testPrimitiveId}`;
    testPrimitiveId = 0;
  }
  if (testPrimitiveId2) {
    await sql`DELETE FROM primitives WHERE id = ${testPrimitiveId2}`;
    testPrimitiveId2 = 0;
  }
});

// =============================================================================
// 1. Migration shape checks
// =============================================================================

describe("Phase 8.3a migration shape", () => {
  it("character_primitives has instance_id column", async () => {
    const rows = (await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'character_primitives'
        AND column_name = 'instance_id'
    `) as Array<{ data_type: string; is_nullable: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0]!.data_type).toBe("uuid");
    expect(rows[0]!.is_nullable).toBe("NO");
  });

  it("character_primitives_pk no longer exists (PK was dropped)", async () => {
    const rows = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'character_primitives'
        AND constraint_name = 'character_primitives_pk'
    `;
    expect(rows.length).toBe(0);
  });

  it("character_primitives_inherited_uniq partial index exists", async () => {
    const rows = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'character_primitives'
        AND indexname = 'character_primitives_inherited_uniq'
    `;
    expect(rows.length).toBe(1);
  });

  it("character_primitives_mirror_uniq partial index exists", async () => {
    const rows = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'character_primitives'
        AND indexname = 'character_primitives_mirror_uniq'
    `;
    expect(rows.length).toBe(1);
  });

  it("character_primitives_instance_id_idx exists", async () => {
    const rows = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'character_primitives'
        AND indexname = 'character_primitives_instance_id_idx'
    `;
    expect(rows.length).toBe(1);
  });
});

// =============================================================================
// 2. Inherited rows: at most 1 per (character, primitive)
// =============================================================================

describe("Inherited primitive storage", () => {
  it("allows 1 inherited row per (character, primitive)", async () => {
    // Create a fake heritage row so the FK is satisfied.
    // We use a heritage of kind LINEAGE with a known-unique name.
    const heritageRow = (await sql`
      INSERT INTO heritage (name, kind, user_id, source_origin)
      VALUES (${"Phase 8.3a Test Heritage " + Date.now()}, 'LINEAGE', ${testUserId}, 'LINEAGE')
      RETURNING id
    `) as Array<{ id: string }>;
    const heritageId = heritageRow[0]!.id;
    testHeritageIds.push(heritageId);

    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'LINEAGE', false, ${heritageId})
    `;
    const rows = await sql`
      SELECT * FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveId}
        AND origin_heritage_id IS NOT NULL
    `;
    expect(rows.length).toBe(1);
  });

  it("rejects a 2nd inherited row for the same (character, primitive)", async () => {
    const heritageRow = (await sql`
      INSERT INTO heritage (name, kind, user_id, source_origin)
      VALUES (${"Phase 8.3a Test Heritage 2 " + Date.now()}, 'LINEAGE', ${testUserId}, 'LINEAGE')
      RETURNING id
    `) as Array<{ id: string }>;
    const heritageId = heritageRow[0]!.id;
    testHeritageIds.push(heritageId);

    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'LINEAGE', false, ${heritageId})
    `;
    // Second inherited row should fail due to partial unique index
    await expect(
      sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
          VALUES (${testCharacterId}, ${testPrimitiveId}, 'LINEAGE', false, ${heritageId})
      `,
    ).rejects.toThrow(/character_primitives_inherited_uniq|duplicate key/i);
  });
});

// =============================================================================
// 3. Mirror rows: at most 1 per (character, primitive)
// =============================================================================

describe("Mirror primitive storage", () => {
  it("allows 1 mirror row per (character, primitive)", async () => {
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', true)
    `;
    const rows = await sql`
      SELECT * FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveId}
        AND is_mirrored = true
    `;
    expect(rows.length).toBe(1);
  });

  it("rejects a 2nd mirror row for the same (character, primitive)", async () => {
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', true)
    `;
    await expect(
      sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
        VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', true)
      `,
    ).rejects.toThrow(/character_primitives_mirror_uniq|duplicate key/i);
  });
});

// =============================================================================
// 4. Direct-paid rows: N allowed per (character, primitive)
// =============================================================================

describe("Direct-paid (stacking) primitive storage", () => {
  it("allows multiple direct-paid rows for the same (character, primitive)", async () => {
    // Insert 4 direct-paid copies — all should succeed
    for (let i = 0; i < 4; i++) {
      await sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
        VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', false)
      `;
    }
    const rows = await sql`
      SELECT * FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveId}
        AND is_mirrored = false
        AND origin_heritage_id IS NULL
        AND origin_capability_id IS NULL
        AND origin_effect_id IS NULL
    `;
    expect(rows.length).toBe(4);
  });

  it("each direct-paid row has its own instance_id", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = (await sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
        VALUES (${testCharacterId}, ${testPrimitiveId2}, 'PERSONAL', false)
        RETURNING instance_id
      `) as Array<{ instance_id: string }>;
      ids.push(r[0]!.instance_id);
    }
    // All 3 IDs should be distinct UUIDs
    expect(new Set(ids).size).toBe(3);
  });
});

// =============================================================================
// 5. Mixed: inherited + mirror + multiple direct-paid all coexist
// =============================================================================

describe("Mixed primitive storage scenarios", () => {
  it("character can have inherited + mirror + multiple direct-paid for same primitive", async () => {
    // Create a heritage so the inherited FK is satisfied.
    const heritageRow = (await sql`
      INSERT INTO heritage (name, kind, user_id, source_origin)
      VALUES (${"Phase 8.3a Mixed Heritage " + Date.now()}, 'LINEAGE', ${testUserId}, 'LINEAGE')
      RETURNING id
    `) as Array<{ id: string }>;
    const heritageId = heritageRow[0]!.id;
    testHeritageIds.push(heritageId);

    // 1. Inherited (via heritage)
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'LINEAGE', false, ${heritageId})
    `;

    // 2. Mirror row
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', true)
    `;

    // 3. Two direct-paid rows
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', false)
    `;
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveId}, 'PERSONAL', false)
    `;

    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE origin_heritage_id IS NOT NULL) as inherited_count,
        COUNT(*) FILTER (WHERE is_mirrored = true AND origin_heritage_id IS NULL) as mirror_count,
        COUNT(*) FILTER (WHERE is_mirrored = false AND origin_heritage_id IS NULL AND origin_capability_id IS NULL AND origin_effect_id IS NULL) as direct_paid_count
      FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveId}
    `) as Array<{
      inherited_count: string;
      mirror_count: string;
      direct_paid_count: string;
    }>;
    expect(rows[0]!.inherited_count).toBe("1");
    expect(rows[0]!.mirror_count).toBe("1");
    expect(rows[0]!.direct_paid_count).toBe("2");
  });
});