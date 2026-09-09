"use client";

// =============================================================================
// CharacterSharePanel — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Client modal that lets the OWNER of a character invite collaborators
// (by username) and revoke existing shares. Mounted as a child of the
// character sheet's header; the sheet only renders this panel when
// viewerPermission === "OWNER".
//
// The panel renders:
//   - An invite row: username input + Can edit toggle + "Invite" button.
//     Posts to POST /api/characters/[id]/shares.
//   - The current shares list: rows with [username | canEdit badge |
//     revoke button]. DELETE on revoke.
//
// Why a modal not a slide-over: the action is short and the list is
// small (typically 0-3 collaborators). A centered card keeps the
// mobile UX clean.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Trash2, ShieldCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareRow {
  id: string;
  /** Display info about the shared-with user. Resolved server-side
   *  in /characters/[id]/page.tsx and passed down. */
  username: string;
  displayName: string | null;
  canEdit: boolean;
  /** When the share was created (ISO string). For "shared 3d ago" UI. */
  createdAt: string;
}

interface CharacterSharePanelProps {
  characterId: string;
  shares: ShareRow[];
  /** When set, the panel opens immediately on mount (used for
   *  deep-link ?share=1 flows). Otherwise closed by default. */
  initiallyOpen?: boolean;
}

export function CharacterSharePanel({
  characterId,
  shares: initialShares,
  initiallyOpen = false,
}: CharacterSharePanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [shares, setShares] = useState(initialShares);
  const [username, setUsername] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          canEdit,
        }),
      });
      const json = (await res.json()) as
        | { share: { id: string; canEdit: boolean } }
        | { error: string };
      if (!res.ok || "error" in json) {
        setError(
          "error" in json
            ? json.error
            : `Invite failed (${res.status}).`,
        );
        return;
      }
      // Optimistic update — append the new share row.
      setShares((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === json.share.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx]!,
            canEdit: json.share.canEdit,
          };
          return next;
        }
        return [
          ...prev,
          {
            id: json.share.id,
            username: username.trim(),
            displayName: null,
            canEdit: json.share.canEdit,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      setUsername("");
      setCanEdit(false);
      // Revalidate the server data so the next render is server-truth.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error.",
      );
    }
  }

  async function handleRevoke(shareId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/shares/${shareId}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as
        | { revoked: true; shareId: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        setError(
          "error" in json
            ? json.error
            : `Revoke failed (${res.status}).`,
        );
        return;
      }
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error.",
      );
    }
  }

  return (
    <>
      {/* Trigger button — owner-only, mounted by the sheet header. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card"
        title="Share with a DM or friend"
      >
        <UserPlus className="size-4" />
        Share
        {shares.length > 0 && (
          <span className="ml-1 rounded-full bg-secondary px-1.5 py-0 text-[10px] font-bold text-secondary-foreground">
            {shares.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-panel-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2
                id="share-panel-title"
                className="text-lg font-semibold"
              >
                Share this character
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-secondary"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite a DM or friend by username. Editors can propose
              primitive/capability/item changes for your review.
            </p>

            {/* Invite row */}
            <form
              onSubmit={handleInvite}
              className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                autoComplete="off"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={canEdit}
                  onChange={(e) => setCanEdit(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Can edit
              </label>
              <button
                type="submit"
                disabled={isPending || !username.trim()}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <UserPlus className="size-4" />
                Invite
              </button>
            </form>

            {error && (
              <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {error}
              </p>
            )}

            {/* Current shares */}
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Active shares ({shares.length})
              </h3>
              {shares.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No collaborators yet.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {shares.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          @{s.username}
                        </div>
                        {s.displayName && (
                          <div className="truncate text-xs text-muted-foreground">
                            {s.displayName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            s.canEdit
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {s.canEdit ? (
                            <>
                              <ShieldCheck className="size-3" />
                              Editor
                            </>
                          ) : (
                            <>
                              <Eye className="size-3" />
                              Viewer
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRevoke(s.id)}
                          className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                          aria-label={`Revoke share for @${s.username}`}
                          title="Revoke"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
