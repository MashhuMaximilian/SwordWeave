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
};

/** Choose a full roster within the creature budget. Equipment is appraised separately after resolution. */
export function shuffleEncounterEntries(
  candidates: readonly GroupCandidate[],
  budget: number,
  count: number,
  random = Math.random,
): EncounterDefinition["entries"] {
  if (
    !Number.isSafeInteger(budget) ||
    budget < 1 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 20
  )
    throw new Error("Choose a positive BU limit and 1–20 creatures.");
  const available = candidates.filter(
    (c) =>
      Number.isSafeInteger(c.budget) &&
      c.budget > 0 &&
      c.budget <= budget &&
      Number.isSafeInteger(c.version) &&
      c.version > 0,
  );
  const cheapest = Math.min(...available.map((c) => c.budget));
  if (!available.length || cheapest > budget / count) return [];
  const selected: EncounterDefinition["entries"] = [];
  const roles = new Set<string>();
  let remaining = budget;
  for (let slot = 0; slot < count; slot++) {
    const limit = remaining - (count - slot - 1) * cheapest;
    const choices = available.filter((c) => c.budget <= limit);
    // Prefer different templates and roles, while allowing useful repeated creatures.
    const varied = choices.filter(
      (c) =>
        !selected.some((e) => e.templateId === c.id) &&
        (!c.role || !roles.has(c.role)),
    );
    const pool = varied.length && random() < 0.8 ? varied : choices;
    const choice =
      pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
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
