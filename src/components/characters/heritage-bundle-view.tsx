"use client";

/**
 * HeritageBundleView — Phase 8.4 v8 (Mashu 2026-07-28)
 *
 * Renders one heritage's bundled view on the Capabilities tab's
 * "By Heritage" section. Shows the canon bundle from the sheet
 * (passed as props: canonCaps + canonPrims) but enriches each
 * capability with its effects + transitive primitives by
 * lazy-loading the full bundle from /api/heritage/[id].
 *
 * Why lazy-load?
 *
 * The character GET endpoint already returns the slim canon bundle
 * (heritage.capabilityLinks.capability = { id, name, type,
 * sourceType, verboseDescription }) and the slim primitive bundle
 * (heritage.primitiveLinks.primitive = full primitive row).
 * It deliberately does NOT include effectLinks or capability
 * primitiveLinks because depth-3+ Drizzle `with:` joins mis-scope
 * Postgres LATERAL (the API would error — see the
 * src/app/api/heritage/[id]/route.ts flat-attach workaround at
 * line 115-160).
 *
 * The modal's HeritageSlotCard / CapabilitySlotCard work around
 * this by calling /api/heritage/[id] from the client. We do the
 * same here so the By Heritage view matches the character-creation
 * modal's depth: every capability shows its nested effects AND
 * its bundled primitives.
 *
 * Each entity name (capability / effect / primitive) is a
 * preview button — click opens the entity preview modal so the
 * user can see tags, hardModifiers, narrative rule, etc.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEntityPreview } from "@/components/characters/preview-modal";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";

export interface HeritageBundleViewProps {
  heritageId: string;
  heritageName: string;
  heritageKindLabel: string;
  heritageDescription: string | null;
  isMirrored: boolean;
  /**
   * Slim canon bundle from the sheet's character response.
   * Used to render the header immediately while the full
   * bundle loads.
   */
  canonCaps: ReadonlyArray<{
    capabilityId: string;
    capability: {
      id: string;
      name: string;
      type: string;
      sourceType: string;
      verboseDescription: string;
    };
  }>;
  canonPrims: ReadonlyArray<{
    primitiveId: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
      isMirrorable: boolean;
      mirrorBuCredit: number;
      narrativeRule: string | null;
      hardModifiers: unknown[];
    };
  }>;
  /**
   * Set of capabilityIds that are CURRENTLY slotted on the
   * character (originHeritageId === this heritageId). Used to
   * show "✓ slotted" chips.
   */
  slottedCapIds: ReadonlySet<string>;
  /**
   * Set of primitiveIds currently slotted on the character
   * (originHeritageId === this heritageId).
   */
  slottedPrimIds: ReadonlySet<number>;
  /**
   * Phase 8.3g (Mashu 2026-07-28): hide the "BUNDLED PRIMITIVES"
   * section that renders `canonPrims` inline inside the
   * heritage view. The on-sheet Capabilities tab already has
   * a single Primitives accordion that lists every slotted
   * primitive (with provenance) — so showing them again
   * inside each heritage's card is redundant. Defaults to
   * false. The character-modal builder passes `true`.
   */
  showPrimitives?: boolean;
}

interface FullHeritageBundle {
  id: string;
  name: string;
  description: string | null;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: {
      id: string;
      name: string;
      type: string;
      sourceType: string;
      verboseDescription: string;
      primitiveLinks?: Array<{
        primitiveId: number;
        quantity: number;
        primitive: { id: number; name: string; buCost: number | null };
      }>;
      effectLinks?: Array<{
        effectId: string;
        effect: { id: string; name: string; description: string | null };
        primitiveLinks?: Array<{
          primitiveId: number;
          quantity: number;
          primitive: { id: number; name: string; buCost: number | null };
        }>;
      }>;
    };
  }>;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  }>;
}

export function HeritageBundleView({
  heritageId,
  heritageName,
  heritageKindLabel,
  heritageDescription,
  isMirrored,
  canonCaps,
  canonPrims,
  slottedCapIds,
  slottedPrimIds,
  /**
   * Phase 8.3g (Mashu 2026-07-28): hide the "BUNDLED PRIMITIVES"
   * section. Per the PDF Q8: "We don't show primitives in
   * capabilities or effects, only in primitives accordion."
   * The Primitives accordion at the top of the Capabilities
   * tab already shows every slotted primitive. Defaults to
   * `false` (hide) so the on-sheet accordion doesn't duplicate.
   * The character-modal builder passes `true` because that
   * modal has no separate Primitives section.
   */
  showPrimitives = false,
}: HeritageBundleViewProps) {
  const [bundle, setBundle] = useState<FullHeritageBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openPreview } = useEntityPreview();

  /**
   * Phase 8.4 v9 (Mashu 2026-07-28): lazy-load the full
   * heritage template so its preview modal gets every field
   * TemplateBody needs. Mashu 2026-07-28: "for heritages and
   * stuff it doesn't do nothing."
   */
  const openHeritagePreview = useCallback(async () => {
    if (!bundle) {
      try {
        const res = await fetch(`/api/heritage/${heritageId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { template?: FullHeritageBundle };
        if (!data.template) return;
        const t = data.template;
        const item: SandboxPreviewItem = {
          kind: "heritage",
          row: t as never,
        };
        openPreview({ item });
      } catch {
        /* swallow */
      }
      return;
    }
    const item: SandboxPreviewItem = {
      kind: "heritage",
      row: bundle as never,
    };
    openPreview({ item });
  }, [bundle, heritageId, openPreview]);

  /**
   * Phase 8.4 v9 (Mashu 2026-07-28): capability preview inside
   * the heritage view must fetch the FULL capability from
   * /api/capabilities/[id] — the slim canon-bundle data we
   * already have is missing effectLinks.primitiveLinks and
   * other nested fields that CapabilityBody accesses.
   * Mashu 2026-07-28: "it even crashes if I click on a
   * capability but for primitives works."
   */
  const openCapabilityPreviewById = useCallback(
    async (capabilityId: string) => {
      try {
        const res = await fetch(`/api/capabilities/${capabilityId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { capability?: Record<string, unknown> };
        if (!data.capability) return;
        const raw = data.capability;
        const projected = {
          id: raw["id"] as string,
          name: raw["name"] as string,
          type: raw["type"] as string,
          sourceType: raw["sourceType"] as string,
          verboseDescription: (raw["verboseDescription"] as string) ?? "",
          sourceOrigin: (raw["sourceOrigin"] as string | null) ?? null,
          tags: (raw["tags"] as string[]) ?? [],
          isPublic: (raw["isPublic"] as boolean) ?? true,
          primitiveLinks: ((raw["primitiveLinks"] as Array<Record<string, unknown>>) ?? []).map((pl) => ({
            primitiveId: pl["primitiveId"] as number,
            role: (pl["role"] as string) ?? "OTHER",
            quantity: (pl["quantity"] as number) ?? 1,
            sortOrder: (pl["sortOrder"] as number) ?? 0,
            slotLabel: (pl["slotLabel"] as string | null) ?? null,
            notes: (pl["notes"] as string | null) ?? null,
            versionNumber: null as number | null,
            primitive: pl["primitive"] as {
              id: number;
              name: string;
              category: string;
              buCost: number;
            },
          })),
          effectLinks: ((raw["effectLinks"] as Array<Record<string, unknown>>) ?? []).map((el) => ({
            effectId: el["effectId"] as string,
            sortOrder: (el["sortOrder"] as number) ?? 0,
            slotLabel: (el["slotLabel"] as string | null) ?? null,
            notes: (el["notes"] as string | null) ?? null,
            versionNumber: null as number | null,
            effect: el["effect"] as {
              id: string;
              name: string;
              narrativeDescription: string | null;
              sourceOrigin: string | null;
              primitiveLinks?: Array<{
                primitiveId: number;
                quantity: number;
                primitive: { id: number; name: string; category: string; buCost: number };
              }>;
            },
          })),
          iconSource: (raw["iconSource"] as string | null) ?? null,
          iconKey: (raw["iconKey"] as string | null) ?? null,
          iconUrl: (raw["iconUrl"] as string | null) ?? null,
          iconColor: (raw["iconColor"] as string) ?? "#ffffff",
        };
        const item: SandboxPreviewItem = {
          kind: "capability",
          row: projected as never,
        };
        openPreview({ item });
      } catch {
        /* swallow */
      }
    },
    [openPreview],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/heritage/${heritageId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { template?: FullHeritageBundle };
        if (cancelled) return;
        setBundle(data.template ?? null);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load bundle.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [heritageId]);

  // Merge: prefer the full bundle's capability rows (which carry
  // effectLinks + primitiveLinks) over the slim canonCaps entries.
  // If the bundle hasn't loaded yet, fall back to canonCaps.
  type CapRow = HeritageBundleViewProps["canonCaps"][number] & {
    capability: FullHeritageBundle["capabilityLinks"][number]["capability"];
  };
  const fullCaps: ReadonlyArray<CapRow> = (() => {
    if (!bundle) {
      return canonCaps.map(
        (c) => ({ ...c, capability: c.capability }) as CapRow,
      );
    }
    return bundle.capabilityLinks.map(
      (bcl) =>
        ({
          capabilityId: bcl.capabilityId,
          capability: bcl.capability,
        }) as CapRow,
    );
  })();

  const total = fullCaps.length + canonPrims.length;

  return (
    <div className="rounded-md border border-border bg-card/50 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm font-medium border-b border-border">
        <button
          type="button"
          onClick={() => {
            void openHeritagePreview();
          }}
          className="font-semibold text-left hover:underline"
        >
          {heritageName}
        </button>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
          {heritageKindLabel}
        </span>
        {isMirrored && (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            Mirrored
          </span>
        )}
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
          {total} bundled
        </span>
        {loading && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {heritageDescription && (
        <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
          {heritageDescription}
        </p>
      )}
      {error && (
        <p className="px-3 py-2 text-xs text-destructive border-b border-border">
          {error}
        </p>
      )}
      <div className="px-3 py-2 space-y-3">
        {/* BUNDLED CAPABILITIES — full nested rendering */}
        {fullCaps.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Capabilities ({fullCaps.length})
            </div>
            <ul className="space-y-2">
              {fullCaps.map((cl) => {
                const slotted = slottedCapIds.has(cl.capabilityId);
                const cap = cl.capability;
                const nestedPrims = cap.primitiveLinks ?? [];
                const nestedEffects = cap.effectLinks ?? [];
                return (
                  <li
                    key={cl.capabilityId}
                    className="rounded border border-border bg-card/40 p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void openCapabilityPreviewById(cl.capabilityId);
                      }}
                      className="flex w-full items-center justify-between gap-2 text-left hover:opacity-80"
                    >
                      <span className="font-medium">{cap.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {slotted ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                            ✓ slotted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            template
                          </span>
                        )}
                      </span>
                    </button>
                    {cap.verboseDescription && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                        {cap.verboseDescription}
                      </p>
                    )}
                    {/* Effects nested under the capability */}
                    {nestedEffects.length > 0 && (
                      <details open className="mt-2 group/effects">
                        <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground list-none">
                          <ChevronDown className="size-3 transition-transform group-open/effects:rotate-180" />
                          Effects ({nestedEffects.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1.5 pl-2 border-l-2 border-border">
                          {nestedEffects.map((el) => {
                            const effPrims = el.primitiveLinks ?? [];
                            return (
                              <li
                                key={el.effectId}
                                className="rounded bg-muted/30 px-2 py-1.5"
                              >
                                <div className="font-medium text-foreground">
                                  {el.effect.name}
                                </div>
                                {el.effect.description && (
                                  <p className="mt-0.5 text-[11px] text-muted-foreground italic">
                                    {el.effect.description}
                                  </p>
                                )}
                                {effPrims.length > 0 && (
                                  <ul className="mt-1 space-y-0.5 pl-2 border-l border-border">
                                    {effPrims.map((pl) => (
                                      <li
                                        key={pl.primitiveId}
                                        className="flex items-center justify-between text-[11px]"
                                      >
                                        <span className="font-mono text-foreground">
                                          {pl.quantity > 1
                                            ? `${pl.quantity}× ${pl.primitive.name}`
                                            : pl.primitive.name}
                                        </span>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          {pl.primitive.buCost ?? "?"} BU
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                    {/* Direct capability primitives */}
                    {nestedPrims.length > 0 && (
                      <details
                        open
                        className="mt-2 group/prims"
                      >
                        <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground list-none">
                          <ChevronDown className="size-3 transition-transform group-open/prims:rotate-180" />
                          Primitives ({nestedPrims.length})
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-2 border-l border-border">
                          {nestedPrims.map((pl) => (
                            <li
                              key={pl.primitiveId}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="font-mono text-foreground">
                                {pl.quantity > 1
                                  ? `${pl.quantity}× ${pl.primitive.name}`
                                  : pl.primitive.name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {pl.primitive.buCost ?? "?"} BU
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* BUNDLED PRIMITIVES — direct heritage primitives.
            Phase 8.3g (Mashu 2026-07-28): hidden by default
            (`showPrimitives={false}`). Per the PDF Q8:
            "We don't show primitives in capabilities or
            effects, only in primitives accordion." The
            Primitives accordion at the top of the
            Capabilities tab shows every slotted primitive
            with provenance. The character-modal builder
            passes `showPrimitives={true}` because that
            modal has no separate Primitives section. */}
        {showPrimitives && canonPrims.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Primitives ({canonPrims.length})
            </div>
            <ul className="space-y-1.5">
              {[...canonPrims]
                .sort((a, b) => a.primitive.name.localeCompare(b.primitive.name))
                .map((pl: HeritageBundleViewProps["canonPrims"][number]) => {
                  const slotted = slottedPrimIds.has(pl.primitiveId);
                  return (
                    <li
                      key={pl.primitive.id}
                      className="rounded border border-border bg-card/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium">{pl.primitive.name}</span>
                          {slotted ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                              ✓ slotted
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              template
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-foreground shrink-0">
                          {pl.primitive.buCost} BU
                        </span>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {fullCaps.length === 0 && canonPrims.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground italic">
            No bundle on this heritage.
          </p>
        )}
      </div>
    </div>
  );
}