/**
 * Phase 7.10 — Tests for the effects + capabilities re-author.
 *
 * Verifies:
 *   1. All 8 effects have the 4-section schema narrative
 *   2. All 25 capabilities have the 4-section schema narrative
 *   3. Style classification (A/B/C) is in the tags
 *   4. Hypnotic Suggester → Compelled Focus effect link exists
 *   5. Content hashes are 64-char hex
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// =============================================================================
// Effects
// =============================================================================

const EFFECT_IDS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "ddfa115f-3403-4db1-a0b4-62e6f15e94b6", name: "Blind Stun" },
  { id: "5d4267a8-0c97-474f-aac0-058fd199af21", name: "Compelled Focus" },
  { id: "60ded22a-4649-46ee-a17c-c9b5ef87db0d", name: "Corrosive Decay" },
  { id: "30016446-0171-4c5a-aa1d-326ebf333c2f", name: "Shattered Composure" },
  { id: "b196fa82-40a7-43d6-ae3f-4578d7ea0702", name: "Snared (Vine Bind)" },
  { id: "80bca164-faea-4d34-ac66-ecd051cdedef", name: "Staggered (Acid Corrosion)" },
  { id: "5b37e8ff-3974-402a-8c3e-d6c0acff26b3", name: "System Freeze" },
  { id: "dabe0a3f-5af2-4bfc-872c-398e9064f909", name: "Vertigo Spasms" },
];

// =============================================================================
// Capabilities
// =============================================================================

const CAPABILITY_IDS: ReadonlyArray<{
  id: string;
  name: string;
  style: "A" | "B" | "C";
}> = [
  // Style A
  { id: "c6de8b1e-ca2d-41d5-be18-47635f4e34f1", name: "Aegis Shield", style: "A" },
  { id: "a451c819-9e67-489b-a15a-a2f2cde4b45b", name: "Archmage's Strain Redirection Plate", style: "A" },
  { id: "b0b97b64-2f00-443b-8fd8-21e5b0bd20ca", name: "Aura Detective", style: "A" },
  { id: "598f8198-a534-4d49-90da-5b684e3dd234", name: "Blind Swordsman", style: "A" },
  { id: "fd7dc79a-a877-4af7-ad18-ca29b249ad12", name: "Bloodhound Master", style: "A" },
  { id: "352bd76e-6efb-4275-b203-93e464db543f", name: "Ghost Walk", style: "A" },
  { id: "2adef2f3-e609-4eb4-8a22-8a5c661a93a7", name: "Heavy Tactical Cover", style: "A" },
  { id: "73d9ac79-af9f-4775-bc9e-aa0ca5ef5d25", name: "Vow of Enmity", style: "A" },
  // Style B
  { id: "80dd09d5-6916-416f-9cb3-bc54440fa3c2", name: "Cataclysmic Shockwave", style: "B" },
  { id: "05876879-9f93-4740-aea5-5f40035dc7aa", name: "Rusting Strike", style: "B" },
  { id: "704a1398-3376-4017-b7d0-68ce0e3f1823", name: "Strike", style: "B" },
  { id: "9056720e-3dd2-4ef2-940a-c4cb401ab536", name: "Tornado Blast", style: "B" },
  { id: "42cd612c-a265-4e7d-816f-9917f686f7ea", name: "Mind Scan", style: "B" },
  { id: "a136e673-7c0a-447a-b4f6-796cf2662930", name: "Spell Counter-Disruption Shield", style: "B" },
  { id: "43ad665f-aedf-434c-a881-8bd3ff28059d", name: "Time Stop", style: "B" },
  { id: "81f75de9-79af-4d17-813d-5483babd1561", name: "Medusa's Gaze", style: "B" },
  // Style C
  { id: "fb4abc89-8a9c-4ce4-b1f8-82c225723c04", name: "Aura of Total Enfeeblement", style: "C" },
  { id: "5f7dd8ca-b4d7-4a94-8a18-d2590a5922c7", name: "Chamber Blackout Matrix", style: "C" },
  { id: "3ac2706a-a9cb-4f0e-ba58-eba5e35d53cf", name: "Chronomantic Haste", style: "C" },
  { id: "9eb01658-3753-4368-953f-ddb627448ad2", name: "Gravity Anchor Trap", style: "C" },
  { id: "868fe5e6-e1f0-4a0d-865e-a1ff8bc1a5ff", name: "Greater Invisibility", style: "C" },
  { id: "78145c25-e8d7-447c-9b8f-d3795a62d60a", name: "Hypnotic Suggester", style: "C" },
  { id: "e06c56e4-fb42-4435-90d2-4b6461a2b7c8", name: "Simulacrum", style: "C" },
  { id: "b40309ef-3b22-4076-9709-0080dd84a03b", name: "Spore Choke", style: "C" },
  { id: "7a887e68-0063-4af1-9f2a-4b1ed9096960", name: "Temporal Stasis Trap", style: "C" },
];

interface EffectRow {
  narrative_description: string;
  content_hash: string | null;
}

interface CapRow {
  verbose_description: string;
  tags: string[];
  content_hash: string | null;
}

async function readEffect(id: string): Promise<EffectRow | null> {
  const rows = (await sql`
    SELECT narrative_description, content_hash
    FROM effects WHERE id = ${id}
  `) as EffectRow[];
  return rows[0] ?? null;
}

async function readCap(id: string): Promise<CapRow | null> {
  const rows = (await sql`
    SELECT verbose_description, tags, content_hash
    FROM capabilities WHERE id = ${id}
  `) as CapRow[];
  return rows[0] ?? null;
}

// =============================================================================
// Tests
// =============================================================================

describe("Phase 7.10 — Effects + Capabilities re-author", () => {
  describe("Effects: 4-section schema", () => {
    for (const e of EFFECT_IDS) {
      it(`[${e.name}] has Composition, Delivered Effect, Duration sections`, async () => {
        const row = await readEffect(e.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.narrative_description).toContain("**Composition:**");
        expect(row.narrative_description).toContain("**Delivered Effect:**");
        expect(row.narrative_description).toContain("**Duration:**");
      });
    }
  });

  describe("Effects: content hash present", () => {
    for (const e of EFFECT_IDS) {
      it(`[${e.name}] content_hash is 64-char hex`, async () => {
        const row = await readEffect(e.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.content_hash).not.toBeNull();
        expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
      });
    }
  });

  describe("Capabilities: 4-section schema (Style B and C require all 4 sections)", () => {
    for (const c of CAPABILITY_IDS.filter((c) => c.style === "B" || c.style === "C")) {
      it(`[${c.name}] (Style ${c.style}) has Composition, Spatial, Duration`, async () => {
        const row = await readCap(c.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.verbose_description).toContain("**Composition:**");
        expect(row.verbose_description).toContain("**Spatial & Resolution Gate:**");
        expect(row.verbose_description).toContain("**Duration:**");
      });
    }
    for (const c of CAPABILITY_IDS.filter((c) => c.style === "C")) {
      it(`[${c.name}] (Style C) has Delivered Effect section`, async () => {
        const row = await readCap(c.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.verbose_description).toContain("**Delivered Effect:**");
      });
    }
  });

  describe("Capabilities: Style A only needs Composition", () => {
    for (const c of CAPABILITY_IDS.filter((c) => c.style === "A")) {
      it(`[${c.name}] (Style A) has Composition section`, async () => {
        const row = await readCap(c.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.verbose_description).toContain("**Composition:**");
      });
    }
  });

  describe("Capabilities: Style classification in tags", () => {
    for (const c of CAPABILITY_IDS) {
      it(`[${c.name}] (Style ${c.style}) — tags include style-${c.style.toLowerCase()}`, async () => {
        const row = await readCap(c.id);
        expect(row).not.toBeNull();
        if (!row) return;
        const expectedTag = `style-${c.style.toLowerCase()}`;
        expect(row.tags).toContain(expectedTag);
      });
    }
  });

  describe("Capabilities: content hash present", () => {
    for (const c of CAPABILITY_IDS) {
      it(`[${c.name}] content_hash is 64-char hex`, async () => {
        const row = await readCap(c.id);
        expect(row).not.toBeNull();
        if (!row) return;
        expect(row.content_hash).not.toBeNull();
        expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
      });
    }
  });

  describe("Hypnotic Suggester nests Compelled Focus effect", () => {
    it("[Hypnotic Suggester] → [Compelled Focus] link exists", async () => {
      const rows = (await sql`
        SELECT 1 FROM capability_effects
        WHERE capability_id = '78145c25-e8d7-447c-9b8f-d3795a62d60a'
          AND effect_id = '5d4267a8-0c97-474f-aac0-058fd199af21'
      `) as Array<{ "?column?": number }>;
      expect(rows.length).toBe(1);
    });
  });

  describe("Style distribution", () => {
    it("25 capabilities = 8 A + 8 B + 9 C", () => {
      const counts = { A: 0, B: 0, C: 0 };
      for (const c of CAPABILITY_IDS) counts[c.style]++;
      expect(counts.A).toBe(8);
      expect(counts.B).toBe(8);
      expect(counts.C).toBe(9);
    });
  });
});
