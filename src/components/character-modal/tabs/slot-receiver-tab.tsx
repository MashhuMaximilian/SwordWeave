"use client";

// =============================================================================
// SlotReceiverTab — generic slot receiver for tabs 4-7
// (Lineage / Upbringing / Manifest / Items).
//
// Per Mashu 2026-07-21: each tab is a SLOT RECEIVER — it doesn't host
// a library picker. Instead, the user slots things from /atelier via
// the context-aware "Slot into [step]" button on library previews.
//
// === Phase 8.3b UI revamp: unified top + collapsed bottom ===
// Each tab now renders two sections:
//   1. Top — unified primitive list (all direct + inherited, with
//      full controls). The user can mirror or copy ANY primitive
//      active in this tab right from the list.
//   2. Bottom — source bundles (heritages + direct capabilities),
//      collapsed into accordions. Expandable to see provenance /
//      read-only breakdown. Most of the screen real estate goes to
//      the primitives, not the heritage chrome.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCharacterModal,
  type CharacterTabId,
  type PendingSlot,
} from "../character-modal-store";
import {
  useTabPrimitives,
  registerBundleCacheReader,
  provenanceLabel,
  type InheritedPrimitive,
} from "./use-tab-primitives";

interface SlotReceiverTabProps {
  tabId: CharacterTabId;
  title: string;
  help: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

interface HeritageBundle {
  id: string;
  name: string;
  description: string | null;
  primitiveLinks: Array<{
    primitiveId: number;
    isMirrored: boolean;
    primitive: { id: number; name: string; buCost: number | null } | null;
  }>;
  // Phase 8.1 batch 13.1 follow-up: capabilities now carry their
  // primitive + effect join so the modal can show the full
  // transitive closure ("Primitives from capabilities", "Primitives
  // from effects"). The endpoint (/api/heritage/[id]) was extended
  // in the same batch to deep-join these.
  capabilityLinks: Array<{
    capabilityId: string;
    capability: { id: string; name: string; description: string | null } | null;
    primitiveLinks: Array<{
      primitiveId: number;
      quantity: number;
      primitive: { id: number; name: string; buCost: number | null } | null;
    }>;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string | null } | null;
      primitiveLinks: Array<{
        primitiveId: number;
        quantity: number;
        primitive: { id: number; name: string; buCost: number | null } | null;
      }>;
    }>;
  }>;
  computedBu: number;
}

// Bundle cache shared across all SlotReceiverTab instances for the
// session — keyed by heritageId. Avoids refetching when switching tabs.
const heritageBundleCache = new Map<string, HeritageBundle | null>();

// Phase 8.1 batch 13.5 follow-up: same shape as HeritageBundle but for
// capability slots. The capability slot card (see below) fetches
// /api/capabilities/[id] on mount and renders the same exploded
// "Primitives from Capability" / "Primitives from Effects" sections.
// Mashu 2026-07-22: "in character creation I still don't see all the
// primitives if I slot in a capability."
interface CapabilityBundle {
  id: string;
  name: string;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    isMirrored: boolean;
    primitive: { id: number; name: string; buCost: number | null } | null;
  }>;
  effectLinks: Array<{
    effectId: string;
    effect: { id: string; name: string; description: string | null };
    primitiveLinks: Array<{
      primitiveId: number;
      quantity: number;
      isMirrored: boolean;
      primitive: { id: number; name: string; buCost: number | null } | null;
    }>;
  }>;
  computedBu: number;
}
const capabilityBundleCache = new Map<string, CapabilityBundle | null>();

/**
 * Phase 8.3b UI revamp: expose bundle caches to useTabPrimitives via
 * a registered reader. The hook walks heritage + capability bundles
 * to build the unified primitive list at the top of each tab.
 */
registerBundleCacheReader(() => ({
  heritageBundles: heritageBundleCache,
  capabilityBundles: capabilityBundleCache,
}));

/**
 * Phase 8.1 batch 10: parent components (footer) need a quick lookup
 * of "how much BU does this heritage bundle cost?" for live BU
 * accounting. Exported as a Map view; populated lazily by the
 * HeritageSlotCard fetch on mount.
 */
export function getHeritageBundleBuMap(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, bundle] of heritageBundleCache.entries()) {
    if (bundle != null) out.set(id, bundle.computedBu);
  }
  return out;
}

/**
 * Phase 8.1 batch 13.6 follow-up: same shape as
 * getHeritageBundleBuMap() but for direct capability slots. Used by
 * the footer BU summary to reflect capability cost while editing.
 * Mashu 2026-07-22: "if I slot into anything primitives capabilities
 * or heritages the BU budget does not update."
 */
export function getCapabilityBundleBuMap(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, bundle] of capabilityBundleCache.entries()) {
    if (bundle != null) out.set(id, bundle.computedBu);
  }
  return out;
}

/**
 * Phase 8.2 batch 10: warm the heritage bundle cache for a list of
 * heritage IDs without rendering a HeritageSlotCard. Used after
 * applySeed() in the modal form so that seeded characters show
 * their full BU impact in the footer on first render — without
 * the user having to click into each tab (which was Mashu's
 * 2026-07-23 symptom: "It doesn't calculate budget when i enter
 * edit only if if go through each tab of builder").
 *
 * Each fetch hits /api/heritage/[id] (the same endpoint the
 * HeritageSlotCard uses), caches the normalised bundle into
 * heritageBundleCache, and dispatches sw-character-bundle-loaded
 * exactly the way the card does — so the form's bundleVersion
 * counter bumps and the useMemo recomputes.
 *
 * Idempotent: if the cache already has an entry, we skip.
 */
export async function preloadHeritageBundles(
  heritageIds: ReadonlyArray<string>,
): Promise<void> {
  const missing = heritageIds.filter(
    (id) => !heritageBundleCache.has(id),
  );
  if (missing.length === 0) return;
  await Promise.all(missing.map((id) => fetchAndCacheHeritageBundle(id)));
}

async function fetchAndCacheHeritageBundle(
  heritageId: string,
): Promise<void> {
  try {
    const res = await fetch(`/api/heritage/${heritageId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    const t = data.template as HeritageBundle | undefined;
    const normalised: HeritageBundle | null = t
      ? {
          id: t.id,
          name: t.name,
          description: t.description ?? null,
          primitiveLinks: t.primitiveLinks ?? [],
          capabilityLinks: (t.capabilityLinks ?? []).map((cl) => {
            const capRow = cl.capability as typeof cl.capability & {
              primitiveLinks?: Array<{
                primitiveId: number;
                quantity: number;
                isMirrored?: boolean;
                primitive: { id: number; name: string; buCost: number | null } | null;
              }>;
              effectLinks?: Array<{
                effectId?: string;
                effect: { id: string; name: string; description: string | null };
                primitiveLinks?: Array<{
                  primitiveId: number;
                  quantity: number;
                  isMirrored?: boolean;
                  primitive: { id: number; name: string; buCost: number | null } | null;
                }>;
              }>;
            };
            return {
              capabilityId: cl.capabilityId ?? cl.capability?.id ?? "",
              capability: cl.capability,
              primitiveLinks: capRow.primitiveLinks ?? [],
              effectLinks: (capRow.effectLinks ?? []).map((el) => ({
                effectId: el.effectId ?? el.effect?.id ?? "",
                effect: el.effect,
                primitiveLinks: el.primitiveLinks ?? [],
              })),
            };
          }),
          computedBu: t.computedBu ?? 0,
        }
      : null;
    heritageBundleCache.set(heritageId, normalised);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sw-character-bundle-loaded", {
          detail: { kind: "heritage", id: heritageId },
        }),
      );
    }
  } catch {
    heritageBundleCache.set(heritageId, null);
  }
}

/**
 * Phase 8.2 batch 10: same shape as preloadHeritageBundles() but
 * for direct capability slots. Capability bundles populate
 * capabilityBundleCache and dispatch the same custom event so the
 * footer recomputes.
 */
export async function preloadCapabilityBundles(
  capabilityIds: ReadonlyArray<string>,
): Promise<void> {
  const missing = capabilityIds.filter(
    (id) => !capabilityBundleCache.has(id),
  );
  if (missing.length === 0) return;
  await Promise.all(missing.map((id) => fetchAndCacheCapabilityBundle(id)));
}

async function fetchAndCacheCapabilityBundle(
  capabilityId: string,
): Promise<void> {
  try {
    const res = await fetch(`/api/capabilities/${capabilityId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    // Phase 8.2 batch 10: /api/capabilities/[id] returns the
    // capability under data.capability (not data.template). Match
    // CapabilitySlotCard's normaliser to keep the cache shape
    // consistent — including the deep-joined effect→primitive
    // links the slot card relies on.
    const c = data.capability as
      | (CapabilityBundle & { computedBu?: number })
      | undefined;
    const normalised: CapabilityBundle | null = c
      ? {
          id: c.id,
          name: c.name,
          primitiveLinks: c.primitiveLinks ?? [],
          effectLinks: (c.effectLinks ?? []).map((el) => ({
            effectId: el.effectId,
            effect: el.effect,
            primitiveLinks: el.primitiveLinks ?? [],
          })),
          computedBu: c.computedBu ?? 0,
        }
      : null;
    capabilityBundleCache.set(capabilityId, normalised);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sw-character-bundle-loaded", {
          detail: { kind: "capability", id: capabilityId },
        }),
      );
    }
  } catch {
    capabilityBundleCache.set(capabilityId, null);
  }
}

export function SlotReceiverTab({
  tabId,
  title,
  help,
  ctaPrimary,
  ctaSecondary,
}: SlotReceiverTabProps) {
  const { pendingSlots, removeSlot, setSlotMirror, queueSlot } = useCharacterModal();
  const slots = pendingSlots[tabId];

  const { direct, inherited, heritageSlots, capabilitySlots } =
    useTabPrimitives(tabId);

  // Force re-render when bundle caches populate (inherited list changes).
  // HeritageSlotCard fires sw-character-bundle-loaded on fetch complete;
  // we bump a counter so this tab re-derives.
  const [bundleVersion, setBundleVersion] = useState(0);
  useEffect(() => {
    const handler = () => setBundleVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("sw-character-bundle-loaded", handler);
      return () => window.removeEventListener("sw-character-bundle-loaded", handler);
    }
    return undefined;
  }, []);

  const isEmpty =
    slots.length === 0 && inherited.length === 0;

  // ---------------------------------------------------------------------
  // SECTION 1: Unified primitive list (top).
  //
  // We render ONE row per "instance parent" so the copy counter only
  // counts copies attached to the same parent. Two PendingSlots of the
  // same primitiveId with the same slot are different parents — each
  // gets its own row, own counter, own "add another" button.
  //
  // Direct slots (the user explicitly added these on this tab) come
  // first; inherited rows (from heritage/capability/effect bundles)
  // come after, tagged with provenance.
  // ---------------------------------------------------------------------

  const directRows = direct; // already filtered by useTabPrimitives

  const inheritedRows = inherited;

  // ---------------------------------------------------------------------
  // SECTION 2: Source bundles (bottom, collapsible).
  // ---------------------------------------------------------------------

  const totalBundleCount = heritageSlots.length + capabilitySlots.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </div>

      {isEmpty ? (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center">
          <p className="text-sm font-medium text-foreground">{ctaPrimary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ctaSecondary}</p>
        </div>
      ) : null}

      {/* SECTION 1: Unified primitive list */}
      {!isEmpty ? (
        <section>
          <header className="mb-2 flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active Primitives ({directRows.length + inheritedRows.length})
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Mirror, expand, or duplicate — all from here
            </span>
          </header>
          <ul className="space-y-2">
            {/* Direct primitives — each slot is its own row, no global dedup */}
            {directRows.map((slot, idx) => {
              const realIdx = slot.slotId
                ? slots.findIndex((s) => s.slotId === slot.slotId)
                : slots.indexOf(slot);
              return (
                <DirectPrimitiveRow
                  key={`direct-${slot.slotId ?? `${slot.primitiveId}-${idx}`}`}
                  slot={slot}
                  allDirectSlots={directRows}
                  onRemove={() => removeSlot(tabId, realIdx)}
                  onToggleMirror={(mirror: boolean) =>
                    setSlotMirror(slot.slotId ?? "", mirror)
                  }
                  onAddAnotherCopy={() => {
                    queueSlot({
                      kind: "primitive",
                      primitiveId: slot.primitiveId,
                      tab: slot.tab,
                      name: slot.name,
                      mirror: false,
                      ...(slot.isMirrorable === true
                        ? { isMirrorable: true }
                        : {}),
                      ...(typeof slot.mirrorBuCredit === "number"
                        ? { mirrorBuCredit: slot.mirrorBuCredit }
                        : {}),
                      ...(typeof slot.buCost === "number"
                        ? { buCost: slot.buCost }
                        : {}),
                    });
                  }}
                />
              );
            })}
            {/* Inherited primitives — read-only provenance rows */}
            {inheritedRows.map((p, idx) => (
              <InheritedPrimitiveRow
                key={`inherited-${p.primitiveId}-${idx}`}
                primitive={p}
                onMirror={() => {
                  // Mirror an inherited primitive: write a new direct
                  // mirror slot. We need isMirrorable + mirrorBuCredit
                  // from the underlying primitive — fall back to buCost
                  // if mirrorBuCredit unknown.
                  queueSlot({
                    kind: "primitive",
                    primitiveId: p.primitiveId,
                    tab: tabId,
                    name: p.name,
                    mirror: true,
                    ...(typeof p.buCost === "number"
                      ? { buCost: p.buCost }
                      : {}),
                    ...(typeof p.mirrorBuCredit === "number"
                      ? { mirrorBuCredit: p.mirrorBuCredit }
                      : {}),
                  });
                }}
                onAddCopy={() => {
                  // Add a direct-paid copy of an inherited primitive.
                  queueSlot({
                    kind: "primitive",
                    primitiveId: p.primitiveId,
                    tab: tabId,
                    name: p.name,
                    mirror: false,
                    ...(typeof p.buCost === "number"
                      ? { buCost: p.buCost }
                      : {}),
                  });
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* SECTION 2: Source bundles (collapsed accordions) */}
      {totalBundleCount > 0 ? (
        <section>
          <header className="mb-2 flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source Bundles ({totalBundleCount})
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Provenance — click [v] to inspect
            </span>
          </header>
          <ul className="space-y-2">
            {heritageSlots.map((slot, idx) => {
              const realIdx = slot.slotId
                ? slots.findIndex((s) => s.slotId === slot.slotId)
                : slots.indexOf(slot);
              return (
                <HeritageSlotCard
                  key={`heritage-${slot.slotId ?? `${slot.heritageId}-${idx}`}`}
                  slot={slot}
                  onRemove={() => removeSlot(tabId, realIdx)}
                />
              );
            })}
            {capabilitySlots.map((slot, idx) => {
              const realIdx = slot.slotId
                ? slots.findIndex((s) => s.slotId === slot.slotId)
                : slots.indexOf(slot);
              return (
                <CapabilitySlotCard
                  key={`capability-${slot.slotId ?? `${slot.capabilityId}-${idx}`}`}
                  slot={slot}
                  onRemove={() => removeSlot(tabId, realIdx)}
                />
              );
            })}
          </ul>
        </section>
      ) : null}
      {/* bundleVersion referenced for re-render only */}
      {bundleVersion > 0 ? null : null}
    </div>
  );
}

// =============================================================================
// DirectPrimitiveRow — one row per PendingSlot.
//
// Bug fix for Phase 8.3b UI revamp: copy counter is per-slot, not
// per-primitiveId. A direct slot is its own parent — the counter
// counts copies *attached to this specific slot* (none today, but
// kept as a hook for future "group siblings" behavior). Mirror rows
// are separate slots too and get their own row.
//
// Actually, the simpler model: each PendingSlot IS one row. The
// counter shows "1 of 1" if there's only this slot; "this is slot N"
// if a future phase groups siblings. For now, we just render each
// slot cleanly.
// =============================================================================

function DirectPrimitiveRow({
  slot,
  onRemove,
  onToggleMirror,
  onAddAnotherCopy,
}: {
  slot: Extract<PendingSlot, { kind: "primitive" }>;
  allDirectSlots: ReadonlyArray<Extract<PendingSlot, { kind: "primitive" }>>;
  onRemove: () => void;
  onToggleMirror: (mirror: boolean) => void;
  onAddAnotherCopy: () => void;
}) {
  const isMirrorable = slot.isMirrorable === true;
  const mirrored = slot.mirror === true;
  const buCost = slot.buCost ?? 0;

  return (
    <li className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{slot.name}</span>
            {isMirrorable ? (
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                  (mirrored
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "bg-secondary text-secondary-foreground")
                }
              >
                {mirrored ? "Mirrored" : "Mirrorable"}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Direct primitive · {buCost} BU
            {mirrored ? ` → −${slot.mirrorBuCredit ?? buCost} BU debt` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          Remove
        </button>
      </div>
      {isMirrorable ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={mirrored}
            onChange={(e) => onToggleMirror(e.target.checked)}
            className="size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-muted-foreground">
            Mirror this primitive (BU debt of{" "}
            <span className="font-mono">
              −{slot.mirrorBuCredit ?? buCost}
            </span>
            )
          </span>
        </label>
      ) : null}
      <button
        type="button"
        onClick={onAddAnotherCopy}
        className="rounded-md border border-dashed border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
      >
        + Add another copy ({buCost} BU)
      </button>
    </li>
  );
}

// =============================================================================
// InheritedPrimitiveRow — read-only primitive from a bundle.
//
// Renders the primitive with its provenance tag ("via Aegis Shield").
// Two action buttons:
//   * "Mirror" — writes a new direct mirror slot (inheritance doesn't
//     carry mirror; the user opts into the debt for this specific char).
//   * "+ Add copy" — writes a new direct-paid row. Useful for stacking
//     extra copies of an inherited primitive on top of the baseline.
// =============================================================================

function InheritedPrimitiveRow({
  primitive,
  onMirror,
  onAddCopy,
}: {
  primitive: InheritedPrimitive;
  onMirror: () => void;
  onAddCopy: () => void;
}) {
  const buCost = primitive.buCost ?? 0;
  return (
    <li className="space-y-2 rounded-md border border-border/60 bg-card/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{primitive.name}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
              Inherited
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {buCost} BU · {provenanceLabel(primitive.provenance)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMirror}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
        >
          ⌐ Mirror (−{buCost} BU debt)
        </button>
        <button
          type="button"
          onClick={onAddCopy}
          className="rounded-md border border-dashed border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          + Add direct copy ({buCost} BU)
        </button>
      </div>
    </li>
  );
}

// =============================================================================
// HeritageSlotCard — Phase 8.1 batch 13.1 follow-up
//
// Renders the exploded view of a slotted heritage in the character
// creation modal. Per Mashu 2026-07-22: "in character creation modal
// I don't see exploded or all primitives or whatever in heritages."
//
// Shows:
//   1. Direct primitives (bundled at heritage level)
//   2. Primitives from each capability (transitive)
//   3. Primitives from each effect of each capability (transitive)
//   4. Capabilities (as container labels)
//
// Each primitive row carries its buCost so the user can see exactly
// what they're paying for. The chip on the right shows the total
// transitive BU (same number the server-side expander will charge).
// =============================================================================

function HeritageSlotCard({
  slot,
  onRemove,
}: {
  slot: Extract<PendingSlot, { kind: "heritage" }>;
  onRemove: () => void;
}) {
  const cached = heritageBundleCache.get(slot.heritageId);
  const [bundle, setBundle] = useState<HeritageBundle | null>(
    cached !== undefined ? cached : null,
  );
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchBundle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/heritage/${slot.heritageId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const t = data.template as HeritageBundle | undefined;
      const normalised: HeritageBundle | null = t
        ? {
            id: t.id,
            name: t.name,
            description: t.description ?? null,
            primitiveLinks: t.primitiveLinks ?? [],
            // Phase 8.1 batch 13.1 follow-up: deep-join data now
            // flows through (the /api/heritage/[id] endpoint was
            // extended in this batch to deep-join capabilities →
            // primitives + effects → primitives).
            capabilityLinks: (t.capabilityLinks ?? []).map((cl) => {
              // Phase 8.1 batch 13.5 follow-up: the /api/heritage/[id]
              // response puts the deep-joined primitives + effects
              // UNDER `cl.capability` (the capability row carries
              // them after the batch 13.1 follow-up server attach).
              // Previously this normalizer read `cl.primitiveLinks`
              // which never existed on the link row, so both
              // "Primitives from Capabilities" and "Primitives from
              // Effects" sections silently rendered empty even when
              // the heritage had bundled caps with effects.
              //
              // Mashu 2026-07-22: "I still don't see the expanded
              // list of primitives if I slot in for example a
              // lineage that has capabilities with effects or a
              // heritage that has primitives, and capabilities with
              // effects."
              const capRow = cl.capability as typeof cl.capability & {
                primitiveLinks?: Array<{
                  primitiveId: number;
                  quantity: number;
                  isMirrored?: boolean;
                  primitive: { id: number; name: string; buCost: number | null } | null;
                }>;
                effectLinks?: Array<{
                  effectId?: string;
                  effect: { id: string; name: string; description: string | null };
                  primitiveLinks?: Array<{
                    primitiveId: number;
                    quantity: number;
                    isMirrored?: boolean;
                    primitive: { id: number; name: string; buCost: number | null } | null;
                  }>;
                }>;
              };
              return {
                capabilityId: cl.capabilityId ?? cl.capability?.id ?? "",
                capability: cl.capability,
                primitiveLinks: capRow.primitiveLinks ?? [],
                effectLinks: (capRow.effectLinks ?? []).map((el) => ({
                  effectId: el.effectId ?? el.effect?.id ?? "",
                  effect: el.effect,
                  primitiveLinks: el.primitiveLinks ?? [],
                })),
              };
            }),
            computedBu: t.computedBu ?? 0,
          }
        : null;
      heritageBundleCache.set(slot.heritageId, normalised);
      // Phase 8.1 batch 13.6 follow-up: notify the footer so its
      // buSummary recomputes. Without this, the footer stays at the
      // stale cached value until something else (e.g. a primitive
      // add) forces a re-render.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sw-character-bundle-loaded", {
            detail: { kind: "heritage", id: slot.heritageId },
          }),
        );
      }
      setBundle(normalised);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load heritage.";
      setError(msg);
      heritageBundleCache.set(slot.heritageId, null);
    } finally {
      setLoading(false);
    }
  }, [slot.heritageId]);

  useEffect(() => {
    if (cached === undefined) {
      void fetchBundle();
    }
  }, [cached, fetchBundle]);

  return (
    <li className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {bundle?.name ?? slot.name}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
              {slot.heritageKind}
            </span>
          </div>
          {bundle?.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
              {bundle.description}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {bundle ? (
              <>
                <span>
                  {/* Phase 8.1 batch 13.1 follow-up: transitive
                      primitive count (direct + via capabilities +
                      via capability effects), deduped by ID. */}
                  {(() => {
                    const seen = new Set<number>();
                    bundle.primitiveLinks.forEach((l) => {
                      if (l.primitive?.id) seen.add(l.primitive.id);
                    });
                    bundle.capabilityLinks.forEach((cl) => {
                      cl.primitiveLinks.forEach((l) => {
                        if (l.primitive?.id) seen.add(l.primitive.id);
                      });
                      cl.effectLinks.forEach((el) => {
                        el.primitiveLinks.forEach((l) => {
                          if (l.primitive?.id) seen.add(l.primitive.id);
                        });
                      });
                    });
                    return `${seen.size} primitive${seen.size === 1 ? "" : "s"}`;
                  })()}
                </span>
                <span>·</span>
                <span>
                  {bundle.capabilityLinks.length} capabilit
                  {bundle.capabilityLinks.length === 1 ? "y" : "ies"}
                </span>
                <span>·</span>
                <span className="font-mono font-bold text-foreground">
                  {bundle.computedBu} BU
                </span>
              </>
            ) : loading ? (
              <span>Loading bundle…</span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          Remove
        </button>
      </div>

      {bundle && (bundle.primitiveLinks.length > 0 || bundle.capabilityLinks.length > 0) ? (
        <div className="border-t border-border bg-muted/30 px-3 py-2">
          {bundle.primitiveLinks.length > 0 ? (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Bundled Primitives ({bundle.primitiveLinks.length})
              </div>
              <ul className="mt-1 flex flex-wrap gap-1">
                {bundle.primitiveLinks.map((link, i) => (
                  <li
                    key={`${link.primitive?.id ?? "unknown"}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    <span>{link.primitive?.name ?? "Unknown"}</span>
                    {link.primitive?.buCost != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {link.primitive.buCost} BU
                      </span>
                    ) : null}
                    {link.isMirrored ? (
                      <span className="rounded-full bg-fuchsia-500/20 px-1.5 text-[10px] font-semibold uppercase text-fuchsia-700 dark:text-fuchsia-300">
                        Mirrored
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Phase 8.1 batch 13.1 follow-up: NEW section. Primitives
              that come in via each bundled capability. Per user:
              "we should also list primitives from capabilities."
              Each row tagged with the source capability name. */}
          {bundle.capabilityLinks.flatMap((cl) => cl.primitiveLinks).length > 0 ? (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Primitives from Capabilities (
                {bundle.capabilityLinks.flatMap((cl) => cl.primitiveLinks).length})
              </div>
              <ul className="mt-1 space-y-1">
                {bundle.capabilityLinks.flatMap((cl) =>
                  cl.primitiveLinks.map((link) => ({
                    ...link,
                    sourceName: cl.capability?.name ?? "Unknown capability",
                  })),
                ).map((link, i) => (
                  <li
                    key={`cap-${link.primitive?.id ?? "unknown"}-${i}`}
                    className="inline-flex flex-wrap items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium">{link.primitive?.name ?? "Unknown"}</span>
                    {link.primitive?.buCost != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {link.primitive.buCost} BU
                      </span>
                    ) : null}
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      via {link.sourceName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Phase 8.1 batch 13.1 follow-up: NEW section. Primitives
              that come in via each capability's effect. Per user:
              "if said capability has an effect, in same section with
              primitives from capability we should list the primitives
              from effect of capability too (and for each we should
              mention source)." */}
          {bundle.capabilityLinks.flatMap((cl) =>
            cl.effectLinks.flatMap((el) => el.primitiveLinks),
          ).length > 0 ? (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Primitives from Effects (
                {bundle.capabilityLinks.flatMap((cl) =>
                  cl.effectLinks.flatMap((el) => el.primitiveLinks),
                ).length})
              </div>
              <ul className="mt-1 space-y-1">
                {bundle.capabilityLinks.flatMap((cl) =>
                  cl.effectLinks.flatMap((el) =>
                    el.primitiveLinks.map((link) => ({
                      ...link,
                      sourcePath: `${cl.capability?.name ?? "?"} > ${el.effect?.name ?? "?"}`,
                    })),
                  ),
                ).map((link, i) => (
                  <li
                    key={`eff-${link.primitive?.id ?? "unknown"}-${i}`}
                    className="inline-flex flex-wrap items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium">{link.primitive?.name ?? "Unknown"}</span>
                    {link.primitive?.buCost != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {link.primitive.buCost} BU
                      </span>
                    ) : null}
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      via {link.sourcePath}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {bundle.capabilityLinks.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Bundled Capabilities
              </div>
              <ul className="mt-1 flex flex-wrap gap-1">
                {bundle.capabilityLinks.map((link, i) => (
                  <li
                    key={`${link.capability?.id ?? "unknown"}-${i}`}
                    className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    {link.capability?.name ?? "Unknown"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// CapabilitySlotCard — Phase 8.1 batch 13.5 follow-up
//
// Renders the exploded view of a slotted capability in the character
// creation modal. Mirrors HeritageSlotCard but for direct capability
// slots. Mashu 2026-07-22: "in character creation I still don't see
// all the primitives if I slot in a capability."
//
// Shows:
//   1. Direct primitives (bundled at capability level)
//   2. Primitives from each effect (transitive)
//   3. Total transitive BU
//
// Each primitive row carries its buCost. The chip on the right shows
// the total transitive BU (matches the server-side expander).
function CapabilitySlotCard({
  slot,
  onRemove,
}: {
  slot: Extract<PendingSlot, { kind: "capability" }>;
  onRemove: () => void;
}) {
  const cached = capabilityBundleCache.get(slot.capabilityId);
  const [bundle, setBundle] = useState<CapabilityBundle | null>(
    cached !== undefined ? cached : null,
  );
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchBundle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/capabilities/${slot.capabilityId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const c = data.capability as
        | (CapabilityBundle & {
            computedBu?: number;
          })
        | undefined;
      const normalised: CapabilityBundle | null = c
        ? (() => {
            // The /api/capabilities/[id] response puts each effect's
            // primitiveLinks INSIDE el.effect (after the server-side
            // attach), so we widen the raw row type to read it. The
            // heritage API follows the same pattern. CapabilityBundle's
            // declared shape only needs the slim version.
            const rawCap = c as typeof c & {
              effectLinks?: Array<{
                effectId: string;
                effect: {
                  id: string;
                  name: string;
                  description?: string | null;
                  primitiveLinks?: Array<{
                    primitiveId: number;
                    quantity: number;
                    isMirrored?: boolean;
                    primitive: {
                      id: number;
                      name: string;
                      buCost: number | null;
                    };
                  }>;
                };
              }>;
            };
            return {
              id: rawCap.id,
              name: rawCap.name,
              primitiveLinks: (rawCap.primitiveLinks ?? []).map((pl) => ({
                primitiveId: pl.primitiveId,
                quantity: pl.quantity ?? 1,
                isMirrored: pl.isMirrored ?? false,
                primitive: pl.primitive,
              })),
              effectLinks: (rawCap.effectLinks ?? []).map((el) => {
                // Widening the response row: el.effect.primitiveLinks
                // is populated by /api/capabilities/[id] but not part
                // of CapabilityBundle's slim declared shape. We cast
                // each el.effect before reading.
                const eff = el.effect as {
                  id: string;
                  name: string;
                  description?: string | null;
                  primitiveLinks?: Array<{
                    primitiveId: number;
                    quantity: number;
                    isMirrored?: boolean;
                    primitive: { id: number; name: string; buCost: number | null };
                  }>;
                };
                return {
                  effectId: el.effectId ?? eff.id ?? "",
                  effect: {
                    id: eff.id ?? "",
                    name: eff.name ?? "",
                    description: eff.description ?? null,
                  },
                  primitiveLinks: (eff.primitiveLinks ?? []).map(
                    (pl: {
                      primitiveId: number;
                      quantity: number;
                      isMirrored?: boolean;
                      primitive: { id: number; name: string; buCost: number | null };
                    }) => ({
                      primitiveId: pl.primitiveId,
                      quantity: pl.quantity ?? 1,
                      isMirrored: pl.isMirrored ?? false,
                      primitive: pl.primitive,
                    }),
                  ),
                };
              }),
              // Server's computedBu already accounts for both direct
              // primitive cost AND effect → primitive cost. Trust it.
              computedBu: rawCap.computedBu ?? 0,
            };
          })()
        : null;
      capabilityBundleCache.set(slot.capabilityId, normalised);
      // Phase 8.1 batch 13.6 follow-up: notify the footer so its
      // buSummary recomputes. See HeritageSlotCard for the same fix.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sw-character-bundle-loaded", {
            detail: { kind: "capability", id: slot.capabilityId },
          }),
        );
      }
      setBundle(normalised);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load capability.";
      setError(msg);
      capabilityBundleCache.set(slot.capabilityId, null);
    } finally {
      setLoading(false);
    }
  }, [slot.capabilityId]);

  useEffect(() => {
    if (cached === undefined) {
      void fetchBundle();
    }
  }, [cached, fetchBundle]);

  const label = slot.name;
  const kindLabel = "Capability";

  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{label}</span>
            {bundle ? (
              <>
                <span>·</span>
                <span className="text-xs text-muted-foreground">
                  {bundle.primitiveLinks.length} direct primitive
                  {bundle.primitiveLinks.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span className="text-xs text-muted-foreground">
                  {bundle.effectLinks.length} effect
                  {bundle.effectLinks.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span className="font-mono font-bold text-foreground">
                  {bundle.computedBu} BU
                </span>
              </>
            ) : loading ? (
              <span className="text-xs text-muted-foreground">
                Loading bundle…
              </span>
            ) : error ? (
              <span className="text-xs text-destructive">{error}</span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{kindLabel}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          Remove
        </button>
      </div>

      {bundle ? (
        <div className="space-y-2 border-t border-border pt-2">
          {/* Direct primitives bundled at capability level. */}
          {bundle.primitiveLinks.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Bundled Primitives ({bundle.primitiveLinks.length})
              </div>
              <ul className="mt-1 flex flex-wrap gap-1">
                {bundle.primitiveLinks.map((link, i) => (
                  <li
                    key={`cap-p-${link.primitive?.id ?? "unknown"}-${i}`}
                    className="inline-flex flex-wrap items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium">
                      {link.primitive?.name ?? "Unknown"}
                    </span>
                    {link.primitive?.buCost != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {link.primitive.buCost} BU
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Primitives from each effect of the capability. */}
          {bundle.effectLinks.flatMap((el) => el.primitiveLinks).length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Primitives from Effects (
                {bundle.effectLinks.flatMap((el) => el.primitiveLinks).length})
              </div>
              <ul className="mt-1 flex flex-wrap gap-1">
                {bundle.effectLinks.flatMap((el) =>
                  el.primitiveLinks.map((link) => ({
                    ...link,
                    sourceName: el.effect?.name ?? "Unknown effect",
                  })),
                ).map((link, i) => (
                  <li
                    key={`cap-e-${link.primitive?.id ?? "unknown"}-${i}`}
                    className="inline-flex flex-wrap items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium">
                      {link.primitive?.name ?? "Unknown"}
                    </span>
                    {link.primitive?.buCost != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {link.primitive.buCost} BU
                      </span>
                    ) : null}
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      via {link.sourceName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function slotLabel(slot: PendingSlot): string {
  if (slot.kind === "heritage") return slot.name;
  return slot.name;
}

function slotKindLabel(slot: PendingSlot): string {
  switch (slot.kind) {
    case "heritage":
      return `Heritage · ${slot.heritageKind}`;
    case "primitive":
      return "Primitive";
    case "capability":
      return "Capability";
    case "effect":
      return "Effect";
    case "item":
      return "Item";
  }
}