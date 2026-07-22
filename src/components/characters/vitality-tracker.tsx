"use client";

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
 * After a successful POST, calls router.refresh() so the rest of
 * the sheet (BU, encumbrance, anything derived from character state)
 * re-renders. The local state is updated optimistically first to
 * keep the UI snappy.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, BedDouble, Coffee } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface VitalityTrackerProps {
  characterId: string;
  max: number;
  current: number;
}

interface ApplyResponse {
  character: { id: string; currentVitality: number; level: number };
  max: number;
  delta: { prev: number; next: number; applied: number };
  note?: string;
}

interface RestResponse {
  character: { id: string; currentVitality: number; level: number };
  max: number;
  restType: "long" | "short";
  vitalityRestored: number;
}

export function VitalityTracker({
  characterId,
  max,
  current,
}: VitalityTrackerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showToast } = useToasts();

  // Local optimistic state so the UI feels instant. The server is
  // the source of truth; we re-sync via the API response.
  const [optimisticCurrent, setOptimisticCurrent] = useState(current);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"damage" | "heal">("damage");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [restPending, setRestPending] = useState<"long" | "short" | null>(
    null,
  );

  // Keep optimistic state in sync if the server pushes a new value
  // (e.g. after a refresh triggered by an external action).
  if (optimisticCurrent !== current && !pending && !restPending) {
    setOptimisticCurrent(current);
  }

  const percent =
    max > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((optimisticCurrent / max) * 100)),
        )
      : 0;

  function openDialog(mode: "damage" | "heal") {
    setDialogMode(mode);
    setAmount("");
    setDialogOpen(true);
  }

  async function submitApply(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      showToast("Enter a positive number.", "error");
      return;
    }
    const delta = dialogMode === "damage" ? -Math.floor(num) : Math.floor(num);

    setPending(true);
    const clamped = Math.max(0, Math.min(max, optimisticCurrent + delta));
    setOptimisticCurrent(clamped);

    try {
      const res = await fetch(`/api/characters/${characterId}/vitality`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta, source: "manual" }),
      });

      if (!res.ok) {
        setOptimisticCurrent(current);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to update vitality.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as ApplyResponse;
      setOptimisticCurrent(data.character.currentVitality);
      setDialogOpen(false);

      startTransition(() => router.refresh());

      const verb = dialogMode === "damage" ? "Damage" : "Heal";
      const actualDelta = data.delta.applied;
      const wasClamped = actualDelta !== delta;
      const note = wasClamped
        ? `${verb} ${Math.abs(actualDelta)} (clamped from ${Math.abs(delta)}).`
        : `${verb} ${Math.abs(actualDelta)} applied.`;
      showToast(note, "success");
    } catch (err) {
      setOptimisticCurrent(current);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitRest(restType: "long" | "short") {
    setRestPending(restType);
    try {
      const res = await fetch(`/api/characters/${characterId}/rest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restType }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to rest.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as RestResponse;
      setOptimisticCurrent(data.character.currentVitality);
      startTransition(() => router.refresh());

      const restored = data.vitalityRestored;
      const verb = restType === "long" ? "Long rest" : "Short rest";
      const note =
        restored > 0
          ? `${verb} complete. +${restored} vitality.`
          : `${verb} complete. Already at full vitality.`;
      showToast(note, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setRestPending(null);
    }
  }

  return (
    <div>
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

      {/* Action row */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openDialog("damage")}
          disabled={
            pending || restPending !== null || optimisticCurrent === 0
          }
          className="inline-flex items-center gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Apply damage"
        >
          <Minus className="size-3" />
          Damage
        </button>
        <button
          type="button"
          onClick={() => openDialog("heal")}
          disabled={
            pending || restPending !== null || optimisticCurrent >= max
          }
          className="inline-flex items-center gap-1 rounded-md border border-green-600/50 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-green-400"
          aria-label="Apply healing"
        >
          <Plus className="size-3" />
          Heal
        </button>
        <button
          type="button"
          onClick={() => submitRest("long")}
          disabled={
            pending || restPending !== null || optimisticCurrent === max
          }
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Long rest"
          title="Long rest: restore to full vitality"
        >
          <BedDouble className="size-3" />
          {restPending === "long" ? "Resting…" : "Long rest"}
        </button>
        <button
          type="button"
          onClick={() => submitRest("short")}
          disabled={
            pending || restPending !== null || optimisticCurrent === max
          }
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Short rest"
          title="Short rest: restore 50% of missing vitality (rounded up)"
        >
          <Coffee className="size-3" />
          {restPending === "short" ? "Resting…" : "Short rest"}
        </button>
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
                <input
                  type="number"
                  min={1}
                  max={999}
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