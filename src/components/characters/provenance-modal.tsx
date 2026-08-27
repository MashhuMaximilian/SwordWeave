/**
 * provenance-modal.tsx — Phase 8.3f S5 (Mashu 2026-07-28)
 *
 * Click-through provenance modal. When a user clicks an attribute
 * modifier / save value / save DC / max vitality in the
 * VitalityCard, this modal opens to show:
 *
 *   Target: Physical modifier
 *   Total:  +4
 *
 *   ┌─ Contributions ──────────────────────────────┐
 *   │  Primitive           Op    Val    Condition   │
 *   │  Systemic Reson...   +     +2     [always]    │
 *   │    ↳ from Mystic → Aura Detective            │
 *   │                                              │
 *   │  Focused Edge...     +     +2     [always]    │
 *   │    ↳ from Mystic → Aura Detective            │
 *   └──────────────────────────────────────────────┘
 *
 * For mirrored primitives, the row shows:
 *   - the post-mirror value
 *   - the pre-mirror value as a struck-through "STANDARD: +8"
 *     for transparency
 *   - a "MIRRORED" pill
 *   - the mirror vector (VARIABLE_VECTOR / STRUCTURAL_FAULT /
 *     COST_INSTABILITY)
 *
 * Modal is dismissible via the X button, the backdrop, or the
 * Escape key. Per the S4 spec: provenance display is always a
 * MODAL (never a dropdown) so the contributor list is readable
 * on mobile.
 */

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { OP_LABEL, OP_COLOR, formatOperandValue } from "./operator-symbol";
import { X } from "lucide-react";
import type {
  ModifierContribution,
  ResolvedModifiers,
} from "@/lib/engine/resolve-modifiers";

export interface ProvenanceModalProps {
  /** The ModifierTarget string this modal is showing provenance for. */
  target: string;
  /** Human-readable label for the target (e.g. "Physical modifier"). */
  targetLabel: string;
  /** Resolver's totals map. */
  totals: ResolvedModifiers["totals"];
  /** Resolver's per-target attribution list. */
  byTarget: ResolvedModifiers["byTarget"];
  onClose: () => void;
}


function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function ProvenanceModal({
  target,
  targetLabel,
  totals,
  byTarget,
  onClose,
}: ProvenanceModalProps) {
  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const total = totals[target] ?? 0;
  const contributions = byTarget[target] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Provenance for ${targetLabel}`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Provenance
            </h2>
            <p className="mt-0.5 text-base font-semibold">{targetLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Total + body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Total
            </span>
            <span className="font-mono text-xl font-bold tabular-nums">
              {fmt(total)}
            </span>
          </div>

          {contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No primitive contributes to this target.
            </p>
          ) : (
            <ul className="space-y-2">
              {contributions.map((c, i) => (
                <ContributionRow key={`${c.primitiveId}-${i}`} c={c} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ContributionRow({ c }: { c: ModifierContribution }) {
  return (
    <li className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={c.primitiveName}>
            {c.primitiveName}
          </p>
          <ProvenanceBreadcrumb c={c} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {c.op !== "min" && c.op !== "max" ? (
            <span
              className={cn(
                "font-mono text-lg font-bold leading-none",
                OP_COLOR[c.op] ?? "text-foreground",
              )}
            >
              {OP_LABEL[c.op] ?? c.op}
            </span>
          ) : (
            <span
              className={cn(
                "font-mono text-lg font-bold leading-none",
                OP_COLOR[c.op] ?? "text-foreground",
              )}
            >
              {OP_LABEL[c.op] ?? c.op}
            </span>
          )}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatOperandValue(c.value)}
          </span>
          {c.preMirrorValue !== null && (
            <span
              className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
              title={`Standard (non-mirrored) value was ${fmt(c.preMirrorValue)} — mirror flipped it`}
            >
              Mirrored
            </span>
          )}
        </div>
      </div>
      {c.preMirrorValue !== null && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Standard: <span className="line-through">{fmt(c.preMirrorValue)}</span>{" "}
          → Mirrored: <span className="font-semibold">{fmt(c.value)}</span>
        </p>
      )}
    </li>
  );
}

function ProvenanceBreadcrumb({ c }: { c: ModifierContribution }) {
  const { heritageName, capabilityName, effectName, kind } = c.provenance;
  if (kind === "direct") {
    return (
      <p className="mt-0.5 text-[11px] text-muted-foreground">direct</p>
    );
  }
  const parts: string[] = [];
  if (heritageName) parts.push(heritageName);
  if (capabilityName) parts.push(capabilityName);
  if (effectName) parts.push(effectName);
  if (parts.length === 0) {
    return (
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        from {kind}
      </p>
    );
  }
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      from {parts.join(" → ")}
    </p>
  );
}