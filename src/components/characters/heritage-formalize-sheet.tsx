"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): heritage formalize sheet.
 *
 * Triggered from the LINEAGE / UPBRINGING / MANIFEST accordions'
 * "Formalize as heritage" button in BUILD mode. Confirms:
 *   - name (defaults to the kind name)
 *   - description (optional)
 *   - visibility (private by default; flip to public to share)
 *   - the count of primitives that will be bundled
 *
 * On submit, POSTs /api/characters/[id]/heritages/formalize which
 * creates a heritage row + heritage_primitives + sets the
 * character's lineage_id / upbringing_id / manifest_id.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST";

interface HeritageFormalizeSheetProps {
  characterId: string;
  kind: AccordionKind;
  open: boolean;
  onClose: () => void;
  onFormalized?: () => void;
}

export function HeritageFormalizeSheet({
  characterId,
  kind,
  open,
  onClose,
  onFormalized,
}: HeritageFormalizeSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [primitiveCount, setPrimitiveCount] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load the count of slotted primitives so the sheet can show
  // "Will bundle N primitives" before the user commits.
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setIsPublic(false);
      setPrimitiveCount(null);
      setError(null);
      return;
    }
    // Default the name to "<Kind>" — the API's computeUniqueForkName
    // handles collisions.
    setName(kind.toLowerCase());
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/characters/${characterId}/primitives?kind=${kind}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Failed to count primitives (${res.status}).`);
        }
        const data = (await res.json()) as {
          primitiveInstances?: Array<unknown>;
        };
        if (cancelled) return;
        const unique = new Set(
          (data.primitiveInstances ?? []).map(
            (row: unknown) =>
              (row as { primitiveId: number }).primitiveId,
          ),
        );
        setPrimitiveCount(unique.size);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load count.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, characterId, kind]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setError(null);
      setIsPending(true);
      try {
        const res = await fetch(
          `/api/characters/${characterId}/heritages/formalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind,
              name: name.trim(),
              description: description.trim() || undefined,
              isPublic,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Formalize failed (${res.status}).`,
          );
        }
        onFormalized?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to formalize.");
      } finally {
        setIsPending(false);
      }
    },
    [characterId, kind, name, description, isPublic, onFormalized],
  );

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Formalize ${kind.toLowerCase()} as heritage`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 overflow-hidden rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Formalize {kind.toLowerCase()} as heritage
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <p className="text-xs text-muted-foreground">
          This bundles every primitive currently slotted to the{" "}
          <span className="font-semibold text-foreground">
            {kind.toLowerCase()}
          </span>{" "}
          accordion into a real heritage row, and pins it to this
          character so it can be shared with others.
          {primitiveCount !== null && (
            <>
              {" "}
              Will bundle{" "}
              <span className="font-mono font-semibold text-foreground">
                {primitiveCount}
              </span>{" "}
              unique primitive{primitiveCount === 1 ? "" : "s"}.
            </>
          )}
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Heritage name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What this heritage bundle represents in your world."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="size-4 rounded border-border bg-background accent-primary"
          />
          <span className="text-foreground">
            Make this heritage public (shareable in the library)
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || primitiveCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:bg-primary/40"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            Formalize
          </button>
        </div>
      </form>
    </div>
  );
}
