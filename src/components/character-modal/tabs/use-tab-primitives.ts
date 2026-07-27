/**
 * useTabPrimitives — Phase 8.3b UI revamp
 *
 * Aggregates ALL primitives active in a tab (direct + inherited) for
 * the unified top-section list. Returns:
 *
 *   direct: PendingSlot[] — primitive slots the user explicitly added
 *     on this tab (these already have full mirror/copy/remove controls
 *     in the modal store)
 *
 *   inherited: Array<{
 *     primitiveId, name, buCost, isMirrorable, mirrorBuCredit,
 *     provenance: 'direct-heritage' | 'direct-capability' |
 *                 'direct-effect' | 'direct',
 *     sourceLabel: string  // e.g. "via Aegis Shield"
 *   }> — primitives that arrived via heritage/capability/effect
 *     bundles on this tab. The user can mirror them (which writes a
 *     new mirror primitive slot to the queue) or add a direct-paid
 *     copy (which writes a new direct slot).
 *
 *   heritageCount, capabilityCount — used by the bottom accordion
 *     to decide how many rows to show.
 *
 * Implementation:
 *   * Reads pendingSlots[tabId] for direct primitive slots + heritage
 *     slots + capability slots (all sources for this tab).
 *   * Reads heritageBundleCache / capabilityBundleCache for the
 *     bundled primitives (already populated by HeritageSlotCard /
 *     CapabilitySlotCard, or by preloadHeritageBundles / preloads).
 *   * Walks each bundle, expanding capabilities → primitives and
 *     capabilities → effects → primitives. Tags each primitive with
 *     its provenance for the source label.
 *
 * The hook is read-only — it does NOT mutate the queue. The caller
 * wires the mirror/copy buttons back to queueSlot / setSlotMirror.
 */
import { useMemo } from "react";
import {
  useCharacterModal,
  type CharacterTabId,
  type PendingSlot,
} from "../character-modal-store";

// -----------------------------------------------------------------------
// Shared bundle types (mirrored from slot-receiver-tab.tsx so this
// hook is self-contained).
// -----------------------------------------------------------------------

export interface BundlePrimitiveLink {
  primitiveId: number;
  isMirrored?: boolean;
  quantity?: number;
  primitive: { id: number; name: string; buCost: number | null } | null;
}
export interface BundleEffectLink {
  effectId: string;
  effect: { id: string; name: string } | null;
  primitiveLinks: BundlePrimitiveLink[];
}
export interface BundleCapabilityLink {
  capabilityId: string;
  capability: { id: string; name: string } | null;
  primitiveLinks: BundlePrimitiveLink[];
  effectLinks: BundleEffectLink[];
}
export interface HeritageBundleLite {
  id: string;
  name: string;
  primitiveLinks: BundlePrimitiveLink[];
  capabilityLinks: BundleCapabilityLink[];
}

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

export type Provenance =
  | { kind: "direct-heritage"; heritageName: string }
  | { kind: "direct-capability"; capabilityName: string }
  | { kind: "direct-effect"; capabilityName: string; effectName: string }
  | { kind: "direct" };

export interface InheritedPrimitive {
  primitiveId: number;
  name: string;
  buCost: number | null;
  isMirrorable: boolean | null;
  mirrorBuCredit: number | null;
  provenance: Exclude<Provenance, { kind: "direct" }>;
}

export interface TabPrimitives {
  /** Primitive slots the user explicitly added on this tab. */
  direct: Extract<PendingSlot, { kind: "primitive" }>[];
  /** Primitives arriving via heritage/capability/effect bundles. */
  inherited: InheritedPrimitive[];
  /** Heritage slots on this tab (for the bottom accordion). */
  heritageSlots: Extract<PendingSlot, { kind: "heritage" }>[];
  /** Capability slots on this tab (for the bottom accordion). */
  capabilitySlots: Extract<PendingSlot, { kind: "capability" }>[];
}

/**
 * Phase 8.3b: read the modal's bundle caches directly. These are
 * module-level Maps populated by slot-receiver-tab.tsx as bundles
 * load. We import lazily via a getter so this hook can be called from
 * components without circular imports.
 */
type BundleCacheReader = () => {
  heritageBundles: Map<string, HeritageBundleLite | null>;
  capabilityBundles: Map<string, CapabilityBundleLike | null>;
};

/** Local mirror of CapabilityBundle from slot-receiver-tab.tsx — kept
 *  loose to avoid a circular import. */
interface CapabilityBundleLike {
  id: string;
  name: string;
  primitiveLinks: Array<{
    primitiveId: number;
    isMirrored?: boolean;
    quantity?: number;
    primitive: { id: number; name: string; buCost: number | null } | null;
  }>;
  effectLinks: Array<{
    effectId: string;
    effect: { id: string; name: string } | null;
    primitiveLinks: Array<{
      primitiveId: number;
      isMirrored?: boolean;
      quantity?: number;
      primitive: { id: number; name: string; buCost: number | null } | null;
    }>;
  }>;
  computedBu?: number;
}

let bundleReader: BundleCacheReader | null = null;

/** Slot-receiver-tab registers its caches here on module load. */
export function registerBundleCacheReader(reader: BundleCacheReader): void {
  bundleReader = reader;
}

// -----------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------

export function useTabPrimitives(tabId: CharacterTabId): TabPrimitives {
  const { pendingSlots } = useCharacterModal();
  const slots = pendingSlots[tabId];

  return useMemo(() => {
    const direct = slots.filter(
      (s): s is Extract<PendingSlot, { kind: "primitive" }> =>
        s.kind === "primitive",
    );
    const heritageSlots = slots.filter(
      (s): s is Extract<PendingSlot, { kind: "heritage" }> =>
        s.kind === "heritage",
    );
    const capabilitySlots = slots.filter(
      (s): s is Extract<PendingSlot, { kind: "capability" }> =>
        s.kind === "capability",
    );

    const inherited: InheritedPrimitive[] = [];
    const seen = new Set<number>(); // dedupe across sources
    const bundles = bundleReader?.() ?? {
      heritageBundles: new Map(),
      capabilityBundles: new Map(),
    };

    // Walk each heritage: primitiveLinks, capabilityLinks → primitiveLinks,
    // capabilityLinks → effectLinks → primitiveLinks.
    for (const hSlot of heritageSlots) {
      const bundle = bundles.heritageBundles.get(hSlot.heritageId);
      if (!bundle) continue;
      for (const link of bundle.primitiveLinks) {
        if (!link.primitive) continue;
        if (seen.has(link.primitive.id)) continue;
        seen.add(link.primitive.id);
        inherited.push({
          primitiveId: link.primitive.id,
          name: link.primitive.name,
          buCost: link.primitive.buCost,
          isMirrorable: null, // unknown at this layer
          mirrorBuCredit: null,
          provenance: { kind: "direct-heritage", heritageName: hSlot.name },
        });
      }
      for (const capLink of bundle.capabilityLinks) {
        const capName =
          capLink.capability?.name ?? "(unknown capability)";
        for (const p of capLink.primitiveLinks) {
          if (!p.primitive) continue;
          if (seen.has(p.primitive.id)) continue;
          seen.add(p.primitive.id);
          inherited.push({
            primitiveId: p.primitive.id,
            name: p.primitive.name,
            buCost: p.primitive.buCost,
            isMirrorable: null,
            mirrorBuCredit: null,
            provenance: {
              kind: "direct-capability",
              capabilityName: capName,
            },
          });
        }
        for (const effLink of capLink.effectLinks) {
          const effName = effLink.effect?.name ?? "(unknown effect)";
          for (const p of effLink.primitiveLinks) {
            if (!p.primitive) continue;
            if (seen.has(p.primitive.id)) continue;
            seen.add(p.primitive.id);
            inherited.push({
              primitiveId: p.primitive.id,
              name: p.primitive.name,
              buCost: p.primitive.buCost,
              isMirrorable: null,
              mirrorBuCredit: null,
              provenance: {
                kind: "direct-effect",
                capabilityName: capName,
                effectName: effName,
              },
            });
          }
        }
      }
    }

    // Walk each direct capability slot: primitiveLinks, effectLinks.
    for (const cSlot of capabilitySlots) {
      const capBundle = bundles.capabilityBundles.get(cSlot.capabilityId);
      if (!capBundle) continue;
      const capName = cSlot.name;
      for (const p of capBundle.primitiveLinks) {
        if (!p.primitive) continue;
        if (seen.has(p.primitive.id)) continue;
        seen.add(p.primitive.id);
        inherited.push({
          primitiveId: p.primitive.id,
          name: p.primitive.name,
          buCost: p.primitive.buCost,
          isMirrorable: null,
          mirrorBuCredit: null,
          provenance: {
            kind: "direct-capability",
            capabilityName: capName,
          },
        });
      }
      for (const effLink of capBundle.effectLinks) {
        const effName = effLink.effect?.name ?? "(unknown effect)";
        for (const p of effLink.primitiveLinks) {
          if (!p.primitive) continue;
          if (seen.has(p.primitive.id)) continue;
          seen.add(p.primitive.id);
          inherited.push({
            primitiveId: p.primitive.id,
            name: p.primitive.name,
            buCost: p.primitive.buCost,
            isMirrorable: null,
            mirrorBuCredit: null,
            provenance: {
              kind: "direct-effect",
              capabilityName: capName,
              effectName: effName,
            },
          });
        }
      }
    }

    return { direct, inherited, heritageSlots, capabilitySlots };
  }, [slots]);
}

/**
 * Compose a short human-readable label for an inherited primitive's
 * provenance (e.g. "via Aegis Shield", "via Aegis Shield > System Freeze").
 */
export function provenanceLabel(p: InheritedPrimitive["provenance"]): string {
  switch (p.kind) {
    case "direct-heritage":
      return `via ${p.heritageName}`;
    case "direct-capability":
      return `via ${p.capabilityName}`;
    case "direct-effect":
      return `via ${p.capabilityName} > ${p.effectName}`;
  }
}