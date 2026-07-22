"use client";

import { useMemo, useState, useTransition } from "react";
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
} from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import { ToastViewport, useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import { OriginBadge } from "@/components/characters/origin-badge";

// Re-use the same SlotSource type the badge component accepts.
type SlotSource = "OWNED" | "FORKED" | "PINNED";

/**
 * Character Sheet UI
 *
 * 5 tabs: Overview · Practices · Capabilities · Items · Notes
 * Mobile: bottom tabs. Desktop: top tabs.
 *
 * Sticky BU bar always visible: spent/remaining + level + total + separate item BU.
 *
 * Edit mode toggles inline fields (level, attributes, BU, items, notes).
 * Level-up button in header with confirm dialog (resets DM bonus).
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
  initialEditMode: boolean;
};

type Tab = "overview" | "practices" | "capabilities" | "items" | "notes";

const TABS: Array<{ id: Tab; label: string; icon: typeof Edit }> = [
  { id: "overview", label: "Overview", icon: Shield },
  { id: "practices", label: "Practices", icon: Sparkles },
  { id: "capabilities", label: "Capabilities", icon: Swords },
  { id: "items", label: "Items", icon: Package },
  { id: "notes", label: "Notes", icon: ScrollText },
];

export function CharacterSheetView(props: CharacterSheetProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editMode, setEditMode] = useState(props.initialEditMode);
  const [levelUpConfirm, setLevelUpConfirm] = useState(false);
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

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
          {editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card"
            >
              <X className="size-4" />
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-card"
              >
                <Pencil className="size-4" />
                Edit
              </button>
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
            </>
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
          <OverviewTab props={props} editMode={editMode} onSaved={() => window.location.reload()} showToast={showToast} />
        )}
        {tab === "practices" && (
          <PracticesTab
            practices={props.practices}
            defensiveDCs={props.defensiveDCs}
            attrProficient={props.attrProficient}
            expandedPractice={expandedPractice}
            setExpandedPractice={setExpandedPractice}
          />
        )}
        {tab === "capabilities" && (
          <CapabilitiesTab
            capabilities={props.capabilityLinks.map((l) => ({
              ...l.capability,
              acquiredAtLevel: l.acquiredAtLevel,
              // Phase 5 (T5.C.3): surface slot metadata to the tab.
              versionId: l.versionId,
              slotSource: l.slotSource,
              latestVersionId: l.latestVersionId,
              // Phase 8.1 batch 13.1: pass through origin for the badge.
              originHeritageId: l.originHeritageId,
            }))}
            // Phase 8.1 batch 13.1: lookup maps for origin chain.
            heritageById={heritageById}
            capabilityById={capabilityById}
            effectById={effectById}
          />
        )}
        {tab === "items" && (
          <ItemsTab
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
            initialDmNotes={props.dmNotes ?? ""}
            editMode={editMode}
            showToast={showToast}
          />
        )}
      </div>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Sheet tabs (mobile)"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 py-2 text-xs ${
                tab === t.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-5" />
              {t.label}
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
  progressionSpent,
  progressionPool,
  progressionPercent,
  overBudget,
  level,
  dmBonusBu,
  itemBuSpent,
  warning,
}: {
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
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {dmBonusBu} BU
            </span>
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

function OverviewTab({
  props,
  editMode,
  onSaved,
  showToast,
}: {
  props: CharacterSheetProps;
  editMode: boolean;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const attrSum = props.attrPhysical + props.attrMental + props.attrMagical;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Vitality + Defensive DC */}
      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Heart className="size-5 text-rose-500" />
          Vitality & Defenses
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <VitalityCard
            max={props.vitality.max}
            current={props.vitality.current}
            percent={props.vitality.percent}
          />
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Defensive DCs
            </p>
            <ul className="mt-2 space-y-1">
              {props.defensiveDCs.map((d) => (
                <li
                  key={d.attribute}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{d.attribute}</span>
                  <span className="font-mono font-bold">{d.dc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Encumbrance */}
      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="size-5 text-amber-500" />
          Encumbrance
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Load
            </p>
            <p
              className={`mt-1 font-mono text-2xl font-bold ${
                props.encumbrance.encumbered ? "text-destructive" : ""
              }`}
            >
              {props.encumbrance.load}
              <span className="text-muted-foreground text-sm">
                {" "}
                / {props.encumbrance.capacity}
              </span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${
                  props.encumbrance.encumbered
                    ? "bg-destructive"
                    : props.encumbrance.percentOfCapacity > 90
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(100, props.encumbrance.percentOfCapacity)}%`,
                }}
              />
            </div>
            {props.encumbrance.encumbered && (
              <p className="mt-2 text-xs text-destructive">Encumbered!</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Equip Slots
            </p>
            <p className="mt-1 font-mono text-2xl font-bold">
              {props.encumbrance.equipSlotsUsed}
              <span className="text-muted-foreground text-sm">
                {" "}
                / {props.encumbrance.equipSlotsAvailable}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Identity / Race / BG / Archetype */}
      <div className="rounded-md border border-border bg-card p-5 lg:col-span-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="size-5 text-primary" />
          Identity
        </h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Lineage" value={props.lineageName ?? "—"} {...(props.lineageDescription ? { description: props.lineageDescription } : {})} />
          <Field
            label="Upbringing"
            value={props.upbringingName ?? "—"}
            {...(props.upbringingDescription ? { description: props.upbringingDescription } : {})}
          />
          <Field label="Manifest" value={props.manifestName ?? "—"} />
          <Field
            label="Attribute Sum"
            value={`${attrSum} / 10 ${
              attrSum === 10 ? "✓" : "✗ INVALID"
            }`}
          />
        </dl>
      </div>

      {editMode && (
        <QuickEditPanel
          props={props}
          attrSum={attrSum}
          onSaved={onSaved}
          showToast={showToast}
        />
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

// =============================================================================
// Quick edit panel (in Overview when edit mode is on)
// =============================================================================

function QuickEditPanel({
  props,
  attrSum,
  onSaved,
  showToast,
}: {
  props: CharacterSheetProps;
  attrSum: number;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: props.name,
    level: props.level,
    attrPhysical: props.attrPhysical,
    attrMental: props.attrMental,
    attrMagical: props.attrMagical,
    attrProficient: props.attrProficient,
    startingBu: props.startingBu,
    buSpent: props.buSpent,
    dmBonusBu: props.dmBonusBu,
    currentVitality: props.currentVitality,
    notes: props.notes ?? "",
  });
  const localSum =
    form.attrPhysical + form.attrMental + form.attrMagical;
  const localValid = localSum === 10;
  const localPool = form.startingBu + (form.level - 1) * 5 + form.dmBonusBu;
  const localValidCap = form.buSpent <= localPool;

  async function save() {
    if (!localValid) {
      showToast(`Attributes must sum to 10 (currently ${localSum}).`, "error");
      return;
    }
    if (!localValidCap) {
      showToast(`BU spent (${form.buSpent}) exceeds cap (${localPool}).`, "error");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/characters/${props.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            level: form.level,
            attrPhysical: form.attrPhysical,
            attrMental: form.attrMental,
            attrMagical: form.attrMagical,
            attrProficient: form.attrProficient,
            startingBu: form.startingBu,
            buSpent: form.buSpent,
            dmBonusBu: form.dmBonusBu,
            currentVitality: form.currentVitality,
            notes: form.notes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Save failed.", "error");
          return;
        }
        showToast("Saved.", "success");
        onSaved();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  return (
    <div className="rounded-md border border-primary/50 bg-primary/5 p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Edit className="size-5 text-primary" />
          Edit Mode
        </h3>
        <button
          type="button"
          onClick={save}
          disabled={isPending || !localValid || !localValidCap}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="size-4" />
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Name
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Level
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.level}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                level: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
              }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
            Attributes (sum = 10)
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            <AttrSlider
              label="Physical"
              value={form.attrPhysical}
              onChange={(v) => setForm((f) => ({ ...f, attrPhysical: v }))}
            />
            <AttrSlider
              label="Mental"
              value={form.attrMental}
              onChange={(v) => setForm((f) => ({ ...f, attrMental: v }))}
            />
            <AttrSlider
              label="Magical"
              value={form.attrMagical}
              onChange={(v) => setForm((f) => ({ ...f, attrMagical: v }))}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Sum:</span>
            <span
              className={`font-mono font-bold ${
                localValid ? "text-green-600" : "text-destructive"
              }`}
            >
              {localSum} / 10 {localValid ? "✓" : "✗"}
            </span>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Proficient Attribute
          </span>
          <select
            value={form.attrProficient ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                attrProficient:
                  (e.target.value as "PHYSICAL" | "MENTAL" | "MAGICAL") || null,
              }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            <option value="PHYSICAL">Physical</option>
            <option value="MENTAL">Mental</option>
            <option value="MAGICAL">Magical</option>
          </select>
        </label>

        <div />

        <NumField
          label="Starting BU"
          value={form.startingBu}
          onChange={(v) => setForm((f) => ({ ...f, startingBu: v }))}
        />
        <NumField
          label="BU Spent"
          value={form.buSpent}
          onChange={(v) => setForm((f) => ({ ...f, buSpent: v }))}
        />
        <NumField
          label="DM Bonus BU"
          value={form.dmBonusBu}
          onChange={(v) => setForm((f) => ({ ...f, dmBonusBu: v }))}
        />
        <NumField
          label="Current Vitality"
          value={form.currentVitality ?? 0}
          onChange={(v) =>
            setForm((f) => ({ ...f, currentVitality: v }))
          }
          allowNull
        />

        <div className="sm:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground">Progression pool: </span>
          <span className="font-mono font-bold">
            {form.startingBu} + ({form.level} - 1) × 5 + {form.dmBonusBu} = {localPool}
          </span>
          {!localValidCap && (
            <span className="ml-2 text-destructive">exceeded</span>
          )}
        </div>
      </div>
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
// Practices Tab
// =============================================================================

function PracticesTab({
  practices,
  defensiveDCs,
  attrProficient,
  expandedPractice,
  setExpandedPractice,
}: {
  practices: PracticeRow[];
  defensiveDCs: DefensiveDC[];
  attrProficient: string | null;
  expandedPractice: string | null;
  setExpandedPractice: (s: string | null) => void;
}) {
  const byAttr: Record<string, PracticeRow[]> = {
    PHYSICAL: [],
    MENTAL: [],
    MAGICAL: [],
  };
  for (const p of practices) {
    byAttr[p.attribute]?.push(p);
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Roll modifier for each practice: slice (from attribute distribution) +
        PB (if proficient in that attribute) + primitive bonuses.
        {attrProficient && (
          <>
            {" "}
            You are proficient in <strong>{attrProficient}</strong> — all
            practices under it receive PB.
          </>
        )}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attr) => (
          <section
            key={attr}
            className="rounded-md border border-border bg-card p-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {attr}
            </h3>
            <ul className="mt-3 space-y-1">
              {byAttr[attr]?.map((p) => (
                <li key={p.practice}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPractice(
                        expandedPractice === p.practice ? null : p.practice,
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                      expandedPractice === p.practice
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span className="font-medium capitalize">
                      {p.practice}
                    </span>
                    <span className="font-mono font-bold">
                      {p.total >= 0 ? "+" : ""}
                      {p.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <DetailModal
        isOpen={expandedPractice !== null}
        onClose={() => setExpandedPractice(null)}
        title={
          expandedPractice
            ? `${expandedPractice.charAt(0).toUpperCase() + expandedPractice.slice(1)} breakdown`
            : ""
        }
      >
        {expandedPractice && (
          <BreakdownView
            practice={
              practices.find((p) => p.practice === expandedPractice)!
            }
          />
        )}
      </DetailModal>

      <div className="mt-6 rounded-md border border-border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Defensive DCs
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {defensiveDCs.map((d) => (
            <div
              key={d.attribute}
              className="rounded-md border border-border bg-background px-3 py-2 text-center"
            >
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {d.attribute}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold">{d.dc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownView({ practice }: { practice: PracticeRow }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between text-base">
        <span className="font-semibold capitalize">{practice.practice}</span>
        <span className="font-mono text-2xl font-bold">
          {practice.total >= 0 ? "+" : ""}
          {practice.total}
        </span>
      </div>
      <hr className="border-border" />
      <BreakdownRow label="Slice (from attribute)" value={practice.slice} />
      <BreakdownRow
        label="Proficiency Bonus"
        value={practice.pbContribution}
        subdued={practice.pbContribution === 0}
      />
      {practice.primitiveContributions.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Primitive bonuses
          </p>
          {practice.primitiveContributions.map((p) => (
            <BreakdownRow
              key={p.primitiveId}
              label={p.primitiveName}
              value={p.bonus}
            />
          ))}
        </>
      )}
      {practice.primitiveContributions.length === 0 &&
        practice.pbContribution === 0 && (
          <p className="text-xs text-muted-foreground">
            No PB or primitive bonuses. Only slice contributes.
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
// Capabilities Tab
// =============================================================================

function CapabilitiesTab({
  capabilities,
  heritageById,
  capabilityById,
  effectById,
}: {
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
    verboseDescription: string;
    acquiredAtLevel: number;
    // Phase 5 (T5.C.3): slot metadata for the badge.
    versionId: string | null;
    slotSource: SlotSource | null;
    latestVersionId: string | null;
    // Phase 8.1 batch 13.1: origin (heritage that brought this
    // capability in). Direct slots have null.
    originHeritageId: string | null;
  }>;
  // Phase 8.1 batch 13.1: lookup maps for displaying the origin
  // chain (heritage name → "from Lineage 'Elf'", etc.).
  heritageById: Map<string, { name: string; kind: string }>;
  capabilityById: Map<string, { name: string }>;
  effectById: Map<string, { name: string }>;
}) {
  if (capabilities.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Swords className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No capabilities yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant capabilities from the Library or assign them via Edit mode.
        </p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {capabilities.map((c) => {
        // Phase 8.1 batch 13.1: build the origin chain (heritage only
        // for capabilities — capabilities don't bubble through effects,
        // they contain effects).
        const originChain: Array<{
          kind: "heritage" | "capability" | "effect";
          name: string;
        }> = [];
        if (c.originHeritageId) {
          const h = heritageById.get(c.originHeritageId);
          if (h) {
            originChain.push({
              kind: "heritage",
              name: `${h.kind === "LINEAGE" ? "Lineage" : h.kind === "UPBRINGING" ? "Upbringing" : "Manifest"}: ${h.name}`,
            });
          }
        }
        return (
          <li
            key={c.id}
            className="rounded-md border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold">{c.name}</h4>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                {c.type}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{c.sourceType}</span>
              <span>·</span>
              <span>Acquired L{c.acquiredAtLevel}</span>
            </div>
            {/* Phase 5 (T5.C.3): render the slot-source badge so the user
                can tell at a glance whether this capability is theirs, a
                fork, or pinned to someone else's version. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SlotSourceBadge
                slotSource={c.slotSource}
                versionId={c.versionId}
                latestVersionId={c.latestVersionId}
              />
              {originChain.length > 0 ? (
                <OriginBadge chain={originChain} />
              ) : null}
            </div>
            {c.verboseDescription && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                {c.verboseDescription}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// =============================================================================
// Items Tab
// =============================================================================

function ItemsTab({
  items,
  encumbrance,
}: {
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
          <li
            key={i.id}
            className="rounded-md border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold">{i.name}</h4>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                {i.itemType}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{i.rarity}</span>
              {i.isTwoHanded && <span>· Two-handed</span>}
              {i.isConsumable && <span>· Consumable</span>}
              {i.equipped && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                  Equipped
                </span>
              )}
            </div>
            {/* Phase 5 (T5.C.3): render the slot-source badge. */}
            <div className="mt-2">
              <SlotSourceBadge
                slotSource={i.slotSource}
                versionId={i.versionId}
                latestVersionId={i.latestVersionId}
              />
            </div>
            {i.description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                {i.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Notes Tab
// =============================================================================

function NotesTab({
  id,
  initialNotes,
  initialDmNotes,
  editMode,
  showToast,
}: {
  id: string;
  initialNotes: string;
  initialDmNotes: string;
  editMode: boolean;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [dmNotes, setDmNotes] = useState(initialDmNotes);

  async function save() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/characters/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.trim() || null,
            dmNotes: dmNotes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Save failed.", "error");
          return;
        }
        showToast("Notes saved.", "success");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Notes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Visible to everyone. Personality, backstory, hooks.
        </p>
        {editMode ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={12}
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            placeholder="Lore, traits, hooks..."
          />
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
            {notes || <span className="text-muted-foreground">—</span>}
          </p>
        )}
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ScrollText className="size-5 text-amber-500" />
          DM Notes
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Private to the DM. Plot hooks, secrets, triggers.
        </p>
        {editMode ? (
          <>
            <textarea
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={12}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="DM-only secrets..."
            />
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="mt-3 flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save Notes"}
            </button>
          </>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
            {dmNotes || (
              <span className="text-muted-foreground">No DM notes.</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// Unused but reserved for future inline actions
void ChevronRight;