import { isMirrorableOperation, readMirrorMeta, resolveMirrorEffect } from "@/lib/engine/mirror";
import type { HardModifier } from "@/types/swordweave";

/** Tier, category, and origin do not limit mirroring. */
export interface MirrorCandidate {
  id: number;
  isMirrorable?: boolean | null;
  mirrorBuCredit?: number | null;
  buCost: number;
  mirrorVector?: string | null;
  hardModifiers?: readonly unknown[] | null;
}

function modifiersOf(candidate: MirrorCandidate): HardModifier[] {
  return (candidate.hardModifiers ?? []).filter((entry): entry is HardModifier =>
    Boolean(entry) && typeof entry === "object" && typeof (entry as { operation?: unknown }).operation === "string");
}

function hasMirroredEffect(candidate: MirrorCandidate): boolean {
  const vector = candidate.mirrorVector ?? "VARIABLE_VECTOR";
  return modifiersOf(candidate).some((modifier) => {
    if (readMirrorMeta(modifier)?.optedOut) return false;
    if (vector === "VARIABLE_VECTOR") return isMirrorableOperation(modifier.operation);
    return vector === "STRUCTURAL_FAULT" || vector === "COST_INSTABILITY";
  });
}

export function eligibleMirrorCandidates<T extends MirrorCandidate>(
  primitives: readonly T[],
  debtCeiling: number,
): T[] {
  return primitives.filter((primitive) => {
    const credit = primitive.mirrorBuCredit ?? primitive.buCost;
    return primitive.isMirrorable === true && Number.isFinite(credit) &&
      credit > 0 && credit <= debtCeiling && hasMirroredEffect(primitive);
  });
}

function targetLabel(modifier: HardModifier): string {
  const scope = (modifier.metadata?.["targetScope"] as { values?: unknown[] } | undefined)?.values?.[0];
  if (modifier.target === "skill_practice_check" && typeof scope === "string") {
    return `${scope.toLowerCase()} practice checks`;
  }
  return ({ max_vitality: "Max Vitality", defense_dc: "Defense DC", load: "Load",
    skill_practice_check: "practice checks" } as Record<string, string>)[modifier.target]
    ?? modifier.target.replaceAll("_", " ");
}

/** Describe the mirrored modifier using the value the runtime applies. */
export function mirrorConsequence(candidate: MirrorCandidate): string {
  const vector = candidate.mirrorVector ?? "VARIABLE_VECTOR";
  const modifier = modifiersOf(candidate).find((item) => !readMirrorMeta(item)?.optedOut &&
    (vector !== "VARIABLE_VECTOR" || isMirrorableOperation(item.operation)));
  if (!modifier) return "No mirrored mechanical effect is available.";
  if (vector === "STRUCTURAL_FAULT") return "Mirrored effect: its protection becomes a vulnerability.";
  if (vector === "COST_INSTABILITY") return "Mirrored effect: its benefit carries an ongoing cost.";

  const value = modifier.value && typeof modifier.value === "object" && "value" in modifier.value
    ? (modifier.value as { value: unknown }).value : modifier.value;
  const resolved = resolveMirrorEffect(vector, true, value);
  const label = targetLabel(modifier);
  const condition = modifier.condition as { kind?: string; text?: string } | undefined;
  const timing = condition?.kind === "narrative" && condition.text ? ` ${condition.text}` : "";
  if ((modifier.operation === "add" || modifier.operation === "subtract") &&
    typeof value === "number" && Number.isFinite(value)) {
    const signedChange = modifier.operation === "add" ? resolved.targetValue : -resolved.targetValue;
    return `Mirrored effect: ${signedChange < 0 ? "subtract" : "add"} ${Math.abs(signedChange)} ${signedChange < 0 ? "from" : "to"} ${label}${timing}.`;
  }
  return `Mirrored effect: ${modifier.operation} ${resolved.targetValue} on ${label}${timing}.`;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  // Avalanche the low bits so nearby numeric IDs have independent ranks.
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  return (result ^ (result >>> 16)) >>> 0;
}

/**
 * Draw from every eligible primitive, regardless of origin or duplicate name.
 * Kept choices never return to the suggestion row. A shuffle walks the entire
 * available catalog before recycling choices, and avoids the immediately
 * previous row even when a small catalog has to repeat.
 */
export function chooseMirrorSuggestions<T extends MirrorCandidate>(
  options: readonly T[],
  characterName: string,
  seed: number,
  keptIds: readonly number[] = [],
  previousIds: readonly number[] = [],
  count = 3,
  seenIds: readonly number[] = [],
): T[] {
  const kept = new Set(keptIds);
  const previous = new Set(previousIds);
  const seen = new Set(seenIds);
  const available = [...new Map(options.filter((item) => !kept.has(item.id)).map((item) => [item.id, item])).values()];
  const ranked = available.sort((a, b) =>
    hash(`${characterName}:${seed}:${a.id}`) - hash(`${characterName}:${seed}:${b.id}`) || a.id - b.id);
  return [
    ...ranked.filter((item) => !seen.has(item.id) && !previous.has(item.id)),
    ...ranked.filter((item) => !seen.has(item.id) && previous.has(item.id)),
    ...ranked.filter((item) => seen.has(item.id) && !previous.has(item.id)),
    ...ranked.filter((item) => seen.has(item.id) && previous.has(item.id)),
  ]
    .slice(0, Math.max(0, count));
}
