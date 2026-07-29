"use client";

/**
 * useDeepPrimitiveClosure — Phase 8.4 v11 (Mashu 2026-07-28)
 *
 * Walks the deep transitive closure of primitives —
 * heritage → capability → primitive AND heritage →
 * capability → effect → primitive. Returns a map of
 * primitiveId → { primitive, sourceCapabilityId,
 * sourceEffectId? }.
 *
 * The character API can't return this directly because
 * depth-3+ Drizzle joins mis-scope Postgres LATERAL
 * (see the explicit warning in
 * src/app/api/characters/[id]/route.ts lines 122-128).
 * So we lazy-load the bundle for each capability in
 * each heritage the character has.
 */

import { useEffect, useState } from "react";

export interface BundlePrimitive {
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
    isMirrorable: boolean;
    mirrorBuCredit: number;
    narrativeRule: string | null;
    hardModifiers: unknown[];
  };
  sourceCapabilityId: string;
  sourceEffectId: string | null;
  heritageId: string;
}

export type DeepPrimitiveMap = Map<number, BundlePrimitive>;

interface HeritageLinkForClosure {
  heritageId: string;
  heritage: { capabilityLinks: Array<{ capabilityId: string }> };
}

export function useDeepPrimitiveClosure(
  heritageLinks: ReadonlyArray<HeritageLinkForClosure>,
): DeepPrimitiveMap {
  const [map, setMap] = useState<DeepPrimitiveMap>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const capIds: Array<{ capId: string; heritageId: string }> = [];
    for (const hl of heritageLinks) {
      for (const cl of hl.heritage.capabilityLinks ?? []) {
        capIds.push({ capId: cl.capabilityId, heritageId: hl.heritageId });
      }
    }
    if (capIds.length === 0) {
      setMap(new Map());
      return;
    }
    (async () => {
      const next = new Map<number, BundlePrimitive>();
      const seenCaps = new Set<string>();
      await Promise.all(
        capIds.map(async ({ capId, heritageId }) => {
          if (seenCaps.has(capId)) return;
          seenCaps.add(capId);
          try {
            const res = await fetch(`/api/capabilities/${capId}`);
            if (!res.ok) return;
            const data = (await res.json()) as {
              capability?: {
                primitiveLinks?: Array<{
                  primitive: BundlePrimitive["primitive"];
                }>;
                effectLinks?: Array<{
                  effectId: string;
                  effect: {
                    primitiveLinks?: Array<{
                      primitive: BundlePrimitive["primitive"];
                    }>;
                  };
                }>;
              };
            };
            const cap = data.capability;
            if (!cap) return;
            for (const pl of cap.primitiveLinks ?? []) {
              if (next.has(pl.primitive.id)) continue;
              next.set(pl.primitive.id, {
                primitive: pl.primitive,
                sourceCapabilityId: capId,
                sourceEffectId: null,
                heritageId,
              });
            }
            for (const el of cap.effectLinks ?? []) {
              for (const pl of el.effect.primitiveLinks ?? []) {
                if (next.has(pl.primitive.id)) continue;
                next.set(pl.primitive.id, {
                  primitive: pl.primitive,
                  sourceCapabilityId: capId,
                  sourceEffectId: el.effectId,
                  heritageId,
                });
              }
            }
          } catch {
            // Network blip — skip; existing direct + heritage-level
            // primitives still cover the most important cases.
          }
        }),
      );
      if (cancelled) return;
      setMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [heritageLinks]);

  return map;
}
