"use client";

/**
 * Phase 9.3 (Mashu 2026-09-06): heritage formalize sheet, REWRITTEN
 * to embed atelier's <HeritageForm>.
 *
 * Previous version had a bespoke 4-field form (name, description,
 * isPublic). Mashu asked for the same UI as /atelier. The lifter
 * <EmbeddedHeritageForm> wraps the atelier form in a sheet and
 * auto-attaches the new heritage to the character via
 * POST /api/characters/[id]/heritages/formalize after save.
 *
 * Sheet still:
 *   - Lazy-loads the count of slotted primitives so the header
 *     shows "Will bundle N unique primitives" before the user
 *     opens the form.
 *   - Lazily loads the character_capabilities rows so the
 *     user can re-bundle existing caps into the heritage.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  EmbeddedHeritageForm,
  type TemplateSlot,
} from "@/components/characters/workspace/embedded-atelier-forms";

export type AccordionKind = "LINEAGE" | "UPBRINGING" | "MANIFEST";

export interface HeritageFormalizeSheetProps {
  characterId: string;
  kind: AccordionKind;
  open: boolean;
  onClose: () => void;
  onFormalized?: (info: { heritageId: string; heritageName: string }) => void;
}

export function HeritageFormalizeSheet({
  characterId,
  kind,
  open,
  onClose,
  onFormalized,
}: HeritageFormalizeSheetProps) {
  const [primitives, setPrimitives] = useState<TemplateSlot[]>([]);
  const [capabilities, setCapabilities] = useState<TemplateSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load accordion + capability data when the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [primRes, capRes] = await Promise.all([
          fetch(
            `/api/characters/${characterId}/primitives?kind=${kind}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/characters/${characterId}/capabilities?kind=${kind}`,
            { cache: "no-store" },
          ),
        ]);
        if (cancelled) return;
        if (!primRes.ok) {
          throw new Error(`primitives fetch failed (${primRes.status}).`);
        }
        const primData = (await primRes.json()) as {
          primitiveInstances?: Array<{
            primitiveId: number;
            primitive: {
              id: number;
              name: string;
              category: string;
              buCost: number;
            };
          }>;
        };
        // De-dupe by primitiveId — multiple instances of the same
        // primitive get bundled as one slot.
        const seen = new Set<number>();
        const out: TemplateSlot[] = [];
        for (const row of primData.primitiveInstances ?? []) {
          if (seen.has(row.primitiveId)) continue;
          seen.add(row.primitiveId);
          out.push({
            id: row.primitiveId,
            name: row.primitive.name,
            category: row.primitive.category,
            buCost: row.primitive.buCost,
          });
        }
        setPrimitives(out);

        if (capRes.ok) {
          const capData = (await capRes.json()) as {
            capabilities?: Array<{
              capabilityId: string;
              capability: {
                id: string;
                name: string;
                type: string;
              };
            }>;
          };
          setCapabilities(
            (capData.capabilities ?? []).map((c) => ({
              id: c.capabilityId,
              name: c.capability.name,
              category: c.capability.type,
              buCost: 0,
            })),
          );
        } else {
          setCapabilities([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load accordion data.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, characterId, kind]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Formalize ${kind.toLowerCase()} as heritage`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Formalize {kind.toLowerCase()} as heritage
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {loading
                ? "Loading accordion…"
                : `Will bundle ${primitives.length} primitive${primitives.length === 1 ? "" : "s"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading accordion contents…
            </div>
          )}
          {!loading && (
            <EmbeddedHeritageForm
              characterId={characterId}
              kind={kind}
              primitives={primitives}
              capabilities={capabilities}
              onFormalized={(info) => {
                onFormalized?.(info);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
