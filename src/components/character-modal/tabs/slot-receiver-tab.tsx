"use client";

// =============================================================================
// SlotReceiverTab — generic slot receiver for tabs 4-7
// (Lineage / Upbringing / Manifest / Items).
//
// Per Mashu 2026-07-21: each tab is a SLOT RECEIVER — it doesn't host
// a library picker. Instead, the user slots things from /atelier via
// the context-aware "Slot into [step]" button on library previews.
//
// === Phase 8.1 batch 9: heritage expansion ===
// When a heritage is slotted, this tab fetches its bundled primitives,
// capabilities, and effects (from /api/heritage/[id]) and renders them
// under the heritage name. The user sees what they're getting without
// having to drill into the heritage itself.
//
// Bundles are fetched lazily — only when at least one heritage slot is
// present on this tab. We cache the bundle in a Map keyed by heritageId
// for the session, so re-renders don't refetch.
//
// === What does NOT live here yet ===
//   - Capability auto-expand to primitives (batch 10). Right now
//     capability slots in the receiver show as a flat list. After
//     batch 10 they should auto-expand their bundled primitives.
//   - Per-slot Mirrored flag for heritage (Phase 7 Q-M-UX) — heritage
//     slot's isMirrored is read-only for now; UI ships the badge in
//     a follow-up.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCharacterModal,
  type CharacterTabId,
  type PendingSlot,
} from "../character-modal-store";

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
    isMirrored: boolean;
    primitive: { id: number; name: string; buCost: number | null } | null;
  }>;
  capabilityLinks: Array<{
    capability: { id: string; name: string; description: string | null } | null;
  }>;
  computedBu: number;
}

// Bundle cache shared across all SlotReceiverTab instances for the
// session — keyed by heritageId. Avoids refetching when switching tabs.
const heritageBundleCache = new Map<string, HeritageBundle | null>();

export function SlotReceiverTab({
  tabId,
  title,
  help,
  ctaPrimary,
  ctaSecondary,
}: SlotReceiverTabProps) {
  const { pendingSlots, removeSlot, setSlotMirror } = useCharacterModal();
  const slots = pendingSlots[tabId];

  const heritageSlots = useMemo(
    () => slots.filter((s) => s.kind === "heritage"),
    [slots],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center">
          <p className="text-sm font-medium text-foreground">{ctaPrimary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ctaSecondary}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {slots.map((slot, idx) =>
            slot.kind === "heritage" ? (
              <HeritageSlotCard
                key={slot.slotId ?? `heritage-${slot.heritageId}-${idx}`}
                slot={slot}
                onRemove={() => removeSlot(tabId, idx)}
              />
            ) : (
              <MechanicSlotRow
                key={slot.slotId ?? `${slot.kind}-${idx}`}
                slot={slot}
                onRemove={() => removeSlot(tabId, idx)}
                onToggleMirror={
                  slot.kind === "primitive" && slot.isMirrorable
                    ? (mirror: boolean) => setSlotMirror(slot.slotId ?? "", mirror)
                    : undefined
                }
              />
            ),
          )}
        </ul>
      )}

      {/* Hide the heritage count when none exist (avoids noisy
          counters in the empty state). */}
      {heritageSlots.length === 0 && slots.length > 0 ? null : null}
    </div>
  );
}

function MechanicSlotRow({
  slot,
  onRemove,
  onToggleMirror,
}: {
  slot: PendingSlot;
  onRemove: () => void;
  onToggleMirror?: ((mirror: boolean) => void) | undefined;
}) {
  const label = slotLabel(slot);
  const kindLabel = slotKindLabel(slot);
  const isMirrorablePrimitive =
    slot.kind === "primitive" && slot.isMirrorable === true;
  const mirrored = isMirrorablePrimitive && slot.mirror === true;
  const buCost = slot.kind === "primitive" ? (slot.buCost ?? 0) : 0;
  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{label}</span>
            {isMirrorablePrimitive ? (
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
          <div className="text-xs text-muted-foreground">{kindLabel}</div>
          {isMirrorablePrimitive ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{buCost} BU</span>
              {mirrored ? (
                <>
                  {" "}
                  →{" "}
                  <span className="font-mono text-amber-700 dark:text-amber-300">
                    −{slot.mirrorBuCredit ?? buCost} BU (debt)
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          Remove
        </button>
      </div>
      {isMirrorablePrimitive && onToggleMirror ? (
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
    </li>
  );
}

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
            capabilityLinks: t.capabilityLinks ?? [],
            computedBu: t.computedBu ?? 0,
          }
        : null;
      heritageBundleCache.set(slot.heritageId, normalised);
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
                  {bundle.primitiveLinks.length} primitive
                  {bundle.primitiveLinks.length === 1 ? "" : "s"}
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
                Bundled Primitives
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