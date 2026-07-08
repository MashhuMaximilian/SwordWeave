"use client";

/**
 * RestoreButton — P5R-5: client component that POSTs to
 * `/api/versions/restore` and shows the result. Shown on every version
 * row in the version history page. Disabled for the latest version (you
 * can't restore the version that's already current).
 *
 * The endpoint is unified across all 5 entity types. We pass the
 * canonical targetType from the version history page; the API figures
 * out which table to write to.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2 } from "lucide-react";

interface RestoreButtonProps {
  targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE";
  targetId: string;
  versionNumber: number;
  isLatest: boolean;
}

export function RestoreButton({
  targetType,
  targetId,
  versionNumber,
  isLatest,
}: RestoreButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLatest) return null;

  async function handleRestore() {
    if (
      !window.confirm(
        `Restore ${targetType} ${targetId} to v${versionNumber}? The current state will be saved as a new version; the older content is reapplied.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/versions/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: targetType, id: targetId, versionNumber }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        newVersionNumber?: number;
        warnings?: string[];
        error?: string;
      };
      if (!res.ok || !json.success) {
        setError(json.error ?? `HTTP ${res.status}`);
        setPending(false);
        return;
      }
      // Refresh the page so the new version appears in the history.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleRestore}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        title={`Restore ${targetType} to v${versionNumber}`}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <History className="size-3" />
        )}
        Restore
      </button>
      {error && (
        <span className="text-xs text-red-500" title={error}>
          Error
        </span>
      )}
    </span>
  );
}
