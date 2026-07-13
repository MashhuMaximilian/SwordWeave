// =============================================================================
// backfill-icons.ts — propose icons for every existing entity, leave the
// actual icon state untouched.
//
// Phase 8 backfill. The user has 145 primitives + 25 capabilities +
// 8 effects + 16 templates + 5 items sitting in production without icons
// (the icon columns were added in 0027_icon_columns.sql and the deployed
// commit a097d2f, but no creator has used the picker yet). Without icons
// the library cards, browse grids, and previews all show the muted
// "kind" placeholder, which makes the new icon system look like it
// doesn't work.
//
// This script proposes a best-guess icon for every row and writes the
// proposal to the dedicated `icon_proposed_*` columns (added in
// 0028_icon_proposal_columns.sql). The committed icon state
// (`icon_source` etc.) is never touched here — a human review pass
// (Phase 8 follow-up) is what promotes proposals into committed state.
//
// Matching strategy, in priority order:
//   1. Name keyword → game-icons slug. We tokenize the entity name
//      + tags (if any), look each token up in a curated keyword
//      dictionary, and take the first match. The dictionary is
//      deliberately small (~100 entries) — it's a starting point, not
//      the final answer. The CSv report and review UI are how the
//      user filters out the misses.
//   2. Category default. If no name keyword matches, fall back to a
//      per-(entity-type, category) default icon. Less informative but
//      visually cohesive — every "Body" primitive gets the same body
//      glyph until the creator picks something better.
//   3. Generic placeholder. The last-resort icon is a neutral token
//      that signals "this needs human attention".
//
// Output: a CSV at scripts/output/icon-backfill-<timestamp>.csv with
//   type, id, name, category, current_icon, proposed_icon, source
// so a human can scan what was proposed before promoting.
//
// Idempotent: re-running overwrites only the `icon_proposed_*` columns
// (never the committed `icon_*` columns). A row that already has a
// committed icon keeps its icon and gets a fresh proposal written to
// the proposed columns for the next review pass; the user can decide
// to keep, accept, or skip.
//
// Run with:  pnpm tsx scripts/backfill-icons.ts

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  effects,
  capabilities,
} from "@/db/schema/engine";
import { items } from "@/db/schema/items";
import { templates } from "@/db/schema/characters";
import iconIndex from "@/lib/icons/game-icons-index.json";
// -----------------------------------------------------------------------------
// Keyword → game-icons slug dictionary
// -----------------------------------------------------------------------------
// Curated, deliberately small. Each entry: keyword (lowercased substring of
// the entity name) → game-icons.net key (`<author>/<slug>`). The match is
// first-keyword-wins, so put more specific words first when in doubt.

const KEYWORD_ICONS: Record<string, string> = {
  // Weapons & combat
  sword: "lorc/broadsword",
  blade: "lorc/plain-dagger",
  dagger: "lorc/plain-dagger",
  knife: "lorc/plain-dagger",
  axe: "lorc/battle-axe",
  hammer: "lorc/thunder-hammer",
  mace: "lorc/flanged-mace",
  spear: "lorc/spear-feather",
  lance: "lorc/spear-feather",
  pike: "lorc/spear-feather",
  bow: "lorc/pocket-bow",
  arrow: "lorc/arrow-flight",
  crossbow: "carl-olsen/crossbow",
  shield: "lorc/round-shield",
  armor: "skoll/trench-body-armor",
  gauntlet: "lorc/gauntlet",
  fist: "lorc/fist",
  punch: "lorc/fist",
  kick: "lorc/kick",
  strike: "lorc/sword-spade",
  slash: "lorc/sword-slice",
  thrust: "lorc/spear-feather",
  parry: "lorc/shield-bash",
  dodge: "lorc/dodging",
  block: "lorc/shield",
  guard: "lorc/shield",
  reflect: "lorc/reflected-light",
  absorb: "lorc/sponge",
  deflect: "lorc/deflect",

  // Magic & effects
  fire: "carl-olsen/flame",
  flame: "carl-olsen/flame",
  burn: "carl-olsen/flame",
  frost: "lorc/snowflake-2",
  ice: "lorc/ice-spear",
  cold: "lorc/snowflake-2",
  lightning: "willdabeast/chain-lightning",
  thunder: "lorc/thunder-hammer",
  shock: "lorc/electric",
  electric: "lorc/electric",
  poison: "lorc/poison-bottle",
  toxic: "lorc/poison-bottle",
  venom: "lorc/poison-bottle",
  heal: "lorc/health-normal",
  cure: "lorc/pill",
  potion: "starseeker/potion-of-madness",
  elixir: "lorc/pill",
  mana: "lorc/crystal-ball",
  magic: "lorc/sword-spell-book",
  arcane: "lorc/spark-spirit",
  mystic: "lorc/eye-shield",
  divine: "lorc/angel-outfit",
  holy: "lorc/angel-outfit",
  curse: "lorc/cursed-star",
  hex: "lorc/voodoo-doll",
  summon: "lorc/summon-zombies",
  raise: "skoll/raise-skeleton",
  resurrect: "lorc/resurrect",
  drain: "lorc/life-tap",
  shield_spell: "lorc/shield-bash",

  // Movement
  dash: "lorc/run",
  run: "lorc/run",
  sprint: "lorc/running-shoe",
  jump: "lorc/jump-across",
  leap: "lorc/jump-across",
  climb: "lorc/climbing",
  swim: "lorc/swim-fins",
  fly: "lorc/flying-fox",
  fall: "lorc/falling",
  teleport: "lorc/portal",
  blink: "lorc/portal",

  // Perception & mind
  vision: "lorc/eye-target",
  sight: "lorc/binoculars",
  see: "lorc/eye-target",
  see_invisible: "lorc/spyglass",
  hear: "lorc/ear",
  listen: "lorc/ear",
  smell: "lorc/nose",
  sense: "lorc/spyglass",
  detect: "lorc/eye-target",
  invisible: "lorc/invisible",
  stealth: "lorc/ninja-mask",
  hide: "lorc/ninja-mask",
  sneak: "lorc/ninja-mask",

  // Mind-affecting
  charm: "lorc/heart-eyes",
  fear: "lorc/scream",
  terrify: "lorc/scream",
  confuse: "lorc/dizzy-person",
  stun: "lorc/stunned",
  sleep: "lorc/sleepy",
  rage: "lorc/enrage",
  calm: "lorc/lotus",
  mind: "lorc/brain",
  thought: "lorc/brain",
  memory: "lorc/brain",

  // Body / physical
  body: "lorc/muscle-up",
  muscle: "lorc/muscle-up",
  strength: "lorc/muscle-up",
  vitality: "lorc/heart-plus",
  health: "lorc/heart-plus",
  stamina: "lorc/energy-drink",
  speed: "lorc/running-shoe",
  agility: "lorc/acrobatic",
  reflexes: "lorc/acrobatic",

  // Conditions
  blind: "lorc/blindfold",
  silence: "lorc/silenced",
  bleed: "lorc/bleeding-wound",
  wound: "lorc/bleeding-wound",
  stunned: "lorc/stunned",
  prone: "lorc/falling",
  grappled: "lorc/chains",
  bound: "lorc/chains",

  // Utility / generic
  light: "lorc/light-bulb",
  dark: "lorc/night-sky",
  shadow: "lorc/shadow-follower",
  weight: "lorc/weight",
  heavy: "lorc/weight",
  speed_general: "lorc/sprint",
  duration: "lorc/hourglass",
  range: "lorc/far-reach",
  area: "lorc/blast",
  aoe: "lorc/blast",
  cone: "lorc/blast",
  line: "lorc/line-arrows",
  burst: "lorc/blast",
  ray: "lorc/laser-blast",
  // Verb-tier fallbacks (lexicon categories)
  verb: "lorc/sword-spade",
  domain: "lorc/orb-wand",
  sizing: "lorc/resize",
  targeting: "lorc/target",
  range_cat: "lorc/far-reach",
  duration_cat: "lorc/hourglass",
  output: "lorc/gear-jump",
  condition_cat: "lorc/poison-bottle",
  defense: "lorc/shield-bash",
  structural: "lorc/portal",
};

// Per-(entity-type, category) defaults — second-priority fallbacks.
const CATEGORY_DEFAULTS: Record<string, Record<string, string>> = {
  primitive: {
    VERB_TIER: "lorc/sword-spade",
    DOMAIN: "lorc/orb-wand",
    SIZING: "lorc/resize",
    TARGETING: "lorc/target",
    RANGE: "lorc/far-reach",
    DURATION: "lorc/hourglass",
    OUTPUT: "lorc/gear-jump",
    CONDITION: "lorc/poison-bottle",
    DEFENSE: "lorc/shield-bash",
    STRUCTURAL: "lorc/portal",
    SHEET_AUGMENT: "lorc/cog",
    ITEM_AUGMENT: "lorc/anvil-impact",
  },
  effect: {
    // Effects have no first-class category; use generic by tag presence
    __default: "lorc/spark-spirit",
  },
  capability: {
    ACTIVE: "lorc/sword-spade",
    PASSIVE: "lorc/shield",
    REACTION: "lorc/sword-spade",
    AUGMENT: "lorc/cog",
  },
  template: {
    RACE: "lorc/elf-helmet",
    BACKGROUND: "lorc/scroll-quill",
    ARCHETYPE: "lorc/crowned-skull",
  },
  item: {
    WEAPON: "lorc/broadsword",
    ARMOR: "skoll/trench-body-armor",
    TRINKET: "lorc/gem-pendant",
    ARTIFACT: "lorc/orb-wand",
    CONSUMABLE: "starseeker/potion-of-madness",
  },
};

// Last-resort fallback when nothing else matches.
const GENERIC_ICON = "lorc/abstract-001";

// -----------------------------------------------------------------------------
// Build a label → key lookup from the index so we can also match against
// the icon's display label, not just the slug.
// -----------------------------------------------------------------------------
type IndexEntry = {
  key: string;
  author: string;
  slug: string;
  label: string;
  tags: string[];
  category: string;
};
const INDEX: IndexEntry[] = (iconIndex as { icons: IndexEntry[] }).icons;
const VALID_KEYS = new Set(INDEX.map((e) => e.key));

function isValidKey(key: string): boolean {
  return VALID_KEYS.has(key);
}

// -----------------------------------------------------------------------------
// Tokenize + match
// -----------------------------------------------------------------------------
function proposeIconForName(name: string, tags: string[] = []): string | null {
  const haystack = `${name} ${tags.join(" ")}`.toLowerCase();
  // Try each dictionary key as a substring. First match wins.
  for (const [keyword, iconKey] of Object.entries(KEYWORD_ICONS)) {
    // word-boundary check for short keywords (< 4 chars) to avoid
    // matching "ace" inside "peaceful", etc.
    if (keyword.length <= 3) {
      const re = new RegExp(`\\b${keyword}\\b`);
      if (re.test(haystack)) return iconKey;
    } else if (haystack.includes(keyword)) {
      return iconKey;
    }
  }
  return null;
}

function proposeIconForCategory(
  entityType: keyof typeof CATEGORY_DEFAULTS,
  category: string | null,
): string {
  const table = CATEGORY_DEFAULTS[entityType];
  if (!table) return GENERIC_ICON;
  if (category && table[category]) return table[category];
  return table["__default"] ?? GENERIC_ICON;
}

function proposeIcon(
  entityType: keyof typeof CATEGORY_DEFAULTS,
  name: string,
  category: string | null,
  tags: string[] = [],
): { key: string; source: string } {
  // Priority 1: name keyword match
  const nameMatch = proposeIconForName(name, tags);
  if (nameMatch && isValidKey(nameMatch)) {
    return { key: nameMatch, source: "name-keyword" };
  }
  // Priority 2: category default
  const catMatch = proposeIconForCategory(entityType, category);
  if (isValidKey(catMatch)) {
    return { key: catMatch, source: "category-default" };
  }
  // Priority 3: generic
  return { key: GENERIC_ICON, source: "generic-fallback" };
}

// -----------------------------------------------------------------------------
// Per-entity-type runner
// -----------------------------------------------------------------------------

type CsvRow = {
  type: string;
  id: string;
  name: string;
  category: string;
  current_icon: string;
  proposed_icon: string;
  proposed_color: string;
  source: string;
  has_committed_icon: boolean;
};

const PROPOSED_COLOR = "#ffffff";

async function backfillPrimitives(): Promise<CsvRow[]> {
  console.log("Reading primitives...");
  const rows = await db.select().from(primitives);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("primitive", r.name, r.category);
    await db
      .update(primitives)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: PROPOSED_COLOR,
      })
      .where(eq(primitives.id, r.id));
    out.push({
      type: "primitive",
      id: String(r.id),
      name: r.name,
      category: r.category,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: PROPOSED_COLOR,
      source: proposal.source,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
}

async function backfillEffects(): Promise<CsvRow[]> {
  console.log("Reading effects...");
  const rows = await db.select().from(effects);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("effect", r.name, null, r.tags ?? []);
    await db
      .update(effects)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: PROPOSED_COLOR,
      })
      .where(eq(effects.id, r.id));
    out.push({
      type: "effect",
      id: r.id,
      name: r.name,
      category: "",
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: PROPOSED_COLOR,
      source: proposal.source,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
}

async function backfillCapabilities(): Promise<CsvRow[]> {
  console.log("Reading capabilities...");
  const rows = await db.select().from(capabilities);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("capability", r.name, r.type, r.tags ?? []);
    await db
      .update(capabilities)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: PROPOSED_COLOR,
      })
      .where(eq(capabilities.id, r.id));
    out.push({
      type: "capability",
      id: r.id,
      name: r.name,
      category: r.type,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: PROPOSED_COLOR,
      source: proposal.source,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
}

async function backfillTemplates(): Promise<CsvRow[]> {
  console.log("Reading templates...");
  const rows = await db.select().from(templates);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("template", r.name, r.kind);
    await db
      .update(templates)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: PROPOSED_COLOR,
      })
      .where(eq(templates.id, r.id));
    out.push({
      type: "template",
      id: r.id,
      name: r.name,
      category: r.kind,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: PROPOSED_COLOR,
      source: proposal.source,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
}

async function backfillItems(): Promise<CsvRow[]> {
  console.log("Reading items...");
  const rows = await db.select().from(items);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("item", r.name, r.itemType, r.tags ?? []);
    await db
      .update(items)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: PROPOSED_COLOR,
      })
      .where(eq(items.id, r.id));
    out.push({
      type: "item",
      id: r.id,
      name: r.name,
      category: r.itemType,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: PROPOSED_COLOR,
      source: proposal.source,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
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
    "current_icon",
    "proposed_icon",
    "proposed_color",
    "source",
    "has_committed_icon",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const fields = [
      r.type,
      r.id,
      // Quote + escape any field that could contain a comma
      csvField(r.name),
      r.category,
      r.current_icon,
      r.proposed_icon,
      r.proposed_color,
      r.source,
      String(r.has_committed_icon),
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
  const all: CsvRow[] = [
    ...(await backfillPrimitives()),
    ...(await backfillEffects()),
    ...(await backfillCapabilities()),
    ...(await backfillTemplates()),
    ...(await backfillItems()),
  ];

  // Write CSV
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `icon-backfill-${stamp}.csv`);
  await writeFile(outPath, toCsv(all), "utf8");

  // Summary stats
  const bySource: Record<string, number> = {};
  for (const r of all) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }
  const withCommitted = all.filter((r) => r.has_committed_icon).length;

  console.log("");
  console.log("=== Backfill summary ===");
  console.log(`Total entities processed: ${all.length}`);
  console.log(`  with committed icon already: ${withCommitted}`);
  console.log(`  proposal sources:`);
  for (const [src, n] of Object.entries(bySource)) {
    console.log(`    ${src}: ${n}`);
  }
  console.log("");
  console.log(`CSV report: ${outPath}`);
  console.log("");
  console.log("Next step: review the CSV. When you're happy, run the");
  console.log("promote script (scripts/promote-icon-proposals.ts, TBD) to");
  console.log("copy accepted proposals from icon_proposed_* → icon_*.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
