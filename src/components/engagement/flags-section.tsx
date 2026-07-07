"use client";

// =============================================================================
// FlagsSection — collapsible distribution table + SVG pie chart for the
// flag reasons on a library item's source page.
//
// Shows total count + per-reason breakdown:
//   • UNBALANCED  — BU / power issue
//   • BROKEN      — doesn't work mechanically
//   • INAPPROPRIATE — content violation
//   • DUPLICATE   — duplicates existing entry
//   • OTHER       — freeform; "View notes" link opens a modal listing
//                   each reporter's freeform note.
//
// Visibility: the count + distribution are public to everyone — flag
// counts help community moderation. Individual reporter identities are
// NOT exposed (only the note text is, since "OTHER" notes may contain
// genuinely useful bug reports and the reporter opted into them).
//
// Pie chart is a pure SVG <path d="..."> implementation (no extra deps).
// Each slice is rendered as a separate path; stroke colors provide the
// segment separation. Slices under 2% are skipped (label would be
// unreadable) — the table below the chart still shows them.
// =============================================================================

import { useState } from "react";
import { ChevronDown, ChevronUp, Flag, MessageSquare } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

export interface FlagDistribution {
  UNBALANCED: number;
  BROKEN: number;
  INAPPROPRIATE: number;
  DUPLICATE: number;
  OTHER: number;
}

const REASON_META: Array<{
  key: keyof FlagDistribution;
  label: string;
  color: string;
}> = [
  { key: "UNBALANCED", label: "Unbalanced", color: "#f59e0b" },
  { key: "BROKEN", label: "Broken", color: "#ef4444" },
  { key: "INAPPROPRIATE", label: "Inappropriate", color: "#a855f7" },
  { key: "DUPLICATE", label: "Duplicate", color: "#3b82f6" },
  { key: "OTHER", label: "Other", color: "#6b7280" },
];

export function FlagsSection(props: {
  distribution: FlagDistribution;
  /** Called when the user clicks "View all OTHER notes (N)". */
  onOpenNotes?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const total = Object.values(props.distribution).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <Flag className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Flags</span>
          <span
            className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold tabular-nums text-secondary-foreground"
            aria-label={`${total} ${total === 1 ? "flag" : "flags"}`}
          >
            {total}
          </span>
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <FlagPie distribution={props.distribution} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2 font-semibold">Reason</th>
                <th className="py-1 pr-2 text-right font-semibold">Count</th>
                <th className="py-1 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {REASON_META.map((meta) => {
                const count = props.distribution[meta.key];
                const pct =
                  total === 0 ? 0 : Math.round((count / total) * 100);
                return (
                  <tr key={meta.key} className="border-b border-border/50">
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: meta.color }}
                          aria-hidden="true"
                        />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {count}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
              {props.distribution.OTHER > 0 && props.onOpenNotes ? (
                <tr>
                  <td colSpan={3} className="pt-2">
                    <button
                      type="button"
                      onClick={props.onOpenNotes}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <MessageSquare className="size-3" /> View all OTHER notes (
                      {props.distribution.OTHER})
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

// =============================================================================
// FlagPie — SVG pie chart
// =============================================================================
//
// Single donut chart with each reason as a colored slice. Slices under 2%
// of the total are dropped from the visual (label would be unreadable);
// the table still shows them. Render is deterministic — no animation,
// no chart library, ~80 lines of code.
// =============================================================================

const PIE_RADIUS = 80;
const PIE_CX = 90;
const PIE_CY = 90;
const PIE_INNER = 40; // donut hole

function FlagPie({ distribution }: { distribution: FlagDistribution }) {
  const total = Object.values(distribution).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
        No flags
      </div>
    );
  }

  let cumulativeAngle = -Math.PI / 2; // start at 12 o'clock
  const slices: Array<{
    key: keyof FlagDistribution;
    color: string;
    path: string;
    pct: number;
  }> = [];

  for (const meta of REASON_META) {
    const count = distribution[meta.key];
    if (count === 0) continue;
    const fraction = count / total;
    // Drop tiny slices — unreadable labels + visual noise. Table still
    // shows them.
    if (fraction < 0.02) continue;
    const angle = fraction * Math.PI * 2;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;
    const path = donutSlice(
      PIE_CX,
      PIE_CY,
      PIE_RADIUS,
      PIE_INNER,
      startAngle,
      endAngle,
    );
    slices.push({ key: meta.key, color: meta.color, path, pct: fraction });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={180}
        height={180}
        viewBox="0 0 180 180"
        role="img"
        aria-label={`Flag distribution pie chart, ${total} total flags`}
      >
        <circle
          cx={PIE_CX}
          cy={PIE_CY}
          r={PIE_INNER}
          fill="var(--card)"
        />
        {slices.map((s) => (
          <path key={s.key} d={s.path} fill={s.color} stroke="var(--card)" strokeWidth={2} />
        ))}
        <text
          x={PIE_CX}
          y={PIE_CY - 6}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 24, fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x={PIE_CX}
          y={PIE_CY + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}
        >
          {total === 1 ? "flag" : "flags"}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {slices.map((s) => {
          const meta = REASON_META.find((m) => m.key === s.key)!;
          return (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{meta.label}</span>
              <span className="tabular-nums text-foreground">
                {Math.round(s.pct * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function donutSlice(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  // Standard SVG donut slice: outer arc + inner arc reversed + close.
  const x1Outer = cx + outerR * Math.cos(startAngle);
  const y1Outer = cy + outerR * Math.sin(startAngle);
  const x2Outer = cx + outerR * Math.cos(endAngle);
  const y2Outer = cy + outerR * Math.sin(endAngle);
  const x1Inner = cx + innerR * Math.cos(endAngle);
  const y1Inner = cy + innerR * Math.sin(endAngle);
  const x2Inner = cx + innerR * Math.cos(startAngle);
  const y2Inner = cy + innerR * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1Outer} ${y1Outer}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
    `L ${x1Inner} ${y1Inner}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
    "Z",
  ].join(" ");
}

// =============================================================================
// FlagNotesModal — lists freeform OTHER notes
// =============================================================================

export function FlagNotesModal(props: {
  isOpen: boolean;
  onClose: () => void;
  notes: Array<{ id: string; note: string; reportedAt: Date | string }>;
}) {
  // Escape closes
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flag notes"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Other flag notes</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {props.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No freeform notes yet.
            </p>
          ) : (
            props.notes.map((n) => (
              <div
                key={n.id}
                className="rounded-md border border-border bg-background p-3 text-sm"
              >
                <p className="whitespace-pre-wrap text-foreground">{n.note}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(n.reportedAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
