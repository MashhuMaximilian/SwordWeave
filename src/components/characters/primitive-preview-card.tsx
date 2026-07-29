"use client";

/**
 * Phase 8.3e (Mashu 2026-07-27): PrimitivePreviewCard
 *
 * Compact card for a primitive slotted on a character sheet.
 * Click anywhere on the card (not on a button) to open the
 * unified EntityPreview modal in read mode, populated via
 * `useEntityPreview`. No trigger/active buttons — primitives
 * are passive modifiers, not actions.
 *
 * Pattern mirrors CapabilityCard (src/components/characters/
 * capability-card.tsx) but is simpler:
 *   - No trigger button (no action semantics)
 *   - No active toggle (primitives apply unconditionally
 *     per their authored modifiers, modulo future condition
 *     evaluation)
 *   - Same click-to-preview affordance
 *
 * Phase 8.3d (Mashu 2026-07-27) commit 2 follow-up: when the
 * primitive has authored hard_modifiers with conditions, we
 * render each modifier's condition as a row of pill badges
 * beneath the name. The pills were previously rendered
 * inline in the AllPrimitivesAccordion; moving them into the
 * card keeps the layout consistent (card owns the row).
 */

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useToasts } from "@/components/ui/toast";
import { useEntityPreview } from "@/components/characters/preview-modal";
import { ConditionBadges } from "@/components/library/condition-badges";
import {
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
} from "@/components/library/library-item-preview";

export interface PrimitivePreviewCardProps {
  /** Phase 8.4 v6 (Mashu 2026-07-28): if this primitive is
   * inherited from a heritage (manifest/lineage/upbringing) and
   * NOT slotted directly, we render an "inherited" tag + the
   * source heritage name + kind. */
  readonly inheritedFrom?: string | null;
  readonly inheritedKind?: string | null;
  /** Phase 8.4 v11 (Mashu 2026-07-28): the full provenance
   * path "heritage → capability → effect" for primitives
   * that came in via a capability or capability → effect.
   * E.g. "Mystic → Aura Detective → Psychic Firewall".
   * Used in the subtitle line to match the character
   * creation modal's "via X > Y > Z" breadcrumb. */
  readonly provenancePath?: string | null;
  /** The primitive link data the sheet already has. We use this
   * to render immediately (no fetch needed) and as a fallback
   * if the detail fetch fails. */
  readonly primitiveLink: {
    readonly primitiveId: number;
    readonly source: string;
    readonly acquiredAtLevel: number;
    readonly isMirrored: boolean;
    readonly primitive: {
      readonly id: number;
      readonly name: string;
      readonly category: string;
      readonly buCost: number;
      readonly isMirrorable: boolean;
      readonly mirrorBuCredit: number;
      readonly narrativeRule: string;
      readonly hardModifiers: readonly unknown[];
    };
  };
}

export function PrimitivePreviewCard({
  primitiveLink,
  inheritedFrom = null,
  inheritedKind = null,
  provenancePath = null,
}: PrimitivePreviewCardProps) {
  const p = primitiveLink.primitive;
  const isMirrored = primitiveLink.isMirrored;
  const mirrorBuCredit = p.mirrorBuCredit;
  const { showToast } = useToasts();
  const { openPreview } = useEntityPreview();

  const [fetching, setFetching] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      // The preview is now bound ONLY to the name button,
      // so we don't need to check for nested buttons. The
      // Details toggle and the inherited/mirrored tags
      // don't bubble up here anymore.
      setFetching(true);
      try {
        const res = await fetch(`/api/primitives/${p.id}`);
        if (!res.ok) {
          throw new Error("Failed to load primitive preview");
        }
        const data = await res.json();
        const primitive = data.primitive as SandboxPrimitiveRow;
        const item: SandboxPreviewItem = {
          kind: "primitive",
          row: primitive,
        };
        openPreview({ item });
      } catch (err) {
        // Fallback: build a minimal preview from the data we
        // already have on the sheet. This won't have icon /
        // tags / etc, but at least the user gets a preview
        // modal with name + category + BU + narrative rule.
        const fallback: SandboxPrimitiveRow = {
          id: p.id,
          name: p.name,
          category: p.category,
          buCost: p.buCost,
          isPublic: false,
          costTier: "Tier 1: Minor (4 BU anchor)",
          mechanicalOutputText: "",
          narrativeRule: p.narrativeRule,
          isMirrorable: p.isMirrorable,
          mirrorVector: "STANDARD_ONLY",
          mirrorBuCredit: p.mirrorBuCredit,
          mirrorEligibilityNotes: "",
          sourceOrigin: null,
          tags: [],
          hardModifiers: p.hardModifiers,
          iconSource: null,
          iconKey: null,
          iconUrl: null,
          iconColor: "#ffffff",
        };
        openPreview({
          item: { kind: "primitive", row: fallback },
        });
        showToast(
          err instanceof Error
            ? `${err.message} — showing partial preview.`
            : "Preview load failed — showing partial preview.",
          "error",
        );
      } finally {
        setFetching(false);
      }
    },
    [p, openPreview, showToast],
  );

  // Keyboard accessibility: Enter / Space should also open the
  // preview, since the name is the click target.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick],
  );

  const modifiers = p.hardModifiers;
  const hasConditions =
    Array.isArray(modifiers) && modifiers.length > 0;

  const isInherited = Boolean(inheritedFrom) || Boolean(provenancePath);
  // The character-creation modal uses a yellow / amber
  // accent for the mirrored state. We mirror that here so
  // the UI is consistent between modal and sheet.
  const mirroredClasses = isMirrored
    ? "border-yellow-500/50 bg-yellow-500/10"
    : "";

  return (
    <div
      className={`flex flex-col gap-1 rounded border border-border bg-card/40 px-2 py-1.5 text-xs transition-colors hover:bg-card/80 ${mirroredClasses}`}
      data-testid="primitive-preview-card"
      data-primitive-id={p.id}
      data-primitive-name={p.name}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Only the NAME opens the preview modal. The
              inherited/mirrored tags + the Details toggle
              don't trigger the preview. */}
          <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="font-medium text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            {p.name}
          </button>
          {primitiveLink.isMirrored && (
            <span className="inline-flex items-center gap-0.5 rounded border border-yellow-500/50 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300">
              <RotateCcw className="size-2.5" />
              Mirrored
            </span>
          )}
          {isInherited && !primitiveLink.isMirrored && (
            <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              Inherited
            </span>
          )}
          {!isInherited && (
            <span className="inline-flex items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Direct
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="font-mono text-foreground">{p.buCost} BU</span>
        </div>
      </div>
      {/* Phase 8.4 v11 (Mashu 2026-07-28): subtitle line
          that shows the source path. Matches the
          character-creation modal's "8 BU · via X > Y > Z"
          breadcrumb. */}
      <p
        className="text-[10px] text-muted-foreground"
        data-testid="primitive-subtitle"
      >
        {isMirrored ? (
          <>
            <span className="font-medium text-yellow-700 dark:text-yellow-300">
              Direct primitive
            </span>
            {" · "}
            <span className="line-through">{p.buCost} BU</span>
            {" → "}
            <span className="font-mono text-yellow-700 dark:text-yellow-300">
              {mirrorBuCredit} BU debt
            </span>
          </>
        ) : isInherited ? (
          <>
            <span className="font-mono">{p.buCost} BU</span>
            {" · via "}
            <span>
              {provenancePath ??
                `${inheritedFrom}${inheritedKind ? ` (${inheritedKind.toLowerCase()})` : ""}`}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Direct primitive</span>
            {" · "}
            <span className="font-mono">{p.buCost} BU</span>
          </>
        )}
      </p>
      {fetching ? (
        <span className="text-[10px] text-muted-foreground">
          Loading preview…
        </span>
      ) : null}
      {/* Phase 8.3d follow-up: condition pills live inside the
          card so they stay attached to the row. Renders nothing
          when the primitive has no authored hard_modifiers. */}
      {hasConditions ? (
        <div
          className="ml-1 space-y-0.5"
          data-testid="primitive-conditions"
        >
          {modifiers.map((mod: unknown, modIndex: number) => {
            // Phase 8.4 v2 (Mashu 2026-07-28): pull the `.condition`
            // field off the HardModifier before passing it to
            // ConditionBadges. Previously we passed the whole
            // modifier — but ConditionBadges.parseCondition saw
            // `kind: "modify"` (the HardModifier's own kind, not
            // a condition kind) and threw "unknown condition kind:
            // modify", which crashed the entire Capabilities tab.
            // The .condition field is the actual condition blob
            // (legacy or v1) that parseCondition knows about.
            const cond = (mod as { condition?: unknown })?.condition;
            if (cond === undefined || cond === null) return null;
            return (
              <ConditionBadges
                key={modIndex}
                condition={cond}
                showNarrative={true}
              />
            );
          })}
        </div>
      ) : null}
      {/* Phase 8.4 v6 (Mashu 2026-07-28): expandable
          provenance + modifier + ops + conditions panel.
          Same pattern as the CapabilityCard's Effects
          toggle. The summary is small (10px) so it doesn't
          dominate the card. Mirroring is shown inline. */}
      <PrimitiveDetailToggle
        inheritedFrom={inheritedFrom}
        inheritedKind={inheritedKind}
        modifierList={Array.isArray(modifiers) ? modifiers : []}
        narrativeRule={p.narrativeRule}
        isMirrored={primitiveLink.isMirrored}
        mirrorBuCredit={p.mirrorBuCredit}
        buCost={p.buCost}
      />
    </div>
  );
}

/**
 * Phase 8.4 v6 (Mashu 2026-07-28): toggleable <details> for
 * the per-primitive provenance + modifier + ops + conditions.
 * Renders nothing if the primitive is featureless (no narrative
 * rule, no modifiers, no inherited-from tag).
 */
function PrimitiveDetailToggle({
  inheritedFrom,
  inheritedKind,
  modifierList,
  narrativeRule,
  isMirrored,
  mirrorBuCredit,
  buCost,
}: {
  readonly inheritedFrom: string | null;
  readonly inheritedKind: string | null;
  readonly modifierList: ReadonlyArray<unknown>;
  readonly narrativeRule: string;
  readonly isMirrored: boolean;
  readonly mirrorBuCredit: number;
  readonly buCost: number;
}) {
  const hasContent =
    Boolean(inheritedFrom) ||
    Boolean(narrativeRule) ||
    modifierList.length > 0;
  if (!hasContent) return null;

  return (
    <details
      className="mt-1 rounded border border-border bg-muted/30 px-2 py-1"
      data-testid="primitive-detail-toggle"
      onClick={(e) => e.stopPropagation()}
    >
      <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Details
      </summary>
      <div className="mt-1 space-y-1.5 text-[10px]">
        {/* Mirror toggle (only when the primitive is mirrorable
            and not currently mirrored — the modal has the
            "✓ Mirrored (-N BU debt) — click to unmirror" pill).
            Sheet is read-only, so just show the action hint. */}
        {isMirrored && (
          <div className="space-y-1">
            <p className="rounded border border-yellow-500/50 bg-yellow-500/10 px-2 py-1 font-medium text-yellow-700 dark:text-yellow-300">
              ✓ Mirrored (−{buCost - mirrorBuCredit || buCost} BU debt) —{" "}
              <span className="italic">
                toggle from the character editor to unmirror
              </span>
            </p>
            <p className="mb-0.5 font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
              Modifier (mirrored)
            </p>
            <ul className="space-y-0.5">
              {modifierList.map((mod, i) => {
                const m = mod as {
                  target?: string;
                  operation?: string;
                  value?: unknown;
                };
                const v = Number(m.value ?? 0);
                const flipped = v !== 0 ? -v : v;
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-1.5 font-mono"
                  >
                    <span className="rounded border border-border bg-background px-1.5 py-0.5 text-foreground">
                      {m.target ?? "?"}
                    </span>
                    <span className="rounded border border-yellow-500/50 bg-yellow-500/15 px-1.5 py-0.5 font-mono text-yellow-700 dark:text-yellow-300">
                      {m.operation ?? "modify"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {v >= 0 ? `+${v}` : `${v}`}
                    </span>
                    <span className="text-yellow-700/70 dark:text-yellow-300/70">
                      →
                    </span>
                    <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                      {flipped >= 0 ? `+${flipped}` : `${flipped}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* Mirror semantics tag — matches the modal's
                UNIQUE-BY-PRIMITIVE / STACK badges. */}
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded border border-yellow-500/50 bg-yellow-500/15 px-1.5 py-0.5 font-medium text-yellow-700 dark:text-yellow-300">
                Mirrored
              </span>
              <span className="italic">sign flipped (VARIABLE_VECTOR)</span>
            </p>
          </div>
        )}
        {/* Unmirrored modifiers — green tag + same UI */}
        {!isMirrored && modifierList.length > 0 && (
          <div className="space-y-1">
            <p className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">
              Modifier
            </p>
            <ul className="space-y-0.5">
              {modifierList.map((mod, i) => {
                const m = mod as {
                  target?: string;
                  operation?: string;
                  value?: unknown;
                };
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-1.5 font-mono"
                  >
                    <span className="rounded border border-border bg-background px-1.5 py-0.5 text-foreground">
                      {m.target ?? "?"}
                    </span>
                    <span className="rounded border border-emerald-500/50 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-700 dark:text-emerald-300">
                      {m.operation ?? "modify"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {String(m.value ?? "?")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {narrativeRule && (
          <p className="text-muted-foreground italic">{narrativeRule}</p>
        )}
      </div>
    </details>
  );
}

export type { SandboxPrimitiveRow };