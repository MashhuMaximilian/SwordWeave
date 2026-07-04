/**
 * verify-migration.ts - End-to-end test: compile migrated data through engine
 *
 * Usage:
 *   npx tsx scripts/verify-migration.ts
 *
 * This script:
 *   1. Loads all primitives from the DB
 *   2. Loads all Blueprint Ledger capabilities from the DB
 *   3. Builds CapabilityAssembly for each
 *   4. Runs the engine's compileCapability
 *   5. Verifies the totals match the Notion totals
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { compileCapability, type CapabilityAssembly } from "../src/lib/engine/capabilities";
import type {
  Primitive,
  PrimitiveReference,
  HardModifier,
  Effect,
  Capability,
  CapabilityType,
  SourceType,
} from "../src/types/swordweave";

config({ path: ".env.local" });

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const sql = neon(process.env["DATABASE_URL"]);

interface DbPrimitive {
  id: number;
  name: string;
  category: string;
  bu_cost: number;
  hard_modifiers: HardModifier[];
  is_mirrorable: boolean;
  mirror_bu_credit: number;
}

interface DbCapabilityPrimitive {
  capability_id: string;
  primitive_id: number;
  role: string;
  quantity: number;
  sort_order: number;
  slot_label: string | null;
}

interface DbCapability {
  id: string;
  name: string;
  type: string;
  source_type: string;
  verbose_description: string;
  metadata: { totalBu?: number; tier?: string };
}

async function main() {
  console.log("=".repeat(70));
  console.log("Migration Verification - Engine Compilation Against DB");
  console.log("=".repeat(70));
  console.log("");

  // Load primitives
  const prims = (await sql`
    SELECT id, name, category, bu_cost, hard_modifiers, is_mirrorable, mirror_bu_credit
    FROM primitives
    WHERE user_id IS NULL
  `) as DbPrimitive[];

  console.log(`Loaded ${prims.length} core primitives from DB`);

  // Build primitive map (id -> Primitive)
  const primitivesById = new Map<string, Primitive>();
  for (const p of prims) {
    const prim: Primitive = {
      id: String(p.id),
      name: p.name,
      category: p.category.toLowerCase().replace(/_/g, "-") as Primitive["category"],
      buCost: p.bu_cost,
      hardModifiers: p.hard_modifiers ?? [],
    };
    primitivesById.set(String(p.id), prim);
  }

  // Load capabilities
  const caps = (await sql`
    SELECT id, name, type, source_type, verbose_description, metadata
    FROM capabilities
    WHERE source_origin = 'Blueprint Ledger (Notion)'
  `) as DbCapability[];

  console.log(`Loaded ${caps.length} Blueprint Ledger capabilities from DB`);
  console.log("");

  // Load capability_primitives links
  const links = (await sql`
    SELECT capability_id, primitive_id, role, quantity, sort_order, slot_label
    FROM capability_primitives
  `) as DbCapabilityPrimitive[];

  console.log(`Loaded ${links.length} capability-primitive links`);
  console.log("");
  console.log("Compiling capabilities through engine:");
  console.log("");

  let passed = 0;
  let failed = 0;
  let warnings = 0;
  const results: Array<{
    name: string;
    expectedBu: number;
    actualBu: number;
    delta: number;
    valid: boolean;
    warningCount: number;
  }> = [];

  for (const cap of caps) {
    const capLinks = links
      .filter((l) => l.capability_id === cap.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    // Group by role
    const verbReferences: PrimitiveReference[] = [];
    const domainReferences: PrimitiveReference[] = [];
    const structuralPrimitives: PrimitiveReference[] = [];
    const augmentPrimitives: PrimitiveReference[] = [];
    let rangePrimitive: PrimitiveReference | null = null;
    let targetingPrimitive: PrimitiveReference | null = null;
    let durationPrimitive: PrimitiveReference | null = null;
    let outputPrimitive: PrimitiveReference | null = null;
    let sizingPrimitive: PrimitiveReference | null = null;

    for (const link of capLinks) {
      const ref: PrimitiveReference = {
        primitiveId: String(link.primitive_id),
        quantity: link.quantity,
        ...(link.slot_label ? { label: link.slot_label } : {}),
      };

      switch (link.role) {
        case "VERB":
          verbReferences.push(ref);
          break;
        case "DOMAIN":
          domainReferences.push(ref);
          break;
        case "RANGE":
          rangePrimitive = ref;
          break;
        case "DURATION":
          durationPrimitive = ref;
          break;
        case "OUTPUT":
          outputPrimitive = ref;
          break;
        case "SIZING":
          sizingPrimitive = ref;
          break;
        case "AUGMENT":
          augmentPrimitives.push(ref);
          break;
        default:
          structuralPrimitives.push(ref);
      }
    }

    const assembly: CapabilityAssembly = {
      id: cap.id,
      name: cap.name,
      type: cap.type.toLowerCase() as CapabilityType,
      sourceType: cap.source_type.toLowerCase() as SourceType,
      verboseDescription: cap.verbose_description,
      verbReferences,
      domainReferences,
      effectReferences: [],
      rangePrimitive,
      targetingPrimitive,
      durationPrimitive,
      outputPrimitive,
      sizingPrimitive,
      structuralPrimitives,
      augmentPrimitives,
      primitivesById,
    };

    const result = compileCapability(assembly);
    const expectedBu = cap.metadata?.totalBu ?? 0;
    const delta = result.totalBu - expectedBu;
    const matches = Math.abs(delta) <= 4; // Tolerance: +/-4 BU (since migrated data is simplified)
    const isValid = result.validation.valid;
    const warningCount = result.validation.warnings.length;

    if (isValid) passed++;
    else failed++;
    if (warningCount > 0) warnings++;

    results.push({
      name: cap.name,
      expectedBu,
      actualBu: result.totalBu,
      delta,
      valid: isValid,
      warningCount,
    });

    const status = isValid ? "OK" : "X";
    const matchStatus = matches ? "~" : "X";
    console.log(
      `  ${status} ${cap.name.padEnd(42)} ${matchStatus} expected=${expectedBu.toString().padStart(3)} actual=${result.totalBu.toString().padStart(3)} delta=${delta >= 0 ? "+" : ""}${delta}`,
    );
    if (warningCount > 0) {
      console.log(`     (${warningCount} warning${warningCount === 1 ? "" : "s"})`);
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log(`Verification summary:`);
  console.log(`  Valid (compile succeeded):   ${passed}`);
  console.log(`  Invalid (compile failed):    ${failed}`);
  console.log(`  With warnings:               ${warnings}`);
  console.log("");

  // Distribution of deltas
  const deltas = results.map((r) => Math.abs(r.delta));
  const exactMatches = deltas.filter((d) => d === 0).length;
  const closeMatches = deltas.filter((d) => d > 0 && d <= 4).length;
  const offMatches = deltas.filter((d) => d > 4).length;
  console.log(`  Exact BU match (delta=0):    ${exactMatches}`);
  console.log(`  Close BU match (0<delta<=4): ${closeMatches}`);
  console.log(`  Off BU match (delta>4):      ${offMatches}`);
  console.log(`  Note: +/-4 BU tolerance accounts for simplified migration`);
  console.log(`        (Notion has fine-grained primitives not yet migrated)`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});