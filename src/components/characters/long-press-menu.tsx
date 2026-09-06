"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): long-press menu for primitive chips.
 *
 * On mobile, drag-and-drop is fragile (no native drop targets, touch
 * gestures conflict with scroll). Instead, every primitive chip in
 * BUILD mode supports long-press (~500ms) → bottom action sheet:
 *
 *   - Move to Lineage
 *   - Move to Upbringing
 *   - Move to Manifest
 *   - Move to Items
 *   - Detach (delete from character)
 *
 * Desktop still works because long-press also fires from pointer
 * hold on touch-screen laptops — but the same component also exposes
 * a small "..." overflow button for mouse users.
 *
 * Why custom logic, not a UI library:
 *   The existing `@radix-ui/react-dropdown-menu` is already used for
 *   desktop menus. We layer a simple bottom-sheet on top of it for
 *   touch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MoreHorizontal, X } from "lucide-react";

export type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";

const LONG_PRESS_MS = 500;

interface LongPressMenuProps {
  /** Character the chip belongs to. */
  characterId: string;
  /** The character_primitives.instanceId to move/delete. */
  instanceId: string;
  /** Where the chip currently sits; greys out "Move to <this>". */
  currentSource: AccordionKind;
  /** Trigger element (the chip itself) — usually a <button> or <div>. */
  children: React.ReactNode;
  /** Fired after the move succeeds so the parent can refetch. */
  onChange?: () => void;
}

export function LongPressMenu({
  characterId,
  instanceId,
  currentSource,
  children,
  onChange,
}: LongPressMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    triggeredRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  }, [clearTimer]);

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  // Keyboard accessibility: Space or Enter on the trigger opens the
  // menu immediately (no long-press required for keyboard users).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
    },
    [],
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const handleAction = useCallback(
    async (
      action: "move" | "detach",
      target: AccordionKind | null,
    ) => {
      setPending(`${action}:${target ?? "null"}`);
      setError(null);
      try {
        if (action === "detach") {
          const res = await fetch(
            `/api/characters/${characterId}/primitives/${instanceId}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              payload.error ?? `Detach failed (${res.status}).`,
            );
          }
        } else {
          const res = await fetch(
            `/api/characters/${characterId}/primitives/${instanceId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to: target }),
            },
          );
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(payload.error ?? `Move failed (${res.status}).`);
          }
        }
        setOpen(false);
        onChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setPending(null);
      }
    },
    [characterId, instanceId, onChange],
  );

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative cursor-grab select-none active:cursor-grabbing"
      >
        {children}
        <button
          type="button"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((s) => !s);
          }}
          className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground focus:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Primitive actions"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                Move chip
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>
            <ul className="divide-y divide-border">
              {(
                ["LINEAGE", "UPBRINGING", "MANIFEST", "PERSONAL"] as const
              ).map((target) => (
                <li key={target}>
                  <button
                    type="button"
                    onClick={() => handleAction("move", target)}
                    disabled={
                      pending !== null ||
                      target === currentSource
                    }
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold text-foreground transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      Move to {target.toLowerCase()}
                      {target === currentSource && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          (current)
                        </span>
                      )}
                    </span>
                    {pending === `move:${target}` && (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => handleAction("detach", null)}
                  disabled={pending !== null}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Detach (remove from character)
                  {pending === "detach:null" && (
                    <Loader2 className="size-4 animate-spin text-rose-400" />
                  )}
                </button>
              </li>
            </ul>
            {error && (
              <p
                role="alert"
                className="border-t border-border bg-rose-500/10 px-5 py-3 text-xs text-rose-300"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
