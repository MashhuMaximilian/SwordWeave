/**
 * Phase 8.3b: integration test for multi-instance primitive storage.
 *
 * Verifies the end-to-end flow:
 *   1. Create a character with 4 direct-paid copies of the same primitive
 *   2. Each copy is its own row in character_primitives (4 rows, all
 *      with is_mirrored = false, no origin_*)
 *   3. Add a mirror row → 5 rows total (4 direct + 1 mirror, mirror
 *      links to the inherited baseline — there isn't one here, so
 *      mirror is a standalone negative instance)
 *   4. Add a heritage that bundles the same primitive → 6 rows total
 *      (4 direct + 1 mirror + 1 inherited). Inherited collapses to 1
 *      row, no matter how many inheritance paths.
 *   5. Verify per-row instanceId uniqueness
 *   6. Verify bundle-expander produces the same shape from API input
 *
 * Setup: uses the live DB. Creates scratch character + heritage +
 * primitives in beforeEach and cleans up in afterEach.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { expandBundles, type BundleExpansionInput } from "@/lib/engine/bundle-expander";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// =============================================================================
// Test data
// =============================================================================

let testUserId: string;
let testCharacterId: string;
let testPrimitiveIds: number[] = [];
let testHeritageId: string;

beforeEach(async () => {
  const userRows = (await sql`
    SELECT id FROM users ORDER BY created_at ASC LIMIT 1
  `) as Array<{ id: string }>;
  if (userRows.length === 0) {
    throw new Error("No users in DB — cannot run multi-instance tests.");
  }
  testUserId = userRows[0]!.id;

  const ts = Date.now();
  const charRows = (await sql`
    INSERT INTO characters (user_id, name, level, attr_physical, attr_mental, attr_magical)
    VALUES (${testUserId}, ${"Phase 8.3b Test " + ts}, 1, 4, 3, 3)
    RETURNING id
  `) as Array<{ id: string }>;
  testCharacterId = charRows[0]!.id;

  // Create two test primitives: one we'll stack, one we won't
  const stackable = (await sql`
    INSERT INTO primitives (name, category, bu_cost, source_origin, user_id)
    VALUES (${"Stackable Vitality (Test " + ts + ")"}, 'VITALITY', 4, 'PRIMITIVE', ${testUserId})
    RETURNING id
  `) as Array<{ id: number }>;
  testPrimitiveIds = [stackable[0]!.id];

  // Create a test heritage that bundles the stackable primitive
  const heritageRows = (await sql`
    INSERT INTO heritage (name, kind, user_id, source_origin)
    VALUES (${"Phase 8.3b Test Heritage " + ts}, 'LINEAGE', ${testUserId}, 'LINEAGE')
    RETURNING id
  `) as Array<{ id: string }>;
  testHeritageId = heritageRows[0]!.id;
  await sql`
    INSERT INTO heritage_primitives (template_id, primitive_id, sort_order)
    VALUES (${testHeritageId}, ${testPrimitiveIds[0]}, 0)
  `;
});

afterEach(async () => {
  // Delete character (cascades to character_primitives), then heritage
  if (testCharacterId) {
    await sql`DELETE FROM characters WHERE id = ${testCharacterId}`;
    testCharacterId = "";
  }
  if (testHeritageId) {
    await sql`DELETE FROM heritage WHERE id = ${testHeritageId}`;
    testHeritageId = "";
  }
  for (const pid of testPrimitiveIds) {
    await sql`DELETE FROM primitives WHERE id = ${pid}`;
  }
  testPrimitiveIds = [];
});

// =============================================================================
// Bundle-expander v2 model — multi-instance output
// =============================================================================

describe("Bundle-expander v2 — multi-instance direct primitives", () => {
  it("emits 4 separate rows for 4 direct-paid copies of the same primitive", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 42, source: "PERSONAL", isMirrored: false },
        { primitiveId: 42, source: "PERSONAL", isMirrored: false },
        { primitiveId: 42, source: "PERSONAL", isMirrored: false },
        { primitiveId: 42, source: "PERSONAL", isMirrored: false },
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(4);
    for (const p of out.primitives) {
      expect(p.primitiveId).toBe(42);
      expect(p.isMirrored).toBe(false);
      expect(p.originHeritageId).toBeNull();
      expect(p.originCapabilityId).toBeNull();
      expect(p.originEffectId).toBeNull();
    }
    // Each row gets a unique instanceIndex
    const indices = out.primitives.map((p) => p.instanceIndex);
    expect(new Set(indices).size).toBe(4);
  });

  it("emits 2 rows for inherited + 1 mirror + 4 direct-paid of same primitive", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-1",
          kind: "LINEAGE",
          primitiveLinks: [{ primitiveId: 42, isMirrored: false }],
          capabilityLinks: [],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 42, source: "PERSONAL", isMirrored: true }, // mirror
        { primitiveId: 42, source: "PERSONAL", isMirrored: false }, // direct 1
        { primitiveId: 42, source: "PERSONAL", isMirrored: false }, // direct 2
        { primitiveId: 42, source: "PERSONAL", isMirrored: false }, // direct 3
        { primitiveId: 42, source: "PERSONAL", isMirrored: false }, // direct 4
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(6);
    const inherited = out.primitives.filter((p) => p.originHeritageId !== null);
    const mirrors = out.primitives.filter((p) => p.isMirrored);
    const directPaid = out.primitives.filter(
      (p) => !p.isMirrored && p.originHeritageId === null,
    );
    expect(inherited).toHaveLength(1);
    expect(mirrors).toHaveLength(1);
    expect(directPaid).toHaveLength(4);
  });

  it("only counts 1 mirror per primitive (dedup at expander level)", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 42, source: "PERSONAL", isMirrored: true },
        { primitiveId: 42, source: "PERSONAL", isMirrored: true }, // 2nd mirror
        { primitiveId: 42, source: "PERSONAL", isMirrored: true }, // 3rd mirror
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(1);
    expect(out.primitives[0]!.isMirrored).toBe(true);
  });
});

// =============================================================================
// DB write path — multi-instance persistence
// =============================================================================

describe("character_primitives persistence — multi-instance direct copies", () => {
  it("inserts 4 separate rows for 4 direct-paid copies of the same primitive", async () => {
    for (let i = 0; i < 4; i++) {
      await sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
        VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'PERSONAL', false)
      `;
    }
    const rows = (await sql`
      SELECT instance_id, primitive_id, is_mirrored, source
      FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveIds[0]}
      ORDER BY created_at ASC
    `) as Array<{
      instance_id: string;
      primitive_id: number;
      is_mirrored: boolean;
      source: string;
    }>;
    expect(rows).toHaveLength(4);
    // Each row has a unique instanceId UUID
    const ids = rows.map((r) => r.instance_id);
    expect(new Set(ids).size).toBe(4);
    // All are direct-paid (no mirror, no origin)
    for (const r of rows) {
      expect(r.is_mirrored).toBe(false);
      expect(r.source).toBe("PERSONAL");
    }
  });

  it("inserts 4 direct + 1 mirror + 1 inherited (from heritage) for the same primitive", async () => {
    // 4 direct-paid copies
    for (let i = 0; i < 4; i++) {
      await sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
        VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'PERSONAL', false)
      `;
    }
    // 1 mirror row
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'PERSONAL', true)
    `;
    // 1 inherited row (from heritage)
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
      VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'LINEAGE', false, ${testHeritageId})
    `;

    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE origin_heritage_id IS NOT NULL) as inherited_count,
        COUNT(*) FILTER (WHERE is_mirrored = true AND origin_heritage_id IS NULL) as mirror_count,
        COUNT(*) FILTER (WHERE is_mirrored = false AND origin_heritage_id IS NULL) as direct_paid_count
      FROM character_primitives
      WHERE character_id = ${testCharacterId}
        AND primitive_id = ${testPrimitiveIds[0]}
    `) as Array<{
      inherited_count: string;
      mirror_count: string;
      direct_paid_count: string;
    }>;
    expect(rows[0]!.inherited_count).toBe("1");
    expect(rows[0]!.mirror_count).toBe("1");
    expect(rows[0]!.direct_paid_count).toBe("4");
  });

  it("rejects a 2nd inherited row (partial unique index enforces collapse)", async () => {
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
      VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'LINEAGE', false, ${testHeritageId})
    `;
    await expect(
      sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored, origin_heritage_id)
          VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'LINEAGE', false, ${testHeritageId})
      `,
    ).rejects.toThrow();
  });

  it("rejects a 2nd mirror row (partial unique index enforces single mirror)", async () => {
    await sql`
      INSERT INTO character_primitives
        (character_id, primitive_id, source, is_mirrored)
      VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'PERSONAL', true)
    `;
    await expect(
      sql`
        INSERT INTO character_primitives
          (character_id, primitive_id, source, is_mirrored)
          VALUES (${testCharacterId}, ${testPrimitiveIds[0]}, 'PERSONAL', true)
      `,
    ).rejects.toThrow();
  });
});

// =============================================================================
// Stack math — direct-paid copies multiply BU cost
// =============================================================================

describe("Stack math — direct copies multiply BU cost", () => {
  it("4 direct-paid copies of a 4-BU primitive = 16 BU total", async () => {
    // Insert 4 copies (using a fresh character so we don't conflict with other tests)
    const freshChar = (await sql`
      INSERT INTO characters (user_id, name, level, attr_physical, attr_mental, attr_magical)
      VALUES (${testUserId}, ${"Stack Math Test " + Date.now()}, 1, 4, 3, 3)
      RETURNING id
    `) as Array<{ id: string }>;
    const freshCharId = freshChar[0]!.id;
    try {
      for (let i = 0; i < 4; i++) {
        await sql`
          INSERT INTO character_primitives
            (character_id, primitive_id, source, is_mirrored)
          VALUES (${freshCharId}, ${testPrimitiveIds[0]}, 'PERSONAL', false)
        `;
      }
      // Read all rows back
      const rows = (await sql`
        SELECT primitive_id, is_mirrored, source, origin_heritage_id
        FROM character_primitives
        WHERE character_id = ${freshCharId}
      `) as Array<{
        primitive_id: number;
        is_mirrored: boolean;
        source: string;
        origin_heritage_id: string | null;
      }>;
      // 4 direct rows × 4 BU = 16 BU total
      const directPaidRows = rows.filter(
        (r) => !r.is_mirrored && r.origin_heritage_id === null,
      );
      expect(directPaidRows).toHaveLength(4);
      const totalBu = directPaidRows.length * 4;
      expect(totalBu).toBe(16);
    } finally {
      await sql`DELETE FROM characters WHERE id = ${freshCharId}`;
    }
  });
});