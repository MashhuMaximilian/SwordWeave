import type { QuickRuleSeed } from "./quick-rules";
import type { EntityKey, EntityKind } from "../model";

export const DISCOVERY_INTENTS = [
  { id: "surprise", label: "Explore possibilities", query: "" },
  { id: "defense", label: "Protect myself", query: "defense" },
  { id: "mobility", label: "Move and explore", query: "mobility" },
  { id: "training", label: "Improve a skill", query: "training" },
  { id: "healing", label: "Help and heal", query: "healing" },
  { id: "weakness", label: "Take a drawback", query: "" },
] as const;
export type DiscoveryIntent = (typeof DISCOVERY_INTENTS)[number]["id"];
export interface DiscoveryCandidate {
  key: EntityKey;
  kind: EntityKind;
  name: string;
  description: string;
  mechanicalDescription: string;
  tags: string[];
  family: string;
  structuredRules: string;
  origin: "system" | "community";
  cost: number;
  /** Full Library price; cost may be an incremental estimate for a known draft. */
  libraryCost?: number;
  primitiveCosts?: Array<{ key: EntityKey; cost: number }>;
  versionNumber: number | null;
  ruleSeed?: QuickRuleSeed;
  heritageType?: string;
  mirrorCredit?: number;
  mirrorDescription?: string;
}
export interface DiscoverySuggestion extends DiscoveryCandidate {
  reason: string;
  evidence: "mechanics" | "description" | "exploration";
  score: number;
  mirrored: boolean;
}
export interface DiscoveryRequest {
  query: string;
  intent: DiscoveryIntent;
  budget: number;
  debtAvailable: number;
  kinds: EntityKind[];
  excludedKeys?: EntityKey[];
  suppliedPrimitiveKeys?: EntityKey[];
  destinationIsItem?: boolean;
}

// Deliberately inspectable vocabulary, not generated mechanical promises.
const CONCEPTS: Record<string, string[]> = {
  defense: ["defense", "defence", "protection", "resistance", "resist", "armor", "armour", "shield", "immunity", "immune", "tough", "hard to hurt", "harder to hurt", "survive", "durable", "reduce damage"],
  mobility: ["mobility", "movement", "move", "speed", "swift", "fast", "run", "climb", "swim", "flight", "fly", "jump", "teleport", "travel", "explore"],
  training: ["training", "trained", "skill", "practice", "proficiency", "proficient", "expert", "expertise", "accuracy", "tracking", "track", "craft"],
  healing: ["healing", "heal", "restore", "recovery", "recover", "regenerate", "regeneration", "mend", "medicine", "medic", "help allies"],
  magic: ["magic", "magical", "spell", "spells", "arcane", "sorcery", "sorcerous", "enchantment", "wizard"],
  interrupt: ["interrupt", "counterspell", "counter", "disrupt", "silence", "prevent casting"],
  detect: ["detect", "sense", "reveal", "perceive", "perception", "awareness", "find hidden"],
  remove: ["dispel", "remove effect", "cancel", "purge", "cleanse", "break enchantment"],
};
const STOP = new Set("a an the to of in on for with without and or my me i want be can could more less it some something become make that is at as when from against by have get give character their them myself".split(" "));
export function normalizeDiscoveryText(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_\W]+/g, " ").trim();
}
function contains(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${term} `);
}
function conceptsIn(text: string): string[] {
  return Object.entries(CONCEPTS).filter(([, words]) => words.some((word) => contains(text, word))).map(([key]) => key);
}
function stem(word: string): string {
  return word.length > 4 ? word.replace(/(?:ies|ing|ed|s)$/, (suffix) => suffix === "ies" ? "y" : "") : word;
}
function oneTypo(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let differences = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++differences > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return differences + Number(i < a.length || j < b.length) <= 1;
}
function tokenPresent(token: string, words: string[]): boolean {
  return words.some((word) => stem(word) === stem(token) || oneTypo(token, word));
}

/** An advisory lower-cost discovery filter. Commit still runs canonical resolution.
 * Only known, already supplied leaf rules reduce a bundle's Library price.
 * Unknown composition and direct purchases retain the full price. */
export function incrementalDiscoveryCost(candidate: DiscoveryCandidate, supplied: ReadonlySet<EntityKey>, destinationIsItem = false): DiscoveryCandidate {
  const libraryCost = candidate.libraryCost ?? candidate.cost;
  if (destinationIsItem) return { ...candidate, libraryCost, cost: 0 };
  if (candidate.kind === "primitive" || !candidate.primitiveCosts?.length) return { ...candidate, libraryCost };
  const reused = [...new Map(candidate.primitiveCosts.map((leaf) => [leaf.key, leaf])).values()]
    .filter((leaf) => supplied.has(leaf.key) && Number.isFinite(leaf.cost) && leaf.cost > 0)
    .reduce((sum, leaf) => sum + leaf.cost, 0);
  return { ...candidate, libraryCost, cost: Math.max(0, libraryCost - reused) };
}

export function discoverySetCost(candidates: readonly DiscoverySuggestion[], suppliedKeys: readonly EntityKey[] = [], destinationIsItem = false): { cost: number; credit: number } {
  const supplied = new Set(suppliedKeys);
  let cost = 0, credit = 0;
  for (const candidate of candidates) {
    if (candidate.mirrored) { credit += candidate.mirrorCredit ?? 0; continue; }
    cost += incrementalDiscoveryCost(candidate, supplied, destinationIsItem).cost;
    if (candidate.kind === "primitive") supplied.add(candidate.key);
    else for (const leaf of candidate.primitiveCosts ?? []) supplied.add(leaf.key);
  }
  return { cost, credit };
}

export function rankDiscoveryCandidates(candidates: readonly DiscoveryCandidate[], request: DiscoveryRequest): DiscoverySuggestion[] {
  const excluded = new Set(request.excludedKeys ?? []);
  const supplied = new Set(request.suppliedPrimitiveKeys ?? []);
  const intentQuery = DISCOVERY_INTENTS.find((intent) => intent.id === request.intent)?.query ?? "";
  const query = normalizeDiscoveryText(`${intentQuery} ${request.query}`);
  const concepts = conceptsIn(query);
  const expandedWords = new Set(concepts.flatMap((concept) => CONCEPTS[concept]!.flatMap((phrase) => phrase.split(" "))));
  const tokens = [...new Set(query.split(" ").filter((word) => word && !STOP.has(word) && !expandedWords.has(word)))];
  const mirrored = request.intent === "weakness";
  return candidates.flatMap((original): DiscoverySuggestion[] => {
    const candidate = incrementalDiscoveryCost(original, supplied, request.destinationIsItem ?? false);
    if (excluded.has(candidate.key) || !request.kinds.includes(candidate.kind)) return [];
    if (!Number.isFinite(candidate.cost) || candidate.cost < 0) return [];
    if (mirrored ? !candidate.mirrorCredit || candidate.mirrorCredit > request.debtAvailable : candidate.cost > request.budget) return [];
    const mechanic = normalizeDiscoveryText(`${candidate.mechanicalDescription} ${candidate.structuredRules}`);
    const description = normalizeDiscoveryText(`${candidate.name} ${candidate.description} ${candidate.tags.join(" ")} ${candidate.family}`);
    const all = `${mechanic} ${description}`;
    // A multi-concept request must match all concepts. "Resist magic" should
    // not quietly broaden to every magical entry or every physical shield.
    const matchedConcepts = concepts.filter((concept) => CONCEPTS[concept]!.some((word) => contains(all, word)));
    if (matchedConcepts.length !== concepts.length) return [];
    const words = all.split(" ");
    const matchedTokens = tokens.filter((token) => tokenPresent(token, words));
    if (tokens.length && matchedTokens.length < Math.ceil(tokens.length * 0.6)) return [];
    const mechanicConcepts = concepts.filter((concept) => CONCEPTS[concept]!.some((word) => contains(mechanic, word)));
    const mechanicTokens = tokens.filter((token) => tokenPresent(token, mechanic.split(" ")));
    const hasQuery = concepts.length > 0 || tokens.length > 0;
    const supported = hasQuery && mechanicConcepts.length === concepts.length && mechanicTokens.length >= Math.ceil(tokens.length * 0.6);
    const evidence = !hasQuery ? "exploration" : supported ? "mechanics" : "description";
    const reason = mirrored
      ? `Mirrorable rule; ${candidate.mirrorCredit} BU credit fits your remaining drawback allowance.`
      : !hasQuery ? "An available Library option within your allowance."
        : supported ? "Related wording appears in its mechanical rule. Read the complete rule below."
          : "Related wording appears in its name, description, family, or tags. Check the rule before choosing.";
    return [{ ...candidate, mirrored, reason, evidence, score: mechanicConcepts.length * 8 + mechanicTokens.length * 5 + matchedConcepts.length * 3 + matchedTokens.length * 2 + Number(!hasQuery) }];
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** Walk the complete matching pool before recycling. Kept options never return. */
export function drawDiscoverySuggestions<T extends { key: string }>(pool: readonly T[], kept: readonly string[], seen: readonly string[], previous: readonly string[], random: () => number = Math.random, count = 3): T[] {
  const keptSet = new Set(kept), seenSet = new Set(seen), previousSet = new Set(previous);
  const available = [...new Map(pool.filter((item) => !keptSet.has(item.key)).map((item) => [item.key, item])).values()];
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [available[i], available[j]] = [available[j]!, available[i]!];
  }
  return [
    ...available.filter((item) => !seenSet.has(item.key) && !previousSet.has(item.key)),
    ...available.filter((item) => !seenSet.has(item.key) && previousSet.has(item.key)),
    ...available.filter((item) => seenSet.has(item.key) && !previousSet.has(item.key)),
    ...available.filter((item) => seenSet.has(item.key) && previousSet.has(item.key)),
  ].slice(0, Math.max(0, count));
}
