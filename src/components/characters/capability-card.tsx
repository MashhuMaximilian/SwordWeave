"use client";

/**
 * CapabilityCard — Phase 8.2 batch 4
 *
 * Interactive card for a single capability on the character sheet.
 * Two runtime actions:
 *
 *   1. TOGGLE  (sustained capabilities, e.g. "Shield Wall is up")
 *      - State persists in localStorage keyed by (characterId, capabilityId)
 *      - Always writes a capability_toggle log entry so the audit trail
 *        captures the act of toggling even if the browser storage is
 *        cleared later.
 *      - Toggling from active → inactive is the same endpoint, just
 *        passes `active: false`.
 *
 *   2. TRIGGER (one-shot fire-and-revert capabilities, e.g. "Cast Fireball")
 *      - Optimistically flashes the capability as active, fires the
 *        capability_trigger log entry, then immediately reverts to
 *        inactive. The UI shows a brief "Triggered!" confirmation.
 *      - Per Mashu 2026-07-22: "trigger = instant fire + revert to
 *        inactive; logged". So the trigger does NOT persist any
 *        "active" state — it's purely a log event with a visual flash.
 *
 * State model (Mashu 2026-07-23):
 *   - localStorage ONLY. No server-side persistence of active state.
 *   - Different device / hard refresh / cleared storage = all
 *     capabilities show as inactive (default).
 *   - Log entries are the forensic trail; player can reconstruct
 *     what happened even if localStorage was lost.
 *
 * The card is the smallest unit of state: each card reads its own
 * slice from localStorage so 50 capabilities = 50 keys. The keys
 * are namespaced under "sw:cap:<characterId>:<capabilityId>" so
 * clearing one character doesn't affect another.
 */

import { useState, useEffect, useCallback } from "react";
import { Zap, Power, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { emitCharacterLogAdded } from "@/lib/character/character-events";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { SlotSource } from "@/db/schema/characters";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import { OriginBadge } from "@/components/characters/origin-badge";
import { makeKey as makeVersionKey, type VersionKey } from "@/lib/versions/version-key";
import { useEntityPreview } from "@/components/characters/preview-modal";

interface ToggleResponse {
  capability: { id: string; active: boolean };
}

interface TriggerResponse {
  capability: { id: string; name: string };
}

export interface CapabilityCardProps {
  characterId: string;
  capability: {
    id: string;
    name: string;
    type: string;
    sourceType: string;
    acquiredAtLevel: number;
    /**
     * Optional longer description shown in the card body. Truncated
     * via line-clamp; the full text lives in the entity preview.
     */
    verboseDescription?: string | null;
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
    /**
     * Optional precomputed origin chain (heritage badges, etc.).
     * If present, renders an OriginBadge beneath the slot metadata.
     */
    originChain?: Array<{
      kind: "heritage" | "capability" | "effect";
      name: string;
    }>;
    /**
     * Phase 8.4 v5 (Mashu 2026-07-28): effects attached to
     * this capability. When present and non-empty, a
     * collapsible "Effects (N)" section appears in the card
     * body so the user can see them nested under the
     * capability. Matches the character-creation modal's
     * structure.
     */
    effectLinks?: Array<{
      effectId: string;
      effect: {
        id: string;
        name: string;
        description: string;
      };
    }>;
  };
  /**
   * Phase 8.4 v11 (Mashu 2026-07-28): hide the "Primitives (N)"
   * accordion. The heritage-accordion variant uses this because
   * the bundled primitives are shown directly in the
   * Primitives accordion above; no need to duplicate them.
   * Default: true (still shown for slotted capabilities).
   */
  showPrimitives?: boolean;
  /**
   * Phase 8.4 v11 (Mashu 2026-07-28): hide the "Preview" button.
   * The heritage-accordion variant uses this because the user
   * can already click the card body to open the preview;
   * no need for a second affordance. Default: true (still shown
   * for slotted capabilities).
   */
  showPreviewButton?: boolean;
  /**
   * Phase 8.5 / Session H6 round 11 (Mashu
   * 2026-08-03): the bulk-resolved latest-version
   * map. Used to render "Pinned v:XXXX" chips on
   * the nested effects and primitives inside the
   * capability's EFFECTS / PRIMITIVES accordions.
   * Without this, the chips render a hardcoded
   * "Pinned" without a version.
   */
  latestVersions?: Map<VersionKey, string> | undefined;
}

function storageKey(characterId: string, capabilityId: string) {
  return `sw:cap:${characterId}:${capabilityId}`;
}

/**
 * Read the local toggle state. Returns null if not set (treated
 * as inactive). Safe to call server-side — returns null when
 * window/localStorage are unavailable.
 */
function readToggle(characterId: string, capabilityId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(characterId, capabilityId)) === "1";
  } catch {
    return false;
  }
}

function writeToggle(
  characterId: string,
  capabilityId: string,
  active: boolean,
) {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(storageKey(characterId, capabilityId), "1");
    } else {
      window.localStorage.removeItem(storageKey(characterId, capabilityId));
    }
  } catch {
    // localStorage might be disabled (private mode, quota); swallow.
  }
}

export function CapabilityCard({
  characterId,
  capability,
  showPrimitives = true,
  showPreviewButton = true,
  latestVersions,
}: CapabilityCardProps) {
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Local optimistic state. Hydrate from localStorage on mount.
  const [active, setActive] = useState(false);
  // Phase 8.4 v9 (Mashu 2026-07-28): the sheet only carries the
  // capability's effectLinks, not its primitiveLinks. For "actual
  // play" the user wants to see the primitives that come in via
  // the capability directly (not via effects). Lazy-load on
  // mount via the existing preview fetch and stash a slim view.
  const [bundledPrims, setBundledPrims] = useState<Array<{
    primitiveId: number;
    name: string;
    category: string;
    buCost: number;
  }> | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggerPending, setTriggerPending] = useState(false);
  // Brief flash to confirm a trigger. Cleared after ~1.2s.
  const [triggerFlash, setTriggerFlash] = useState(false);

  const fetchPreviewData = useCallback(async () => {
    if (previewData) return previewData;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/capabilities/${capability.id}`);
      if (!res.ok) throw new Error("Failed to fetch capability");
      const data = await res.json();
      // Phase 8.4 v9 (Mashu 2026-07-28): the /api/capabilities/[id]
      // route returns the raw row + computedBu, which is NOT the
      // SandboxCapabilityRow shape the EntityPreview expects.
      // Project it here so CapabilityBody (which accesses
      // row.primitiveLinks[i].versionNumber, etc.) never crashes
      // on missing fields. Mashu 2026-07-28: "it even crashes if
      // I click on a capability but for primitives works."
      const raw = data.capability as Record<string, unknown>;
      const projected = {
        id: raw["id"] as string,
        name: raw["name"] as string,
        type: raw["type"] as string,
        sourceType: raw["sourceType"] as string,
        verboseDescription: (raw["verboseDescription"] as string) ?? "",
        sourceOrigin: (raw["sourceOrigin"] as string | null) ?? null,
        tags: (raw["tags"] as string[]) ?? [],
        isPublic: (raw["isPublic"] as boolean) ?? true,
        primitiveLinks: ((raw["primitiveLinks"] as Array<Record<string, unknown>>) ?? []).map((pl) => ({
          primitiveId: pl["primitiveId"] as number,
          role: (pl["role"] as string) ?? "OTHER",
          quantity: (pl["quantity"] as number) ?? 1,
          sortOrder: (pl["sortOrder"] as number) ?? 0,
          slotLabel: (pl["slotLabel"] as string | null) ?? null,
          notes: (pl["notes"] as string | null) ?? null,
          versionNumber: null as number | null,
          primitive: pl["primitive"] as {
            id: number;
            name: string;
            category: string;
            buCost: number;
          },
        })),
        effectLinks: ((raw["effectLinks"] as Array<Record<string, unknown>>) ?? []).map((el) => ({
          effectId: el["effectId"] as string,
          sortOrder: (el["sortOrder"] as number) ?? 0,
          slotLabel: (el["slotLabel"] as string | null) ?? null,
          notes: (el["notes"] as string | null) ?? null,
          versionNumber: null as number | null,
          effect: el["effect"] as {
            id: string;
            name: string;
            narrativeDescription: string | null;
            sourceOrigin: string | null;
            primitiveLinks?: Array<{
              primitiveId: number;
              quantity: number;
              primitive: { id: number; name: string; category: string; buCost: number };
            }>;
          },
        })),
        iconSource: (raw["iconSource"] as string | null) ?? null,
        iconKey: (raw["iconKey"] as string | null) ?? null,
        iconUrl: (raw["iconUrl"] as string | null) ?? null,
        iconColor: (raw["iconColor"] as string) ?? "#ffffff",
      };
      setPreviewData(projected);
      return projected;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load preview", "error");
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [capability.id, previewData, showToast]);

  useEffect(() => {
    setActive(readToggle(characterId, capability.id));
    setHydrated(true);
  }, [characterId, capability.id]);

  // Phase 8.4 v9 (Mashu 2026-07-28): lazy-load the capability's
  // bundled primitives so the SHEET can show them nested under
  // the capability (the modal already does this via
  // HeritageSlotCard). Mashu 2026-07-28: "we should see ALL
  // primitives, and before for each heritage type the
  // capabilities and effects nested in them or directly added.
  // Not the primitives directly (more or less like we already
  // display in the character creation modal, but more useful
  // for actual play)."
  useEffect(() => {
    if (!showPrimitives) {
      setBundledPrims([]);
      setBundleLoading(false);
      return;
    }
    let cancelled = false;
    setBundleLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/capabilities/${capability.id}`);
        if (!res.ok) {
          if (!cancelled) setBundleLoading(false);
          return;
        }
        const data = (await res.json()) as { capability?: { primitiveLinks?: Array<{ primitive: { id: number; name: string; category: string; buCost: number } }> } };
        const links = data.capability?.primitiveLinks ?? [];
        if (cancelled) return;
        setBundledPrims(
          links.map((l) => ({
            primitiveId: l.primitive.id,
            name: l.primitive.name,
            category: l.primitive.category,
            buCost: l.primitive.buCost,
          })),
        );
        setBundleLoading(false);
      } catch {
        if (!cancelled) setBundleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capability.id, showPrimitives]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    const next = !active;

    // Optimistic UI update — feels instant.
    setActive(next);
    writeToggle(characterId, capability.id, next);
    setToggling(true);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/toggle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: next }),
        },
      );

      if (!res.ok) {
        // Revert optimistic update on failure.
        setActive(!next);
        writeToggle(characterId, capability.id, !next);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to toggle capability.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as ToggleResponse;
      // Reconcile with server's view of truth.
      setActive(data.capability.active);
      writeToggle(characterId, capability.id, data.capability.active);

      showToast(
        next ? `Activated "${capability.name}"` : `Deactivated "${capability.name}"`,
        "success",
      );
      // Mashu 2026-07-28: notify the History tab (and
      // any other listener) so it re-fetches the log
      // entries WITHOUT a router.refresh() that would
      // remount this CapabilityCard and undo the toggle.
      emitCharacterLogAdded(characterId);
      // Mashu 2026-07-28: don't call router.refresh() here.
      // It re-fetches the page, which can cause the
      // CapabilityCard to remount and reset its local
      // state, undoing the toggle. The audit log entry is
      // written server-side; the user can switch tabs
      // and back (or click the History tab) to see it.
    } catch (err) {
      setActive(!next);
      writeToggle(characterId, capability.id, !next);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setToggling(false);
    }
  }, [active, capability.id, capability.name, characterId, showToast, toggling]);

  const handleTrigger = useCallback(async () => {
    if (triggerPending) return;
    setTriggerPending(true);

    // Visual flash: show active for ~1.2s regardless of stored state.
    setTriggerFlash(true);
    window.setTimeout(() => setTriggerFlash(false), 1200);

    try {
      const res = await fetch(
        `/api/characters/${characterId}/capabilities/${capability.id}/trigger`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to trigger capability.";
        showToast(msg, "error");
        setTriggerFlash(false);
        return;
      }

      const data = (await res.json()) as TriggerResponse;
      showToast(`Triggered "${data.capability.name}"`, "success");
      // Mashu 2026-07-28: same rationale as the toggle
      // handler — notify the History tab via the event
      // bus so it re-fetches without a router.refresh().
      emitCharacterLogAdded(characterId);
      // Mashu 2026-07-28: same rationale as the toggle
      // handler — don't router.refresh() because it can
      // cause the CapabilityCard to remount and undo the
      // trigger flash. The audit log is written
      // server-side and visible on the History tab after
      // a manual refresh.
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
      setTriggerFlash(false);
    } finally {
      setTriggerPending(false);
    }
  }, [capability.id, capability.name, characterId, showToast, triggerPending]);

  // Until hydration runs on the client, render a neutral state so
  // server-rendered HTML matches the first client render (avoids
  // hydration mismatch on the active ring).
  const showActive = triggerFlash || (hydrated && active);

  const openCapabilityPreview = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const data = await fetchPreviewData();
      if (data) {
        openPreview({
          item: {
            kind: "capability",
            // Safe: fetchPreviewData now returns the projected
            // SandboxCapabilityRow shape (see projection block
            // above).
            row: data as never,
          },
          category: "CAPABILITY",
          // Phase 8.5 / Session H6 (Mashu 2026-08-03):
          // wire source + version-history buttons into
          // the capability preview modal's action bar so
          // they render at the bottom of the modal. The
          // user wants these in the PREVIEW, not inline
          // on the card.
          actionBar: {
            openSourceHref: `/library/item/CAPABILITY:${capability.id}`,
            versionHistoryHref: `/library/item/CAPABILITY:${capability.id}/versions`,
          },
          callbacks: {
            engagement: {
              likes: 0,
              dislikes: 0,
              forks: 0,
              userReaction: null,
              authorId: null,
              authorUsername: null,
              authorIsAdmin: null,
              currentUserInternalId: null,
            },
          },
        });
      }
    },
    [fetchPreviewData, openPreview],
  );

  const handlePreviewClick = (e: React.MouseEvent) => {
    void openCapabilityPreview(e);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger preview if clicking on buttons
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("a")
    ) {
      return;
    }
    void openCapabilityPreview();
  };

  return (
      <div
        className={cn(
          "relative rounded-md border bg-card p-4 transition-all cursor-pointer",
          showActive
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-primary/50",
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold">{capability.name}</h4>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            {capability.type}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{capability.sourceType}</span>
          <span>·</span>
          <span>Acquired L{capability.acquiredAtLevel}</span>
        </div>

        {/* Slot metadata: badge for source + optional origin chain. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SlotSourceBadge
            slotSource={capability.slotSource}
            versionId={capability.versionId}
            latestVersionId={capability.latestVersionId}
          />
          {capability.originChain && capability.originChain.length > 0 ? (
            <OriginBadge chain={capability.originChain} />
          ) : null}
        </div>

        {capability.verboseDescription && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {capability.verboseDescription}
          </p>
        )}
        {/* Phase 8.4 v5 (Mashu 2026-07-28): nested effects list
            (matches the character-creation modal's structure).
            Only renders when the capability has at least one
            effect. Mashu 2026-07-28: "we still don't display
            all primitives all capabilities all effects
            properly like in the character creation/edit
            modal." */}
        {capability.effectLinks && capability.effectLinks.length > 0 && (
          <details className="mt-2 rounded border border-border bg-muted/30 px-2 py-1 text-xs">
            <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-muted-foreground">
              Effects ({capability.effectLinks.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {capability.effectLinks.map((el) => (
                <li
                  key={el.effectId}
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {el.effect.name}
                    </span>
                    {/* Phase 8.5 H6 round 11: SlotSourceBadge
                        with the effect's latest version id
                        (resolved from bulk latestVersions). */}
                    <SlotSourceBadge
                      slotSource={"PINNED"}
                      versionId={latestVersions?.get(makeVersionKey("effect", el.effectId)) ?? null}
                      latestVersionId={null}
                    />
                  </div>
                  {el.effect.description ? (
                    <div className="text-muted-foreground italic">
                      {el.effect.description}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Phase 8.4 v9 (Mashu 2026-07-28): bundled primitives
            nested under the capability (lazy-loaded from
            /api/capabilities/[id]). Same data the modal's
            CapabilitySlotCard shows. Mashu 2026-07-28: "we
            should see ALL primitives, and before for each
            heritage type the capabilities and effects nested
            in them or directly added. Not the primitives
            directly (more or less like we already display in
            the character creation modal, but more useful for
            actual play)." */}
        {showPrimitives && ((bundledPrims && bundledPrims.length > 0) || bundleLoading) ? (
          <details open className="mt-2 rounded border border-border bg-muted/30 px-2 py-1 text-xs">
            <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-muted-foreground">
              Primitives ({bundledPrims?.length ?? 0})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {bundledPrims?.map((pl) => (
                <li
                  key={pl.primitiveId}
                  className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-border bg-background px-2 py-1"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-foreground">
                      {pl.name}
                    </span>
                    {/* Phase 8.5 H6 round 11: SlotSourceBadge
                        with the primitive's latest version id. */}
                    <SlotSourceBadge
                      slotSource={"PINNED"}
                      versionId={latestVersions?.get(makeVersionKey("primitive", pl.primitiveId)) ?? null}
                      latestVersionId={null}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {pl.buCost} BU
                  </span>
                </li>
              ))}
              {bundleLoading && !bundledPrims && (
                <li className="text-muted-foreground italic">Loading…</li>
              )}
            </ul>
          </details>
        ) : null}

        {/* Action row */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => {
              // Don't bubble up to the card click handler
              // (which opens the preview modal).
              e.stopPropagation();
              void handleToggle();
            }}
            disabled={toggling || triggerPending}
            aria-pressed={showActive}
            data-testid="capability-toggle"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              showActive
                ? "border-green-500 bg-green-500/15 text-green-700 dark:text-green-300"
                : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            title={
              showActive
                ? "Active — click to deactivate. Persists in localStorage; logs to History."
                : "Inactive — click to activate. Persists in localStorage; logs to History."
            }
          >
            <Power className="size-3" />
            {showActive ? "Active" : "Inactive"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleTrigger();
            }}
            disabled={triggerPending || toggling}
            data-testid="capability-trigger"
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300"
            title="Fire this capability once and log it (state does not persist)"
          >
            {triggerFlash ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Zap className="size-3" />
            )}
            {triggerFlash ? "Triggered" : triggerPending ? "…" : "Trigger"}
          </button>
          {/* Preview modal — same EntityPreview used in atelier/library.
              Hidden in the heritage-accordion variant because the
              user can already click the card body to open the
              preview; no need for a second affordance. */}
          {showPreviewButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewClick(e);
              }}
              disabled={previewLoading}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              title="Open preview modal"
            >
              {previewLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ExternalLink className="size-3" />
              )}
              Preview
            </button>
          )}
        </div>

        {triggerFlash && (
          <p
            className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Capability fired (logged). Effect resolves per its description.
          </p>
        )}
      </div>
    );
  }
