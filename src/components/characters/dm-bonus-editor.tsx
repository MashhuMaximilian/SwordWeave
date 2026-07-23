"use client";

/**
 * DmBonusEditor — Phase 8.2 batch 5
 *
 * Inline editor for the character's DM-issued bonus BU. Renders as
 * a click-to-edit badge (matches the look of the existing static
 * badge in BuBar); clicking opens a small popover with a number
 * input + Save / Cancel.
 *
 * Why popover (not modal)? It's a single integer field. A modal
 * would be overkill and interrupt the player's flow. The popover
 * stays open until the user saves, cancels, or clicks away.
 *
 * Optimistic update pattern mirrors the other Phase 8.2 client
 * components (CapabilityCard, ItemCard): flip local state first,
 * POST in the background, reconcile with server's view, router.refresh()
 * so the BU bar / progression pool re-renders.
 */

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface DmBonusResponse {
  character: { id: string; dmBonusBu: number };
  prev: number;
  next: number;
  applied: number;
  note?: string;
}

export interface DmBonusEditorProps {
  characterId: string;
  initialValue: number;
}

export function DmBonusEditor({
  characterId,
  initialValue,
}: DmBonusEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showToast } = useToasts();

  // Display state — what the badge shows right now. Default to
  // initialValue from props; updated optimistically when saving.
  const [optimisticValue, setOptimisticValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(initialValue));
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reconcile with server on prop change (after router.refresh).
  useEffect(() => {
    if (!pending) setOptimisticValue(initialValue);
  }, [initialValue, pending]);

  // Auto-focus the input when editing opens.
  useEffect(() => {
    if (editing) {
      setDraft(String(optimisticValue));
      // Defer focus until the input is mounted.
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, optimisticValue]);

  const handleSave = useCallback(async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || !Number.isInteger(next) || next < 0) {
      showToast("DM bonus must be a non-negative integer.", "error");
      return;
    }
    if (next === optimisticValue) {
      // No-op — just close the editor.
      setEditing(false);
      return;
    }

    const prev = optimisticValue;
    setOptimisticValue(next);
    setPending(true);

    try {
      const res = await fetch(`/api/characters/${characterId}/dm-bonus`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dmBonusBu: next }),
      });

      if (!res.ok) {
        // Revert on failure.
        setOptimisticValue(prev);
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? "Failed to update DM bonus.";
        showToast(msg, "error");
        return;
      }

      const data = (await res.json()) as DmBonusResponse;
      setOptimisticValue(data.character.dmBonusBu);
      setEditing(false);

      // Refresh the SC so the BU pool recalculates with the new bonus.
      startTransition(() => router.refresh());

      const applied = data.applied;
      if (applied !== 0) {
        const verb = applied > 0 ? "Granted" : "Removed";
        showToast(`${verb} ${Math.abs(applied)} DM bonus BU.`, "success");
      }
    } catch (err) {
      setOptimisticValue(prev);
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }, [
    characterId,
    draft,
    optimisticValue,
    pending,
    router,
    showToast,
    startTransition,
  ]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft(String(optimisticValue));
  }, [optimisticValue]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-medium transition-colors hover:bg-secondary/70"
        title="Click to edit DM bonus BU"
      >
        <span>{optimisticValue} BU</span>
        <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <span
      className="relative inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2 py-1"
      // Click-away handler on the wrapper.
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
          }
        }}
        disabled={pending}
        className="w-16 rounded-sm bg-transparent px-1 text-sm font-medium tabular-nums focus:outline-none"
        aria-label="DM bonus BU"
      />
      <span className="text-xs text-muted-foreground">BU</span>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={pending}
        className={cn(
          "inline-flex items-center rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
        )}
        title="Save (Enter)"
      >
        <Check className="size-3" />
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
        title="Cancel (Esc)"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
