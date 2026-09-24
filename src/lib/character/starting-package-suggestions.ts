/** Pure, seeded suggestions for starting access packages. */
export type StartingPackageSlot = "verb" | "range" | "die" | "domain";

export interface StartingPackagePrimitive {
  id: number;
  name: string;
  category: string;
  buCost: number;
  costTier?: string;
  sourceOrigin?: string | null;
}

export interface StartingPackage<T extends StartingPackagePrimitive> {
  key: string;
  items: T[]; // first four: verb, range, die, domain; then optional access primitives
  cost: number;
}

export interface StartingPackageSuggestionInput<T extends StartingPackagePrimitive> {
  options: Record<StartingPackageSlot, readonly T[]>;
  /** Retained for existing callers; access tiers are limited by BU, not level. */
  maxTier?: number;
  availableBu: number;
  seed: number;
  excludedKeys?: readonly string[];
}

export function startingPackageKey(items: readonly StartingPackagePrimitive[]): string {
  return items.map((item) => item.id).sort((a, b) => a - b).join(":");
}

const expectedCategory: Record<StartingPackageSlot, string> = {
  verb: "VERB_TIER",
  range: "RANGE",
  die: "INTENSITY_DICE",
  domain: "DOMAIN",
};

/** Match the creation form's tier inference, including zero-cost basics. */
export function startingPackageTier(item: StartingPackagePrimitive): number {
  const raw = item.costTier?.toUpperCase() ?? "";
  const numeric = raw.match(/TIER\s+(\d+)/)?.[1];
  if (numeric) return Math.min(5, Number(numeric));
  const roman = raw.match(/TIER\s+(V|IV|III|II|I)\b/)?.[1];
  if (roman) return ["", "I", "II", "III", "IV", "V"].indexOf(roman);
  if (item.category === "INTENSITY_DICE") return ({ 0: 0, 2: 1, 4: 2, 8: 3, 16: 4, 32: 5 } as Record<number, number>)[item.buCost] ?? 0;
  if (item.category === "RANGE") return ({ 0: 0, 4: 2, 8: 3, 12: 4, 24: 5 } as Record<number, number>)[item.buCost] ?? 0;
  return Math.max(0, Math.min(5, Math.ceil(item.buCost / 4)));
}

function mix(hash: number, value: number): number {
  return Math.imul(hash ^ value, 16777619) >>> 0;
}

function rank(seed: number, ids: readonly number[]): number {
  let hash = mix(2166136261, seed | 0);
  for (const id of ids) hash = mix(hash, id);
  return hash;
}

/**
 * Return up to three distinct foundations. Every package starts with one of
 * each required access family, then may add further access primitives within
 * the chosen BU allowance. A changed seed changes the suggestions without
 * relying on Math.random.
 */
export function suggestStartingPackages<T extends StartingPackagePrimitive>({
  options, availableBu, seed, excludedKeys = [],
}: StartingPackageSuggestionInput<T>): StartingPackage<T>[] {
  if (!Number.isFinite(availableBu) || availableBu < 0) return [];
  const slots = (Object.keys(expectedCategory) as StartingPackageSlot[]).reduce((result, slot) => {
    result[slot] = options[slot]
      .filter((item) => item.category === expectedCategory[slot] && Number.isFinite(item.buCost) && item.buCost >= 0 && item.buCost <= availableBu)
      .sort((a, b) => a.id - b.id);
    return result;
  }, {} as Record<StartingPackageSlot, T[]>);
  if (Object.values(slots).some((items) => items.length === 0)) return [];

  type Candidate = StartingPackage<T> & { rank: number; foundation: [T, T, T, T] };
  const candidates = new Map<string, Candidate>();
  const excluded = new Set(excludedKeys);
  const allOptions = (Object.keys(expectedCategory) as StartingPackageSlot[]).flatMap((slot) => slots[slot]);

  // A cost-indexed 0/1 knapsack keeps the suggested package near the user's
  // shuffle allowance without making its result depend on input array order.
  const fillBudget = (base: [T, T, T, T], variant: number): StartingPackage<T> => {
    const baseIds = new Set(base.map((item) => item.id));
    const baseCost = base.reduce((sum, item) => sum + item.buCost, 0);
    const remaining = Math.floor(availableBu - baseCost);
    const extras = allOptions.filter((item) => !baseIds.has(item.id) && item.buCost > 0 && item.buCost <= remaining)
      .sort((a, b) => rank(seed + variant * 8191, [a.id]) - rank(seed + variant * 8191, [b.id]) || a.id - b.id);
    const totals = new Map<number, T[]>([[0, []]]);
    for (const item of extras) {
      for (const [cost, chosen] of [...totals]) {
        const nextCost = cost + item.buCost;
        if (nextCost <= remaining && !totals.has(nextCost)) totals.set(nextCost, [...chosen, item]);
      }
    }
    const bestCost = Math.max(...totals.keys());
    const items = [...base, ...totals.get(bestCost)!.sort((a, b) => a.id - b.id)];
    return { key: startingPackageKey(items), items, cost: baseCost + bestCost };
  };

  for (const domain of slots.domain) {
    const foundations: Array<{ items: [T, T, T, T]; rank: number }> = [];
    for (const verb of slots.verb) for (const range of slots.range) for (const die of slots.die) {
      const cost = verb.buCost + range.buCost + die.buCost + domain.buCost;
      if (cost > availableBu) continue;
      const items: [T, T, T, T] = [verb, range, die, domain];
      foundations.push({ items, rank: rank(seed, items.map((item) => item.id)) });
    }
    // Sample the foundation combinations before filling their remaining BU.
    // Every Domain participates, and rotating the seed rotates which other
    // access tiers, ranges, and dice are paired with it.
    foundations.sort((a, b) => a.rank - b.rank);
    const sampled: typeof foundations = [];
    while (sampled.length < 4 && sampled.length < foundations.length) {
      const next = [...foundations].filter((foundation) => !sampled.includes(foundation)).sort((a, b) => {
        const novelty = (candidate: typeof a) => candidate.items.slice(0, 3).reduce((sum, item, slot) =>
          sum + (sampled.some((chosen) => chosen.items[slot]!.id === item.id) ? 0 : 1), 0);
        return novelty(b) - novelty(a) || a.rank - b.rank;
      })[0]!;
      sampled.push(next);
    }
    for (const { items } of sampled) {
      for (const variant of [0, 1, 2]) {
        const filled = fillBudget(items, variant);
        if (excluded.has(filled.key)) continue;
        const candidate = { ...filled, foundation: items, rank: rank(seed + variant * 8191, items.map((item) => item.id)) };
        const existing = candidates.get(filled.key);
        if (!existing || candidate.rank < existing.rank) candidates.set(filled.key, candidate);
      }
    }
  }

  const pool = [...candidates.values()];
  const bestCost = Math.max(0, ...pool.map((candidate) => candidate.cost));
  const selected: StartingPackage<T>[] = [];
  const usedKeys = new Set<string>();
  const selectedFoundations: Candidate[] = [];
  const origin = (item: T) => item.sourceOrigin?.startsWith("user:") || item.sourceOrigin?.startsWith("fork:") ? "community" : "system";
  while (selected.length < 3) {
    const eligible = pool.filter((candidate) => !usedKeys.has(candidate.key));
    if (!eligible.length) break;
    eligible.sort((a, b) => {
      const score = (candidate: Candidate) => {
        const newFoundationParts = candidate.foundation.reduce((sum, item, slot) =>
          sum + (selectedFoundations.some((chosen) => chosen.foundation[slot]!.id === item.id) ? 0 : 1), 0);
        const newOrigins = candidate.items.reduce((sum, item) =>
          sum + (selectedFoundations.some((chosen) => chosen.items.some((other) => origin(other) === origin(item))) ? 0 : 1), 0);
        return newFoundationParts * 8 + Math.min(newOrigins, 1) * 3 - (bestCost - candidate.cost) / Math.max(4, availableBu);
      };
      return score(b) - score(a) || a.rank - b.rank || a.key.localeCompare(b.key);
    });
    const choice = eligible[0]!;
    usedKeys.add(choice.key);
    selectedFoundations.push(choice);
    selected.push({ key: choice.key, items: choice.items, cost: choice.cost });
  }
  return selected;
}
