import type { EncounterDefinition, CreatureSummary } from "./model";
export type GroupCandidate = {
  id: string;
  version: number;
  budget: number;
  role?: string;
};
export type EncounterGroup = {
  entries: EncounterDefinition["entries"];
  creatures: CreatureSummary[];
  creatureBu: number;
  itemBu: number;
  count: number;
  boss?: { templateId: string; version: number };
};
export type ShuffleLimits = {
  mode: "total" | "perCreature";
  bossBudget: number | null;
};
export function groupBudgetLimit(
  budget: number,
  count: number,
  limits: ShuffleLimits,
) {
  return limits.mode === "total"
    ? budget
    : budget * (count - (limits.bossBudget === null ? 0 : 1)) +
        (limits.bossBudget ?? 0);
}

/** Choose a full roster within the creature budget. Equipment is appraised separately after resolution. */
export function shuffleEncounterEntries(
  candidates: readonly GroupCandidate[],
  budget: number,
  count: number,
  random = Math.random,
  limits: ShuffleLimits = { mode: "total", bossBudget: null },
): EncounterDefinition["entries"] {
  if (
    !Number.isSafeInteger(budget) ||
    budget < 1 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 20 ||
    (limits.bossBudget !== null &&
      (!Number.isSafeInteger(limits.bossBudget) || limits.bossBudget < 1))
  )
    throw new Error("Choose a positive BU limit and 1–20 creatures.");
  const total = groupBudgetLimit(budget, count, limits);
  const regularCap = limits.mode === "perCreature" ? budget : total;
  const available = candidates.filter(
    (c) =>
      Number.isSafeInteger(c.budget) &&
      c.budget > 0 &&
      c.budget <= Math.max(regularCap, limits.bossBudget ?? 0) &&
      Number.isSafeInteger(c.version) &&
      c.version > 0,
  );
  const selected: EncounterDefinition["entries"] = [];
  const roles = new Set<string>();
  let remaining = total;
  let regular = available.filter((c) => c.budget <= regularCap);
  let slots = count;
  const pick = (pool: readonly GroupCandidate[]) =>
    pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  if (limits.bossBudget !== null) {
    const eligible = available.filter(
      (boss) =>
        boss.budget <= limits.bossBudget! &&
        (count === 1
          ? boss.budget <= total
          : regular.some(
              (c) =>
                c.id !== boss.id &&
                boss.budget + c.budget * (count - 1) <= total,
            )),
    );
    const solos = eligible.filter((c) => c.role === "Solo");
    const bosses = (solos.length ? solos : eligible).sort(
      (a, b) => b.budget - a.budget,
    );
    if (!bosses.length) return [];
    // Prefer a substantial lead creature without treating its budget as a difficulty rating.
    const boss = pick(
      bosses.slice(0, Math.max(1, Math.ceil(bosses.length / 3))),
    );
    selected.push({ templateId: boss.id, version: boss.version, quantity: 1 });
    remaining -= boss.budget;
    slots--;
    regular = regular.filter((c) => c.id !== boss.id);
    if (boss.role) roles.add(boss.role);
  }
  const cheapest = Math.min(...regular.map((c) => c.budget));
  if (slots && (!regular.length || cheapest > remaining / slots)) return [];
  for (let slot = 0; slot < slots; slot++) {
    const limit = Math.min(
      regularCap,
      remaining - (slots - slot - 1) * cheapest,
    );
    const choices = regular.filter((c) => c.budget <= limit);
    const varied = choices.filter(
      (c) =>
        !selected.some((e) => e.templateId === c.id) &&
        (!c.role || !roles.has(c.role)),
    );
    const choice = pick(varied.length && random() < 0.8 ? varied : choices);
    const existing = selected.find(
      (e) => e.templateId === choice.id && e.version === choice.version,
    );
    if (existing) existing.quantity++;
    else
      selected.push({
        templateId: choice.id,
        version: choice.version,
        quantity: 1,
      });
    remaining -= choice.budget;
    if (choice.role) roles.add(choice.role);
  }
  return selected;
}
