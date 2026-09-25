import type { EntityKind } from "../model";

export type DiscoveryHeritageCategory = "LINEAGE" | "UPBRINGING" | "MANIFEST" | "ITEM";

/** Heritage bundles belong to one root; ordinary pieces retain their destination's kind rules. */
export function matchesDiscoveryDestination(
  kind: EntityKind,
  heritageType: string | undefined,
  category?: DiscoveryHeritageCategory,
): boolean {
  return kind !== "heritage" || !category || (category !== "ITEM" && heritageType === category);
}
