// =============================================================================
// build-icon-index-v2.mjs — fetch official game-icons.net tag pages and
// build a proper slug → categories index.
//
// Phase 8. The official site at game-icons.net/tags/<slug>.html lists every
// icon in each tag. We scrape these once at build time to produce a
// canonical slug → tags[] map. This is much better than keyword matching
// because the official taxonomy is curated and authoritative.
//
// Categories returned to the picker are a hand-curated subset of the
// official tags, grouped into ~12 buckets the user can quickly scan.
//
// Output: src/lib/icons/game-icons-index.json
//
// Usage: node scripts/build-icon-index-v2.mjs <path-to-zip>
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = process.argv[2];
if (!ZIP_PATH) {
  console.error("usage: node build-icon-index-v2.mjs <path-to-zip>");
  process.exit(1);
}

// Top-level tag buckets surfaced in the picker UI. These map to the
// official game-icons.net tag slugs (the bit in the /tags/<slug>.html URL).
// The picker shows the label and the count, sorted by count desc. An icon
// can appear in multiple buckets (e.g. "skull" shows up in Body, Symbol,
// Death, etc.) — we just store all matching tags and the picker filters
// by any-of.
const TAG_BUCKETS = [
  // (url slug → picker label)
  ["weapon", "Weapon"],
  ["body", "Body"],
  ["creature", "Creature"],
  ["animal", "Animal"],
  ["bird", "Bird"],
  ["fish", "Fish"],
  ["insect", "Insect"],
  ["mammal", "Mammal"],
  ["reptile", "Repture"],
  ["plant", "Plant"],
  ["fire", "Fire"],
  ["ice", "Ice"],
  ["lightning", "Lightning"],
  ["water", "Water"],
  ["earth", "Earth"],
  ["stone", "Stone"],
  ["metal", "Metal"],
  ["magic", "Magic"],
  ["chemical", "Alchemy"],
  ["spell", "Spell"],
  ["building", "Building"],
  ["vehicle", "Vehicle"],
  ["boat", "Boat"],
  ["machine", "Machine"],
  ["robot", "Robot"],
  ["electronic", "Electronics"],
  ["tool", "Tool"],
  ["household", "Household"],
  ["clothing", "Clothing"],
  ["armor", "Armor"],
  ["food", "Food"],
  ["drink", "Drink"],
  ["fruit", "Fruit"],
  ["money", "Money"],
  ["book", "Book"],
  ["office", "Office"],
  ["music", "Music"],
  ["sport", "Sport"],
  ["time", "Time"],
  ["trap", "Trap"],
  ["target", "Target"],
  ["shield", "Shield"],
  ["blade", "Blade"],
  ["gun", "Gun"],
  ["bomb", "Bomb"],
  ["death", "Death"],
  ["skull", "Skull"],
  ["eye", "Eye"],
  ["heart", "Heart"],
  ["hand", "Hand"],
  ["mouth", "Mouth"],
  ["vampire", "Vampire"],
  ["zombie", "Zombie"],
  ["ghost", "Ghost"],
  ["demon", "Demon"],
  ["angel", "Angel"],
  ["star", "Star"],
  ["sun", "Sun"],
  ["moon", "Moon"],
  ["planet", "Planet"],
  ["space", "Space"],
  ["abstract", "Abstract"],
  ["symbol", "Symbol"],
  ["cross", "Cross"],
  ["gui", "UI"],
  ["tarot", "Tarot"],
  ["dice", "Dice"],
  ["board", "Board"],
  ["card", "Card"],
  ["egypt", "Egypt"],
  ["greek-roman", "Greek/Roman"],
  ["viking", "Viking"],
  ["western", "Western"],
  ["ninja", "Ninja"],
  ["pirate", "Pirate"],
  ["police", "Police"],
  ["science-fiction", "Sci-Fi"],
  ["steampunk", "Steampunk"],
  ["super-mario", "Mario"],
  ["zelda", "Zelda"],
  ["video-game", "Game"],
  ["state", "State"],
  ["state_and_mood", "Mood"],
  ["rank", "Rank"],
  ["rank_and_file", "Rank"],
  ["emotion", "Emotion"],
  ["profession", "Profession"],
  ["role", "Role"],
];

// Group some official slugs into picker-friendly labels. The picker shows
// at most ~15 buckets so users aren't paralyzed. We pick the most useful
// spread: combat, body, creature, magic, nature, building, machine,
// clothing, food, symbol, abstract, plus a few cross-cutting themes.
const PICKER_BUCKETS = [
  { key: "weapon", label: "Weapon", tags: ["weapon", "blade", "arrow", "axe", "bomb", "explosion", "gun", "shield", "target"] },
  { key: "body", label: "Body", tags: ["body", "anatomy", "blood", "bone", "eye", "hand", "head", "heart", "mouth", "skull"] },
  { key: "creature", label: "Creature", tags: ["creature", "animal", "bird", "fish", "insect", "mammal", "reptile", "shell", "tentacle", "wing", "claw"] },
  { key: "magic", label: "Magic", tags: ["magic", "spell", "chemical", "poison", "smoke", "light", "potion"] },
  { key: "nature", label: "Nature", tags: ["plant", "fire", "ice", "lightning", "water", "stone", "metal", "mineral", "mushroom", "sea", "sky", "wood", "tree", "earth"] },
  { key: "undead", label: "Undead & Dark", tags: ["death", "vampire", "zombie", "ghost", "demon"] },
  { key: "building", label: "Building & Place", tags: ["building", "bridge", "door", "tower"] },
  { key: "machine", label: "Machine & Vehicle", tags: ["machine", "boat", "electronic", "energy", "robot", "vehicle"] },
  { key: "tool", label: "Tool & Object", tags: ["tool", "container", "bag", "block", "ball", "household", "office", "book", "lock", "string", "trap", "time", "money", "flag", "light"] },
  { key: "clothing", label: "Clothing", tags: ["clothing", "armor", "boot", "hat", "mask", "jewellery"] },
  { key: "food", label: "Food & Drink", tags: ["food", "bottle", "egg", "fruit", "glass", "kitchenware", "meat", "liquid"] },
  { key: "symbol", label: "Symbol", tags: ["symbol", "star", "sun", "moon", "planet", "space", "abstract", "cross", "gui"] },
  { key: "tarot", label: "Tarot", tags: ["tarot"] },
  { key: "dice", label: "Dice & Board", tags: ["dice", "board", "card", "toy"] },
  { key: "setting", label: "Setting", tags: ["egypt", "greek-roman", "viking", "western", "ninja", "pirate", "police", "science-fiction", "steampunk", "super-mario", "zelda", "video-game", "stone-age", "celtic", "world-wars", "circus", "cinema", "medieval-fantasy", "game-of-thrones"] },
  { key: "status", label: "Status & State", tags: ["state", "emotion", "rank", "role", "profession", "sport", "life"] },
];

// Step 1: extract every SVG from the zip and build the basic icon list.
console.log(`unzipping ${ZIP_PATH}...`);
const tmp = `/tmp/icon-build-${Date.now()}`;
execSync(`unzip -q "${ZIP_PATH}" -d "${tmp}"`, { stdio: "inherit" });
const root = execSync(`find "${tmp}" -name "ffffff" -type d | head -1`).toString().trim();
if (!root) { console.error("no ffffff dir"); process.exit(1); }
const files = execSync(`find "${root}/transparent/1x1" -name "*.svg" | sort`).toString().trim().split("\n");
console.log(`found ${files.length} SVGs`);

const icons = [];
const authorSet = new Set();
for (const file of files) {
  const m = file.match(/\/([^/]+)\/([^/]+)\.svg$/);
  if (!m) continue;
  const author = m[1];
  const slug = m[2];
  authorSet.add(author);
  icons.push({
    key: `${author}/${slug}`,
    author,
    slug,
    label: slug.replace(/-/g, " "),
    tags: [],
  });
}
const slugSet = new Set(icons.map(i => `${i.author}/${i.slug}`));
execSync(`rm -rf "${tmp}"`);

// Step 2: scrape each tag page. Each tag page lists icons in the form
// /icons/ffffff/000000/1x1/<author>/<slug>.svg — we extract author/slug
// from every such URL on the page.
const allTagSlugs = new Set();
for (const bucket of PICKER_BUCKETS) {
  for (const t of bucket.tags) allTagSlugs.add(t);
}

console.log(`fetching ${allTagSlugs.size} tag pages...`);
let fetched = 0;
for (const tagSlug of allTagSlugs) {
  const url = `https://game-icons.net/tags/${tagSlug}.html`;
  const out = `/tmp/tag-page-${tagSlug}.html`;
  try {
    execSync(`curl -fsS --max-time 15 "${url}" -o "${out}"`, { stdio: "pipe" });
    const html = readFileSync(out, "utf-8");
    // Pattern: /icons/ffffff/000000/1x1/<author>/<slug>.svg
    const re = /\/icons\/ffffff\/[0-9a-f]+\/1x1\/([^/]+)\/([^/]+)\.svg/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      const [, author, slug] = match;
      const key = `${author}/${slug}`;
      const icon = icons.find(i => i.key === key);
      if (icon && !icon.tags.includes(tagSlug)) {
        icon.tags.push(tagSlug);
      }
    }
    fetched++;
  } catch (e) {
    console.warn(`  failed: ${tagSlug} (${e.message})`);
  }
}
console.log(`fetched ${fetched}/${allTagSlugs.size} tag pages`);

// Step 3: assign each icon to its primary picker bucket. An icon can have
// multiple tags; we pick the first matching bucket in PICKER_BUCKETS order.
function primaryBucket(tags) {
  for (const bucket of PICKER_BUCKETS) {
    if (tags.some(t => bucket.tags.includes(t))) return bucket.key;
  }
  return "other";
}

const bucketCounts = {};
const noTags = [];
for (const icon of icons) {
  icon.category = primaryBucket(icon.tags);
  if (icon.tags.length === 0) noTags.push(icon.key);
  bucketCounts[icon.category] = (bucketCounts[icon.category] ?? 0) + 1;
}

const index = {
  generatedAt: new Date().toISOString(),
  source: "https://game-icons.net (CC BY 3.0)",
  totalIcons: icons.length,
  totalAuthors: authorSet.size,
  authors: [...authorSet].sort(),
  // Author → homepage (per license.txt). This powers the attribution tooltip.
  authorCredits: {
    "lorc": "http://lorcblog.blogspot.com",
    "delapouite": "https://delapouite.com",
    "john-colburn": "http://ninmunanmu.com",
    "felbrigg": "http://blackdogofdoom.blogspot.co.uk",
    "john-redman": "http://www.uniquedicetowers.com",
    "carl-olsen": "https://twitter.com/unstoppableCarl",
    "sbed": "http://opengameart.org/content/95-game-icons",
    "priorblue": null,
    "willdabeast": "http://wjbstories.blogspot.com",
    "viscious-speed": "http://viscious-speed.deviantart.com", // CC0
    "lord-berandas": "http://berandas.deviantart.com",
    "irongamer": "http://ecesisllc.wix.com/home",
    "heavenlydog": "http://www.gnomosygoblins.blogspot.com",
    "lucas": null,
    "faithtoken": "http://fungustoken.deviantart.com",
    "skoll": null,
    "andymeneely": "http://www.se.rit.edu/~andy/",
    "cathelineau": null,
    "kier-heyl": null,
    "aussiesim": null,
    "sparker": "http://citizenparker.com",
    "zeromancer": null, // CC0
    "rihlsul": null,
    "quoting": null,
    "guard13007": "https://guard13007.com",
    "darkzaitzev": "http://darkzaitzev.deviantart.com",
    "spencerdub": null,
    "generalace135": null,
    "zajkonur": null,
    "catsu": null,
    "starseeker": null,
    "pepijn-poolman": null,
    "pierre-leducq": null,
    "caro-asercion": null,
  },
  pickerBuckets: PICKER_BUCKETS.map(b => ({ key: b.key, label: b.label })),
  icons,
};

console.log("bucket distribution:");
for (const b of PICKER_BUCKETS) {
  console.log(`  ${b.label}: ${bucketCounts[b.key] ?? 0}`);
}
console.log(`  other (no tag match): ${bucketCounts.other ?? 0}`);
console.log(`  no tags at all: ${noTags.length}`);

const outPath = join(__dirname, "..", "src", "lib", "icons", "game-icons-index.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(index));
console.log(`wrote ${outPath} (${(JSON.stringify(index).length / 1024).toFixed(1)} KB)`);