"use client";
import { useCharacterReadOnly } from "./character-read-only";
import { EditableNumberInput } from "@/components/ui/editable-number-input";

/**
 * VitalityTracker — Phase 8.2 batch 2
 *
 * Interactive vitality widget for the character sheet. Replaces the
 * old display-only VitalityCard. Lets the player apply damage or
 * healing (with clamp-on-boundary semantics), or take a long/short
 * rest. Every change POSTs to the server, which writes a
 * character_log entry and returns the new state.
 *
 * Semantics (Mashu 2026-07-22):
 *   - heal past max → clamps to max (no rejection)
 *   - damage below 0 → clamps to 0 (no rejection)
 *
 * UI states:
 *   - Idle: shows current/max + buttons
 *   - Dialog open: apply damage/heal input
 *   - Pending: spinner inline while POST in flight
 *
 * Confirms vitality through a targeted event; the sheet recalculates its
 * HP-dependent rules without refetching the route.
 */

import { useEffect, useRef, useState } from "react";
import { queuePlayChanges, getEffectivePlayState, getPlaySessionAccountId, subscribePlaySession } from "@/lib/play-state/client-sync";
import { usePlaySession } from "@/lib/hooks/use-play-session";
import { Heart, Minus, Plus } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { RestRecoveryActions } from "./rest-recovery-actions";


export interface VitalityTrackerProps {
  characterId: string;
  max: number;
  current: number;
  /** Mirrors optimistic changes into the parent vitality readout immediately. */
  onCurrentChange?: (next: number) => void;
  /**
   * Phase 8.4 (Mashu 2026-07-28): compact mode shrinks the four
   * action buttons (damage / heal / short rest / long rest) so
   * they lay out on a single row even on phones ≤ 360px wide. Used
   * by BottomStickyBar's expanded drawer; the in-page Overview
   * panel keeps the original roomier layout.
   */
  compact?: boolean;
  /**
   * Phase 8.4 v4 (Mashu 2026-07-28): optional best-practice totals
   * per attribute. When all four (phys, ment, magi, pb) are
   * provided, the Vitality card renders a compact
   * "PHYS 13 / MENT 8 / MAGI 7 / PROF +3" row at the bottom of
   * the card so the user sees the proficiency bonus alongside
   * the attributes. Mashu 2026-07-28: "I don't see proficiency
   * bonus next to attributes in the vitality card (not in quick
   * bar). I was wrong in deferring it."
   */
  attrBestTotals?: {
    physical: number;
    mental: number;
    magical: number;
    pb: number;
  };
}

export function VitalityTracker({
  characterId,
  max,
  current,
  onCurrentChange,
  compact = false,
  attrBestTotals,
}: VitalityTrackerProps) {
  const readOnly = useCharacterReadOnly();
  const { session, accountId } = usePlaySession("CHARACTER", characterId, undefined, undefined, { enabled: !readOnly });
  const sessionReady = session.ready && session.status !== "legacy";
  const mutationPending = useRef(false);
  const { showToast } = useToasts();

  // Local optimistic state so the UI feels instant. The server is
  // the source of truth; we re-sync via the API response.
  const safeCurrent = Math.max(0, Math.min(max, current));
  const [optimisticCurrent, setOptimisticCurrent] = useState(safeCurrent);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"damage" | "heal">("damage");
  const [amount, setAmount] = useState("");
  const pending = false;
  const restPending: "long" | "short" | null = null;

  const [baseCurrent, setBaseCurrent] = useState(safeCurrent);
  if (baseCurrent !== safeCurrent) { setBaseCurrent(safeCurrent); setOptimisticCurrent(safeCurrent); }

  const percent =
    max > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((optimisticCurrent / max) * 100)),
        )
      : 0;

  function openDialog(mode: "damage" | "heal") {
    if (readOnly) return;
    setDialogMode(mode);
    setAmount("");
    setDialogOpen(true);
  }

  function applySessionVitality(next: number) {
    if (!sessionReady || !accountId || getPlaySessionAccountId() !== accountId) throw new Error("Wait for your signed-in session before editing vitality.");
    queuePlayChanges("CHARACTER", characterId, [{ field: "currentVitality", value: next }]);
    setOptimisticCurrent(next);
    onCurrentChange?.(next);
  }

  useEffect(() => subscribePlaySession("CHARACTER", characterId, () => {
    const value = getEffectivePlayState("CHARACTER", characterId).overrides["currentVitality"];
    if (typeof value === "number") { setOptimisticCurrent(Math.min(max, value)); onCurrentChange?.(Math.min(max, value)); }
  }), [characterId, max, onCurrentChange, accountId, sessionReady]);

  async function submitApply(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || !sessionReady || !accountId || getPlaySessionAccountId() !== accountId || mutationPending.current) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) { showToast("Enter a positive number.", "error"); return; }
    const delta = dialogMode === "damage" ? -Math.floor(num) : Math.floor(num);
    try {
      applySessionVitality(Math.max(0, Math.min(max, optimisticCurrent + delta)));
      setDialogOpen(false);
      showToast("Vitality updated. Session sync retains this change until saved.", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to queue vitality.", "error"); }
  }

  // Phase 8.3g v3 (Mashu 2026-07-28): compact mode now
  // means "buttons + dialogs only" — the top label /
  // number / bar are SKIPPED. They're rendered separately
  // by VitalityDisplayCard. The legacy non-compact mode
  // (some modal contexts) keeps the label + number + bar.
  // The dialogs + buttons stay so the user can still
  // apply damage / heal / rest.
  return (
    <div>
      {!compact && (
        <>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Vitality
          </p>
          <p className="mt-1 font-mono text-2xl font-bold">
            {optimisticCurrent}
            <span className="text-muted-foreground text-base"> / {max}</span>
          </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            percent < 25
              ? "bg-destructive"
              : percent < 50
                ? "bg-amber-500"
                : "bg-green-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{percent}%</p>
        </>
      )}

      {/* Phase 8.4 v4 (Mashu 2026-07-28): attribute best totals +
          proficiency bonus row. Sits at the bottom of the Vitality
          card so the user sees the proficiency bonus alongside the
          attributes. Mashu 2026-07-28: "I don't see proficiency
          bonus next to attributes in the vitality card (not in
          quick bar). I was wrong in deferring it." */}
      {attrBestTotals && (
        <div
          className="mt-2 grid grid-cols-4 gap-1.5"
          data-testid="vitality-attribute-row"
        >
          <AttrTotalCell label="PHYS" value={attrBestTotals.physical} />
          <AttrTotalCell label="MENT" value={attrBestTotals.mental} />
          <AttrTotalCell label="MAGI" value={attrBestTotals.magical} />
          <AttrTotalCell label="PROF" value={attrBestTotals.pb} emphasize />
        </div>
      )}

      {/* Action row. compact: no flex-wrap so the 4 buttons
          always sit on a single row; smaller padding. normal: wraps
          to 2 rows on phones ≤ 360px. */}
      <div
        className={cn(
          "mt-3 flex gap-1.5",
          compact ? "flex-nowrap" : "flex-wrap gap-2",
        )}
      >
        <button
          type="button"
          onClick={() => openDialog("damage")}
          disabled={
            readOnly || !sessionReady || pending || restPending !== null || optimisticCurrent === 0
          }
          className={cn(
            "v12-vitality-command is-damage inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70",
            compact ? "px-1 py-0.5 text-xs gap-0.5" : "px-2 py-1 text-xs",
          )}
          aria-label="Apply damage"
        >
          <Minus className="size-3" />
          Damage
        </button>
        <button
          type="button"
          onClick={() => openDialog("heal")}
          disabled={
            readOnly || !sessionReady || pending || restPending !== null || optimisticCurrent >= max
          }
          className={cn(
            "v12-vitality-command is-heal inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70",
            compact ? "px-1 py-0.5 text-xs gap-0.5" : "px-2 py-1 text-xs",
          )}
          aria-label="Apply healing"
        >
          <Plus className="size-3" />
          Heal
        </button>
        <RestRecoveryActions
          subjectKind="CHARACTER" subjectId={characterId} maximum={max} current={optimisticCurrent}
          accountId={accountId} disabled={readOnly || !sessionReady || pending}
          buttonClassName={cn("v12-vitality-command is-rest inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70", compact ? "px-1 py-0.5 text-xs gap-0.5" : "px-2 py-1 text-xs")}
          onCurrentChange={next => { setOptimisticCurrent(next); onCurrentChange?.(next); }}
        />
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            dialogMode === "damage" ? "Apply damage" : "Apply healing"
          }
          onClick={() => !pending && setDialogOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Heart
                className={cn(
                  "size-4",
                  dialogMode === "damage"
                    ? "text-destructive"
                    : "text-green-500",
                )}
              />
              {dialogMode === "damage" ? "Apply damage" : "Apply healing"}
            </h3>
            <form onSubmit={submitApply} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Amount</span>
                <EditableNumberInput
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  disabled={pending}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-lg"
                  placeholder="0"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Current: {optimisticCurrent} / {max}
                  {dialogMode === "heal" && optimisticCurrent >= max && (
                    <> — already at full vitality.</>
                  )}
                  {dialogMode === "damage" && optimisticCurrent === 0 && (
                    <> — already at 0 vitality.</>
                  )}
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  disabled={pending}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50",
                    dialogMode === "damage"
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-green-600 hover:bg-green-700",
                  )}
                >
                  {pending
                    ? "Applying…"
                    : dialogMode === "damage"
                      ? "Take damage"
                      : "Heal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AttrTotalCell({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  const display = value >= 0 ? `+${value}` : `${value}`;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 rounded-md border px-2 py-1.5",
        emphasize
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-background",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          emphasize ? "text-sm text-primary" : "text-sm text-foreground",
        )}
      >
        {display}
      </span>
    </div>
  );
}
