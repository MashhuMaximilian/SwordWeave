/**
 * Cross-check DB against the BU Market Notion canonical (139 named rows).
 * Outputs three lists: in-both, only-in-notion, only-in-db.
 *
 * Notion canonical names are hardcoded below (extracted from page
 * 37eed8479ccd8155b917c373194dbdf4). Update this list whenever the
 * Notion page changes — re-running this script verifies DB is in sync.
 *
 * Run: pnpm exec tsx scripts/_diff-notion-vs-db.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");

const sql = neon(url);

// CANONICAL — sourced from the BU Market Notion page.
// Keep in sync with the Notion page. To regenerate: extract the markdown
// and list every primitive row (skip the empty Universal Modifier Market
// template-tables — those are scope layers, not primitives).
const NOTION_CANONICAL: ReadonlyArray<string> = [
  // Vitality
  "Vitality Core Augment I", "Vitality Core Augment II", "Vitality Core Augment III",
  // Global DC/Attack
  "Focused Presence (Global DC Modifier)", "Precise Vector Alignment (Global Attack Modifier)",
  // Verbs
  "Verb Access Tier I", "Verb Access Tier II", "Verb Access Tier III", "Verb Access Tier IV",
  // Domains
  "Domain Access Tier I", "Domain Access Tier II", "Domain Access Tier III", "Domain Access Tier IV",
  // Structure
  "Structure Tier I", "Structure Tier II", "Structure Tier III", "Structure Tier IV",
  // Range
  "Close Range", "Near Range", "Far Range", "Very Far Range", "Extreme Range", "Touch Range", "World Range",
  // Speed/Quickening
  "Standard Execution", "Fast Execution", "Instant Execution", "Reaction Execution",
  // Duration
  "Instant Duration", "Short Duration", "Medium Duration", "Long Duration", "Persistent Duration", "Permanent Duration",
  // Semantic State Tags
  "Physical Interaction Tag", "Sensory & Physiological Tag", "Cognitive & Agency Tag", "System & Identity Tag",
  // Character Progression
  "Attribute Increment", "Attack Bonus Increment", "Defensive Save Upgrade",
  // Practice Progression
  "Broad Familiarity", "Focused Edge", "Practice Proficiency", "Expertise Upgrade", "Reliable Practice",
  // Probability Bias (kept as Positive/Negative split until Phase 8 chirality fix)
  "Positive Bias I — Narrative Focus", "Negative Bias I — Narrative Focus",
  "Positive Bias II — Named Practice", "Negative Bias II — Named Practice",
  "Positive Bias III — Core Attribute", "Negative Bias III — Core Attribute",
  "Causal Override (Fate Replacement)",
  // Trigger Hooks
  "Direct Material Trigger", "Systemic Threshold Trigger", "Conditional Informational Trigger", "Interceptive Causal Trigger",
  // Perception Qualifiers
  "Environmental Translation Qualifier", "Systemic Resonance Qualifier",
  "Non-Material Translation Qualifier", "Existential Clarity Qualifier",
  // Kinetic
  "Minor Linear Displacement", "Velocity Arrest / Standard Vector",
  "Advanced Vector Manipulation", "Systemic Kinetic Override",
  // Agency
  "Impulse Nudge / Point Transmission", "Behavioral Directive / Data Trace Masking",
  "Direct Executive Override / Matrix Redaction", "Existential Allegiance Bind / Informational Absolutism",
  // Metamorphosis
  "Composition Tuning", "Volumetric Scale Shift", "State Transmutation", "Polymorphic Template Overwrite",
  // Action Economy Alterations
  "Timeline Shift / Minor Window Grant", "Reactive Expansion (Guardian Vector)",
  "Core Action Multiplication (Haste Vector)", "Absolute Timeline Deprivation (Stun Vector)",
  // Track Adaptation
  "Track Acceleration", "Heavy Compactor", "Timeline Anchor",
  // Reaction Window
  "Reaction Pulse", "Reaction Reflex", "Clash Dominance", "Interceptive Priority",
  // Strain Mitigation
  "Heuristic Buffer", "Systemic Sink", "Volatile Vent",
  // Consequence Redirection
  "Vitality Shielding", "Condition Insulation", "Domain Lock Shield",
  "Hazard Transmutation", "Narrative Pivot", "CV Matrix Trap",
  // Temporal Ordering
  "Chronological Echo", "Dormant Trigger Hook", "Timeline Tether",
  "Duration Anchor", "Perpetual Lock", "Kinetic Stasis", "Temporal Isolate",
  // Sensory Arrays
  "Umbral Sight I (Darkvision 60ft)", "Substrate Echo (Tremorsense 30ft)",
  "Umbral Sight II (Darkvision 120ft)", "Tactile Echo (Blindsight 30ft)",
  // Mobility
  "Stride Extension", "Aquatic Unlock", "Subterranean Bore",
  "Aero Unlock", "Phase Slip", "Hover Precision",
  // Targeting Modifiers
  "Vector Split", "Bouncing Vector", "Collateral Buffer", "Selective Focus",
  // Sizing
  "Linear / Conical Vector", "Kinetic Sphere", "Stationary Zone", "Mobile Aura",
  "Structural Wall", "Volume Scaling I", "Global Field",
  // Defenses
  "Kinetic Hardening", "Warding Shell", "Psychic Firewall",
  "Reactive Bulwark", "Structural Hardening", "Universal Aegis", "Absolute Insulation",
  // Intensity
  "Minor Die Block", "Standard Die Block", "Heavy Die Block",
  "Impact Die Block", "Calamity Die Block", "Existential Tear",
  // Boss Economy
  "Legendary Cadence I", "Legendary Cadence II", "Legendary Cadence III",
  "Existential Imperative", "Mythic Safeguard",
];

async function main() {
  const dbRows = await sql`
    SELECT name, category::text as category
    FROM primitives WHERE user_id IS NULL
  `;
  const dbNames = new Set(dbRows.map((r) => r["name"]));
  const notionSet = new Set(NOTION_CANONICAL);

  const inBoth: string[] = [];
  const onlyInNotion: string[] = [];
  const onlyInDb: string[] = [];

  for (const n of NOTION_CANONICAL) {
    (dbNames.has(n) ? inBoth : onlyInNotion).push(n);
  }
  for (const r of dbRows) {
    if (!notionSet.has(r["name"])) {
      onlyInDb.push(`${r["name"]} (${r["category"]})`);
    }
  }

  console.log("=".repeat(70));
  console.log("Notion ↔ DB canonical primitive alignment");
  console.log("=".repeat(70));
  console.log(`Notion canonical rows:  ${NOTION_CANONICAL.length}`);
  console.log(`DB canonical rows:      ${dbRows.length}`);
  console.log(`In both:               ${inBoth.length}`);
  console.log(`Only in Notion:        ${onlyInNotion.length}`);
  console.log(`Only in DB:            ${onlyInDb.length}`);

  if (onlyInNotion.length) {
    console.log("\n----- Only in Notion (need INSERT) -----");
    for (const n of onlyInNotion) console.log(`  • ${n}`);
  }
  if (onlyInDb.length) {
    console.log("\n----- Only in DB (need review/remove) -----");
    for (const n of onlyInDb) console.log(`  • ${n}`);
  }
  if (!onlyInNotion.length && !onlyInDb.length) {
    console.log("\n✓ Aligned. DB matches Notion canonical.");
  }

  console.log("=".repeat(70));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
