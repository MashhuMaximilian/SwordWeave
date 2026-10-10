"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BedDouble, Coffee } from "lucide-react";
import { getEffectivePlayState, getPlaySessionAccountId, queuePlayChanges } from "@/lib/play-state/client-sync";
import { restRecoveryAllowance, restRecoveryChanges, type RestType } from "@/lib/play-state/rest-recovery";
import type { SubjectKind } from "@/lib/play-state/model";
import type { ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { ToastViewport, useToasts } from "@/components/ui/toast";

/** Shared explicit, table-agreed rest controls for characters and private creatures. */
export function RestRecoveryActions({ subjectKind, subjectId, maximum, current, accountId, disabled = false, buttonClassName, onCurrentChange }: {
  subjectKind: Exclude<SubjectKind, "ENCOUNTER_RUN">;
  subjectId: string;
  maximum: number;
  current: number;
  accountId: string | null;
  disabled?: boolean;
  buttonClassName?: string;
  onCurrentChange?: (next: number) => void;
}) {
  const [rest, setRest] = useState<RestType | null>(null);
  const [amount, setAmount] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { toasts, showToast, dismissToast } = useToasts();
  const overrides = getEffectivePlayState(subjectKind, subjectId).overrides;
  const { allowance, remaining } = restRecoveryAllowance(maximum, overrides);
  const missing = Math.max(0, maximum - current);
  const limit = rest === "short" ? Math.min(missing, remaining) : missing;
  useEffect(() => {
    if (rest && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!rest && dialog.current?.open) dialog.current.close();
  }, [rest]);
  useEffect(() => { setRest(null); }, [accountId, subjectId]);

  function choose(type: RestType) {
    setAmount(type === "short" ? Math.min(missing, remaining) : missing);
    setRest(type);
  }
  function record() {
    if (!rest || disabled || !accountId || getPlaySessionAccountId() !== accountId) return;
    try {
      const state = getEffectivePlayState(subjectKind, subjectId);
      const latest = typeof state.overrides["currentVitality"] === "number" ? state.overrides["currentVitality"] as number : current;
      const changes = restRecoveryChanges(rest, maximum, latest, state.overrides, amount);
      for (const [field, value] of Object.entries(state.overrides)) {
        if (!field.startsWith("consequence:") || !value || typeof value !== "object") continue;
        const condition = value as ConsequenceOccurrence;
        if (condition.active && condition.durationTier === (rest === "long" ? "long_rest" : "short_rest")) changes.push({ field, value: { ...condition, active: false } });
      }
      if (changes.length > 64) throw new Error("Resolve some Consequences before resting; this rest changes too many session fields.");
      queuePlayChanges(subjectKind, subjectId, changes, rest === "long" ? "long_rest" : "short_rest");
      onCurrentChange?.(changes[0]!.value as number);
      setRest(null);
      showToast("Agreed rest recorded. Session sync retains this change until saved.", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to record rest.", "error"); }
  }
  return <>
    <button type="button" className={buttonClassName} disabled={disabled} onClick={() => choose("long")} title="Record an agreed long rest; reset short-rest recovery"><BedDouble className="size-3" />Long rest</button>
    <button type="button" className={buttonClassName} disabled={disabled} onClick={() => choose("short")} title={`${remaining} of ${allowance} short-rest Vitality available`}><Coffee className="size-3" />Short rest</button>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={() => setRest(null)} onClose={() => setRest(null)} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-lg border border-border bg-card p-4 text-foreground shadow-lg backdrop:bg-black/60">
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); record(); }}>
        <h2 id={titleId} className="text-base font-semibold">Record {rest === "long" ? "long" : "short"} rest</h2>
        <p className="text-sm text-muted-foreground">Apply only the recovery your GM and players agreed. {rest === "short" ? "A short pause may be 15–30 minutes; unused recovery remains available until a long rest." : "An overnight sleep need not be eight hours. This resets short-rest recovery, even if the table agrees partial healing."}</p>
        <p className="text-xs font-mono">Vitality {current} / {maximum} · Short-rest recovery {remaining} / {allowance}</p>
        <label className="block text-sm">Vitality to restore<input autoFocus type="number" min={0} max={limit} value={amount} onChange={event => setAmount(Number(event.target.value))} className="mt-1 w-full rounded border border-input bg-background px-3 py-2 font-mono" /></label>
        <p className="text-xs text-muted-foreground">Rest does not automatically resolve lasting injuries or other recovery requirements.</p>
        <div className="flex justify-end gap-2"><button type="button" className="sheet-button" onClick={() => setRest(null)}>Cancel</button><button type="submit" className="sheet-button is-gold" disabled={disabled || !Number.isSafeInteger(amount) || amount < 0 || amount > limit}>Record agreed rest</button></div>
      </form>
    </dialog>
    <ToastViewport toasts={toasts} onDismiss={dismissToast} />
  </>;
}
