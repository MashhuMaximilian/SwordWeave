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
import { YinYangSpinner } from "@/components/ui/yin-yang-spinner";

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
/**
 * Phase 8.3b UI fix #2 (Mashu 2026-07-27): Set of bundle IDs whose
 * fetch is currently in-flight. The preloader, the HeritageSlotCard
 * fetcher, and the CapabilitySlotCard fetcher all add/remove from
 * this set so Section 1 (active primitives list) can render a
 * loading state until the bundle lands — without the user having to
 * toggle tabs to mount Section 2 first.
 */
const heritageBundleInFlight = new Set<string>();

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
/** Phase 8.3b UI fix #2 — see heritageBundleInFlight above. */
const capabilityBundleInFlight = new Set<string>();

/**
 * Phase 8.3b UI revamp: expose bundle caches to useTabPrimitives via
 * a registered reader. The hook walks heritage + capability bundles
 * to build the unified primitive list at the top of each tab.
 */
registerBundleCacheReader(() => ({
  heritageBundles: heritageBundleCache,
  capabilityBundles: capabilityBundleCache,
  // Phase 8.3b UI fix #2: in-flight sets so the active-primitives
  // list in Section 1 can render a loading state until the bundle
  // resolves (no need for the user to toggle tabs).
  heritageInFlight: heritageBundleInFlight,
  capabilityInFlight: capabilityBundleInFlight,
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
  heritageBundleInFlight.add(heritageId);
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
  } finally {
    heritageBundleInFlight.delete(heritageId);
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
  capabilityBundleInFlight.add(capabilityId);
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
  } finally {
    capabilityBundleInFlight.delete(capabilityId);
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

  const {
    direct,
    inherited,
    heritageSlots,
    capabilitySlots,
    loadingBundleIds,
  } = useTabPrimitives(tabId);

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

          {/* Phase 8.3b UI fix #2 (Mashu 2026-07-27): when a heritage
              or capability slot was just queued, its bundle is still
              fetching — show a counter-clockwise yin-yang spinner here
              so the user knows primitives will land shortly. Disappears
              automatically once loadingBundleIds is empty (which
              happens via the bundle-loaded event bumping bundleVersion
              → useTabPrimitives recomputes). */}
          {loadingBundleIds.length > 0 ? (
            <div
              data-testid="loading-bundle-banner"
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              <YinYangSpinner size={18} label="Loading bundle primitives…" />
              <span>
                Resolving{" "}
                {loadingBundleIds.length === 1
                  ? loadingBundleIds[0]
                  : `${loadingBundleIds.length} bundles`}{" "}
                — primitives will appear momentarily.
              </span>
            </div>
          ) : null}

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
            {inheritedRows.map((p, idx) => {
              // Phase 8.3b UI revamp: check whether a paired mirror
              // slot is already active for this inherited primitive.
              // The mirror slot is one whose primitiveId matches
              // AND mirror=true AND no instanceId (i.e. it was added
              // on top of the inherited baseline). The lookup is
              // cheap (≤ N slots).
              const pairedMirror = slots.find(
                (s) =>
                  s.kind === "primitive" &&
                  s.primitiveId === p.primitiveId &&
                  s.mirror === true,
              );
              return (
                <InheritedPrimitiveRow
                  key={`inherited-${p.primitiveId}-${idx}`}
                  primitive={p}
                  isMirrorActive={pairedMirror != null}
                  onMirror={() => {
                    // Toggle ON: write a new direct mirror slot.
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
                  onUnmirror={() => {
                    // Toggle OFF: remove the paired mirror slot.
                    if (!pairedMirror?.slotId) return;
                    removeSlot(
                      tabId,
                      slots.findIndex(
                        (s) => s.slotId === pairedMirror.slotId,
                      ),
                    );
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
              );
            })}
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

function InheritedPrimitiveRow({
  primitive,
  onMirror,
  onAddCopy,
  isMirrorActive,
  onUnmirror,
}: {
  primitive: InheritedPrimitive;
  /** Toggle on: when no mirror slot exists for this primitive, write one. */
  onMirror: () => void;
  /** Toggle off: remove the matching mirror slot if one is active. */
  onUnmirror: () => void;
  /** True when a paired mirror slot is currently active for this
   *  primitive (the button label flips to "Unmirror"). */
  isMirrorActive: boolean;
  onAddCopy: () => void;
}) {
  const buCost = primitive.buCost ?? 0;
  const mirrorCredit = primitive.mirrorBuCredit ?? buCost;

  // Mirrorability rule (Phase 8.3b UI revamp item #2):
  //   1. DB-level isMirrorable flag must be true
  //   2. The primitive must have at least one modifier entry (so it's
  //      actually a modifier primitive, not e.g. a verb/domain)
  //   3. No operation is currently assigned to it (TBD — operation
  //      wiring is in a later phase; for now this is always true)
  const isMirrorable =
    primitive.isMirrorable === true && primitive.hardModifiers.length > 0;

  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-md border border-border/60 bg-card/60 text-sm">
      {/* COLLAPSED — always-visible header row */}
      <div
        className="flex items-start justify-between gap-2 p-3"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{primitive.name}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
              Inherited
            </span>
            {isMirrorActive ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                Mirrored
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {buCost} BU · {provenanceLabel(primitive.provenance)}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      {/* EXPANDED — action buttons + modifier display */}
      {expanded ? (
        <div className="space-y-2 border-t border-border/60 bg-background/40 p-3">
          {isMirrorable ? (
            <button
              type="button"
              onClick={isMirrorActive ? onUnmirror : onMirror}
              className={
                "rounded-md border px-2 py-1 text-xs font-medium " +
                (isMirrorActive
                  ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "border-border bg-background text-muted-foreground hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300")
              }
            >
              {isMirrorActive
                ? `✓ Mirrored (−${mirrorCredit} BU debt) — click to unmirror`
                : `⌐ Mirror (−${mirrorCredit} BU debt)`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Not mirrorable
              {primitive.isMirrorable !== true
                ? " (no mirror flag on this primitive)"
                : " (no modifier attached)"}
            </span>
          )}
          <button
            type="button"
            onClick={onAddCopy}
            className="block rounded-md border border-dashed border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            + Add direct copy ({buCost} BU)
          </button>
          {isMirrorable && primitive.hardModifiers.length > 0 ? (
            <div className="space-y-1 border-t border-border/40 pt-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                {isMirrorActive ? "Modifier (mirrored)" : "Modifier"}
              </div>
              <ModifierChips
                targetScope={primitive.targetScope}
                hardModifiers={primitive.hardModifiers}
                mirrored={isMirrorActive}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// =============================================================================
// DirectPrimitiveRow — one row per PendingSlot.
//
// Phase 8.3b UI revamp:
//   * Collapsed by default. Header shows: title + cost + (Mirrored or
//     Mirrorable badge) + (▸ expand button).
//   * On expand: shows mirror toggle (button-style), "+ Add copy" +
//     "Remove" + (if mirrorable) modifier chips.
//   * Mirror UI is a TOGGLE BUTTON, not a checkbox — click once to
//     add a mirror row, click again to unmirror (toggles the slot's
//     mirror flag or removes the paired mirror slot for inherited).
//   * Mirror toggle is HIDDEN when the primitive has no modifier
//     (Phase 8.3b UI revamp item #2). DB isMirrorable flag alone is
//     not enough — the primitive must actually carry a modifier entry.
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
  const isMirrorable =
    slot.isMirrorable === true &&
    (slot.hardModifiers?.length ?? 0) > 0;
  const mirrored = slot.mirror === true;
  const buCost = slot.buCost ?? 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-md border border-border bg-card text-sm">
      {/* COLLAPSED — always-visible header row */}
      <div
        className="flex items-start justify-between gap-2 p-3"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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
          <div className="mt-1 text-xs text-muted-foreground">
            Direct primitive · {buCost} BU
            {mirrored ? ` → −${slot.mirrorBuCredit ?? buCost} BU debt` : ""}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      {/* EXPANDED — actions + modifier chips */}
      {expanded ? (
        <div className="space-y-2 border-t border-border bg-background/40 p-3">
          {isMirrorable ? (
            <button
              type="button"
              onClick={() => onToggleMirror(!mirrored)}
              className={
                "rounded-md border px-2 py-1 text-xs font-medium " +
                (mirrored
                  ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "border-border bg-background text-muted-foreground hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300")
              }
            >
              {mirrored
                ? `✓ Mirrored (−${slot.mirrorBuCredit ?? buCost} BU debt) — click to unmirror`
                : `⌐ Mirror (−${slot.mirrorBuCredit ?? buCost} BU debt)`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Not mirrorable
              {slot.isMirrorable !== true
                ? " (no mirror flag on this primitive)"
                : " (no modifier attached)"}
            </span>
          )}
          <button
            type="button"
            onClick={onAddAnotherCopy}
            className="block rounded-md border border-dashed border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            + Add another copy ({buCost} BU)
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="block rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            Remove
          </button>
          {isMirrorable && (slot.hardModifiers?.length ?? 0) > 0 ? (
            <div className="space-y-1 border-t border-border/40 pt-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                {mirrored ? "Modifier (mirrored)" : "Modifier"}
              </div>
              <ModifierChips
                targetScope={slot.targetScope ?? null}
                hardModifiers={slot.hardModifiers ?? []}
                mirrored={mirrored}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// =============================================================================
// ModifierChips — Phase 8.3b UI revamp item #5 + rev 6
//
// Render the hard-modifier payload as chips with LIVE inline
// transformation when mirrored. Matches the "Modifier" + "Mirror"
// blocks in the library preview.
//
// Mashu 2026-07-27 rev 6:
//   "To clean up the Mirrors To display when toggling mirror on/off,
//    use live inline transformation."
//
//   OFF state:
//     Hide static "Mirrors To" text. Show the live positive modifier:
//     [target]  [+]  5  [STACK]
//     "Mirrors to subtract" (small caption)
//
//   ON state (mirrored):
//     Highlight the pill, swap operator to its mirrored form, no
//     extra text:
//     [target]  [−]  5  [STACK]
//
// Header text:
//   OFF: "MODIFIER"
//   ON:  "MODIFIER (MIRRORED)"
// =============================================================================

function ModifierChips({
  targetScope,
  hardModifiers,
  mirrored = false,
}: {
  targetScope: string | null;
  hardModifiers: ReadonlyArray<unknown>;
  mirrored?: boolean;
}) {
  if (hardModifiers.length === 0) return null;
  return (
    <div className="space-y-1">
      {hardModifiers.map((m, i) => {
        const mod = m as Partial<{
          target: string;
          operation: string;
          value: unknown;
          stacking: string;
        }>;
        const baseOp = mod.operation ?? "add";
        // Live inline transformation:
        //   - In OFF state we show the base op (e.g. "+") and a small
        //     "Mirrors to subtract" caption.
        //   - In ON state we swap to the mirror op (e.g. "−") and
        //     drop the caption; the pill is highlighted.
        const liveOp = mirrored ? mirrorOperation(baseOp) : baseOp;
        const value = mod.value;
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-1 text-xs"
          >
            <span className="rounded border border-border bg-background px-2 py-0.5 font-mono">
              {mod.target ?? targetScope ?? "?"}
            </span>
            <span
              className={
                "rounded px-2 py-0.5 font-mono " +
                (mirrored
                  ? "bg-amber-500/20 font-semibold text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300"
                  : "bg-primary/15 text-primary")
              }
            >
              {opSymbol(liveOp)}
            </span>
            <span className="font-mono text-foreground">
              {formatValue(value)}
            </span>
            {mod.stacking ? (
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                  (mirrored
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")
                }
              >
                {mod.stacking}
              </span>
            ) : null}
            {!mirrored && (
              <span className="ml-1 text-[10px] italic text-muted-foreground">
                Mirrors to {describeMirrorOp(baseOp)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Returns the operator that mirrors the given one (sign flip for
// add/subtract). Used by the live inline transform.
function mirrorOperation(op: string): string {
  if (op === "add") return "subtract";
  if (op === "subtract" || op === "sub") return "add";
  return op;
}

// Human-readable mirror description for the OFF-state caption.
// e.g. "add" → "Subtract", "subtract" → "Add".
function describeMirrorOp(op: string): string {
  if (op === "add") return "Subtract";
  if (op === "subtract" || op === "sub") return "Add";
  return op;
}

function opSymbol(op: string): string {
  switch (op) {
    case "add":
      return "+";
    case "subtract":
    case "sub":
      return "−";
    case "set":
      return "=";
    case "multiply":
      return "×";
    default:
      return op;
  }
}

function formatValue(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "?";
  return JSON.stringify(v);
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

  // Phase 8.3b UI revamp: collapsed by default. Header is a pill row
// with name + kind + computedBu + chevron. Click expands to show
// the capabilities + their effects ONLY — primitives are gone from
// this view because the top "ACTIVE PRIMITIVES" section already lists
// every primitive active on this tab. This card is now purely a
// provenance / structural overview.
const [heritageExpanded, setHeritageExpanded] = useState(false);

return (
    <li className="overflow-hidden rounded-md border border-border bg-card">
      <div
        className="flex items-start justify-between gap-2 p-3"
        role="button"
        tabIndex={0}
        onClick={() => setHeritageExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setHeritageExpanded((v) => !v);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {bundle?.name ?? slot.name}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
              {slot.heritageKind}
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {bundle?.computedBu ?? 0} BU
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {bundle ? (
              <>
                {bundle.capabilityLinks.length} capabilit
                {bundle.capabilityLinks.length === 1 ? "y" : "ies"}
                {" · "}
                {(() => {
                  // Count distinct effects across all capabilities
                  const effectCount = bundle.capabilityLinks.reduce(
                    (n, cl) => n + cl.effectLinks.length,
                    0,
                  );
                  if (effectCount === 0) return null;
                  return `${effectCount} effect${effectCount === 1 ? "" : "s"}`;
                })()}
              </>
            ) : loading ? (
              "Loading bundle…"
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-expanded={heritageExpanded}
            aria-label={heritageExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setHeritageExpanded((v) => !v);
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            {heritageExpanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            Remove
          </button>
        </div>
      </div>

      {heritageExpanded && bundle ? (
        <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          {bundle.description ? (
            <p className="text-muted-foreground line-clamp-3">
              {bundle.description}
            </p>
          ) : null}

          {bundle.capabilityLinks.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Bundled Capabilities ({bundle.capabilityLinks.length})
              </div>
              <ul className="mt-1 space-y-1">
                {bundle.capabilityLinks.map((cl) => (
                  <li
                    key={cl.capabilityId}
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">
                        {cl.capability?.name ?? "Unknown capability"}
                      </span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">
                        {cl.effectLinks.length} effect
                        {cl.effectLinks.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {cl.effectLinks.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 pl-3">
                        {cl.effectLinks.map((el) => (
                          <li
                            key={el.effectId}
                            className="flex flex-wrap items-center gap-1 text-muted-foreground"
                          >
                            <span className="text-foreground">
                              {el.effect?.name ?? "(unnamed effect)"}
                            </span>
                            {el.effect?.description ? (
                              <span className="text-[10px] italic">
                                — {el.effect.description}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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

  // Phase 8.3b UI revamp: collapsed by default. Header shows name +
// computedBu + chevron. Expanded reveals the effects — primitives
// are gone from this view because the top "ACTIVE PRIMITIVES"
// section already lists every primitive active on this tab.
const [capabilityExpanded, setCapabilityExpanded] = useState(false);

return (
    <li className="overflow-hidden rounded-md border border-border bg-card text-sm">
      <div
        className="flex items-start justify-between gap-2 p-3"
        role="button"
        tabIndex={0}
        onClick={() => setCapabilityExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCapabilityExpanded((v) => !v);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{label}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
              {kindLabel}
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {bundle?.computedBu ?? 0} BU
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {bundle ? (
              <>
                {bundle.effectLinks.length} effect
                {bundle.effectLinks.length === 1 ? "" : "s"}
              </>
            ) : loading ? (
              "Loading bundle…"
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-expanded={capabilityExpanded}
            aria-label={capabilityExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setCapabilityExpanded((v) => !v);
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            {capabilityExpanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            Remove
          </button>
        </div>
      </div>

      {capabilityExpanded && bundle ? (
        <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          {bundle.effectLinks.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Effects ({bundle.effectLinks.length})
              </div>
              <ul className="mt-1 space-y-1">
                {bundle.effectLinks.map((el) => (
                  <li
                    key={el.effectId}
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <div className="font-medium text-foreground">
                      {el.effect?.name ?? "(unnamed effect)"}
                    </div>
                    {el.effect?.description ? (
                      <div className="text-muted-foreground italic">
                        {el.effect.description}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-muted-foreground italic">
              No effects on this capability.
            </div>
          )}
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