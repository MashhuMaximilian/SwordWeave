import type { BundleExpansionResult, CharacterPrimitiveSource, ExpandedPrimitive } from "@/lib/engine/bundle-expander";

export type CreationPrimitive = { id: number; category: string; buCost: number; name: string };

/** Creation selects owned definitions. A package reference to a definition
 * already supplied by a heritage reuses that purchase, just as sheet editing
 * adopts the first direct occurrence into an inherited supply. Further explicit
 * copies remain separate occurrences; mirrored rules retain their own state. */
export function adoptCreationPurchases(expansion: BundleExpansionResult): Omit<BundleExpansionResult, "primitives"> & {
  primitives: Array<ExpandedPrimitive & { directSource?: CharacterPrimitiveSource }>;
} {
  const adopted = new Set<number>();
  const inherited = new Map(expansion.primitives.filter(p => !p.isMirrored && Boolean(p.originHeritageId || p.originCapabilityId || p.originEffectId)).map(p => [p.primitiveId, { ...p }]));
  const result: Array<ExpandedPrimitive & { directSource?: CharacterPrimitiveSource }> = [];
  for (const primitive of expansion.primitives) {
    const baseline = inherited.get(primitive.primitiveId);
    if (!primitive.isMirrored && baseline && !primitive.originHeritageId && !primitive.originCapabilityId && !primitive.originEffectId && !adopted.has(primitive.primitiveId)) {
      adopted.add(primitive.primitiveId);
      (baseline as ExpandedPrimitive & { directSource?: CharacterPrimitiveSource }).directSource = primitive.source;
      continue;
    }
    result.push(baseline === undefined || primitive.isMirrored || !Boolean(primitive.originHeritageId || primitive.originCapabilityId || primitive.originEffectId) ? primitive : baseline);
  }
  return { ...expansion, primitives: result };
}

/** Items deliberately never enter the creation expansion. A mirrored access
 * rule does not grant the positive access required to begin play. */
export function missingCreationAccess(expansion: BundleExpansionResult, definitions: readonly { id: number; category?: string }[]): string[] {
  const owned = new Set(expansion.primitives.filter(p => !p.isMirrored).map(p => p.primitiveId));
  const categories = new Set(definitions.filter(p => owned.has(p.id)).map(p => p.category));
  return [!categories.has("VERB_TIER") ? "verb tier" : "", !categories.has("DOMAIN") ? "domain" : ""].filter(Boolean);
}

export const FREE_CREATION_PRIMITIVES = ["Touch Range", "Minor Die Block"] as const;
