import { queryLibrary } from "@/lib/publishing/library-query";
import { prepareMonster } from "./service";
import { monsterDefinitionSchema, type MonsterReference } from "./model";
import { monsterPreviewInput } from "./draft";
export type MonsterShuffleOptions = { shuffleKinds?: readonly ("PRIMITIVE" | "CAPABILITY")[]; shuffleBudget?: number };
/** A reviewable replacement: keep locked and unrelated references and the foundation. */
export async function shuffleMonster(value: unknown, userId: string, locks: readonly string[], options: MonsterShuffleOptions = {}) {
  const original = monsterDefinitionSchema.parse(monsterPreviewInput(value));
  const kinds = options.shuffleKinds ?? ["PRIMITIVE", "CAPABILITY"];
  if (!Array.isArray(kinds) || !kinds.length || kinds.length > 2 || kinds.some(k => k !== "PRIMITIVE" && k !== "CAPABILITY")) throw new Error("Choose primitives, capabilities, or both to shuffle.");
  const budget = options.shuffleBudget ?? original.budget;
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > original.budget) throw new Error("Shuffle budget must be a whole number from 1 to the creature budget.");
  const references: MonsterReference[] = original.references.filter((ref, index) => !kinds.includes(ref.kind as "PRIMITIVE" | "CAPABILITY") || locks.includes(`reference:${index}`));
  let prepared = await prepareMonster({ ...original, references }, userId);
  if (prepared.sheet.spent > budget) throw new Error("Kept components already exceed this shuffle budget. Increase it or unlock some choices.");
  const libraries = await Promise.all([...new Set(kinds)].map(targetType => queryLibrary({ targetType, viewerClerkId: userId, minBu: 1, maxBu: budget, limit: 100, sort: "ALPHABETICAL" })));
  const pool = libraries.flatMap((library, index) => library.items.filter(item => item.buCost !== null && item.buCost > 0).map(item => ({ item, kind: [...new Set(kinds)][index]! })));
  // Randomize once, bound expensive graph resolution, and verify actual shared ownership cost.
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  let added = 0;
  for (const { item, kind } of pool.slice(0, 18)) {
    if (added >= 5) break;
    if (references.some(ref => ref.kind === kind && ref.id === item.targetId)) continue;
    const candidate: MonsterReference = { kind, id: item.targetId, quantity: 1, isMirrored: false, versionId: null };
    try {
      const next = await prepareMonster({ ...original, references: [...references, candidate] }, userId);
      if (next.sheet.spent > budget) continue;
      references.push(candidate); prepared = next; added++;
    } catch (error) {
      // Templates and unavailable/invalid community expressions are not playable packages.
      if (!(error instanceof Error)) throw error;
    }
  }
  if (!added) throw new Error("No published components fit these shuffle choices. Try another category or a larger budget.");
  return prepared;
}
