// =============================================================================
// backfill-icons.ts — propose icons + colors for every existing entity.
//
// Phase 8 follow-up. The original backfill (4f8b911) wrote proposals
// with color always = "#ffffff". The user said the cards looked terrible
// — every card was a white silhouette on a dark background and the
// proposed icons were visually noisy. This rewrite assigns a real color
// to every row based on the entity's category and any element-flavor
// tokens in the name (fire, frost, lightning, poison, holy, etc.).
//
// Color philosophy:
//   - Categories get a coherent palette so a row of "Range" primitives
//     all share a hue (cyan), "Defense" share another (emerald), etc.
//     This makes the library grid feel like a deliberate visual system
//     instead of a random icon dump.
//   - Element tokens override the category color (a "Fire Wall" defense
//     primitive still gets red, not emerald) — name wins over category.
//   - Races/Backgrounds/Archetypes get identity colors (race = gold,
//     background = purple, archetype = amber) so the user can see at a
//     glance what kind of template a row is.
//   - Items follow a rarity-ish color scale (weapon = slate, armor =
//     bronze, trinket = violet, artifact = gold, consumable = red).
//   - Builds get a level-tinted color: low level = teal, mid = violet,
//     high = crimson. A subtle signal that "this is a character snapshot".
//
// The script is idempotent. Re-running overwrites the proposed columns
// (never the committed icon_* columns). Run with:
//
//   pnpm tsx scripts/backfill-icons.ts
//
// Output: a CSV at scripts/output/icon-backfill-<timestamp>.csv with
// every row's proposed (icon, color) for the user's review pass.
// =============================================================================

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
import { templates, builds } from "@/db/schema/characters";
import iconIndex from "@/lib/icons/game-icons-index.json";

// -----------------------------------------------------------------------------
// Color palettes
// -----------------------------------------------------------------------------
// Each row is `[name, hex]`. The hex codes are picked from Tailwind's
// 400-500 step because they read well on both dark (default) and light
// backgrounds. The ColorTrigger popover shows 17 of these; the
// backfill uses a wider set so different categories feel distinct.

const COLORS = {
  // Elemental — name-token wins over category
  fire: "#f97316",      // orange-500
  flame: "#f97316",
  frost: "#22d3ee",     // cyan-400
  ice: "#22d3ee",
  cold: "#22d3ee",
  lightning: "#facc15", // yellow-400
  thunder: "#facc15",
  shock: "#facc15",
  electric: "#facc15",
  poison: "#84cc16",    // lime-500
  toxic: "#84cc16",
  venom: "#84cc16",
  acid: "#bef264",      // lime-300 (brighter than poison)
  holy: "#fef08a",      // yellow-200
  divine: "#fef08a",
  radiant: "#fef08a",
  light: "#fde047",     // yellow-300
  dark: "#a78bfa",      // violet-400
  shadow: "#a78bfa",
  void: "#7c3aed",      // violet-600
  necrotic: "#9ca3af",  // gray-400
  death: "#9ca3af",
  curse: "#c084fc",     // purple-400
  blood: "#dc2626",     // red-600
  bleed: "#dc2626",
  water: "#3b82f6",     // blue-500
  earth: "#a16207",     // amber-700
  stone: "#78716c",     // stone-500
  air: "#93c5fd",       // blue-300
  wind: "#93c5fd",
  nature: "#22c55e",    // green-500
  healing: "#22c55e",
  heal: "#22c55e",
  mind: "#f472b6",      // pink-400
  charm: "#f472b6",
  psychic: "#f472b6",
  fear: "#a78bfa",
  physical: "#ef4444",  // red-500
  weapon: "#ef4444",
} as const;

// Category default colors (per-entity-type)
const CATEGORY_COLORS: Record<string, Record<string, string>> = {
  primitive: {
    VERB_TIER: "#facc15",        // yellow-400 — actions
    DOMAIN: "#a78bfa",           // violet-400 — schools of magic
    SIZING: "#fb923c",           // orange-400 — scale
    TARGETING: "#60a5fa",        // blue-400 — aim
    RANGE: "#22d3ee",            // cyan-400 — reach
    DURATION: "#34d399",         // emerald-400 — time
    OUTPUT: "#f472b6",           // pink-400 — result type
    CONDITION: "#84cc16",        // lime-500 — status
    DEFENSE: "#22c55e",          // green-500 — protection
    STRUCTURAL: "#c084fc",       // purple-400 — meta
    SHEET_AUGMENT: "#fde047",    // yellow-300
    ITEM_AUGMENT: "#fb7185",     // rose-400
  },
  effect: {
    __default: "#facc15",        // yellow — energy
  },
  capability: {
    ACTIVE: "#f97316",           // orange-500 — actions
    PASSIVE: "#22c55e",          // green-500 — always-on
    REACTION: "#facc15",         // yellow-400 — triggers
    AUGMENT: "#c084fc",          // purple-400 — modifications
  },
  template: {
    RACE: "#facc15",             // yellow-400 — identity
    BACKGROUND: "#c084fc",       // purple-400 — history
    ARCHETYPE: "#f97316",        // orange-500 — role
  },
  item: {
    WEAPON: "#94a3b8",           // slate-400 — tools of war
    ARMOR: "#b45309",            // amber-700 — protection
    TRINKET: "#a78bfa",          // violet-400 — baubles
    ARTIFACT: "#facc15",         // yellow-400 — relics
    CONSUMABLE: "#fb7185",       // rose-400 — one-shot
  },
  build: {
    __default: "#22d3ee",        // cyan — base tint
  },
};

// Default color if nothing matches
const DEFAULT_COLOR = "#e5e7eb"; // gray-200 — neutral

// -----------------------------------------------------------------------------
// Element color detection — name wins
// -----------------------------------------------------------------------------
function detectElementColor(name: string, tags: string[] = []): string | null {
  const haystack = `${name} ${tags.join(" ")}`.toLowerCase();
  for (const [keyword, color] of Object.entries(COLORS)) {
    // Word-boundary for short keywords (<= 4 chars) to avoid
    // matching "air" inside "chair" or "ice" inside "voice".
    if (keyword.length <= 4) {
      const re = new RegExp(`\\b${keyword}\\b`);
      if (re.test(haystack)) return color;
    } else if (haystack.includes(keyword)) {
      return color;
    }
  }
  return null;
}

function colorByCategory(
  entityType: keyof typeof CATEGORY_COLORS,
  category: string | null,
): string {
  const table = CATEGORY_COLORS[entityType];
  if (!table) return DEFAULT_COLOR;
  if (category && table[category]) return table[category];
  return table["__default"] ?? DEFAULT_COLOR;
}

// Build rows get a level-tinted color: L1-L5 teal, L6-L10 violet,
// L11-L20 crimson. A subtle visual hierarchy on the library page.
function colorByLevel(level: number): string {
  if (level <= 5) return "#22d3ee";   // cyan-400
  if (level <= 10) return "#a78bfa";  // violet-400
  return "#fb7185";                   // rose-400
}

// -----------------------------------------------------------------------------
// Keyword → game-icons slug dictionary (expanded from 4f8b911)
// -----------------------------------------------------------------------------
const KEYWORD_ICONS: Record<string, string> = {
  // Weapons & combat — all slugs verified against the live icon index
  sword: "lorc/broadsword",
  blade: "lorc/plain-dagger",
  dagger: "lorc/plain-dagger",
  knife: "lorc/plain-dagger",
  axe: "lorc/battle-axe",
  hammer: "delapouite/thunder-hammer",
  mace: "delapouite/flanged-mace",
  spear: "delapouite/spear-feather",
  lance: "delapouite/spear-feather",
  pike: "delapouite/spear-feather",
  bow: "lorc/pocket-bow",
  arrow: "carl-olsen/arrow-flights",
  crossbow: "carl-olsen/crossbow",
  shield: "willdabeast/round-shield",
  armor: "skoll/trench-body-armor",
  gauntlet: "delapouite/gauntlet",
  fist: "lorc/fist",
  punch: "lorc/fist",
  kick: "delapouite/high-kick",
  strike: "lorc/sword-spade",
  slash: "lorc/sword-slice",
  thrust: "delapouite/spear-feather",
  parry: "sbed/shield-bash",
  dodge: "lorc/dodging",
  block: "sbed/shield",
  guard: "sbed/shield",
  reflect: "lorc/reflected-light",
  absorb: "lorc/sponge",
  deflect: "sbed/shield",

  // Magic & effects
  fire: "carl-olsen/flame",
  flame: "carl-olsen/flame",
  burn: "carl-olsen/flame",
  burning: "carl-olsen/flame",
  frost: "lorc/snowflake-1",
  ice: "lorc/ice-spear",
  cold: "lorc/snowflake-1",
  freezing: "lorc/snowflake-1",
  lightning: "willdabeast/chain-lightning",
  thunder: "delapouite/thunder-hammer",
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
  mystic: "lorc/spark-spirit",
  divine: "lorc/angel-outfit",
  holy: "lorc/angel-outfit",
  curse: "lorc/cursed-star",
  hex: "lorc/voodoo-doll",
  summon: "lorc/summon-zombies",
  raise: "skoll/raise-skeleton",
  resurrect: "lorc/resurrect",
  drain: "lorc/life-tap",
  spell: "lorc/sword-spell-book",
  blast: "sbed/blast",
  beam: "lorc/laser-blast",

  // Movement
  dash: "delapouite/running-shoe",
  run: "delapouite/running-shoe",
  sprint: "delapouite/running-shoe",
  jump: "delapouite/jump-across",
  leap: "delapouite/jump-across",
  climb: "lorc/climbing",
  swim: "lorc/swim-fins",
  fly: "delapouite/flying-fox",
  falling: "lorc/falling",
  teleport: "lorc/magic-portal",
  blink: "lorc/magic-portal",

  // Perception & mind
  vision: "delapouite/eye-target",
  sight: "lorc/binoculars",
  see: "delapouite/eye-target",
  hear: "lorc/ear",
  listen: "lorc/ear",
  smell: "lorc/nose",
  sense: "lorc/spyglass",
  detect: "delapouite/eye-target",
  invisible: "lorc/invisible",
  stealth: "lorc/ninja-mask",
  hide: "lorc/ninja-mask",
  sneak: "lorc/ninja-mask",

  // Mind-affecting
  charm: "lorc/charm",
  fear: "lorc/terror",
  terrify: "lorc/terror",
  confuse: "lorc/dizzy-person",
  stun: "lorc/stunned",
  sleep: "lorc/sleepy",
  rage: "delapouite/enrage",
  calm: "lorc/lotus",
  mind: "lorc/brain",
  thought: "lorc/brain",
  memory: "lorc/brain",

  // Body / physical
  body: "lorc/muscle-up",
  muscle: "lorc/muscle-up",
  strength: "lorc/muscle-up",
  vitality: "zeromancer/heart-plus",
  health: "zeromancer/heart-plus",
  stamina: "delapouite/energy-drink",
  speed: "delapouite/running-shoe",
  agility: "lorc/acrobatic",
  reflexes: "lorc/acrobatic",

  // Conditions
  blind: "lorc/blindfold",
  silence: "delapouite/silenced",
  bleed: "lorc/bleeding-wound",
  wound: "lorc/bleeding-wound",
  stunned: "lorc/stunned",
  prone: "lorc/falling",
  grappled: "delapouite/chainsaw",
  bound: "delapouite/chainsaw",
  root: "delapouite/plant-roots",
  snare: "lorc/snare",

  // Races (templates)
  elf: "kier-heyl/elf-helmet",
  human: "lorc/human-ear",
  dwarf: "kier-heyl/dwarf-helmet",
  orc: "lorc/orc-head",
  halfling: "lorc/half-body-crawling",
  tiefling: "lorc/devil-mask",
  dragonborn: "lorc/dragon-head",
  gnome: "lorc/gnome",
  goblin: "lorc/goblin-head",

  // Backgrounds (templates)
  soldier: "lorc/crossed-swords",
  scholar: "delapouite/scroll-quill",
  criminal: "lorc/plain-dagger",
  noble: "lorc/crown",
  hermit: "lorc/lotus",
  acolyte: "lorc/prayer",
  sailor: "lorc/ship-wheel",
  entertainer: "lorc/musical-notes",
  folk_hero: "lorc/laurel-crown",

  // Archetypes
  warrior: "lorc/crossed-swords",
  mage: "lorc/wizard-face",
  rogue: "lorc/plain-dagger",
  cleric: "lorc/prayer",
  ranger: "lorc/pocket-bow",
  paladin: "sbed/shield-bash",
  bard: "lorc/musical-notes",
  druid: "lorc/leaf",
  monk: "lorc/lotus-flower",
  barbarian: "lorc/battle-axe",
  sorcerer: "lorc/crystal-ball",
  warlock: "lorc/pentagram",

  // Utility / generic
  light: "lorc/light-bulb",
  dark: "lorc/night-sky",
  shadow: "lorc/shadow-follower",
  weight: "delapouite/weight",
  heavy: "delapouite/weight",
  duration: "lorc/hourglass",
  range: "skoll/bullseye",
  area: "sbed/blast",
  aoe: "sbed/blast",
  cone: "sbed/blast",
  line: "lorc/line-arrows",
  burst: "sbed/blast",
  ray: "lorc/laser-blast",
  target: "skoll/bullseye",
  // Verb-tier fallbacks (lexicon categories)
  verb: "lorc/sword-spade",
  domain: "willdabeast/orb-wand",
  sizing: "delapouite/resize",
  targeting: "skoll/bullseye",
  range_cat: "skoll/bullseye",
  duration_cat: "lorc/hourglass",
  output: "lorc/cog",
  condition_cat: "lorc/poison-bottle",
  defense: "sbed/shield-bash",
  structural: "lorc/portal",
  // Item types
  sword_item: "lorc/broadsword",
  blade_item: "lorc/plain-dagger",
  axe_item: "lorc/battle-axe",
  bow_item: "lorc/pocket-bow",
  staff: "lorc/wizard-staff",
  wand: "lorc/crystal-wand",
  tome: "lorc/scroll-quill",
  ring: "lorc/gem-pendant",
  amulet: "lorc/gem-pendant",
  cloak: "lorc/cape",
  boots: "lorc/boots",
  gloves: "delapouite/gauntlet",
  helmet: "kier-heyl/elf-helmet",
};

// Per-(entity-type, category) defaults — second-priority fallbacks.
// All slugs validated against the live icon index.
const CATEGORY_ICONS: Record<string, Record<string, string>> = {
  primitive: {
    VERB_TIER: "lorc/sword-spade",
    DOMAIN: "willdabeast/orb-wand",
    SIZING: "delapouite/resize",
    TARGETING: "skoll/bullseye",
    RANGE: "skoll/bullseye",
    DURATION: "lorc/hourglass",
    OUTPUT: "lorc/cog",
    CONDITION: "lorc/poison-bottle",
    DEFENSE: "sbed/shield-bash",
    STRUCTURAL: "lorc/portal",
    // Phase 8 follow-up: new categories from the corpus
    DEFENSIVE: "sbed/shield-bash",
    ACTION_ECONOMY: "lorc/stopwatch",
    TARGETING_AOE: "sbed/blast",
    EVALUATION_STRAIN: "lorc/brain",
    SHEET_AUGMENT: "lorc/cog",
    TEMPORAL_CHRONOLOGICAL: "lorc/hourglass",
    PROBABILITY_BIAS: "delapouite/dice-twenty-faces-twenty",
    MOBILITY_LOCOMOTION: "delapouite/running-shoe",
    INTENSITY_DICE: "delapouite/dice-twenty-faces-twenty",
    PRACTICE_PROGRESSION_AUGMENT: "delapouite/star-promotion",
    BOSS_ECONOMY: "lorc/crowned-skull",
    TRIGGER_HOOK: "delapouite/hook",
    SPEED_QUICKENING: "delapouite/running-shoe",
    SENSORY_ARRAY: "lorc/binoculars",
    PERCEPTION_QUALIFIER: "delapouite/eye-target",
    METAMORPHOSIS: "darkzaitzev/chameleon-glyph",
    KINETIC_CONTROL: "lorc/muscle-up",
    AGENCY_OVERRIDE: "felbrigg/overhead",
    ITEM_AUGMENT: "lorc/anvil-impact",
  },
  effect: { __default: "lorc/spark-spirit" },
  capability: {
    ACTIVE: "lorc/sword-spade",
    PASSIVE: "sbed/shield",
    REACTION: "lorc/sword-spade",
    AUGMENT: "lorc/cog",
  },
  template: {
    RACE: "kier-heyl/elf-helmet",
    BACKGROUND: "delapouite/scroll-quill",
    ARCHETYPE: "lorc/crowned-skull",
  },
  item: {
    WEAPON: "lorc/broadsword",
    ARMOR: "skoll/trench-body-armor",
    TRINKET: "lorc/gem-pendant",
    ARTIFACT: "lorc/crystal-ball",
    CONSUMABLE: "starseeker/potion-of-madness",
  },
  build: { __default: "delapouite/character" },
};

const GENERIC_ICON = "viscious-speed/abstract-001";

// -----------------------------------------------------------------------------
// Index validation
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
// Proposers
// -----------------------------------------------------------------------------
function proposeIconForName(name: string, tags: string[] = []): string | null {
  const haystack = `${name} ${tags.join(" ")}`.toLowerCase();
  for (const [keyword, iconKey] of Object.entries(KEYWORD_ICONS)) {
    if (keyword.length <= 4) {
      const re = new RegExp(`\\b${keyword}\\b`);
      if (re.test(haystack)) return iconKey;
    } else if (haystack.includes(keyword)) {
      return iconKey;
    }
  }
  return null;
}

function proposeIconForCategory(
  entityType: keyof typeof CATEGORY_ICONS,
  category: string | null,
): string {
  const table = CATEGORY_ICONS[entityType];
  if (!table) return GENERIC_ICON;
  if (category && table[category]) return table[category];
  return table["__default"] ?? GENERIC_ICON;
}

function proposeIcon(
  entityType: keyof typeof CATEGORY_ICONS,
  name: string,
  category: string | null,
  tags: string[] = [],
): { key: string; source: string } {
  const nameMatch = proposeIconForName(name, tags);
  if (nameMatch && isValidKey(nameMatch)) {
    return { key: nameMatch, source: "name-keyword" };
  }
  const catMatch = proposeIconForCategory(entityType, category);
  if (isValidKey(catMatch)) {
    return { key: catMatch, source: "category-default" };
  }
  return { key: GENERIC_ICON, source: "generic-fallback" };
}

function proposeColor(
  entityType: keyof typeof CATEGORY_COLORS,
  name: string,
  category: string | null,
  tags: string[] = [],
  extra?: { level?: number },
): { color: string; source: string } {
  // Priority 1: element token in name/tags
  const elementColor = detectElementColor(name, tags);
  if (elementColor) return { color: elementColor, source: "name-element" };
  // Priority 2: build level (only applies to builds)
  if (entityType === "build" && extra?.level !== undefined) {
    return { color: colorByLevel(extra.level), source: "build-level" };
  }
  // Priority 3: category default
  const catColor = colorByCategory(entityType, category);
  return { color: catColor, source: "category-default" };
}

// -----------------------------------------------------------------------------
// Per-entity-type runners
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

async function backfillPrimitives(): Promise<CsvRow[]> {
  console.log("Reading primitives...");
  const rows = await db.select().from(primitives);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("primitive", r.name, r.category);
    const color = proposeColor("primitive", r.name, r.category);
    await db
      .update(primitives)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(primitives.id, r.id));
    out.push({
      type: "primitive",
      id: String(r.id),
      name: r.name,
      category: r.category,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
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
    const color = proposeColor("effect", r.name, null, r.tags ?? []);
    await db
      .update(effects)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(effects.id, r.id));
    out.push({
      type: "effect",
      id: r.id,
      name: r.name,
      category: "",
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
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
    const color = proposeColor("capability", r.name, r.type, r.tags ?? []);
    await db
      .update(capabilities)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(capabilities.id, r.id));
    out.push({
      type: "capability",
      id: r.id,
      name: r.name,
      category: r.type,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
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
    const color = proposeColor("template", r.name, r.kind);
    await db
      .update(templates)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(templates.id, r.id));
    out.push({
      type: "template",
      id: r.id,
      name: r.name,
      category: r.kind,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
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
    const color = proposeColor("item", r.name, r.itemType, r.tags ?? []);
    await db
      .update(items)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(items.id, r.id));
    out.push({
      type: "item",
      id: r.id,
      name: r.name,
      category: r.itemType,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
      has_committed_icon: r.iconSource !== null,
    });
  }
  return out;
}

async function backfillBuilds(): Promise<CsvRow[]> {
  console.log("Reading builds...");
  const rows = await db.select().from(builds);
  console.log(`  ${rows.length} rows.`);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const proposal = proposeIcon("build", r.name, null, [String(r.level)]);
    const color = proposeColor("build", r.name, null, [], { level: r.level });
    await db
      .update(builds)
      .set({
        iconProposedSource: "GAME_ICONS",
        iconProposedKey: proposal.key,
        iconProposedColor: color.color,
      })
      .where(eq(builds.id, r.id));
    out.push({
      type: "build",
      id: r.id,
      name: r.name,
      category: `L${r.level}`,
      current_icon: r.iconSource ?? "",
      proposed_icon: proposal.key,
      proposed_color: color.color,
      source: `${proposal.source}+${color.source}`,
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
    ...(await backfillBuilds()),
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
  console.log(`  proposal sources (icon+color):`);
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
