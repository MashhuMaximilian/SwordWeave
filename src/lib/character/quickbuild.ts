import {
  expandBundles,
  summarizeExpansionCost,
  type BundleExpansionInput,
} from "@/lib/engine/bundle-expander";
import {
  parseLineageSize,
  type CharacterSize,
} from "@/lib/heritage/lineage-size";
import { adoptCreationPurchases } from "./creation-primitives";

export const QUICKBUILD_KINDS = ["LINEAGE", "UPBRINGING", "MANIFEST"] as const;
export type QuickbuildKind = (typeof QUICKBUILD_KINDS)[number];
export type QuickbuildSelection = Record<QuickbuildKind, string>;
export const EMPTY_QUICKBUILD: QuickbuildSelection = {
  LINEAGE: "",
  UPBRINGING: "",
  MANIFEST: "",
};
export interface QuickbuildPrimitive {
  id: number;
  category?: string;
  buCost: number;
  mirrorBuCredit: number;
}
export type QuickbuildHeritage = BundleExpansionInput["heritages"][number] & {
  name: string;
  description: string | null;
  imageUrl: string | null;
  defaultSize: CharacterSize | null;
  cost: number;
  rules?: Array<{
    primitiveId: number;
    name: string;
    text: string;
    mechanical: boolean;
    source: "primitive" | "capability" | "effect";
    isMirrored: boolean;
  }>;
};
export interface QuickbuildCatalog {
  heritages: QuickbuildHeritage[];
  primitives: QuickbuildPrimitive[];
}

export function quickbuildCost(
  catalog: QuickbuildCatalog,
  selection: QuickbuildSelection,
  direct: readonly number[] = [],
  mirrored: readonly number[] = [],
) {
  const selected = QUICKBUILD_KINDS.flatMap((kind) => {
    const row = catalog.heritages.find(
      (h) => h.id === selection[kind] && h.kind === kind,
    );
    return row ? [row] : [];
  });
  const expansion = adoptCreationPurchases(expandBundles({
    heritages: selected,
    capabilities: [],
    effects: [],
    primitives: [
      ...direct.map((primitiveId) => ({
        primitiveId,
        source: "PERSONAL" as const,
        isMirrored: false,
      })),
      ...mirrored.map((primitiveId) => ({
        primitiveId,
        source: "PERSONAL" as const,
        isMirrored: true,
      })),
    ],
  }));
  return {
    ...summarizeExpansionCost(
      expansion,
      new Map(catalog.primitives.map((p) => [p.id, p.buCost])),
      new Map(catalog.primitives.map((p) => [p.id, p.mirrorBuCredit])),
    ),
    size: parseLineageSize(
      selected.find((h) => h.kind === "LINEAGE")?.defaultSize,
    ),
    selected,
    expansion,
  };
}

export interface QuickbuildShuffleLimits {
  mode: "total" | "each";
  /** Null uses the character's current BU budget. */
  bu: number | null;
  overrides: Partial<Record<QuickbuildKind, number>>;
}

/** Fits the joint bundle cost, including shared inherited rules and optional direct purchases. */
export function shuffleQuickbuild(
  catalog: QuickbuildCatalog,
  budget: number,
  current: QuickbuildSelection,
  direct: readonly number[] = [],
  mirrored: readonly number[] = [],
  only?: QuickbuildKind,
  random = Math.random,
  maxMirrorCredit = Infinity,
  limits?: QuickbuildShuffleLimits,
): QuickbuildSelection {
  const affordable = (selection: QuickbuildSelection) => {
    const cost = quickbuildCost(catalog, selection, direct, mirrored);
    const limit = limits?.bu ?? budget;
    const heritageCost = quickbuildCost(catalog, selection).netCost;
    const withinTotal = limits?.mode !== "total" || heritageCost <= limit;
    const withinEach = (only ? [only] : QUICKBUILD_KINDS).every(kind => {
      const cap = limits?.overrides[kind] ?? (limits?.mode === "each" ? limit : Infinity);
      const heritage = catalog.heritages.find(h => h.id === selection[kind] && h.kind === kind);
      return !heritage || heritage.cost <= cap;
    });
    return cost.netCost <= budget && cost.mirrorCredit <= maxMirrorCredit && withinTotal && withinEach;
  };
  const kinds = only ? [only] : [...QUICKBUILD_KINDS];
  let best = only ? { ...current } : { ...EMPTY_QUICKBUILD };
  let bestCount = -1;
  // Bounded retries favor a complete trio when the budget permits it, without
  // enumerating every combination or forcing three heritages on the player.
  for (let attempt = 0; attempt < (only ? 1 : 32); attempt++) {
    let result = only ? { ...current } : { ...EMPTY_QUICKBUILD };
    for (const kind of kinds) {
      const options = catalog.heritages.filter(
        (h) => h.kind === kind && affordable({ ...result, [kind]: h.id }),
      );
      const fresh = options.filter((h) => h.id !== current[kind]);
      const pool = fresh.length ? fresh : options;
      if (pool.length)
        result = {
          ...result,
          [kind]:
            pool[
              Math.min(
                pool.length - 1,
                Math.max(0, Math.floor(random() * pool.length)),
              )
            ]!.id,
        };
    }
    const count = kinds.filter((kind) => result[kind]).length;
    if (count > bestCount) {
      best = result;
      bestCount = count;
    }
    if (count === kinds.length) return result;
  }
  return best;
}
