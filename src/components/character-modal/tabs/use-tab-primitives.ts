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
import { useMemo, useState, useEffect } from "react";
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
  primitive: {
    id: number;
    name: string;
    buCost: number | null;
    isMirrorable?: boolean;
    mirrorBuCredit?: number;
    targetScope?: string | null;
    hardModifiers?: ReadonlyArray<unknown> | null;
  } | null;
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
  /** DB-level mirror flag from the primitive row. */
  isMirrorable: boolean | null;
  mirrorBuCredit: number | null;
  /** Modifier target scope (e.g. "max_vitality") — used for the
   *  "mirrors to" display in the expanded view. Null if the primitive
   *  has no target scope (i.e. it's not a modifier primitive). */
  targetScope: string | null;
  /** The raw hard-modifier payload — used to render the modifier
   *  chips in the expanded view. */
  hardModifiers: ReadonlyArray<unknown>;
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
  /**
   * Phase 8.3b UI fix #2 (Mashu 2026-07-27): heritage/capability IDs
   * on this tab whose bundle is still being fetched. Used by
   * SlotReceiverTab to render a loading state in the active-primitives
   * list area while the bundle resolves. Read straight from the
   * in-flight sets registered by slot-receiver-tab.tsx — the hook
   * re-runs its useMemo on every render so the spinner disappears as
   * soon as the fetch completes.
   */
  loadingBundleIds: ReadonlyArray<string>;
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
  /** Phase 8.3b UI fix #2 — in-flight sets for loading state. */
  heritageInFlight: Set<string>;
  capabilityInFlight: Set<string>;
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
    primitive: {
      id: number;
      name: string;
      buCost: number | null;
      isMirrorable?: boolean;
      mirrorBuCredit?: number;
      targetScope?: string | null;
      hardModifiers?: ReadonlyArray<unknown>;
    } | null;
  }>;
  effectLinks: Array<{
    effectId: string;
    effect: { id: string; name: string } | null;
    primitiveLinks: Array<{
      primitiveId: number;
      isMirrored?: boolean;
      quantity?: number;
      primitive: {
        id: number;
        name: string;
        buCost: number | null;
        isMirrorable?: boolean;
        mirrorBuCredit?: number;
        targetScope?: string | null;
        hardModifiers?: ReadonlyArray<unknown>;
      } | null;
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

  // Phase 8.3b UI fix #2 follow-up (Mashu 2026-07-27):
  //   The bundle cache is module-level mutable state. When a
  //   preloader / card fires sw-character-bundle-loaded, the form's
  //   bundleVersion bumps and re-renders — but pendingSlots[tabId]
  //   reference doesn't change, so useMemo's [slots] dep array
  //   would skip recomputation and the freshly-loaded bundle would
  //   never show up in the active-primitives list. We subscribe to
  //   the same event here so useMemo's deps list also bumps.
  const [bundleVersion, setBundleVersion] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setBundleVersion((v) => v + 1);
    window.addEventListener("sw-character-bundle-loaded", handler);
    return () =>
      window.removeEventListener("sw-character-bundle-loaded", handler);
  }, []);

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
    const bundles: ReturnType<NonNullable<typeof bundleReader>> =
      bundleReader?.() ?? {
        heritageBundles: new Map(),
        capabilityBundles: new Map(),
        heritageInFlight: new Set<string>(),
        capabilityInFlight: new Set<string>(),
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
          isMirrorable: link.primitive.isMirrorable ?? null,
          mirrorBuCredit: link.primitive.mirrorBuCredit ?? null,
          targetScope: link.primitive.targetScope ?? null,
          hardModifiers: link.primitive.hardModifiers ?? [],
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
            isMirrorable: p.primitive.isMirrorable ?? null,
            mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
            targetScope: p.primitive.targetScope ?? null,
            hardModifiers: p.primitive.hardModifiers ?? [],
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
              isMirrorable: p.primitive.isMirrorable ?? null,
              mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
              targetScope: p.primitive.targetScope ?? null,
              hardModifiers: p.primitive.hardModifiers ?? [],
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
          isMirrorable: p.primitive.isMirrorable ?? null,
          mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
          targetScope: p.primitive.targetScope ?? null,
          hardModifiers: p.primitive.hardModifiers ?? [],
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
            isMirrorable: p.primitive.isMirrorable ?? null,
            mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
            targetScope: p.primitive.targetScope ?? null,
            hardModifiers: p.primitive.hardModifiers ?? [],
            provenance: {
              kind: "direct-effect",
              capabilityName: capName,
              effectName: effName,
            },
          });
        }
      }
    }

    // Phase 8.3b UI fix #2: snapshot the in-flight bundle IDs on this
    // tab. SlotReceiverTab uses this to render a loading spinner in
    // Section 1 while the bundle resolves (so the user doesn't have
    // to toggle tabs to mount Section 2 first).
    const loadingBundleIds: string[] = [];
    for (const hSlot of heritageSlots) {
      if (bundles.heritageInFlight.has(hSlot.heritageId)) {
        loadingBundleIds.push(`heritage:${hSlot.heritageId}`);
      }
    }
    for (const cSlot of capabilitySlots) {
      if (bundles.capabilityInFlight.has(cSlot.capabilityId)) {
        loadingBundleIds.push(`capability:${cSlot.capabilityId}`);
      }
    }

    return {
      direct,
      inherited,
      heritageSlots,
      capabilitySlots,
      loadingBundleIds,
    };
  }, [slots, bundleVersion]);
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