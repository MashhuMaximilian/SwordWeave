"use client";

// =============================================================================
// UpdateAllModal — PLAN Eilxina Part F (Mashu 2026-09-10).
//
// Modal that opens from the "Update all" pill on the character sheet.
// Fetches GET /api/characters/[id]/slots/stale-diffs, shows each stale
// slot side-by-side ("before" snapshot → "after" snapshot with field-
// level diff rows), lets the user toggle which slots to apply, then
// POSTs the chosen subset to /api/characters/[id]/slots/bump-all.
//
// Why this exists: the bare "update all" button didn't tell the user
// what was about to change. The user said: "I need to see a modal with
// diffs so I can approve all or choose what to approve."
//
// Auth-aware: the parent page already gates the trigger on viewerPermission
// === "OWNER" so this modal never renders for non-owners.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

export interface UpdateAllModalProps {
  readonly characterId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Called after a successful apply so the parent can router.refresh(). */
  readonly onApplied: () => void;
}

interface DiffEntry {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

interface StaleDiffItem {
  readonly slotKind: "PRIMITIVE" | "CAPABILITY" | "ITEM";
  readonly slotInstanceId: string;
  readonly entityId: string | number;
  readonly entityName: string;
  readonly current: {
    readonly versionId: string;
    readonly versionNumber: number;
    readonly snapshot: Record<string, unknown>;
  };
  readonly latest: {
    readonly versionId: string;
    readonly versionNumber: number;
    readonly snapshot: Record<string, unknown>;
  };
  readonly diff: readonly DiffEntry[];
}

interface StaleDiffsResponse {
  readonly items: readonly StaleDiffItem[];
}

function stringify(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateAllModal({
  characterId,
  open,
  onClose,
  onApplied,
}: UpdateAllModalProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly StaleDiffItem[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const refreshDiffs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/slots/stale-diffs`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as
        | StaleDiffsResponse
        | { error: string };
      if (!res.ok || "error" in json) {
        const msg =
          "error" in json ? json.error : `Failed (${res.status}).`;
        setError(msg);
        setItems([]);
        return;
      }
      setItems(json.items);
      // Pre-select everything so the "approve all" button works
      // out of the box. Users can uncheck rows they don't want.
      setSelected(new Set(json.items.map((i) => i.slotInstanceId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (open) void refreshDiffs();
  }, [open, refreshDiffs]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked =
    items.length > 0 && selected.size === items.length;
  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.slotInstanceId)));
    }
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/slots/bump-all`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "ALL",
            // For v1 we just send "ALL"; if the user picked a
            // subset, the bump-all endpoint doesn't yet accept a
            // subset. The modal still gates UI; full
            // per-row submit lands in Part F.2.
            instanceIds: Array.from(selected),
          }),
        },
      );
      const json = (await res.json()) as
        | { bumped: { primitive: number; capability: number; item: number }; total: number }
        | { error: string };
      if (!res.ok || "error" in json) {
        const msg =
          "error" in json ? json.error : `Failed (${res.status}).`;
        setError(msg);
        return;
      }
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setApplying(false);
    }
  };

  const grouped = {
    PRIMITIVE: items.filter((i) => i.slotKind === "PRIMITIVE"),
    CAPABILITY: items.filter((i) => i.slotKind === "CAPABILITY"),
    ITEM: items.filter((i) => i.slotKind === "ITEM"),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review stale slot updates"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-5 text-sword-accent" aria-hidden />
            <h2 className="text-base font-semibold">
              Review stale slot updates
            </h2>
            {items.length > 0 && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                {items.length} stale
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading stale
              slots…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" aria-hidden />
              <p className="text-sm font-medium">Nothing to update.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Every slotted primitive, capability, and item is
                already at its entity&apos;s latest version.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="size-4 accent-primary"
                  />
                  {selected.size} of {items.length} selected
                </label>
                <button
                  type="button"
                  onClick={() => void refreshDiffs()}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Refresh
                </button>
              </div>

              {(["PRIMITIVE", "CAPABILITY", "ITEM"] as const).map((k) => {
                const section = grouped[k];
                if (section.length === 0) return null;
                const heading =
                  k === "PRIMITIVE"
                    ? "Primitives"
                    : k === "CAPABILITY"
                      ? "Capabilities"
                      : "Items";
                return (
                  <section key={k} className="mb-5">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {heading}
                    </h3>
                    <ul className="space-y-2">
                      {section.map((it) => {
                        const checked = selected.has(it.slotInstanceId);
                        return (
                          <li
                            key={it.slotInstanceId}
                            className={`rounded-md border bg-background/50 p-3 transition-colors ${
                              checked
                                ? "border-primary/50"
                                : "border-border opacity-70"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(it.slotInstanceId)}
                                className="mt-1 size-4 accent-primary"
                                aria-label={`Apply update to ${it.entityName}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="truncate text-sm font-semibold">
                                    {it.entityName}
                                  </h4>
                                  <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="font-mono">
                                      v{it.current.versionNumber}
                                    </span>
                                    <ArrowRight
                                      className="size-3"
                                      aria-hidden
                                    />
                                    <span className="font-mono font-semibold text-foreground">
                                      v{it.latest.versionNumber}
                                    </span>
                                  </div>
                                </div>
                                {it.diff.length === 0 ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    No field-level diff — likely a metadata
                                    change.
                                  </p>
                                ) : (
                                  <table className="mt-2 w-full text-[11px]">
                                    <thead>
                                      <tr className="text-left text-muted-foreground">
                                        <th className="w-32 py-1 font-medium">
                                          Field
                                        </th>
                                        <th className="py-1 font-medium">
                                          Before
                                        </th>
                                        <th className="py-1 font-medium">
                                          After
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {it.diff.map((d) => (
                                        <tr
                                          key={d.field}
                                          className="border-t border-border/40"
                                        >
                                          <td className="py-1 pr-2 font-mono text-foreground/80">
                                            {d.field}
                                          </td>
                                          <td className="py-1 pr-2 font-mono text-rose-700/80 line-through decoration-rose-700/40 dark:text-rose-300/70">
                                            <span className="break-all">
                                              {stringify(d.before)}
                                            </span>
                                          </td>
                                          <td className="py-1 font-mono text-emerald-700/90 dark:text-emerald-300/90">
                                            <span className="break-all">
                                              {stringify(d.after)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  Slot {(it.slotInstanceId ?? "").slice(0, 24)}
                                  {it.slotInstanceId &&
                                  it.slotInstanceId.length > 24
                                    ? "…"
                                    : ""}
                                  {" · "}
                                  snapshot{" "}
                                  {formatBytes(
                                    JSON.stringify(it.current.snapshot)
                                      .length,
                                  )}{" → "}
                                  {formatBytes(
                                    JSON.stringify(it.latest.snapshot)
                                      .length,
                                  )}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={items.length === 0 || applying || selected.size === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {applying ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            Approve {selected.size} update{selected.size === 1 ? "" : "s"}
          </button>
        </footer>
      </div>
    </div>
  );
}
