"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ChevronRight,
  Edit,
  Heart,
  Package,
  Pencil,
  Save,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  X,
  Activity,
  Clock,
  Users,
  Flame,
  AlertTriangle,
  BookOpen,
  History,
  Check,
  Trash2,
  ChevronDown,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import { ToastViewport, useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import { OriginBadge } from "@/components/characters/origin-badge";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import { CapabilityCard } from "@/components/characters/capability-card";
import { ItemCard } from "@/components/characters/item-card";
import { DmBonusEditor } from "@/components/characters/dm-bonus-editor";
import { CharacterEditButton } from "@/components/characters/character-edit-button";
import { proficiencyBonus } from "@/lib/engine/practices";
import {
  BACKSTORY_FIELDS,
  isBackstoryEmpty,
  parseBackstory,
  sanitizeBackstory,
  type BackstoryFieldMeta,
  type BackstoryKey,
  type CharacterBackstory,
} from "@/lib/character/character-backstory";

// Re-use the same SlotSource type the badge component accepts.
type SlotSource = "OWNED" | "FORKED" | "PINNED";

/**
 * Character Sheet UI
 *
 * 6 tabs: Overview · Capabilities · Items · Backstory · Notes · History
 * Mobile: bottom tabs (horizontally scrollable). Desktop: top tabs.
 *
 * Phase 8.2 batch 3: Tab restructure per Mashu 2026-07-22.
 *   - Overview merges practices (compact attribute columns inline)
 *   - Backstory is a dedicated tab (read-only on sheet; modal edits)
 *   - History shows the character's event log (capability toggles,
 *     rests, vitality changes, level-ups, item equips)
 *   - Notes: inline edit always (no editMode gate, no modal)
 *   - Capabilities accordions are scheduled for batch 8.2.4
 *
 * Edit mode still gates the "character mechanics" panel (level,
 * attributes, BU, vitality). Notes no longer depends on it.
 */

type SheetPrimitiveLink = {
  primitiveId: number;
  source: string;
  acquiredAtLevel: number;
  isMirrored: boolean;
  // Phase 5 (T5.C.1): surface slot metadata for the badge UI.
  versionId: string | null;
  slotSource: SlotSource | null;
  latestVersionId: string | null;
  // Phase 8.1 batch 13.1: bundle-origin tracking. When a
  // primitive is brought in via a heritage → capability → effect
  // chain, these columns tell the sheet where it came from so we
  // can render "from Lineage 'Elf'" / "from capability 'Fireball'"
  // / "from effect 'Explosion'" breadcrumbs. Nullable: directly
  // slotted primitives have all nulls.
  originHeritageId: string | null;
  originCapabilityId: string | null;
  originEffectId: string | null;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
    isMirrorable: boolean;
    mirrorBuCredit: number;
    narrativeRule: string;
  };
};

type SheetCapabilityLink = {
  capabilityId: string;
  acquiredAtLevel: number;
  // Phase 5 (T5.C.1): surface slot metadata for the badge UI.
  versionId: string | null;
  slotSource: SlotSource | null;
  latestVersionId: string | null;
  // Phase 8.1 batch 13.1: capability origin (the heritage that
  // brought it in, if any). Direct slots have null.
  originHeritageId: string | null;
  capability: {
    id: string;
    name: string;
    type: string;
    sourceType: string;
    verboseDescription: string;
    tags?: string[];
  };
};

type SheetItemLink = {
  itemId: string;
  quantity: number;
  equipped: boolean;
  // Phase 5 (T5.C.1): surface slot metadata for the badge UI.
  versionId: string | null;
  slotSource: SlotSource | null;
  latestVersionId: string | null;
  item: {
    id: string;
    name: string;
    itemType: string;
    rarity: string;
    description: string;
    buCost: number;
    slotCost: number;
    isTwoHanded: boolean;
    isConsumable: boolean;
  };
};

type PracticeRow = {
  practice: string;
  attribute: string;
  total: number;
  slice: number;
  pbContribution: number;
  primitiveContributions: {
    primitiveId: number;
    primitiveName: string;
    bonus: number;
  }[];
};

type DefensiveDC = { attribute: string; dc: number };

export type CharacterSheetProps = {
  id: string;
  name: string;
  level: number;
  size: string;
  portraitUrl: string | null;
  notes: string | null;
  dmNotes: string | null;
  lineageName: string | null;
  lineageDescription: string | null;
  upbringingName: string | null;
  upbringingDescription: string | null;
  manifestName: string | null;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  startingBu: number;
  buSpent: number;
  dmBonusBu: number;
  currentVitality: number | null;
  enforceTemplateCaps: boolean;
  practices: PracticeRow[];
  defensiveDCs: DefensiveDC[];
  vitality: {
    max: number;
    current: number | null;
    percent: number | null;
  };
  encumbrance: {
    load: number;
    capacity: number;
    percentOfCapacity: number;
    encumbered: boolean;
    equipSlotsUsed: number;
    equipSlotsAvailable: number;
  };
  buBalance: {
    progressionSpent: number;
    progressionPool: number;
    progressionRemaining: number;
    progressionPercent: number;
    itemBuSpent: number;
    level: number;
    dmBonusBu: number;
    overBudget: boolean;
    warning?: string;
  };
  /**
   * Mirror-vector (negative BU) accounting. See BU Market canon,
   * Tier-Matched Volatility Ceiling table.
   */
  volatility: {
    rating: number;
    ceiling: number;
    levelBracket:
      | "L1-L4"
      | "L5-L8"
      | "L9-L12"
      | "L13-L16"
      | "L17-L20"
      | "L21-L24"
      | "L25-L28"
      | "L29+";
    remaining: number;
    exceeded: boolean;
    mirroredPrimitives: ReadonlyArray<{
      id: number;
      name: string;
      mirrorBuCredit: number;
      acquiredAtLevel: number;
    }>;
  };
  primitiveLinks: SheetPrimitiveLink[];
  capabilityLinks: SheetCapabilityLink[];
  itemLinks: SheetItemLink[];
  // Phase 8.1 batch 13.1: heritage slots (lineage/upbringing/manifest)
  // so the sheet can show "from Lineage 'Elf'" origin badges.
  heritageLinks: Array<{
    heritageId: string;
    acquiredAtLevel: number;
    isMirrored: boolean;
    heritage: {
      id: string;
      name: string;
      kind: string;
      description: string | null;
    };
  }>;
  // Phase 8.2 batch 3: freeform backstory. The DB column is
  // `backstory jsonb`; we forward the parsed shape so the tab
  // can render labels directly without re-parsing.
  backstory: CharacterBackstory;
  // Phase 8.2 batch 3: the character's event log. Ordered
  // newest-first by the page SC. ISO string for createdAt so
  // it serializes cleanly through the Server→Client boundary.
  logEntries: Array<{
    id: number;
    kind: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

type Tab = "overview" | "capabilities" | "items" | "backstory" | "notes" | "history";

const TABS: Array<{ id: Tab; label: string; icon: typeof Edit }> = [
  { id: "overview", label: "Overview", icon: Shield },
  { id: "capabilities", label: "Capabilities", icon: Swords },
  { id: "items", label: "Items", icon: Package },
  { id: "backstory", label: "Backstory", icon: BookOpen },
  { id: "notes", label: "Notes", icon: ScrollText },
  { id: "history", label: "History", icon: History },
];

export function CharacterSheetView(props: CharacterSheetProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [levelUpConfirm, setLevelUpConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();
  // Phase 8.2 batch 7: opening edit mode triggers the atelier's
  // character builder modal (pre-filled via openForEdit).
  // Phase 8.2 batch 7 rev 2: clicking Edit now navigates to /atelier
  // and lets the atelier client boot the modal from localStorage.

  const attrSum = props.attrPhysical + props.attrMental + props.attrMagical;
  const attrValid = attrSum === 10;

  // Phase 8.1 batch 13.1: lookup maps for resolving the origin chain
  // shown in OriginBadge. heritageById is built from props.heritageLinks
  // (now wired through the page); capabilityById and effectById are
  // built from the same data so the badge can show the full chain
  // (heritage → capability → effect).
  const heritageById = useMemo(() => {
    const m = new Map<string, { name: string; kind: string }>();
    for (const l of props.heritageLinks) {
      m.set(l.heritageId, { name: l.heritage.name, kind: l.heritage.kind });
    }
    return m;
  }, [props.heritageLinks]);
  const capabilityById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    for (const l of props.capabilityLinks) {
      m.set(l.capabilityId, { name: l.capability.name });
    }
    return m;
  }, [props.capabilityLinks]);
  const effectById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    // Effects aren't yet loaded into props; this map stays empty for
    // now. Future batches will populate it once effects are joined
    // onto capability links.
    return m;
  }, []);

  async function handleLevelUp() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/characters/${props.id}/level-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Level up failed.", "error");
          return;
        }
        showToast(
          `Leveled up to L${data.character?.level}. DM bonus consumed.`,
          "success",
        );
        // Refresh page data
        window.location.reload();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      } finally {
        setLevelUpConfirm(false);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 pb-24">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {props.portraitUrl ? (
            <img
              src={props.portraitUrl}
              alt={props.name}
              className="size-16 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-md border border-border bg-background text-2xl font-bold text-muted-foreground">
              {props.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Character Sheet
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{props.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono font-bold text-secondary-foreground">
                L{props.level}
              </span>
              <span>{props.size}</span>
              {props.lineageName && <span>· {props.lineageName}</span>}
              {props.manifestName && <span>· {props.manifestName}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 8.2 batch 7 rev 2: editing goes through the
              atelier's character builder modal, accessed by
              clicking this button → /atelier (with the edit id
              in localStorage). QuickEditPanel was removed per
              Mashu 2026-07-23. */}
          <CharacterEditButton
            characterId={props.id}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card"
            title="Open in the atelier for editing"
          />
          {props.level < 20 && (
            <button
              type="button"
              onClick={() => setLevelUpConfirm(true)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ArrowUp className="size-4" />
              Level Up
            </button>
          )}
          <Link
            href={`/characters/${props.id}/clone`}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card"
          >
            <Swords className="size-4" />
            Clone
          </Link>
        </div>
      </header>

      {/* BU bar — always visible */}
      <BuBar
        characterId={props.id}
        progressionSpent={props.buBalance.progressionSpent}
        progressionPool={props.buBalance.progressionPool}
        progressionPercent={props.buBalance.progressionPercent}
        overBudget={props.buBalance.overBudget}
        level={props.level}
        dmBonusBu={props.buBalance.dmBonusBu}
        itemBuSpent={props.buBalance.itemBuSpent}
        {...(props.buBalance.warning !== undefined
          ? { warning: props.buBalance.warning }
          : {})}
      />

      {/* Volatility panel — mirror-vector accounting (always visible) */}
      <VolatilityPanel
        rating={props.volatility.rating}
        ceiling={props.volatility.ceiling}
        levelBracket={props.volatility.levelBracket}
        remaining={props.volatility.remaining}
        exceeded={props.volatility.exceeded}
        mirroredPrimitives={props.volatility.mirroredPrimitives}
      />

      {/* Tabs — desktop: top, mobile: bottom sticky */}
      <nav
        className="mt-6 hidden border-b border-border md:flex md:gap-1"
        aria-label="Sheet tabs"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="mt-6">
        {tab === "overview" && (
          <OverviewTab props={props} />
        )}
        {tab === "capabilities" && (
          <CapabilitiesTab
            characterId={props.id}
            capabilities={props.capabilityLinks.map((l) => ({
              ...l.capability,
              acquiredAtLevel: l.acquiredAtLevel,
              // Phase 5 (T5.C.3): surface slot metadata to the tab.
              versionId: l.versionId,
              slotSource: l.slotSource,
              latestVersionId: l.latestVersionId,
              // Phase 8.1 batch 13.1: pass through origin for the badge.
              originHeritageId: l.originHeritageId,
              tags: l.capability.tags ?? [],
            }))}
            // Phase 8.1 batch 13.1: lookup maps for origin chain.
            heritageById={heritageById}
            capabilityById={capabilityById}
            effectById={effectById}
            // Phase 8.2 batch 3: pass all primitive links for the primitives accordion
            primitiveLinks={props.primitiveLinks.map((l) => ({
              primitiveId: l.primitiveId,
              source: l.source,
              acquiredAtLevel: l.acquiredAtLevel,
              isMirrored: l.isMirrored ?? false,
              versionId: l.versionId,
              slotSource: l.slotSource,
              latestVersionId: l.latestVersionId,
              originHeritageId: l.originHeritageId ?? null,
              originCapabilityId: l.originCapabilityId ?? null,
              originEffectId: l.originEffectId ?? null,
              primitive: {
                id: l.primitive.id,
                name: l.primitive.name,
                category: l.primitive.category,
                buCost: l.primitive.buCost,
                isMirrorable: l.primitive.isMirrorable,
                mirrorBuCredit: l.primitive.mirrorBuCredit,
                narrativeRule: l.primitive.narrativeRule ?? "",
              },
            }))}
          />
        )}
        {tab === "items" && (
          <ItemsTab
            characterId={props.id}
            items={props.itemLinks.map((l) => ({
              ...l.item,
              equipped: l.equipped,
              quantity: l.quantity,
              // Phase 5 (T5.C.3): surface slot metadata to the tab.
              versionId: l.versionId,
              slotSource: l.slotSource,
              latestVersionId: l.latestVersionId,
            }))}
            encumbrance={props.encumbrance}
          />
        )}
        {tab === "notes" && (
          <NotesTab
            id={props.id}
            initialNotes={props.notes ?? ""}
            showToast={showToast}
          />
        )}
        {tab === "backstory" && (
          <BackstoryTab
            id={props.id}
            initial={props.backstory}
            showToast={showToast}
          />
        )}
        {tab === "history" && (
          <HistoryTab logEntries={props.logEntries} />
        )}
      </div>

      {/* Mobile bottom tabs — Phase 8.2 batch 3: scrollable for 6 tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Sheet tabs (mobile)"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-w-[68px] shrink-0 flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors ${
                tab === t.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Level-up confirmation modal */}
      {levelUpConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLevelUpConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-md border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Level up to L{props.level + 1}?</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>+5 BU</strong> added to your progression pool (one level worth).
              </p>
              {props.dmBonusBu > 0 && (
                <p className="rounded-md bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                  <strong>DM bonus of {props.dmBonusBu} BU</strong> rolls into the
                  new progression pool (resets to 0).
                </p>
              )}
              <p className="text-muted-foreground">
                Proficiency Bonus becomes +{props.level + 1 <= 4 ? 2 : Math.floor((props.level + 1 - 1) / 4) + 2}{" "}
                if you haven't passed a tier threshold.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLevelUpConfirm(false)}
                disabled={isPending}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLevelUp}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <ArrowUp className="size-4" />
                {isPending ? "Leveling..." : `Level Up to L${props.level + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// =============================================================================
// BU Bar
// =============================================================================

function BuBar({
  characterId,
  progressionSpent,
  progressionPool,
  progressionPercent,
  overBudget,
  level,
  dmBonusBu,
  itemBuSpent,
  warning,
}: {
  characterId: string;
  progressionSpent: number;
  progressionPool: number;
  progressionPercent: number;
  overBudget: boolean;
  level: number;
  dmBonusBu: number;
  itemBuSpent: number;
  warning?: string;
}) {
  return (
    <div className="sticky top-0 z-20 mt-6 -mx-5 border-y border-border bg-background/85 px-5 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              BU Spent
            </span>
            <span
              className={`rounded-full px-3 py-1 font-mono text-base font-bold ${
                overBudget
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {progressionSpent}
              <span className="text-muted-foreground"> / {progressionPool}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Level
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 font-mono text-sm font-bold">
              {level}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              DM Bonus
            </span>
            {/* Phase 8.2 batch 5: inline editor — click the badge to
                edit. Replaces the previous read-only display. The
                editor handles its own optimistic state and posts to
                /api/characters/[id]/dm-bonus. */}
            <DmBonusEditor
              characterId={characterId}
              initialValue={dmBonusBu}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Item BU
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {itemBuSpent} <span className="text-muted-foreground text-xs">(separate)</span>
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${
            overBudget
              ? "bg-destructive"
              : progressionPercent > 90
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${Math.min(100, progressionPercent)}%` }}
        />
      </div>
      {warning && (
        <p className="mt-1.5 text-xs text-destructive">{warning}</p>
      )}
    </div>
  );
}

// =============================================================================
// Volatility Panel — mirror-vector accounting (BU Market canon)
// =============================================================================
// Shows the character's current volatility rating against the level-based
// ceiling. Surfaces the list of mirrored primitives so players know exactly
// where their negative BU comes from. Exceeded ceiling highlights red.
function VolatilityPanel({
  rating,
  ceiling,
  levelBracket,
  remaining,
  exceeded,
  mirroredPrimitives,
}: {
  rating: number;
  ceiling: number;
  levelBracket:
      | "L1-L4"
      | "L5-L8"
      | "L9-L12"
      | "L13-L16"
      | "L17-L20"
      | "L21-L24"
      | "L25-L28"
      | "L29+";
  remaining: number;
  exceeded: boolean;
  mirroredPrimitives: ReadonlyArray<{
    id: number;
    name: string;
    mirrorBuCredit: number;
    acquiredAtLevel: number;
  }>;
}) {
  const percent = ceiling > 0 ? Math.min(100, (rating / ceiling) * 100) : 0;
  const barColor = exceeded
    ? "bg-destructive"
    : percent > 80
      ? "bg-amber-500"
      : "bg-primary";

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Volatility
            </span>
            <span
              className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${
                exceeded
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
              title="Mirror-vector BU credits accumulated"
            >
              -{rating}
              <span className="text-muted-foreground"> / -{ceiling}</span>
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              exceeded
                ? "bg-destructive/15 text-destructive"
                : "bg-secondary text-secondary-foreground"
            }`}
            title="Level bracket — determines max negative BU"
          >
            L-bracket {levelBracket}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Remaining
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              -{remaining} BU
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {exceeded && (
        <p className="mt-2 text-xs font-medium text-destructive">
          ⚠ Volatility ceiling exceeded. The DM must remove mirror primitives
          or grant a respec before this character can be played.
        </p>
      )}
      {mirroredPrimitives.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {mirroredPrimitives.length} mirrored primitive
            {mirroredPrimitives.length === 1 ? "" : "s"} (click to expand)
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {mirroredPrimitives.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-border bg-background/40 px-2 py-1"
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-2 font-mono text-muted-foreground">
                  <span>-{p.mirrorBuCredit} BU</span>
                  <span className="text-[10px]">@L{p.acquiredAtLevel}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// =============================================================================
// Overview Tab
// =============================================================================
//
// Phase 8.2 batch 3 redesign per Mashu 2026-07-22:
//   - Vitality tracker sits at the top, full width, with action
//     buttons inline (no internal card grid splitting it from Defenses).
//   - Defenses moved to a small 3-cell row below vitality (saves
//     vertical space and avoids duplicating info already in Practices).
//   - Load + Equip slots collapsed into a single dense row.
//   - Identity strip below: 4 columns on md+, 2 on sm, 1 on xs.
//   - Practices merged in: three compact columns with attribute totals,
//     each practice row is a one-line pill with inline expansion.
//   - No bulky h3 icons; rely on a 3px top accent stripe per card to
//     identify the section at a glance.
//
// The Practices sub-component manages its own expanded-state, so the
// parent doesn't need to thread state through.

function OverviewTab({
  props,
}: {
  props: CharacterSheetProps;
}) {
  const attrSum = props.attrPhysical + props.attrMental + props.attrMagical;

  return (
    <div className="space-y-4">
      {/* ---- Identity strip (compact, full-width) ---- */}
      <section
        aria-label="Identity"
        className="relative overflow-hidden rounded-md border border-border bg-card"
      >
        <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <IdentityCell
            label="Lineage"
            value={props.lineageName ?? "—"}
            note={props.lineageDescription ?? null}
          />
          <IdentityCell
            label="Upbringing"
            value={props.upbringingName ?? "—"}
            note={props.upbringingDescription ?? null}
          />
          <IdentityCell label="Manifest" value={props.manifestName ?? "—"} />
          <IdentityCell
            label="Attributes"
            value={`${attrSum} / 10`}
            tone={attrSum === 10 ? "ok" : "bad"}
            note={attrSum === 10 ? "✓ valid" : `✗ off by ${attrSum - 10}`}
          />
        </div>
      </section>

      {/* ---- Vitality + Defenses (single dense band) ---- */}
      <section
        aria-label="Vitality and defenses"
        className="relative overflow-hidden rounded-md border border-border bg-card"
      >
        <span className="absolute inset-x-0 top-0 h-0.5 bg-rose-500" />
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-start md:gap-6">
          <VitalityTracker
            characterId={props.id}
            max={props.vitality.max}
            current={props.vitality.current ?? 0}
          />
          {/* Defensive DCs as a compact horizontal row (NOT a card) */}
          <div className="flex flex-row gap-2 md:flex-col md:gap-1 md:border-l md:border-border md:pl-6">
            <p className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
              Defenses
            </p>
            {props.defensiveDCs.map((d) => (
              <div
                key={d.attribute}
                className="flex items-baseline gap-2 rounded-md border border-border bg-background px-3 py-1.5 md:min-w-[110px]"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d.attribute.slice(0, 4)}
                </span>
                <span className="font-mono text-base font-bold tabular-nums">
                  {d.dc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Load + Equip slots + PB (one-row stat band) ---- */}
      <section
        aria-label="Load, equip slots, and proficiency bonus"
        className="relative overflow-hidden rounded-md border border-border bg-card"
      >
        <span className="absolute inset-x-0 top-0 h-0.5 bg-amber-500" />
        {/* Phase 8.2 batch 9: 3-cell band — Load / Equip / PB. PB is
            the level-derived proficiency bonus that scales attack
            rolls and proficient saves. Mashu 2026-07-23: "when
            rewriting the tabs in overview we need a card with
            proficiency bonus too to show it." */}
        <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-3">
          <StatCell
            label="Load"
            primary={`${props.encumbrance.load}`}
            secondary={`/ ${props.encumbrance.capacity}`}
            bar={{
              percent: Math.min(100, props.encumbrance.percentOfCapacity),
              tone:
                props.encumbrance.encumbered
                  ? "destructive"
                  : props.encumbrance.percentOfCapacity > 90
                    ? "warning"
                    : "ok",
            }}
            alert={
              props.encumbrance.encumbered ? "Encumbered!" : null
            }
          />
          <StatCell
            label="Equip Slots"
            primary={`${props.encumbrance.equipSlotsUsed}`}
            secondary={`/ ${props.encumbrance.equipSlotsAvailable}`}
          />
          <StatCell
            label={`PB (lvl ${props.level})`}
            primary={`+${proficiencyBonus(props.level)}`}
            secondary="proficiency"
          />
        </div>
      </section>

      {/* ---- Practices (compact three-column, merged from old PracticesTab) ---- */}
      <section
        aria-label="Practices"
        className="relative overflow-hidden rounded-md border border-border bg-card"
      >
        <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-500" />
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Practices</h3>
            {props.attrProficient && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                Proficient: {props.attrProficient}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Roll modifier = attribute slice + PB (if proficient) + primitive bonuses.
          </p>
        </div>
        <PracticesPanel
          practices={props.practices}
          attrProficient={props.attrProficient}
        />
      </section>

      {/* Phase 8.2 batch 7: QuickEditPanel removed per Mashu
          2026-07-23. Editting happens in the atelier's character
          builder modal, accessed via the header Edit button. */}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dense atomic cells used by OverviewTab
// -----------------------------------------------------------------------------

function IdentityCell({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string | null;
  tone?: "default" | "ok" | "bad";
}) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-medium ${
          tone === "ok"
            ? "text-green-600 dark:text-green-400"
            : tone === "bad"
              ? "text-destructive"
              : ""
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

function StatCell({
  label,
  primary,
  secondary,
  bar,
  alert,
}: {
  label: string;
  primary: string;
  secondary?: string;
  bar?: { percent: number; tone: "ok" | "warning" | "destructive" };
  alert?: string | null;
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {primary}
        {secondary && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {secondary}
          </span>
        )}
      </p>
      {bar && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              bar.tone === "destructive"
                ? "bg-destructive"
                : bar.tone === "warning"
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{ width: `${bar.percent}%` }}
          />
        </div>
      )}
      {alert && (
        <p className="mt-1 text-[11px] font-semibold text-destructive">
          {alert}
        </p>
      )}
    </div>
  );
}

function VitalityCard({
  max,
  current,
  percent,
}: {
  max: number;
  current: number | null;
  percent: number | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        Vitality
      </p>
      <p className="mt-1 font-mono text-2xl font-bold">
        {current ?? "—"}{" "}
        <span className="text-muted-foreground text-base">/ {max}</span>
      </p>
      {percent !== null && (
        <>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${
                percent < 25
                  ? "bg-destructive"
                  : percent < 50
                    ? "bg-amber-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{percent}%</p>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
      {description && (
        <dd className="mt-1 text-xs text-muted-foreground">{description}</dd>
      )}
    </div>
  );
}

function AttrSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono font-bold">
          {value >= 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range"
        min={-1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  allowNull,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowNull?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value) || 0;
          onChange(allowNull ? Math.max(0, n) : Math.max(0, n));
        }}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

// =============================================================================
// Practices Panel (compact, used inside OverviewTab)
// =============================================================================
//
// Phase 8.2 batch 3 redesign: instead of a separate Practices tab,
// this panel is embedded in Overview. Each attribute is a column;
// each practice is a one-line row that expands inline (no modal).
// Click a row to toggle the breakdown — same data the modal used
// to show, but right under the row it came from. Mobile-friendly
// because there's no extra navigation.

function PracticesPanel({
  practices,
  attrProficient,
}: {
  practices: PracticeRow[];
  attrProficient: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const byAttr: Record<string, PracticeRow[]> = {
    PHYSICAL: [],
    MENTAL: [],
    MAGICAL: [],
  };
  for (const p of practices) {
    byAttr[p.attribute]?.push(p);
  }

  // Sort practices within each attribute: highest modifier first so
  // the player's best skills are at the top of each column.
  const sortByTotal = (rows: PracticeRow[]) =>
    [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="grid divide-y divide-border border-t border-border md:grid-cols-3 md:divide-x md:divide-y-0">
      {(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attr) => {
        const rows = sortByTotal(byAttr[attr] ?? []);
        const proficient = attrProficient === attr;
        const bestTotal = rows[0]?.total ?? 0;
        return (
          <div key={attr} className="bg-card p-2">
            <div className="flex items-baseline justify-between px-2 pb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {attr}
                {proficient && (
                  <span
                    aria-label="Proficient"
                    title="Proficient — gains PB on all practices"
                    className="rounded bg-primary/15 px-1 text-[9px] font-bold text-primary"
                  >
                    PROF
                  </span>
                )}
              </span>
              <span className="font-mono text-xs font-bold text-muted-foreground tabular-nums">
                {rows.length > 0 ? `${bestTotal >= 0 ? "+" : ""}${bestTotal}` : "—"}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">
                No practices.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((p) => {
                  const isOpen = expanded === p.practice;
                  return (
                    <li key={p.practice}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isOpen ? null : p.practice)
                        }
                        aria-expanded={isOpen}
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
                          isOpen
                            ? "bg-primary/10"
                            : "hover:bg-secondary"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <ChevronRight
                            className={`size-3 text-muted-foreground transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                          <span className="capitalize">{p.practice}</span>
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums">
                          {p.total >= 0 ? "+" : ""}
                          {p.total}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-l-2 border-primary/40 bg-secondary/30 px-3 py-2 text-xs">
                          <BreakdownView practice={p} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BreakdownView({ practice }: { practice: PracticeRow }) {
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold capitalize">{practice.practice}</span>
        <span className="font-mono text-base font-bold tabular-nums">
          {practice.total >= 0 ? "+" : ""}
          {practice.total}
        </span>
      </div>
      <BreakdownRow label="Slice (attr)" value={practice.slice} />
      <BreakdownRow
        label="Proficiency"
        value={practice.pbContribution}
        subdued={practice.pbContribution === 0}
      />
      {practice.primitiveContributions.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-border/50 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Primitives
          </p>
          {practice.primitiveContributions.map((p) => (
            <BreakdownRow
              key={p.primitiveId}
              label={p.primitiveName}
              value={p.bonus}
            />
          ))}
        </div>
      )}
      {practice.primitiveContributions.length === 0 &&
        practice.pbContribution === 0 && (
          <p className="text-[10px] italic text-muted-foreground">
            Pure attribute slice.
          </p>
        )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  subdued,
}: {
  label: string;
  value: number;
  subdued?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        subdued ? "text-muted-foreground" : ""
      }`}
    >
      <span>{label}</span>
      <span className="font-mono font-bold">
        {value >= 0 ? "+" : ""}
        {value}
      </span>
    </div>
  );
}

// =============================================================================
// Capabilities Tab — restructured with accordions
// =============================================================================
//
// Two accordions:
// 1. "All Primitives" — every primitive the character has (direct + from
//    capabilities + from heritages), grouped by origin (Direct / Heritage /
//    Capability / Effect). Each row shows name, BU cost, mirror status, origin.
// 2. "Capabilities" — capabilities grouped by Style (A = Passive, B = Actionable,
//    C = Toggleable, B+C = Both). Each group is an accordion; inside, each
//    capability shows as a CapabilityCard (toggle + trigger).
// =============================================================================

function CapabilitiesTab({
  characterId,
  capabilities,
  primitiveLinks,
  heritageById,
  capabilityById,
  effectById,
}: {
  characterId: string;
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
    verboseDescription: string;
    acquiredAtLevel: number;
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
    originHeritageId: string | null;
    tags?: string[];
  }>;
  primitiveLinks: Array<{
    primitiveId: number;
    source: string;
    acquiredAtLevel: number;
    isMirrored: boolean;
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
    originHeritageId: string | null;
    originCapabilityId: string | null;
    originEffectId: string | null;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
      isMirrorable: boolean;
      mirrorBuCredit: number;
      narrativeRule: string;
    };
  }>;
  heritageById: Map<string, { name: string; kind: string }>;
  capabilityById: Map<string, { name: string }>;
  effectById: Map<string, { name: string }>;
}) {
  // Group primitives by their origin
  const primitivesByOrigin = new Map<
    string,
    Array<typeof primitiveLinks[0]>
  >();
  for (const p of primitiveLinks) {
    let originKey = "Direct";
    if (p.originHeritageId) {
      const h = heritageById.get(p.originHeritageId);
      originKey = h
        ? `Heritage: ${h.kind === "LINEAGE" ? "Lineage" : h.kind === "UPBRINGING" ? "Upbringing" : "Manifest"} — ${h.name}`
        : "Heritage (unknown)";
    } else if (p.originCapabilityId) {
      const c = capabilityById.get(p.originCapabilityId);
      originKey = c ? `Capability: ${c.name}` : "Capability (unknown)";
    } else if (p.originEffectId) {
      const e = effectById.get(p.originEffectId);
      originKey = e ? `Effect: ${e.name}` : "Effect (unknown)";
    }
    if (!primitivesByOrigin.has(originKey)) primitivesByOrigin.set(originKey, []);
    primitivesByOrigin.get(originKey)!.push(p);
  }

  // Helper: infer Style from capability tags (style-a, style-b, style-c)
  function getCapabilityStyle(c: typeof capabilities[0]): "A" | "B" | "C" | "A+B" | "A+C" | "B+C" | "A+B+C" {
    const tags = (c as any).tags as string[] | undefined;
    if (!tags) return "A"; // default
    const hasA = tags.includes("style-a") || tags.includes("style:A");
    const hasB = tags.includes("style-b") || tags.includes("style:B");
    const hasC = tags.includes("style-c") || tags.includes("style:C");
    if (hasA && hasB && hasC) return "A+B+C";
    if (hasA && hasB) return "A+B";
    if (hasA && hasC) return "A+C";
    if (hasB && hasC) return "B+C";
    if (hasA) return "A";
    if (hasB) return "B";
    if (hasC) return "C";
    return "A";
  }

  // Group capabilities by Style
  const capabilitiesByStyle = new Map<
    string,
    Array<typeof capabilities[0]>
  >();
  const styleOrder = ["A", "B", "C", "A+B", "A+C", "B+C", "A+B+C"];
  for (const c of capabilities) {
    const style = getCapabilityStyle(c);
    if (!capabilitiesByStyle.has(style)) capabilitiesByStyle.set(style, []);
    capabilitiesByStyle.get(style)!.push(c);
  }

  const styleLabels: Record<string, { label: string; description: string }> = {
    A: { label: "Style A — Passive", description: "Always-on bonuses. No interaction needed." },
    B: { label: "Style B — Actionable", description: "Trigger for one-shot effects (damage, heal, etc.)." },
    C: { label: "Style C — Toggleable", description: "On/Off toggle that gates passive modifiers." },
    "A+B": { label: "Style A+B — Passive + Actionable", description: "Passive bonuses + triggerable one-shot." },
    "A+C": { label: "Style A+C — Passive + Toggleable", description: "Passive bonuses gated by a toggle." },
    "B+C": { label: "Style B+C — Actionable + Toggleable", description: "Toggle gates a triggerable effect." },
    "A+B+C": { label: "Style A+B+C — All Three", description: "Passive, triggerable, and toggle-gated." },
  };

  if (primitiveLinks.length === 0 && capabilities.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Swords className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No capabilities or primitives yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant capabilities from the Library or assign them via Edit mode.
          Primitives appear here automatically when slotted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== Accordion 1: All Primitives ===== */}
      <details className="group rounded-md border border-border bg-card">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium cursor-pointer list-none">
          <span className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            All Primitives ({primitiveLinks.length})
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {primitiveLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No primitives slotted.</p>
          ) : (
            [...primitivesByOrigin.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([origin, primitives]) => (
                <div key={origin} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <FolderOpen className="size-3" />
                    {origin}
                    <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                      {primitives.length}
                    </span>
                  </div>
                  <ul className="ml-4 space-y-1 divide-y divide-border">
                    {primitives
                      .sort((a, b) => a.primitive.name.localeCompare(b.primitive.name))
                      .map((p) => (
                        <li
                          key={p.primitive.id}
                          className="py-1.5 flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium truncate">{p.primitive.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.primitive.category}
                            </span>
                            {p.isMirrored && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-medium">
                                <RotateCcw className="size-2.5" />
                                Mirrored (−{p.primitive.mirrorBuCredit} BU)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <span className="font-mono text-foreground">{p.primitive.buCost} BU</span>
                            {p.isMirrored && (
                              <span className="text-destructive">mirror: −{p.primitive.mirrorBuCredit} BU</span>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))
          )}
        </div>
      </details>

      {/* ===== Accordion 2: Capabilities by Style ===== */}
      {capabilities.length > 0 && (
        <details className="group rounded-md border border-border bg-card">
          <summary className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium cursor-pointer list-none">
            <span className="flex items-center gap-2">
              <Swords className="size-4 text-muted-foreground" />
              Capabilities ({capabilities.length})
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            {styleOrder
              .filter((s) => capabilitiesByStyle.has(s))
              .map((style) => {
                const caps = capabilitiesByStyle.get(style)!;
                const styleKey = style as keyof typeof styleLabels;
                const { label, description } = styleLabels[styleKey] ?? { label: style, description: "" };
                return (
                  <details key={style} className="group rounded-md border border-border bg-card/50">
                    <summary className="flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium cursor-pointer list-none">
                      <span className="flex items-center gap-2">
                        <FolderOpen className="size-4 text-muted-foreground" />
                        <span>{label}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                          {caps.length}
                        </span>
                      </span>
                      <p className="text-xs text-muted-foreground mr-4 flex-1 text-right hidden sm:block">
                        {description}
                      </p>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-3 pb-3 space-y-2 border-t border-border">
                      <p className="text-xs text-muted-foreground px-2">{description}</p>
                      <ul className="space-y-2">
                        {caps.map((c) => (
                          <li key={c.id}>
                            <CapabilityCard
                              characterId={characterId}
                              capability={{
                                ...c,
                                originChain: c.originHeritageId
                                  ? [{ kind: "heritage" as const, name: (() => {
                                      const h = heritageById.get(c.originHeritageId!);
                                      return h
                                        ? `${h.kind === "LINEAGE" ? "Lineage" : h.kind === "UPBRINGING" ? "Upbringing" : "Manifest"}: ${h.name}`
                                        : "Heritage (unknown)";
                                    })() }]
                                  : [],
                              }}
                            />
                        </li>
                      ))}
                    </ul>
                  </div>
                  </details>
                );
              })}
            </div>
          </details>
        )}
    </div>
  );
}

// =============================================================================
// Items Tab
// =============================================================================

function ItemsTab({
  characterId,
  items,
  encumbrance,
}: {
  characterId: string;
  items: Array<{
    id: string;
    name: string;
    itemType: string;
    rarity: string;
    description: string;
    buCost: number;
    slotCost: number;
    isTwoHanded: boolean;
    isConsumable: boolean;
    equipped: boolean;
    quantity: number;
    // Phase 5 (T5.C.3): slot metadata for the badge.
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
  }>;
  encumbrance: CharacterSheetProps["encumbrance"];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Package className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No items</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This character isn't carrying anything yet.
        </p>
      </div>
    );
  }
  const atCapacity =
    encumbrance.equipSlotsUsed >= encumbrance.equipSlotsAvailable;
  return (
    <div>
      <div className="mb-4 rounded-md border border-border bg-card p-3 text-xs">
        <span className="font-semibold uppercase text-muted-foreground">
          Load:{" "}
        </span>
        {encumbrance.load} / {encumbrance.capacity} ·{" "}
        <span className="font-semibold uppercase text-muted-foreground">
          Equip slots:{" "}
        </span>
        {encumbrance.equipSlotsUsed} / {encumbrance.equipSlotsAvailable}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.id}>
            {/* Phase 8.2 batch 4: each item is now an interactive
                card with an equip/unequip toggle. The card owns
                its own optimistic state and dispatches the API. */}
            <ItemCard
              characterId={characterId}
              item={i}
              atCapacity={atCapacity}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Notes Tab — inline edit always (Phase 8.2 batch 3)
// =============================================================================
//
// Per Mashu 2026-07-22 mid-batch: "in notes tab I need to be able to
// edit and save inline. The rest as established, but in notes I need
// to be able to edit those without going to modal."
//
// Notes is no longer gated by the global editMode toggle. Both
// the player-visible notes and DM notes are inline-editable
// always. Dirty state is tracked per-field; Save persists both
// fields together; debounced auto-save is a stretch goal.
//
// We track `lastSavedAt` so the user sees "Saved 2s ago" instead
// of guessing whether the click took effect.

function NotesTab({
  id,
  initialNotes,
  showToast,
}: {
  id: string;
  initialNotes: string;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const notesDirty = notes !== initialNotes;
  const dirty = notesDirty;

  // Reset baseline when props change (server refresh after a save).
  // The trick: only sync local state if the incoming initial* differs
  // from our local state by more than the user's pending edit, OR
  // the user has no pending edits and the server has fresh data.
  useEffect(() => {
    if (!dirty) {
      setNotes(initialNotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNotes]);

  async function save() {
    if (!dirty || isPending) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/characters/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Save failed.", "error");
          return;
        }
        // Update baselines so dirty → false
        // (the parent will eventually re-render with fresh props too).
        setLastSavedAt(new Date());
        showToast("Notes saved.", "success");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  function discard() {
    setNotes(initialNotes);
  }

  const savedLabel = lastSavedAt
    ? `Saved ${formatRelative(lastSavedAt)}`
    : dirty
      ? "Unsaved changes"
      : "Up to date";

  return (
    <div className="space-y-4">
      {/* ---- Player-visible notes (always editable) ---- */}
      <section
        aria-label="Character notes"
        className="relative overflow-hidden rounded-md border border-border bg-card"
      >
        <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
        <div className="p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Notes</h3>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Public · everyone can read
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Personality, backstory hooks, ties, voice…"
            className="mt-3 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{notes.length} chars</span>
            {notesDirty && (
              <span className="font-semibold text-amber-600">Unsaved</span>
            )}
          </div>
        </div>
      </section>

      {/* ---- Sticky save bar ---- */}
      <div
        className={`sticky bottom-20 z-20 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-2 backdrop-blur md:bottom-4 md:mx-0 md:rounded-md md:border md:px-4 md:shadow-sm ${
          dirty ? "border-amber-500/30" : ""
        }`}
      >
        <span
          className={`flex items-center gap-1.5 text-xs ${
            dirty
              ? "font-semibold text-amber-600"
              : "text-muted-foreground"
          }`}
        >
          {dirty ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <Check className="size-3.5 text-green-600" />
          )}
          {savedLabel}
        </span>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={discard}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-3" />
            {isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tiny relative-time formatter: avoids dragging in date-fns for one
// helper. Returns "now" / "Ns ago" / "Nm ago" / "Nh ago" / "Nd ago".
function formatRelative(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// =============================================================================
// Backstory Tab (Phase 8.2 batch 3)
// =============================================================================
//
// Four freeform fields held in characters.backstory jsonb
// (migration 0039): origin, motivation, ties, flaw. The sheet view
// is read-only with an "Edit in modal" button that opens the
// edit modal. Saves go through POST /api/characters/[id]/backstory.

function BackstoryTab({
  id,
  initial,
  showToast,
}: {
  id: string;
  initial: CharacterBackstory;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [data, setData] = useState<CharacterBackstory>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(updates: CharacterBackstory) {
    setSaving(true);
    try {
      const res = await fetch(`/api/characters/${id}/backstory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backstory: updates }),
      });
      const body = await res.json();
      if (!res.ok) {
        showToast(body.error ?? "Save failed.", "error");
        return;
      }
      const cleaned = sanitizeBackstory(parseBackstory(body.backstory));
      setData(cleaned);
      setModalOpen(false);
      showToast("Backstory saved.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Network error.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  const empty = isBackstoryEmpty(data);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-muted-foreground">
          Four freeform fields. Edit in the modal — saves back to the
          character's backstory column.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Pencil className="size-3" />
          {empty ? "Write backstory" : "Edit"}
        </button>
      </div>

      {empty ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No backstory yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add origin, motivation, ties, and flaw to bring the
            character to life.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {BACKSTORY_FIELDS.map((f) => (
            <BackstoryFieldCard
              key={f.key}
              label={f.label}
              description={f.description}
              iconKey={f.iconKey}
              value={data[f.key]}
            />
          ))}
        </div>
      )}

      <BackstoryEditModal
        open={modalOpen}
        initial={data}
        onClose={() => setModalOpen(false)}
        onSave={save}
        saving={saving}
      />
    </div>
  );
}

const BACKSTORY_ICON_BY_KEY: Record<
  BackstoryFieldMeta["iconKey"],
  typeof ScrollText
> = {
  scroll: ScrollText,
  flame: Flame,
  users: Users,
  alert: AlertTriangle,
} as const;

function BackstoryFieldCard({
  label,
  description,
  iconKey,
  value,
}: {
  label: string;
  description: string;
  iconKey: string;
  value: string;
}) {
  const Icon =
    BACKSTORY_ICON_BY_KEY[iconKey as keyof typeof BACKSTORY_ICON_BY_KEY] ??
    ScrollText;
  const empty = value.trim() === "";
  return (
    <section
      aria-label={label}
      className="relative overflow-hidden rounded-md border border-border bg-card"
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-violet-500" />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-violet-500" />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {description}
        </p>
        <div className="mt-2 text-sm leading-relaxed">
          {empty ? (
            <span className="text-muted-foreground italic">— empty —</span>
          ) : (
            <p className="whitespace-pre-wrap">{value}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function BackstoryEditModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: CharacterBackstory;
  onClose: () => void;
  onSave: (next: CharacterBackstory) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<CharacterBackstory>(initial);
  const [touched, setTouched] = useState(false);

  // Reset draft when modal opens.
  useEffect(() => {
    if (open) {
      setDraft(initial);
      setTouched(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const dirty =
    draft.origin !== initial.origin ||
    draft.motivation !== initial.motivation ||
    draft.ties !== initial.ties ||
    draft.flaw !== initial.flaw;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit backstory"
      onClick={() => !saving && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Edit Backstory</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {BACKSTORY_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{f.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {draft[f.key].length} / 4000
                </span>
              </div>
              <span className="block text-[11px] text-muted-foreground">
                {f.description}
              </span>
              <textarea
                value={draft[f.key]}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                  setTouched(true);
                }}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "No changes"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const cleaned = sanitizeBackstory(draft);
                onSave(cleaned);
              }}
              disabled={saving || (!dirty && touched)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// History Tab (Phase 8.2 batch 3)
// =============================================================================
//
// Renders the character's character_log as a chronological timeline
// newest-first. Pure presentation: the SC loads logEntries and
// passes them down. Event kinds:
//
//   - vitality_change: { delta, prev, next, source }
//   - rest: { restType, vitalityRestored }
//   - level_up: { prevLevel, newLevel, buAwarded, dmBonusAwarded }
//   - capability_trigger: { capabilityId, capabilityName }
//   - capability_toggle: { capabilityId, capabilityName, active }
//   - item_equip: { itemId, itemName }
//   - item_unequip: { itemId, itemName }
//
// We render each event with an icon, a verb, and the payload in
// human-readable form.

function HistoryTab({
  logEntries,
}: {
  logEntries: Array<{
    id: number;
    kind: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}) {
  const [filter, setFilter] = useState<string | null>(null);

  if (logEntries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
        <History className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No history yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Events appear here as you take damage, rest, level up, or
          use capabilities in play.
        </p>
      </div>
    );
  }

  const filterOptions = Array.from(new Set(logEntries.map((e) => e.kind)));
  const filtered = filter
    ? logEntries.filter((e) => e.kind === filter)
    : logEntries;

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label="All"
          count={logEntries.length}
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {filterOptions.map((k) => (
          <FilterChip
            key={k}
            label={k.replace(/_/g, " ")}
            count={logEntries.filter((e) => e.kind === k).length}
            active={filter === k}
            onClick={() => setFilter(k)}
          />
        ))}
      </div>

      {/* Timeline */}
      <ol className="relative space-y-1 border-l border-border pl-4">
        {filtered.map((entry) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[7px] top-2 size-3 rounded-full border-2 border-background bg-primary" />
            <HistoryEntry
              kind={entry.kind}
              payload={entry.payload}
              createdAt={entry.createdAt}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1 text-[10px] ${
          active
            ? "bg-primary-foreground/20"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function HistoryEntry({
  kind,
  payload,
  createdAt,
}: {
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}) {
  const summary = renderHistorySummary(kind, payload);
  const date = new Date(createdAt);
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          {summary.icon}
          <span className="text-sm font-medium">{summary.title}</span>
        </div>
        <time
          dateTime={createdAt}
          className="text-[10px] uppercase tracking-wide text-muted-foreground"
          title={date.toLocaleString()}
        >
          {formatRelative(date)} · {date.toLocaleDateString()}
        </time>
      </div>
      {summary.detail && (
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.detail}
        </p>
      )}
    </div>
  );
}

function renderHistorySummary(
  kind: string,
  payload: Record<string, unknown>,
): { icon: React.ReactNode; title: string; detail: string | null } {
  const num = (v: unknown) =>
    typeof v === "number" ? v.toString() : "—";
  const str = (v: unknown) =>
    typeof v === "string" ? v : "—";

  switch (kind) {
    case "vitality_change": {
      const delta = num(payload["delta"]);
      const prev = num(payload["prev"]);
      const next = num(payload["next"]);
      const source = str(payload["source"]);
      const dn = Number(payload["delta"]);
      const isDamage = Number.isFinite(dn) && dn < 0;
      return {
        icon: (
          <Heart
            className={`size-4 ${isDamage ? "text-destructive" : "text-green-500"}`}
          />
        ),
        title: isDamage
          ? `Took ${Math.abs(dn)} damage`
          : `Healed ${Math.abs(dn)} vitality`,
        detail: `${prev} → ${next} (source: ${source})`,
      };
    }
    case "rest": {
      const restType = str(payload["restType"]);
      const restored = num(payload["vitalityRestored"]);
      const isLong = restType === "long";
      return {
        icon: (
          <Activity
            className={`size-4 ${isLong ? "text-blue-500" : "text-cyan-500"}`}
          />
        ),
        title: isLong ? "Long rest" : "Short rest",
        detail: `Restored ${restored} vitality.`,
      };
    }
    case "level_up": {
      const prev = num(payload["prevLevel"]);
      const next = num(payload["newLevel"]);
      const bu = num(payload["buAwarded"]);
      const dm = num(payload["dmBonusAwarded"]);
      return {
        icon: <ArrowUp className="size-4 text-purple-500" />,
        title: `Leveled up: ${prev} → ${next}`,
        detail: `+${bu} BU awarded. DM bonus consumed: ${dm}.`,
      };
    }
    case "capability_trigger": {
      const name = str(payload["capabilityName"]);
      return {
        icon: <Sparkles className="size-4 text-amber-500" />,
        title: `Triggered "${name}"`,
        detail: null,
      };
    }
    case "capability_toggle": {
      const name = str(payload["capabilityName"]);
      const active = payload["active"] === true;
      return {
        icon: (
          <Swords
            className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`}
          />
        ),
        title: active
          ? `Activated "${name}"`
          : `Deactivated "${name}"`,
        detail: null,
      };
    }
    case "item_equip": {
      const name = str(payload["itemName"]);
      return {
        icon: <Package className="size-4 text-emerald-500" />,
        title: `Equipped "${name}"`,
        detail: null,
      };
    }
    case "item_unequip": {
      const name = str(payload["itemName"]);
      return {
        icon: (
          <Package className="size-4 text-muted-foreground" />
        ),
        title: `Unequipped "${name}"`,
        detail: null,
      };
    }
    case "dm_bonus_change": {
      const prev = Number(payload["prev"] ?? 0);
      const next = Number(payload["next"] ?? 0);
      const applied = Number(payload["applied"] ?? 0);
      const note = str(payload["note"]) || null;
      const direction = applied > 0 ? "granted" : applied < 0 ? "removed" : "set";
      const icon =
        applied > 0 ? (
          <Sparkles className="size-4 text-amber-500" />
        ) : applied < 0 ? (
          <Sparkles className="size-4 text-muted-foreground" />
        ) : (
          <Sparkles className="size-4 text-muted-foreground" />
        );
      return {
        icon,
        title:
          applied === 0
            ? `DM bonus BU ${note ? `(${note})` : "unchanged"}`
            : `DM bonus BU ${direction}: ${prev} → ${next} (${applied >= 0 ? "+" : ""}${applied})`,
        detail: null,
      };
    }
    default:
      return {
        icon: <Clock className="size-4 text-muted-foreground" />,
        title: kind,
        detail: JSON.stringify(payload),
      };
  }
}