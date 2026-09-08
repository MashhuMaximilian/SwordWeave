"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatEquationValue } from "@/lib/engine/equation-formatter";
import type { HardModifier } from "@/types/swordweave";
import type { EntityKey } from "@/lib/character/workspace/model";
import type { ConsequenceBehavior } from "@/lib/character/consequences/types";
export type ConsequencePackagePreview = {
  name: string;
  hash: string;
  currentVitality: number | null;
  previous: number;
  next: number;
  pieces: {
    title: string;
    description: string;
    behavior: ConsequenceBehavior;
    modifiers: HardModifier[];
  }[];
};
export function ConsequencePackageAction({
  characterId,
  entityKey,
  children,
  initialPreview,
  onClose,
}: {
  characterId: string;
  entityKey: EntityKey;
  children?: React.ReactNode;
  initialPreview?: ConsequencePackagePreview;
  onClose?: () => void;
}) {
  const [preview, setPreview] = useState<ConsequencePackagePreview | null>(
    initialPreview ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const applicationId = useRef<string | null>(
    initialPreview ? crypto.randomUUID() : null,
  );
  const router = useRouter();
  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/consequences/apply?key=${encodeURIComponent(entityKey)}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
      applicationId.current = crypto.randomUUID();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to preview.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/consequences/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: entityKey,
            commandId: applicationId.current,
            expectedHash: preview.hash,
            expectedVitality: preview.currentVitality,
            commit: true,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(null);
      onClose?.();
      router.refresh();
      window.dispatchEvent(new Event("focus"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Application failed. Retry this application.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {!initialPreview && (
        <button
          disabled={busy}
          className="rounded border border-primary px-3 py-2 text-sm text-primary"
          onClick={() => void load()}
        >
          {children ?? "Preview consequence package"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <div
          role="dialog"
          aria-label="Confirm action consequences"
          className="space-y-3 rounded border border-primary bg-card p-4"
        >
          <h3 className="font-semibold">{preview.name}</h3>
          <p>
            Vitality: {preview.previous} → {preview.next}
          </p>
          {preview.pieces.map((p, i) => (
            <div key={i} className="rounded border border-border p-3">
              <p className="font-medium">{p.title}</p>
              <p>{p.description}</p>
              {p.behavior.restrictions.map((r, j) => (
                <p key={j}>{r.reason || `Restricts ${r.kind}`}</p>
              ))}
              {p.behavior.recovery && <p>Recovery: {p.behavior.recovery}</p>}
              <ul className="space-y-1 text-sm">
                {p.modifiers.map((modifier, index) => (
                  <li key={index}>
                    {modifier.target} · {modifier.operation}{" "}
                    {formatEquationValue(modifier.value)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {p.modifiers.length} ongoing modifier
                {p.modifiers.length === 1 ? "" : "s"}
              </p>
            </div>
          ))}
          {!preview.pieces.length && (
            <p>No consequence package is authored for this action.</p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || !preview.pieces.length}
              className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              onClick={() => void commit()}
            >
              Commit action
            </button>
            <button
              disabled={busy}
              className="rounded border border-border px-3 py-2"
              onClick={() => {
                setPreview(null);
                onClose?.();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
