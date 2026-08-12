"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  RotateCcw,
} from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import type { HardModifier } from "@/types/swordweave";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import { ToastViewport, useToasts } from "@/components/ui/toast";
import { SlotSourceBadge } from "@/components/characters/slot-source-badge";
import { OriginBadge } from "@/components/characters/origin-badge";
import {
  makeKey as makeVersionKey,
  type VersionKey,
} from "@/lib/versions/version-key";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import { VitalityDisplayCard } from "@/components/characters/vitality-display-card";
import { CapabilityCard } from "@/components/characters/capability-card";
import { ItemCard } from "@/components/characters/item-card";
import { DmBonusEditor } from "@/components/characters/dm-bonus-editor";
import { CharacterEditButton } from "@/components/characters/character-edit-button";
import { PrimitivePreviewCard } from "@/components/characters/primitive-preview-card";
import { BottomStickyBar } from "@/components/characters/bottom-sticky-bar";
import { FormulaModal, type FormulaStep } from "@/components/characters/formula-modal";
import { useDeepPrimitiveClosure } from "@/components/characters/use-deep-primitive-closure";
import { SheetIdentityHeader } from "@/components/characters/sheet-identity-header";
import { CoreStatsCard } from "@/components/characters/core-stats-card";
import { onCharacterLogAdded } from "@/lib/character/character-events";
import { TabErrorBoundary } from "@/components/characters/tab-error-boundary";
import { HeritageBundleView } from "@/components/characters/heritage-bundle-view";
import { proficiencyBonus } from "@/lib/engine/practices";
// Phase 8.3f S4 (Mashu 2026-07-28): the canonical resolver
// replaces the presentation-time approximation in
// `attribute-modifier-delta.ts`. The hook returns totals +
// per-target attribution; we use it for the BottomStickyBar
// and (in S5) the VitalityCard + provenance modal.
import { useCharacterResolver } from "@/lib/hooks/use-character-resolver";
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
 * 5 tabs: Capabilities · Items · Backstory · Notes · History. Overview
 * merged into the bottom sticky drawer (Phase 8.4).
 * Mobile: bottom tabs (horizontally scrollable). Desktop: top tabs.
 *
 * Phase 8.2 batch 3: Tab restructure per Mashu 2026-07-22.
 *   - The bottom drawer carries identity + load/equip + vitality + mods + DC + practices
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
  isToggledOff: boolean;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
    isMirrorable: boolean;
    mirrorBuCredit: number;
    narrativeRule: string;
    // Phase 8.3f S4 (Mashu 2026-07-28): mirrorVector needed by
    // the resolver to apply the correct mirror semantics when
    // computing per-target contributions.
    mirrorVector: string | null;
    // Phase 8.3d (Mashu 2026-07-27): the primitive's authored
    // hard_modifiers JSONB, passed through from the DB. Used by
    // ConditionBadges to render each modifier's condition as a
    // pill row beneath the primitive name on the character sheet.
    // unknown[] because we parse the condition shape at render
    // time (legacy vs v1 differ).
    hardModifiers: readonly unknown[];
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
  // Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab accordion
  // routing for DIRECT caps. Heritage-bundled caps have
  // originHeritageId set; their slotTab stays null. Direct
  // caps read slotTab to know which accordion (LINEAGE /
  // UPBRINGING / MANIFEST) to render under.
  slotTab: "LINEAGE" | "UPBRINGING" | "MANIFEST" | null;
  // Phase 8.4 v5 (Mashu 2026-07-28): effects belonging to the
  // underlying capability template. Flattened to the outer
  // link level so the CapabilitiesTab can spread `{...c}` into
  // CapabilityCard without losing them.
  effectLinks: Array<{
    effectId: string;
    effect: {
      id: string;
      name: string;
      description: string;
    };
  }>;
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
    // Phase 8.5 H5 (Mashu 2026-08-03): item size drives
    // encumbrance Load via SIZE_LOAD. Optional in the type
    // because the bottom drawer doesn't render it.
    size?: string;
    // Phase 8.4 v22 (Mashu 2026-07-29): T2 — item's nested
    // bundle so the sheet ItemsTab can render primitives /
    // caps / effects per item (matching the modal's
    // ItemsTab structure).
    capabilityLinks: Array<{
      capabilityId: string;
      capability: {
        id: string;
        name: string;
        type: string;
        sourceType: string;
        verboseDescription: string;
        effectLinks: Array<{
          effectId: string;
          effect: { id: string; name: string; description: string };
        }>;
      };
    }>;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string };
    }>;
    primitiveLinks: Array<{
      primitiveId: number;
      primitive: {
        id: number;
        name: string;
        category: string;
        buCost: number;
        isMirrorable: boolean;
        mirrorBuCredit: number;
        narrativeRule: string | null;
      };
    }>;
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
  // Phase 8.I i2 finish (Mashu 2026-08-06) - speed +
  // carry capacity from the primitive walks.
  speedByType: Readonly<Record<string, number>>;
  carryCapacity: number;
  // Phase 8.I i2 finish - damage modifiers
  // (resistance / vulnerability / immunity) the character has.
  // Shape: { resistance: ['fire', 'cold'], vulnerability: [],
  // immunity: ['poison'] } - populated by walking
  // damage_modifier.<type> primitives.
  damageModifiers: {
    readonly resistance: readonly string[];
    readonly vulnerability: readonly string[];
    readonly immunity: readonly string[];
  };
  // Phase 8.I Wave 6 (Mashu 2026-08-06): custom behavior
  // variables (legendary_resistance, action_points, etc.)
  behaviorVariables: ReadonlyArray<{
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  }>;
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
  /** Phase 8.I i3: runtime condition context for per-modifier
   *  condition evaluation. */
  conditionContext?: ConditionContext | null;
  capabilityLinks: SheetCapabilityLink[];
  itemLinks: SheetItemLink[];
  // Phase 8.5 / Session H6 round 7 (Mashu
  // 2026-08-03): the latest-version map from
  // bulkResolveLatestVersions. Lets the sheet render
  // "update available" stale pills on every entity
  // type, including heritages which weren't covered
  // before round 7.
  latestVersions?: Map<VersionKey, string>;
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
      // Phase 8.4 v3 (Mashu 2026-07-28): canonical bundle from
      // the heritage template. Rendered in the Capabilities tab's
      // "By Heritage" section so the user sees what each heritage
      // provides (capabilities + primitives bundled together).
      capabilityLinks: Array<{
        capabilityId: string;
        capability: {
          id: string;
          name: string;
          type: string;
          sourceType: string;
          verboseDescription: string;
        };
      }>;
      primitiveLinks: Array<{
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

type Tab = "capabilities" | "items" | "backstory" | "notes" | "history";

const TABS: Array<{ id: Tab; label: string; icon: typeof Edit }> = [
  { id: "capabilities", label: "Capabilities", icon: Swords },
  { id: "items", label: "Items", icon: Package },
  { id: "backstory", label: "Backstory", icon: BookOpen },
  { id: "notes", label: "Notes", icon: ScrollText },
  { id: "history", label: "History", icon: History },
];

// Phase 8.4 v4 (Mashu 2026-07-28): best-practice total per
// attribute. Returns the highest practice total (or 0 if the
// attribute has no practices). Used by the Vitality card's
// PHYS / MENT / MAGI / PROF row.
function bestPracticeTotalForAttribute(
  practices: ReadonlyArray<{ attribute: string; total: number }>,
  attr: "PHYSICAL" | "MENTAL" | "MAGICAL",
): number {
  const filtered = practices.filter((p) => p.attribute === attr);
  if (filtered.length === 0) return 0;
  return filtered.reduce((best, p) => Math.max(best, p.total), 0);
}

export function CharacterSheetView(props: CharacterSheetProps) {
  const [tab, setTab] = useState<Tab>("capabilities");
  const [levelUpConfirm, setLevelUpConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const latestVersions = props.latestVersions ?? (new Map<VersionKey, string>());
  const { toasts, showToast, dismissToast } = useToasts();
  // Phase 8.2 batch 7: opening edit mode triggers the atelier's
  // character builder modal (pre-filled via openForEdit).
  // Phase 8.2 batch 7 rev 2: clicking Edit now navigates to /atelier
  // and lets the atelier client boot the modal from localStorage.

  const attrSum = props.attrPhysical + props.attrMental + props.attrMagical;
  const attrValid = attrSum === 10;

  // Phase 8.3f S4 (Mashu 2026-07-28): run the canonical resolver
  // once per render. The result drives the BottomStickyBar's
  // attribute modifiers and (in S5) the VitalityCard + provenance
  // modal. Memoized on the primitiveLinks ref + attribute values.
  const resolver = useCharacterResolver({
    characterId: props.id,
    level: props.level,
    pb: proficiencyBonus(props.level),
    proficientAttribute:
      props.attrProficient === null
        ? null
        : props.attrProficient.toLowerCase() === "physical"
          ? "physical"
          : props.attrProficient.toLowerCase() === "mental"
            ? "mental"
            : props.attrProficient.toLowerCase() === "magical"
              ? "magical"
              : null,
    attributes: {
      physical: props.attrPhysical,
      mental: props.attrMental,
      magical: props.attrMagical,
    },
    primitiveLinks: props.primitiveLinks.map((l) => ({
      primitiveId: l.primitiveId,
      isMirrored: l.isMirrored,
      originHeritageId: l.originHeritageId,
      originCapabilityId: l.originCapabilityId,
      originEffectId: l.originEffectId,
      isToggledOff: l.isToggledOff ?? false,
      primitive: {
        id: l.primitive.id,
        name: l.primitive.name,
        category: l.primitive.category,
        isMirrorable: l.primitive.isMirrorable,
        mirrorVector: l.primitive.mirrorVector,
        hardModifiers: l.primitive.hardModifiers,
      },
    })),
    conditionContext: props.conditionContext ?? null,
  });

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
    const m = new Map<string, { name: string; slotTab?: string | null }>();
    for (const l of props.capabilityLinks) {
      m.set(l.capabilityId, { name: l.capability.name, slotTab: l.slotTab ?? null });
    }
    return m;
  }, [props.capabilityLinks]);
  const effectById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    // Populate from capability effectLinks (each capability exposes
    // its nested effects via this prop). Also include effects from
    // character-level primitiveLinks in case future code surfaces
    // effects directly on primitives.
    for (const l of props.capabilityLinks ?? []) {
      for (const el of l.effectLinks ?? []) {
        if (el.effect?.id && el.effect?.name) {
          m.set(el.effect.id, { name: el.effect.name });
        }
      }
    }
    return m;
  }, [props.capabilityLinks]);

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
    <div className="mx-auto w-full max-w-screen-2xl px-5 py-8 pb-32">
      {/* Phase 8.4 (Mashu 2026-07-28): the in-page header
          (Pumnu portrait + name + L5 + size + Edit/Level Up/Clone)
          is hidden on mobile because SheetIdentityHeader at the top
          of the screen takes over its identity/avatar/buttons. We
          keep the in-page header on >= md screens where the sticky
          bar collapses. */}
      

      <header className="hidden flex-wrap items-start justify-between gap-4">
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
        {/* Action buttons. Mashu 2026-07-28: kept in the
            <header> on desktop because the identity card
            now lives in the SheetIdentityHeader's expanded
            view (mobile). */}
        <div className="flex flex-wrap items-center gap-2">
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
      {/* Phase 8.4 v15 (Mashu 2026-07-28): SheetIdentityHeader
          is fixed at top-of-viewport on ALL screen sizes now.
          Content needs a top spacer to avoid being hidden.
          Height = SheetIdentityHeader's collapsed-row height
          (88px to give the buttons room). */}
      <div
        className="h-[88px]"
        aria-hidden="true"
        data-testid="sheet-top-spacer"
      />

      {/* Phase 8.4 v2 (Mashu 2026-07-28): the entire BuBudgetFooter
          is hidden on mobile. SheetIdentityHeader's expanded panel
          shows every value the footer exposed (budget, debt, DM
          bonus, item BU, mirrored primitives) so the static
          section is redundant on phones. Mashu 2026-07-28:
          "Since we put all the BU budget things in collapsible on
          top we don't need the section anymore that's not
          collapsed." Desktop keeps the full footer. */}
      <div className="hidden">
      <BuBudgetFooter
        characterId={props.id}
        progressionSpent={props.buBalance.progressionSpent}
        progressionPool={props.buBalance.progressionPool}
        overBudget={props.buBalance.overBudget}
        level={props.level}
        dmBonusBu={props.buBalance.dmBonusBu}
        itemBuSpent={props.buBalance.itemBuSpent}
        {...(props.buBalance.warning !== undefined
          ? { warning: props.buBalance.warning }
          : {})}
        volatilityRating={props.volatility.rating}
        volatilityCeiling={props.volatility.ceiling}
        levelBracket={props.volatility.levelBracket}
        volatilityRemaining={props.volatility.remaining}
        volatilityExceeded={props.volatility.exceeded}
        mirroredPrimitives={props.volatility.mirroredPrimitives}
      />
      </div>

      {/* Tabs — Mashu 2026-07-28 (round 7): move to bottom
          on ALL screen sizes, matching mobile. The previous
          desktop top tabs are hidden. */}
      <nav
        className="mt-6 hidden"
        aria-label="Sheet tabs (desktop top — disabled)"
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
        {tab === "capabilities" && (
          /* Phase 8.4 (Mashu 2026-07-28): wrap the Capabilities tab
             in a TabErrorBoundary so a single bad capability
             (e.g. Tessy s Ironborn fork test reproducer) does not
             white-screen the entire sheet. The error message is
             shown inline so the user can keep using the other tabs. */
          <TabErrorBoundary tabName="Capabilities">
          <CapabilitiesTab
            characterId={props.id}
            heritageLinks={props.heritageLinks}
            capabilities={props.capabilityLinks.map((l) => ({
              ...l.capability,
              acquiredAtLevel: l.acquiredAtLevel,
              // Phase 5 (T5.C.3): surface slot metadata to the tab.
              versionId: l.versionId,
              slotSource: l.slotSource,
              latestVersionId: l.latestVersionId,
              // Phase 8.1 batch 13.1: pass through origin for the badge.
              originHeritageId: l.originHeritageId,
              // Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab
              // accordion routing for direct caps. Default
              // to MANIFEST when the column is null (legacy
              // rows pre-v24.6).
              slotTab: l.slotTab ?? "MANIFEST",
              tags: l.capability.tags ?? [],
              // Phase 8.4 v5 (Mashu 2026-07-28): forward
              // effectLinks so the CapabilityCard can render
              // a nested Effects accordion.
              effectLinks: l.effectLinks ?? [],
            }))}
            // Phase 8.5 / Session H6 round 7 (Mashu
            // 2026-08-03): forward the latest-version
            // map so HeritageKindAccordion (and the
            // heritage header SlotSourceBadge inside
            // it) can render "Pinned v:XXX" + the
            // "update available" stale pill when the
            // heritage has been re-published.
            latestVersions={latestVersions}
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
                // Phase 8.3d (Mashu 2026-07-27): pass-through
                // hardModifiers from the snapshot so the inner
                // accordion can render ConditionBadges per row.
                hardModifiers: l.primitive.hardModifiers,
              },
            }))}
          />
          </TabErrorBoundary>
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
            // Phase 8.5 / Session H6 round 10 (Mashu
            // 2026-08-03): forwarded so each ItemCard's
            // nested CAPABILITIES / EFFECTS / PRIMITIVES
            // chips can render "Pinned v:XXXX".
            latestVersions={latestVersions}
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
          <HistoryTab characterId={props.id} logEntries={props.logEntries} />
        )}
      </div>

      {/* Mobile bottom tabs — Phase 8.2 batch 3: scrollable for 6 tabs */}
      {/* Phase 8.4 v3 (Mashu 2026-07-28): tabs dock at the very
          bottom of the viewport (bottom-0). The BottomStickyBar
          sits at bottom-16 (64px) ABOVE the tabs — the previous
          swap (bar at bottom-0, tabs at bottom-16) was wrong.
          Mashu 2026-07-28: "Now the quick bar is below the tabs.
          It should be just above the tabs like it was at first." */}
      <nav
        // Mashu 2026-07-28 (round 8): tabs at the bottom
        // on every screen size.
        className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-background/95 backdrop-blur"
        aria-label="Sheet tabs"
      >
        {/* Mobile: each button is flex-1 (evenly distributed
            across the row, original Phase 8.4 behavior).
            Desktop (md+): same compact height, but spread out
            via justify-around + 15% left + 15% right padding
            so the row doesn't feel edge-locked.
            We do NOT inflate height for desktop — that was
            making the quick bar above crowd the tabs. */}
        <div className="flex w-full py-1 md:justify-around md:px-[15%] md:py-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors md:flex-none md:px-3 md:py-1.5 ${
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
        </div>
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

      {/* Phase 8 UI revamp (Mashu 2026-07-27): SheetIdentityHeader
          is mobile-only. Per the PDF, it forwards the same data
          as the in-page Edit / Level Up / Clone header but in a
          compact, collapsed-by-default block at the top of the
          screen. Hidden on >= md. */}
      <SheetIdentityHeader
        characterId={props.id}
        name={props.name}
        level={props.level}
        size={props.size}
        lineageName={props.lineageName ?? null}
        lineageDescription={props.lineageDescription ?? null}
        upbringingName={props.upbringingName ?? null}
        upbringingDescription={props.upbringingDescription ?? null}
        manifestName={props.manifestName ?? null}
        attrSum={attrSum}
        portraitUrl={props.portraitUrl ?? null}
        canLevelUp={props.level < 20}
        onLevelUp={() => setLevelUpConfirm(true)}
        buBalance={{
          progressionSpent: props.buBalance.progressionSpent,
          progressionPool: props.buBalance.progressionPool,
          overBudget: props.buBalance.overBudget,
          dmBonusBu: props.buBalance.dmBonusBu,
          itemBuSpent: props.buBalance.itemBuSpent,
        }}
        volatility={{
          rating: props.volatility.rating,
          ceiling: props.volatility.ceiling,
          levelBracket: props.volatility.levelBracket,
          remaining: props.volatility.remaining,
          exceeded: props.volatility.exceeded,
          mirroredPrimitives: props.volatility.mirroredPrimitives,
        }}
      />

      {/* Phase 8.4 (Mashu 2026-07-28): BottomStickyBar is
          the character sheet's single source of truth for
          play-time data. Visible on all screen sizes (no
          `md:hidden`). Renders identity strip + load/equip
          + vitality + mods/saves + DC + practices in the
          expandable drawer. The Overview tab has been
          removed because its content (identity strip + load
          stripe) now lives here. */}
      <BottomStickyBar
        characterId={props.id}
        currentVitality={props.currentVitality}
        maxVitality={props.vitality.max}
        physical={props.attrPhysical}
        mental={props.attrMental}
        magical={props.attrMagical}
        pb={proficiencyBonus(props.level)}
        proficientAttribute={props.attrProficient}
        attributeModifiers={{
          physical:
            props.attrPhysical +
            (resolver.totals["attribute.physical"] ?? 0),
          mental:
            props.attrMental +
            (resolver.totals["attribute.mental"] ?? 0),
          magical:
            props.attrMagical +
            (resolver.totals["attribute.magical"] ?? 0),
        }}
        baseAttributes={{
          physical: props.attrPhysical,
          mental: props.attrMental,
          magical: props.attrMagical,
        }}
        resolver={resolver}
        practices={props.practices.map((p) => ({
          name: p.practice,
          category: "PRACTICE",
          buCost: 0,
          attribute: p.attribute as "PHYSICAL" | "MENTAL" | "MAGICAL",
          total: p.total,
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
        }))}
        // Phase 8.4: identity strip data
        lineageName={props.lineageName}
        lineageDescription={props.lineageDescription}
        upbringingName={props.upbringingName}
        upbringingDescription={props.upbringingDescription}
        manifestName={props.manifestName}
        attrSum={props.attrPhysical + props.attrMental + props.attrMagical}
        attrSumValid={props.attrPhysical + props.attrMental + props.attrMagical === 10}
        // Phase 8.4: load/equip slots
        encumbrance={{
          load: props.encumbrance.load,
          capacity: props.encumbrance.capacity,
          percentOfCapacity: props.encumbrance.percentOfCapacity,
          encumbered: props.encumbrance.encumbered,
          // Phase 8.4: derive tiers from percentOfCapacity
          // (the source-of-truth field). The legacy
          // heavilyEncumbered / overburdened fields are
          // not on the CharacterSheetProps shape, so we
          // compute them here. Thresholds: encumbered
          // > 50%, heavily > 75%, overburdened > 100%.
          heavilyEncumbered: props.encumbrance.percentOfCapacity > 75,
          overburdened: props.encumbrance.percentOfCapacity > 100,
          // Phase 8.5 H-fix4 (Mashu 2026-08-03): equip-slot
          // fields forwarded here so the bottom-drawer
          // <EquipSlotsPanel> renders the real values instead
          // of the previous hardcoded `slotCount={6}
          // usedSlots={0}`. The ItemsTab on the sheet worked
          // correctly because it read these fields directly off
          // CharacterSheetProps; the bottom drawer needed them
          // bridged through the sticky-bar mapper.
          equipSlotsUsed: props.encumbrance.equipSlotsUsed,
          equipSlotsAvailable: props.encumbrance.equipSlotsAvailable,
        }}
        // Phase 8.I i2 finish (Mashu 2026-08-06) - speed +
        // carry capacity from primitive walks. Forwarded so
        // the sticky bar can render speed + carry cards.
        speedByType={props.speedByType}
        carryCapacity={props.carryCapacity}
        damageModifiers={props.damageModifiers}
        behaviorVariables={props.behaviorVariables}
        // Phase 8.4 v25: character size for the encumbrance
        // formula popup. Cast from the loose `string` type on
        // CharacterSheetProps to the literal union the bar
        // expects — the page SC validates it server-side.
        characterSize={
          (props.size as
            | "TINY"
            | "SMALL"
            | "MEDIUM"
            | "LARGE"
            | "HUGE"
            | "GARGANTUAN") || "MEDIUM"
        }
      />
    </div>
  );
}

// =============================================================================
// BU Budget Footer — unified budget + debt display
// =============================================================================
// Replaces the separate BuBar + VolatilityPanel with a single unified footer.
// Shows:
//   Budget: X / Y  (with "exceeded by X" if over)
//   Debt:   Used / Max (e.g., 6/10)  +  Remaining
//   Visual bars for both, color-coded (green/amber/red for budget, red for debt ceiling)
// =============================================================================

function BuBudgetFooter({
  characterId,
  // Budget (positive BU)
  progressionSpent,
  progressionPool,
  overBudget,
  level,
  dmBonusBu,
  itemBuSpent,
  warning,
  // Debt (mirror/negative BU)
  volatilityRating,
  volatilityCeiling,
  levelBracket,
  volatilityRemaining,
  volatilityExceeded,
  mirroredPrimitives,
}: {
  characterId: string;
  // Budget
  progressionSpent: number;
  progressionPool: number;
  overBudget: boolean;
  level: number;
  dmBonusBu: number;
  itemBuSpent: number;
  warning?: string;
  // Debt (volatility)
  volatilityRating: number;
  volatilityCeiling: number;
  levelBracket:
    | "L1-L4"
    | "L5-L8"
    | "L9-L12"
    | "L13-L16"
    | "L17-L20"
    | "L21-L24"
    | "L25-L28"
    | "L29+";
  volatilityRemaining: number;
  volatilityExceeded: boolean;
  mirroredPrimitives: ReadonlyArray<{
    id: number;
    name: string;
    mirrorBuCredit: number;
    acquiredAtLevel: number;
  }>;
}) {
  // Phase 8.5 H-fix3 (Mashu 2026-08-03): the sheet's BuBudgetFooter
  // previously used `overBudget` as the condition for showing the
  // `(+N)` overflow indicator, which meant the indicator fired
  // whenever raw `progressionSpent > progressionPool`, even when
  // debt had fully absorbed the overflow. Per the modal's
  // canonical formula in `tabbed-character-form.tsx`, the right
  // condition is the STILL-VISIBLE remainder after debt absorption:
  //   budgetOverflowRemainder = max(0, budgetVisible - progressionPool)
  // For Tessy (spent=240, pool=235, debt=20):
  //   budgetOverBy=5, debtUsed=5, budgetVisible=235,
  //   budgetOverflowRemainder=0 → "235/235" (no `(+5)`).
  // For spent=260, pool=235, debt=20:
  //   budgetOverBy=25, debtUsed=20, budgetVisible=240,
  //   budgetOverflowRemainder=5 → "235/235 (+5)".
  // Same logic was already correct on /characters/[id] modal but
  // missing on the character-sheet footer and the /characters
  // list page. Bringing all three surfaces in line.
  const budgetOverBy = Math.max(0, progressionSpent - progressionPool);
  const debtUsed = Math.min(budgetOverBy, volatilityRating);
  const budgetVisible = Math.max(0, progressionSpent - debtUsed);
  const budgetOverflowRemainder = Math.max(0, budgetVisible - progressionPool);
  const overBudgetAfterDebt = budgetOverflowRemainder > 0;
  // Cap the budget bar at 100% when over budget, since the overflow
  // is covered by mirror debt.
  const budgetPercent = progressionPool > 0 ? Math.min(100, (budgetVisible / progressionPool) * 100) : 0;
  // Phase 8.4 v25 (Mashu 2026-07-30): flipped budget bar colors.
  // Per Mashu: "The budget bar is orange if > than max allowed
  // technically, green if lower than max budget." Players should
  // see green when they're under pool (not punished for not
  // spending every BU) — the budget is a SOFT cap you can
  // exceed with DM approval (mid-session, etc.).
  // Over-budget still stays destructive (red).
  // Phase 8.5 H-fix3 (Mashu 2026-08-03): budget bar color uses
  // `overBudgetAfterDebt` (destructive only when there's STILL
  // visible overflow past the pool after debt absorption),
  // matching the modal's `overBudget` semantic.
  const budgetBarColor = overBudgetAfterDebt
    ? "bg-destructive"
    : "bg-green-500";

  // Phase 8.4 v26.8: debt bar percentage uses actual debt used (capped
  // at overflow) rather than total mirror credit.
  const debtPercent = volatilityCeiling > 0 ? Math.min(100, (debtUsed / volatilityCeiling) * 100) : 0;
  // Phase 8.4 v25 (Mashu 2026-07-30): debt bar — green when at
  // limit (full), amber/yellow when under (per Mashu: "BU debt
  // is green when full, yellow (like mirror tag) when not").
  // Exceeded stays destructive.
  const debtBarColor = volatilityExceeded
    ? "bg-destructive"
    : debtPercent >= 100
      ? "bg-green-500"
      : "bg-amber-500";

  // Phase 8.4 v25 (Mashu 2026-07-30): BU Budget + Debt chips
  // are clickable to open a formula popup explaining how the
  // numbers are derived. Two popup modes — "budget" and "debt".
  const [popup, setPopup] = useState<"budget" | "debt" | null>(null);

  return (
    <div className="sticky bottom-0 z-20 mt-6 -mx-5 border-y border-border bg-background/85 px-5 py-3 backdrop-blur-md">
      {/* ===== Row 1: Budget + Debt headers ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Budget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Budget
            </span>
            <button
              type="button"
              onClick={() => setPopup("budget")}
              className={`rounded-full px-3 py-1 font-mono text-base font-bold transition-colors hover:ring-2 hover:ring-primary/40 ${
                overBudgetAfterDebt
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
              title="Show BU budget formula"
              aria-label="Show BU budget formula"
            >
              {/* Phase 8.5 H-fix3 (Mashu 2026-08-03): show the
                  budget number that's visible AFTER debt absorption,
                  then append `(+N)` only when debt could NOT fully
                  cover the overflow (matches the modal's formula).
                  See the bu-carry-over.test.ts canonical example. */}
              {budgetVisible}
              <span className="text-muted-foreground"> / {progressionPool}</span>
              {budgetOverflowRemainder > 0 && (
                <span className="ml-1.5 text-destructive font-medium">
                  (+{budgetOverflowRemainder})
                </span>
              )}
            </button>
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
        {/* Debt */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Debt
            </span>
            <button
              type="button"
              onClick={() => setPopup("debt")}
              className={`rounded-full px-3 py-1 font-mono text-sm font-bold transition-colors hover:ring-2 hover:ring-primary/40 ${
                volatilityExceeded
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
              title="Show volatility/debt formula"
              aria-label="Show volatility/debt formula"
            >
              -{debtUsed}
              <span className="text-muted-foreground"> / -{volatilityCeiling}</span>
            </button>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              volatilityExceeded
                ? "bg-destructive/15 text-destructive"
                : "bg-secondary text-secondary-foreground"
            }`}
            title="Level bracket — determines max negative BU"
          >
            L-bracket {levelBracket}
          </span>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Remaining
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              -{volatilityCeiling - debtUsed} BU
            </span>
          </div>
        </div>
      </div>

      {/* ===== Row 2: Budget bar ===== */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Budget usage</span>
          <span>{Math.min(100, budgetPercent)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${budgetBarColor}`}
            style={{ width: `${Math.min(100, budgetPercent)}%` }}
          />
        </div>
        {warning && <p className="mt-1.5 text-xs text-destructive">{warning}</p>}
      </div>

      {/* ===== Row 3: Debt bar ===== */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Debt usage</span>
          <span>{Math.min(100, debtPercent)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${debtBarColor}`}
            style={{ width: `${Math.min(100, debtPercent)}%` }}
          />
        </div>
        {volatilityExceeded && (
          <p className="mt-1.5 text-xs font-medium text-destructive">
            ⚠ Volatility ceiling exceeded. The DM must remove mirror primitives
            or grant a respec before this character can be played.
          </p>
        )}
      </div>

      {/* ===== Row 4: Mirrored primitives detail ===== */}
      {mirroredPrimitives.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {mirroredPrimitives.length} mirrored primitive{mirroredPrimitives.length === 1 ? "" : "s"} (click to expand)
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

      {/* Phase 8.4 v25 (Mashu 2026-07-30): BU Budget + Debt
          formula popups. Two popup modes — "budget" explains the
          lifetime BU formula + progression spikes, "debt" explains
          the volatility ceiling + cascade rule (BU fills first,
          then debt). DM Bonus section is included in both
          popups so the player understands how DM-awarded BU
          interacts with lifetime. */}
      {popup && (
        <BuFormulaModal
          mode={popup}
          level={level}
          dmBonusBu={dmBonusBu}
          itemBuSpent={itemBuSpent}
          volatilityRating={volatilityRating}
          volatilityCeiling={volatilityCeiling}
          volatilityRemaining={volatilityRemaining}
          levelBracket={levelBracket}
          mirroredPrimitives={mirroredPrimitives}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
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
  // Phase 8.3g v2 (Mashu 2026-07-28): the practice
  // breakdown opens as a MODAL (per Mashu: "I still have
  // the drop-down not the modal in click like everywhere
  // else like we discussed"). The `provenanceTarget` is
  // a JSON-stringified PracticeRow so the modal can
  // render the breakdown with the right data.
  const [practiceModal, setPracticeModal] = useState<PracticeRow | null>(null);
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

  // Phase 8.4 v3 (Mashu 2026-07-28): revert to single-column on
  // mobile (3 columns on desktop). The PROF column is gone —
  // the user wants PROF in the vitality card with the
  // attributes, not in the Practices card.
  return (
    <>
      <div className="grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-3 md:divide-x md:divide-y-0 md:gap-0">
        {(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attr) => {
          const rows = sortByTotal(byAttr[attr] ?? []);
          const proficient = attrProficient === attr;
          const bestTotal = rows[0]?.total ?? 0;
          return (
            <PracticeColumn
              key={attr}
              attr={attr}
              rows={rows}
              proficient={proficient}
              bestTotal={bestTotal}
              onOpen={(p) => setPracticeModal(p)}
            />
          );
        })}
      </div>
      {practiceModal && <PracticeModal practice={practiceModal} onClose={() => setPracticeModal(null)} />}
    </>
  );
}

/**
 * PracticeModal — Phase 8.3g v2 (Mashu 2026-07-28).
 * Click-through modal for the practice breakdown. Replaces
 * the previous inline drop-down.
 */
function PracticeModal({
  practice,
  onClose,
}: {
  practice: PracticeRow;
  onClose: () => void;
}) {
  // Use the same DetailModal used elsewhere for consistency.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Practice breakdown: ${practice.practice}`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Practice breakdown
            </p>
            <p className="mt-0.5 text-base font-semibold capitalize">
              {practice.practice}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <BreakdownView practice={practice} />
        </div>
      </div>
    </div>
  );
}

function PracticeColumn({
  attr,
  rows,
  proficient,
  bestTotal,
  onOpen,
  colSpan,
}: {
  attr: "PHYSICAL" | "MENTAL" | "MAGICAL";
  rows: PracticeRow[];
  proficient: boolean;
  bestTotal: number;
  /**
   * Phase 8.3g v2: when set, clicking a practice row
   * invokes this with the row data. The parent
   * PracticesPanel opens a modal with the breakdown
   * (replaces the previous inline drop-down).
   */
  onOpen: (p: PracticeRow) => void;
  colSpan?: number;
}) {
  return (
    <div
      className={cn(
        "bg-card p-2",
        colSpan === 2 && "col-span-2",
      )}
    >
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
            // Mashu 2026-07-27: 'all of them have to start with
            // big letters.' Transform the practice name to
            // capitalize the first letter manually as a backup
            // to the CSS class (some browsers / contexts may
            // strip CSS transforms).
            const displayName =
              p.practice.length > 0
                ? p.practice.charAt(0).toUpperCase() + p.practice.slice(1)
                : p.practice;
            return (
              <li key={p.practice}>
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  // Phase 8.3g v4 (Mashu 2026-07-28):
                  // "in the practices card make the
                  // proficient practices text teal (not
                  // BG, not the name, just the modifiers)."
                  // Only the modifier number goes teal
                  // when the column is proficient. Name
                  // + background stay regular.
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{displayName}</span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                      proficient
                        ? "text-teal-700 dark:text-teal-200"
                        : "text-foreground"
                    }`}
                  >
                    {p.total >= 0 ? "+" : ""}
                    {p.total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
/**
 * BreakdownView — shows the practice total in plain language.
 * Phase 8.3g v3 (Mashu 2026-07-28): rewrote the labels
 * so they're self-explanatory. The old "Slice (attr) +1"
 * left the user confused about why Prowess was +2 instead
 * of +5. The new labels explain each piece:
 *
 *   Slice (your share)   +2   — your share of the PHYS+5 attribute
 *                                 (spread across 3 PHYS practices: 2+2+1)
 *   Proficiency           0   — you don't have PHYS as your proficient
 *                                 attribute, so no PB bonus
 *   + Prim primitives   +0    — sum of primitive contributions
 *   ────────────────────────
 *   = Total              +2
 *
 * The user asked: "Now it makes no sense what is slice
 * (attr) and why +2???". The answer is in the new label
 * ("Slice (your share)") and the explanation text below.
 */
function BreakdownView({ practice }: { practice: PracticeRow }) {
  const sliceNote =
    practice.slice > 0
      ? `your share of ${practice.attribute} +${practice.slice} (spread across that attribute's practices)`
      : practice.slice < 0
        ? `your share of ${practice.attribute} ${practice.slice}`
        : `${practice.attribute} attribute is +0`;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold capitalize">{practice.practice}</span>
        <span className="font-mono text-base font-bold tabular-nums">
          {practice.total >= 0 ? "+" : ""}
          {practice.total}
        </span>
      </div>
      <BreakdownRow
        label="Slice (your share)"
        value={practice.slice}
        subtitle={sliceNote}
      />
      <BreakdownRow
        label="Proficiency bonus"
        value={practice.pbContribution}
        subdued={practice.pbContribution === 0}
        subtitle={
          practice.pbContribution > 0
            ? `${practice.attribute} is your proficient attribute`
            : `${practice.attribute} is NOT your proficient attribute`
        }
      />
      {practice.primitiveContributions.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-border/50 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Primitive contributions
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
            No proficiency, no primitive bonuses. The total is just your
            share of the attribute.
          </p>
        )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  subdued,
  subtitle,
}: {
  label: string;
  value: number;
  subdued?: boolean;
  subtitle?: string;
}) {
  return (
    <div className={subdued ? "text-muted-foreground" : ""}>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono font-bold">
          {value >= 0 ? "+" : ""}
          {value}
        </span>
      </div>
      {subtitle && (
        <p className="mt-0.5 text-[10px] italic text-muted-foreground">
          {subtitle}
        </p>
      )}
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
  heritageLinks,
  capabilities,
  primitiveLinks,
  heritageById,
  capabilityById,
  effectById,
  // Phase 8.5 / Session H6 round 7 (Mashu
  // 2026-08-03): forwarded so HeritageKindAccordion
  // → HeritageBundleView can render the header
  // SlotSourceBadge with the slot's versionId
  // + the heritage's latestVersionId (so the
  // "update available" stale pill lights up
  // when needed).
  latestVersions,
}: {
  characterId: string;
  heritageLinks: Array<{
    heritageId: string;
    acquiredAtLevel: number;
    isMirrored: boolean;
    // Phase 8.5 / Session H6 round 7: forwarded
    // from character_heritages so the
    // HeritageBundleView header can render
    // "Pinned v:XXXX" instead of "Pinned".
    versionId?: string | null;
    slotSource?: SlotSource | null;
    heritage: {
      id: string;
      name: string;
      kind: string;
      description: string | null;
      // Phase 8.4 v3 (Mashu 2026-07-28): canonical bundle from
      // the heritage template. Rendered in the Capabilities tab's
      // "By Heritage" section so the user sees what each heritage
      // provides (capabilities + primitives bundled together).
      capabilityLinks: Array<{
        capabilityId: string;
        capability: {
          id: string;
          name: string;
          type: string;
          sourceType: string;
          verboseDescription: string;
        };
      }>;
      primitiveLinks: Array<{
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
    };
  }>;
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
    /**
     * Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab accordion
     * routing. Always present in CapabilitiesTab — the
     * sheet's caller maps `l.slotTab ?? "MANIFEST"` so
     * legacy pre-v24.6 rows get normalised.
     */
    slotTab: "LINEAGE" | "UPBRINGING" | "MANIFEST";
    tags?: string[];
    // Phase 8.4 v5 (Mashu 2026-07-28): effects belonging to
    // the underlying capability template. Nested under
    // each CapabilityCard.
    effectLinks: Array<{
      effectId: string;
      effect: {
        id: string;
        name: string;
        description: string;
      };
    }>;
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
      hardModifiers: readonly unknown[];
    };
  }>;
  heritageById: Map<string, { name: string; kind: string }>;
  capabilityById: Map<string, { name: string }>;
  effectById: Map<string, { name: string }>;
  // Phase 8.5 / Session H6 round 7: forwarded to
  // HeritageKindAccordion → HeritageBundleView so
  // the heritage header SlotSourceBadge can render
  // the slot's versionId + the latestVersionId
  // (drives the "update available" stale pill).
  latestVersions: Map<VersionKey, string>;
}) {  // Phase 8.4 v11 (Mashu 2026-07-28): deep transitive
  // closure — heritage → capability → primitive AND
  // heritage → capability → effect → primitive. Lazy-loaded
  // because depth-3+ Drizzle joins don't work in the page
  // API. See the hook definition for the full rationale.
  const deepPrimitives = useDeepPrimitiveClosure(heritageLinks);


  // Phase 8.4 v6 (Mashu 2026-07-28): the Primitives accordion
  // shows EVERY primitive the character has — slotted (direct)
  // AND inherited (from heritages). Direct entries link to
  // character_primitive_links; inherited entries fall back to
  // heritage.template.primitive_links. We dedupe by primitive.id
  // and tag each row with its origin so the user can see why a
  // specific primitive is on the sheet.
  type CombinedPrimitive = {
    primitiveId: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
      isMirrorable: boolean;
      mirrorBuCredit: number;
      narrativeRule: string | null;
      hardModifiers: readonly unknown[];
    };
    origin: "DIRECT" | { heritageId: string; heritageName: string; kind: string };
    /**
     * Phase 8.4 v11 (Mashu 2026-07-28): the full
     * provenance path "heritage → capability → effect"
     * for primitives that came in via a capability or
     * via a capability → effect. Used to render the
     * "via X > Y > Z" subtitle on the sheet (matches the
     * character-creation modal). Null for direct-slot
     * primitives.
     */
    provenancePath: string | null;
    isMirrored: boolean;
    // Phase 8.5 / Session H6 (Mashu 2026-08-03):
    // provenance fields surfaced to the primitive preview
    // card so it can render the same SlotSourceBadge +
    // View source / View version history buttons the
    // item card has.
    versionId?: string | null;
    slotSource?: SlotSource | null;
    latestVersionId?: string | null;
  };
  const allPrimitives: CombinedPrimitive[] = [];
  const seenPrimitiveIds = new Set<number>();
  for (const l of primitiveLinks) {
    if (seenPrimitiveIds.has(l.primitive.id)) continue;
    seenPrimitiveIds.add(l.primitive.id);
    // Phase 8.5 / Session H6 round 7 (Mashu
    // 2026-08-03): honor the per-row
    // origin_heritage_id / origin_capability_id /
    // origin_effect_id columns on character_primitives.
    // Pre-round-7 code hardcoded origin: "DIRECT"
    // for every direct-slotted primitive even when
    // the DB row had an origin_heritage_id set
    // (which happens because the same primitive
    // can be slotted via heritage-bundle and ALSO
    // appear as a top-level char_primitive row, or
    // because the slot was stamped with its origin
    // source during the heritage fork).
    const originHeritageId = l.originHeritageId ?? null;
    const originCapabilityId = l.originCapabilityId ?? null;
    const originEffectId = l.originEffectId ?? null;
    let origin: "DIRECT" | {
      heritageId: string;
      heritageName: string;
      kind: string;
    } = "DIRECT";
    let provenancePath: string | null = null;
    // Phase 8.L round 13: build the FULL inheritance chain
    // with accordion (slotTab) as the OUTERMOST prefix.
    // Per Mashu: "accordeon name if not direct primitive >
    // heritage name if nested in heritage > Capability > Effect"
    const chain: string[] = [];
    // Per Mashu round 13: chain order is accordion >
    // heritage > capability > effect.
    // Accordion name comes from the capability's slotTab.
    const capLink = capabilityById.get(originCapabilityId ?? "") as unknown as { slotTab?: string | null } | undefined;
    if (capLink?.slotTab) {
      const label = capLink.slotTab.charAt(0) + capLink.slotTab.slice(1).toLowerCase();
      chain.push(label);
    }
    if (originHeritageId) {
      const h = heritageById.get(originHeritageId);
      if (h) {
        chain.push(h.name);
        origin = {
          heritageId: originHeritageId,
          heritageName: h.name,
          kind: h.kind,
        };
      }
    }
    if (originCapabilityId) {
      const cap = capabilityById.get(originCapabilityId);
      if (cap) chain.push(cap.name);
    }
    if (originEffectId) {
      const e = effectById.get(originEffectId);
      if (e) chain.push(e.name);
    }
    if (chain.length > 0) provenancePath = chain.join(" › ");
    allPrimitives.push({
      primitiveId: l.primitiveId,
      primitive: l.primitive,
      origin,
      provenancePath,
      isMirrored: l.isMirrored,
      // Phase 8.5 / Session H6 (Mashu 2026-08-03):
      // surface the slot's provenance to the preview card.
      // heritage / deep-closure paths below don't carry
      // their own character-level provenance (the slot is
      // effectively inherited, so the badge would say
      // "inherited" anyway); those just leave the
      // fields undefined.
      versionId: l.versionId,
      slotSource: l.slotSource,
      latestVersionId: l.latestVersionId,
    });
  }
  for (const hl of heritageLinks) {
    for (const pl of hl.heritage.primitiveLinks) {
      if (seenPrimitiveIds.has(pl.primitive.id)) continue;
      seenPrimitiveIds.add(pl.primitive.id);
      const h = hl.heritage;
      allPrimitives.push({
        primitiveId: pl.primitiveId,
        primitive: pl.primitive,
        origin: {
          heritageId: h.id,
          heritageName: h.name,
          kind: h.kind,
        },
        provenancePath: h.name,
        isMirrored: false,
      });
    }
  }
  // Phase 8.4 v11 (Mashu 2026-07-28): deep transitive
  // closure — primitives from heritage → capability
  // and heritage → capability → effect. Lazy-loaded
  // via useDeepPrimitiveClosure. Tagged so the user can
  // see why each primitive is on the sheet.
  const deepPrimEntries = Array.from(deepPrimitives.values());
  for (const dp of deepPrimEntries) {
    if (seenPrimitiveIds.has(dp.primitive.id)) continue;
    seenPrimitiveIds.add(dp.primitive.id);
    const h = heritageLinks.find(
      (hl) => hl.heritageId === dp.heritageId,
    )?.heritage;
    allPrimitives.push({
      primitiveId: dp.primitive.id,
      primitive: dp.primitive,
      origin: {
        heritageId: dp.heritageId,
        heritageName: h?.name ?? "—",
        kind: h?.kind ?? "—",
      },
      provenancePath: dp.sourceEffectId
        ? `${h?.name ?? "—"} → ${capabilityById.get(dp.sourceCapabilityId)?.name ?? dp.sourceCapabilityId} → ${effectById.get(dp.sourceEffectId)?.name ?? dp.sourceEffectId}`
        : `${h?.name ?? "—"} → ${capabilityById.get(dp.sourceCapabilityId)?.name ?? dp.sourceCapabilityId}`,
      isMirrored: false,
    });
  }

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
      {/* ===== Accordion 1: Primitives =====
          Phase 8.4 v6 (Mashu 2026-07-28): now shows EVERY
          primitive the character has — direct (slotted) AND
          inherited (from heritage templates). Direct rows
          first, then by heritage kind (Manifest → Lineage →
          Upbringing), then alphabetical.
          Each row can be expanded to reveal:
            - Provenance chain (heritage → capability → effect)
            - hardModifiers (target, operation, value, condition)
            - Mirror status + mirrorBuCredit
          Tags differentiate slotted vs inherited. */}
      <details open className="group rounded-md border border-border bg-card">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium cursor-pointer list-none">
          <span className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            Primitives ({allPrimitives.length})
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-3 space-y-1.5 border-t border-border">
          {allPrimitives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No primitives slotted or inherited.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allPrimitives
                .slice()
                .sort((a, b) => {
                  const aDirect = a.origin === "DIRECT" ? 0 : 1;
                  const bDirect = b.origin === "DIRECT" ? 0 : 1;
                  if (aDirect !== bDirect) return aDirect - bDirect;
                  const aKind = a.origin === "DIRECT" ? "DIRECT" : a.origin.kind;
                  const bKind = b.origin === "DIRECT" ? "DIRECT" : b.origin.kind;
                  const kindOrder: Record<string, number> = {
                    MANIFEST: 0,
                    LINEAGE: 1,
                    UPBRINGING: 2,
                    DIRECT: 3,
                    ZZZ: 4,
                  };
                  const aOrder = kindOrder[aKind] ?? 5;
                  const bOrder = kindOrder[bKind] ?? 5;
                  if (aOrder !== bOrder) return aOrder - bOrder;
                  return a.primitive.name.localeCompare(b.primitive.name);
                })
                .map((p) => {
                  const isInherited = p.origin !== "DIRECT";
                  const heritageName = isInherited && typeof p.origin === "object" ? p.origin.heritageName : null;
                  const heritageKind = isInherited && typeof p.origin === "object" ? p.origin.kind : null;
                  return (
                    <li key={p.primitive.id}>
                      <PrimitivePreviewCard
                        primitiveLink={{
                          primitiveId: p.primitiveId,
                          source: isInherited
                            ? `inherited:${heritageKind}`
                            : "slotted",
                          acquiredAtLevel: 0,
                          isMirrored: p.isMirrored,
                          // Phase 8.5 / Session H6 (Mashu
                          // 2026-08-03): forward the
                          // provenance fields through to the
                          // preview card so it can render
                          // SlotSourceBadge + View source /
                          // View version history buttons
                          // (matching the item card).
                          versionId: p.versionId ?? null,
                          slotSource: p.slotSource ?? null,
                          latestVersionId: p.latestVersionId ?? null,
                          primitive: {
                            id: p.primitive.id,
                            name: p.primitive.name,
                            category: p.primitive.category,
                            buCost: p.primitive.buCost,
                            isMirrorable: p.primitive.isMirrorable,
                            mirrorBuCredit: p.primitive.mirrorBuCredit,
                            narrativeRule: p.primitive.narrativeRule ?? "",
                            hardModifiers: p.primitive.hardModifiers,
                          },
                        }}
                        inheritedFrom={heritageName}
                        inheritedKind={heritageKind}
                        provenancePath={p.provenancePath}
                      />
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </details>

      {/* ===== Accordion 2: Manifest (heritage kind = MANIFEST) =====
          Phase 8.3f S6 (Mashu 2026-07-28): the per-kind
          heritage accordion. Shows the canonical bundle
          (capabilities + primitives) for each heritage the
          character has slotted. Per the S6 spec: "Aura
          Detective should be under Manifest (its heritage
          kind), not floating in Capabilities section." */}
      <HeritageKindAccordion
        characterId={characterId}
        kind="MANIFEST"
        label="Manifest"
        icon={<Sparkles className="size-4 text-muted-foreground" />}
        heritageLinks={heritageLinks.filter(
          (hl) => hl.heritage.kind === "MANIFEST",
        )}
        capabilities={capabilities}
        primitiveLinks={primitiveLinks}
        latestVersions={latestVersions}
      />

      {/* ===== Accordion 3: Lineage (heritage kind = LINEAGE) ===== */}
      <HeritageKindAccordion
        characterId={characterId}
        kind="LINEAGE"
        label="Lineage"
        icon={<Flame className="size-4 text-muted-foreground" />}
        heritageLinks={heritageLinks.filter(
          (hl) => hl.heritage.kind === "LINEAGE",
        )}
        capabilities={capabilities}
        primitiveLinks={primitiveLinks}
        latestVersions={latestVersions}
      />

      {/* ===== Phase 8.K K1 fallback: 0-heritage characters =====
          HeritageKindAccordion only renders when at least one heritage
          of that kind exists. For 0-heritage characters, render caps
          directly using a lightweight CapabilityCard. */}
      {heritageLinks.length === 0 && capabilities.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Capabilities (direct, no heritage)
          </p>
          {(["LINEAGE", "UPBRINGING", "MANIFEST"] as const).map((tab) => {
            const capsInTab = capabilities.filter((c) => c.slotTab === tab);
            if (capsInTab.length === 0) return null;
            const labelMap = { LINEAGE: "Lineage", UPBRINGING: "Upbringing", MANIFEST: "Manifest" };
            return (
              <details key={tab} open className="group rounded-md border border-border bg-card">
                <summary className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium cursor-pointer list-none">
                  <span className="flex items-center gap-2">
                    <Swords className="size-4 text-muted-foreground" />
                    {labelMap[tab]} ({capsInTab.length})
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-3 space-y-2 border-t border-border">
                  {capsInTab.map((c) => (
                    <CapabilityCard
                      key={c.id}
                      characterId={characterId}
                      capability={{
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        sourceType: c.sourceType,
                        acquiredAtLevel: c.acquiredAtLevel,
                        verboseDescription: c.verboseDescription,
                        versionId: c.versionId,
                        slotSource: c.slotSource,
                        latestVersionId: c.latestVersionId,
                      }}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* ===== Accordion 4: Upbringing (heritage kind = UPBRINGING) ===== */}
      <HeritageKindAccordion
        characterId={characterId}
        kind="UPBRINGING"
        label="Upbringing"
        icon={<BookOpen className="size-4 text-muted-foreground" />}
        heritageLinks={heritageLinks.filter(
          (hl) => hl.heritage.kind === "UPBRINGING",
        )}
        capabilities={capabilities}
        primitiveLinks={primitiveLinks}
        latestVersions={latestVersions}
      />
    </div>
  );
}

/**
 * HeritageKindAccordion — Phase 8.3f S6 (Mashu 2026-07-28)
 *
 * Phase 8.4 v24 (Mashu 2026-07-29): T4 restructure —
 * changed from "one accordion per heritage kind" to
 * "one accordion per heritage, with the direct-cap card
 * underneath". Each heritage becomes its own accordion
 * that contains:
 *   1. The heritage card (its canonical bundle).
 *   2. The "direct capabilities" card (caps the
 *      character slotted from the manifest tab that
 *      do NOT come from a heritage — i.e. the
 *      character's own personal cap choices).
 *
 * Why per-heritage: when a character has multiple
 * heritages of the same kind (e.g. two MANIFEST
 * heritages), the old group-by-kind accordion buried
 * the direct caps under the kind label, making it
 * unclear which heritage a cap belonged to. Per-heritage
 * accordions make the relationship explicit.
 *
 * Empty-state behaviour preserved: if no heritages of
 * this kind exist, the entire accordion is omitted
 * (the wrapping conditional lives in the parent).
 */
function HeritageKindAccordion({
  characterId,
  kind,
  label,
  icon,
  heritageLinks,
  capabilities,
  primitiveLinks,
  // Phase 8.5 / Session H6 round 7: forwarded
  // to HeritageBundleView so the SlotSourceBadge
  // can render "update available" when the
  // heritage has been re-published since the
  // character slotted it.
  latestVersions,
}: {
  characterId: string;
  kind: "MANIFEST" | "LINEAGE" | "UPBRINGING";
  label: string;
  icon: React.ReactNode;
  heritageLinks: Array<{
    heritageId: string;
    acquiredAtLevel: number;
    isMirrored: boolean;
    // Phase 8.5 / Session H6 round 7 (Mashu
    // 2026-08-03): forwarded so HeritageBundleView
    // can render the SlotSourceBadge with a real
    // version number.
    versionId?: string | null;
    slotSource?: SlotSource | null;
    heritage: {
      id: string;
      name: string;
      kind: string;
      description: string | null;
      capabilityLinks: Array<{
        capabilityId: string;
        capability: {
          id: string;
          name: string;
          type: string;
          sourceType: string;
          verboseDescription: string;
        };
      }>;
      primitiveLinks: Array<{
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
    };
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
    verboseDescription: string | null;
    originHeritageId: string | null;
    /**
     * Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab accordion
     * routing for DIRECT caps. Heritage-bundled caps have
     * originHeritageId set; they inherit their tab from the
     * heritage's kind. Direct caps read this column to know
     * which accordion (LINEAGE / UPBRINGING / MANIFEST) to
     * render under. The sheet's caller always normalises
     * null → "MANIFEST" for legacy rows, so this can be a
     * strict string here.
     */
    slotTab: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  }>;
  primitiveLinks: Array<{ primitive: { id: number }; originHeritageId: string | null }>;
  // Phase 8.5 / Session H6 round 7: forwarded to
  // HeritageBundleView so the SlotSourceBadge can
  // render the latest published version id and the
  // "update available" stale pill.
  latestVersions: Map<VersionKey, string>;
}) {
  void kind; // unused at runtime; kept for type clarity

  // Phase 8.4 v24 (Mashu 2026-07-29): T4 — group direct
  // caps (originHeritageId === null) by their kind so we
  // can attach them to the right accordion. Phase 8.4
  // v24.6: respect slotTab — caps slotted via the LINEAGE
  // tab render in LINEAGE, etc. Caps without slotTab
  // (legacy rows pre-v24.6) default to MANIFEST.
  const directCapsForKind = capabilities.filter(
    (c) =>
      (c.originHeritageId === null || c.originHeritageId === undefined) &&
      (c.slotTab === kind ||
        (c.slotTab === null && kind === "MANIFEST")),
  );

  return (
    <details className="group rounded-md border border-border bg-card">
      <summary className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium cursor-pointer list-none">
        <span className="flex items-center gap-2">
          {icon}
          {label} ({heritageLinks.length + directCapsForKind.length})
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-3 space-y-4 border-t border-border">
        {heritageLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No {label.toLowerCase()} heritages slotted yet. Click the button on any heritage in /atelier and choose "Slot into {label}" to add one.
          </p>
        ) : null}
        {heritageLinks.map((hl) => {
          const canonCaps = hl.heritage.capabilityLinks ?? [];
          const canonPrims = hl.heritage.primitiveLinks ?? [];
          const slottedCapIds = new Set(
            capabilities
              .filter((c) => c.originHeritageId === hl.heritageId)
              .map((c) => c.id),
          );
          const slottedPrimIds = new Set(
            primitiveLinks
              .filter((p) => p.originHeritageId === hl.heritageId)
              .map((p) => p.primitive.id),
          );
          return (
            <HeritageBundleView
              key={hl.heritageId}
              characterId={characterId}
              heritageId={hl.heritageId}
              heritageName={hl.heritage.name}
              heritageKindLabel={label}
              // Phase 8.5 / Session H6 round 8 (Mashu
              // 2026-08-03): pass the raw heritage kind
              // so the component can build the canonical
              // library composite id
              // (`<KIND>_TEMPLATE:<id>`) for the
              // "View source" / "View version history"
              // links. Without this, the links go to
              // `/atelier/heritage/<id>` which 404s.
              heritageKindRaw={hl.heritage.kind as "LINEAGE" | "UPBRINGING" | "MANIFEST"}
              heritageDescription={hl.heritage.description ?? null}
              isMirrored={hl.isMirrored ?? false}
              // Phase 8.5 / Session H6 round 7: surface
              // the slot's version + the heritage's
              // latest published version so the header
              // SlotSourceBadge renders "Pinned v:XXXX"
              // (and lights up the "update available"
              // pill when the heritage has been
              // re-published since Tessy slotted it).
              versionId={hl.versionId ?? null}
              slotSource={hl.slotSource ?? null}
              latestVersionId={latestVersions.get(makeVersionKey("heritage", hl.heritageId)) ?? null}
              // Phase 8.5 / Session H6 round 10 (Mashu
              // 2026-08-03): forward the bulk-resolved
              // latest-version map so the heritage
              // bundle's nested CAPABILITIES / EFFECTS
              // chips can render "Pinned v:XXXX" with
              // each entity's canonical version.
              latestVersions={latestVersions}
              canonCaps={canonCaps}
              canonPrims={canonPrims}
              slottedCapIds={slottedCapIds}
              slottedPrimIds={slottedPrimIds}
            />
          );
        })}
        {/* Phase 8.4 v24 (Mashu 2026-07-29): T4 — direct-cap
            card lives at the BOTTOM of the per-kind
            accordion. For MANIFEST only — direct
            personal caps conceptually belong to the
            character's manifest, not to their
            lineage/upbringing. */}
        {directCapsForKind.length > 0 && (
          <DirectCapabilitiesCard
            characterId={characterId}
            capabilities={directCapsForKind}
            latestVersions={latestVersions}
          />
        )}
      </div>
    </details>
  );
}

/**
 * DirectCapabilitiesCard — Phase 8.4 v24 (Mashu 2026-07-29)
 *
 * Read-only summary of capabilities the character
 * slotted from the manifest tab DIRECTLY (not via a
 * heritage). Per Mashu's T4 spec: "direct-cap card
 * goes UNDER manifest accordion".
 *
 * For the simple "list" view, this is a single card
 * at the bottom of the manifest accordion listing the
 * direct caps. When we move to per-heritage accordions
 * (which is the eventual goal), this card becomes the
 * "free-floating" section at the end of the heritage
 * cluster.
 */
function DirectCapabilitiesCard({
  characterId,
  capabilities,
  latestVersions,
}: {
  characterId: string;
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
    verboseDescription?: string | null;
    originHeritageId: string | null;
    /**
     * Phase 8.4 v24.8 (Mashu 2026-07-30): upgraded direct-cap
     * card to use the rich CapabilityCard shape so direct
     * caps render with the same UI affordances as caps slotted
     * via a heritage (effect accordion, toggle/trigger,
     * origin badge, etc.). Previously this was a slim
     * name+type list which Mashu called out: "capabilities
     * added personally in ch sheet need the same UI as the
     * other capabilities in the ch sheet from heritages."
     *
     * The CapabilitiesTab prop already has these fields
     * because it spreads `...l.capability` and forwards
     * `l.effectLinks`, `l.slotSource`, `l.versionId`, etc.
     * The filter inside HeritageKindAccordion doesn't strip
     * them, so we can hand the array straight to CapabilityCard.
     */
    acquiredAtLevel?: number;
    versionId?: string | null;
    slotSource?: unknown;
    latestVersionId?: string | null;
    effectLinks?: Array<{
      effectId: string;
      effect: {
        id: string;
        name: string;
        description: string;
      };
    }>;
    tags?: string[];
  }>;
  // Phase 8.5 / Session H6 round 11 (Mashu
  // 2026-08-03): forwarded so the cap's nested
  // EFFECTS chips can render "Pinned v:XXXX".
  latestVersions: Map<VersionKey, string>;
}) {
  if (capabilities.length === 0) return null;
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Direct capabilities ({capabilities.length})
      </div>
      <div className="mt-2 space-y-2">
        {capabilities.map((c) => (
          <CapabilityCard
            key={c.id}
            characterId={characterId}
            // Phase 8.4 v24.9 (Mashu 2026-07-30): explicit
            // false. CapabilityCard defaults showPrimitives
            // to true (it's used inside the modal builder
            // where the primitives accordion isn't shown
            // separately). On the character sheet, the
            // Primitives tab already shows every primitive
            // so the per-cap nested list is redundant — and
            // Mashu asked: "we don't need the primitives in
            // them." HeritageBundleView passes false
            // explicitly on the sheet (it sets the default
            // of showPrimitives when it instantiates
            // CapabilityCard for the bundle's caps).
            showPrimitives={false}
            // Phase 8.5 / Session H6 round 11 (Mashu
            // 2026-08-03): forwarded so the cap's
            // nested EFFECTS chips can render
            // "Pinned v:XXXX" instead of just "Pinned".
            latestVersions={latestVersions}
            capability={{
              id: c.id,
              name: c.name,
              type: c.type,
              sourceType: c.sourceType,
              acquiredAtLevel: c.acquiredAtLevel ?? 1,
              verboseDescription: c.verboseDescription ?? null,
              versionId: c.versionId ?? null,
              slotSource: (c.slotSource ?? null) as never,
              latestVersionId: c.latestVersionId ?? null,
              effectLinks: c.effectLinks ?? [],
            }}
          />
        ))}
      </div>
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
  // Phase 8.5 / Session H6 round 10 (Mashu
  // 2026-08-03): forwarded to each ItemCard so
  // the nested CAPABILITIES / EFFECTS /
  // PRIMITIVES chips can render "Pinned v:XXXX"
  // instead of just "Pinned".
  latestVersions,
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
    // Phase 8.4 v22 (Mashu 2026-07-29): T2 — item's nested
    // bundle so the sheet card can render primitives/caps/
    // effects per item.
    capabilityLinks: Array<{
      capabilityId: string;
      capability: {
        id: string;
        name: string;
        type: string;
        sourceType: string;
        verboseDescription: string;
        effectLinks: Array<{
          effectId: string;
          effect: { id: string; name: string; description: string };
        }>;
      };
    }>;
    effectLinks: Array<{
      effectId: string;
      effect: { id: string; name: string; description: string };
    }>;
    primitiveLinks: Array<{
      primitiveId: number;
      primitive: {
        id: number;
        name: string;
        category: string;
        buCost: number;
        isMirrorable: boolean;
        mirrorBuCredit: number;
        narrativeRule: string | null;
      };
    }>;
  }>;
  encumbrance: CharacterSheetProps["encumbrance"];
  latestVersions: Map<VersionKey, string>;
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
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => (
          <li key={i.id}>
            {/* Phase 8.2 batch 4: each item is now an interactive
                card with an equip/unequip toggle. The card owns
                its own optimistic state and dispatches the API.
                Phase 8.4 v22 (Mashu 2026-07-29): T2 — `nested`
                is the item's primitives/caps/effects bundle,
                rendered inline as collapsible accordions below
                the equip/preview row. Per Mashu's spec these
                are item-scoped (not in the character's general
                primitive pool). */}
            <ItemCard
              characterId={characterId}
              item={i}
              atCapacity={atCapacity}
              nested={{
                capabilityLinks: i.capabilityLinks,
                effectLinks: i.effectLinks,
                primitiveLinks: i.primitiveLinks,
              }}
              // Phase 8.5 / Session H6 round 10 (Mashu
              // 2026-08-03): forward the latest-version
              // map so the nested CAPABILITIES /
              // EFFECTS / PRIMITIVES chips render
              // "Pinned v:XXXX" instead of just "Pinned".
              latestVersions={latestVersions}
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
  characterId,
  logEntries,
}: {
  characterId: string;
  logEntries: Array<{
    id: number;
    kind: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  // Mashu 2026-07-28: fetch fresh log entries from
  // /api/characters/[id]/logs whenever this tab is
  // mounted. The page-level logEntries are passed in
  // as a fallback so the first render has data, but
  // we always re-fetch so new entries (capability
  // toggle / trigger, vitality change, rest, etc.)
  // appear without a page reload.
  const [entries, setEntries] = useState<
    Array<{
      id: number;
      kind: string;
      payload: Record<string, unknown>;
      createdAt: string;
    }>
  >(logEntries);
  const [loading, setLoading] = useState(false);
  // Mashu 2026-07-28: tick is bumped by the parent via a
  // refreshKey prop whenever a toggle/trigger happens, so
  // this tab re-fetches without the user switching tabs.
  // The mount-time fetch is the fallback.
  const [refreshKey, setRefreshKey] = useState(0);

  // Mashu 2026-07-28: re-fetch whenever the character-events
  // bus says a log entry was just added. CapabilityCard
  // emits `log_added` after a successful toggle / trigger,
  // so the user sees the new entry in History without
  // a full page reload.
  useEffect(() => {
    const unsub = onCharacterLogAdded(characterId, () => {
      setRefreshKey((n) => n + 1);
    });
    return unsub;
  }, [characterId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}/logs`);
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          entries: Array<{
            id: number;
            kind: string;
            payload: Record<string, unknown>;
            createdAt: string;
          }>;
        };
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId, refreshKey]);

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        {loading ? (
          <p className="text-[10px] text-muted-foreground">Loading history…</p>
        ) : null}
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
          <History className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No history yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Events appear here as you take damage, rest, level up, or
            use capabilities in play.
          </p>
        </div>
      </div>
    );
  }

  const filterOptions = Array.from(new Set(entries.map((e) => e.kind)));
  const filtered = filter
    ? entries.filter((e) => e.kind === filter)
    : entries;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            count={entries.length}
            active={filter === null}
            onClick={() => setFilter(null)}
          />
          {filterOptions.map((k) => (
            <FilterChip
              key={k}
              label={k.replace(/_/g, " ")}
              count={entries.filter((e) => e.kind === k).length}
              active={filter === k}
              onClick={() => setFilter(k)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="Re-fetch the latest log entries from the server"
        >
          <RotateCcw className="size-3" />
          Refresh
        </button>
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

// =============================================================================
// BuFormulaModal — Phase 8.4 v25 (Mashu 2026-07-30)
//
// Two-mode formula popup for the BU Budget footer.
//
//   mode = "budget" → explains how Lifetime BU is computed
//                      (25 + 10×(L-1) + Progression Spikes) +
//                      the spike table + soft-cap warning +
//                      DM bonus section.
//
//   mode = "debt"   → explains how the volatility ceiling is
//                      computed (bracket-based, NOT cumulative) +
//                      cascade rule (BU fills first, then debt)
//                      + DM bonus interaction.
//
// Both popups use the shared FormulaModal component so the
// structure stays consistent with every other formula popup in
// the system.
// =============================================================================

const PROGRESSION_SPIKES = [
  { level: 4, spike: 4 },
  { level: 8, spike: 8 },
  { level: 12, spike: 12 },
  { level: 16, spike: 16 },
  { level: 20, spike: 20 },
] as const;

const VOLATILITY_BRACKETS = [
  { label: "L1", minLevel: 1, maxLevel: 1, ceiling: 0 },
  { label: "L2-L4", minLevel: 2, maxLevel: 4, ceiling: 8 },
  { label: "L5-L8", minLevel: 5, maxLevel: 8, ceiling: 16 },
  { label: "L9-L12", minLevel: 9, maxLevel: 12, ceiling: 24 },
  { label: "L13-L16", minLevel: 13, maxLevel: 16, ceiling: 32 },
  { label: "L17-L20", minLevel: 17, maxLevel: 20, ceiling: 40 },
] as const;

function spikesUpToLevel(level: number): number {
  if (level < 4) return 0;
  const k = Math.floor(level / 4);
  return 4 * (k * (k + 1)) / 2;
}

function BuFormulaModal({
  mode,
  level,
  dmBonusBu,
  itemBuSpent,
  volatilityRating,
  volatilityCeiling,
  volatilityRemaining,
  levelBracket,
  mirroredPrimitives,
  onClose,
}: {
  readonly mode: "budget" | "debt";
  readonly level: number;
  readonly dmBonusBu: number;
  readonly itemBuSpent: number;
  readonly volatilityRating: number;
  readonly volatilityCeiling: number;
  readonly volatilityRemaining: number;
  readonly levelBracket:
    | "L1-L4"
    | "L5-L8"
    | "L9-L12"
    | "L13-L16"
    | "L17-L20"
    | "L21-L24"
    | "L25-L28"
    | "L29+";
  readonly mirroredPrimitives: ReadonlyArray<{
    id: number;
    name: string;
    mirrorBuCredit: number;
    acquiredAtLevel: number;
  }>;
  readonly onClose: () => void;
}) {
  const spikesTotal = spikesUpToLevel(level);
  const baseBu = 25 + 10 * (level - 1);
  const lifetimeBu = baseBu + spikesTotal;

  if (mode === "budget") {
    // Build the provenance chain for the budget popup.
    const breakdown: FormulaStep[] = [
      { label: "L1 base", value: 25 },
      { label: `+10 BU × ${level - 1} levels`, value: 10 * (level - 1) },
      { label: `Progression Spikes (Σ)`, value: spikesTotal },
      { label: `= Lifetime BU (L${level})`, value: lifetimeBu },
    ];

    return (
      <FormulaModal
        title="BU Budget"
        subtitle={`Level ${level} character`}
        total={lifetimeBu}
        formula="Lifetime BU = 25 + 10×(Level − 1) + Σ Progression Spikes"
        breakdown={breakdown}
        info={{
          title: "Progression Spikes + Soft cap + DM Bonus",
          body: (
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left font-semibold uppercase">Level</th>
                    <th className="py-1 text-right font-semibold uppercase">Spike</th>
                    <th className="py-1 text-right font-semibold uppercase">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {PROGRESSION_SPIKES.map((s) => {
                    const cum =
                      s.spike *
                      ((s.spike / 4) * (s.spike / 4 + 1)) /
                      2;
                    const reached = level >= s.level;
                    return (
                      <tr
                        key={s.level}
                        className={reached ? "bg-teal-500/10" : ""}
                      >
                        <td className="py-0.5">L{s.level}</td>
                        <td className="py-0.5 text-right tabular-nums">
                          +{s.spike} BU
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {cum} BU
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted-foreground">
                A progression spike fires every 4 levels (L4, L8, L12, L16,
                L20…). The spike value equals the level itself — L4 = +4 BU,
                L8 = +8 BU, etc. Formula:{" "}
                <span className="font-mono text-foreground">
                  Σ(4k) for k = 1..⌊L/4⌋
                </span>
                .
              </p>

              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">Soft cap, not hard cap:</strong>{" "}
                the lifetime BU shown above is a <em>suggested</em> budget, not
                a hard limit. You can spend BU mid-session to enable
                primitives on-the-fly (e.g. a Tier 1 Light domain = 4 BU).
                The BU bar turns <strong className="text-destructive">red</strong>{" "}
                when you exceed it — that's a heads-up, not a blocker. The DM
                decides whether to allow the over-spend.
              </p>

              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">DM Bonus BU:</strong>{" "}
                the DM can grant additional BU outside your lifetime pool.
                DM bonus is shown separately on the footer (it does NOT count
                toward your lifetime cap). The DM uses it to{" "}
                <strong className="text-foreground">reward narrative
                milestones</strong> (boss defeats, story arcs, exceptional roleplay)
                — granting you +N BU to spend immediately or bank for later.
                DM bonus is a gift, not a debt: it never has to be repaid.
              </p>

              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">Item BU</strong> (
                {itemBuSpent} spent) is tracked separately from progression BU.
                Items bring their own nested primitives with them, and those
                primitives don't deduct from your lifetime pool — they're
                "taken for granted" with the item. Spending an item therefore
                doesn't count against progression.
              </p>
            </div>
          ),
        }}
        onClose={onClose}
      />
    );
  }

  // mode === "debt"
  const debtBreakdown: FormulaStep[] = [
    {
      label: "Mirror primitives (Σ credits)",
      value: -volatilityRating,
    },
    {
      label: `Bracket ceiling (${levelBracket})`,
      value: -volatilityCeiling,
    },
    {
      label: `= Headroom (L${level})`,
      value: -volatilityRemaining,
    },
  ];

  return (
    <FormulaModal
      title="Volatility / Debt"
      subtitle={`Mirror-debt bracket for ${levelBracket}`}
      total={-volatilityRating}
      formula="Volatility = Σ mirror primitive credits (negative). Ceiling = bracket-based."
      breakdown={debtBreakdown}
      info={{
        title: "Cascade rule + Bracket ceiling",
        body: (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">
              <strong className="text-foreground">Cascade rule:</strong> when
              you slot a primitive, the engine first tries to deduct from
              your <strong className="text-foreground">available BU budget</strong>.
              Once your available BU is zero, additional slots overflow into{" "}
              <strong className="text-foreground">mirror debt</strong>. Going
              into debt is allowed up to your bracket ceiling — beyond that,
              the DM must intervene.
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              <strong className="text-foreground">What counts as debt?</strong>{" "}
              Every primitive you <em>mirrored</em> contributes its{" "}
              <span className="font-mono text-foreground">mirrorBuCredit</span>{" "}
              (negative BU) to your total. The engine adds the same amount as
              positive expansion to your available pool, so the net cost is
              zero — but the volatility tracking remains so you can audit how
              much of your build is built on debt.
            </p>
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1 text-left font-semibold uppercase">
                    Bracket
                  </th>
                  <th className="py-1 text-right font-semibold uppercase">
                    Max Mirror Debt
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {VOLATILITY_BRACKETS.map((b) => {
                  const reached = level >= b.minLevel && level <= b.maxLevel;
                  return (
                    <tr
                      key={b.label}
                      className={reached ? "bg-teal-500/10" : ""}
                    >
                      <td className="py-0.5">{b.label}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        -{b.ceiling} BU
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">
              L1 has zero debt capacity (no mirrors allowed at character
              creation). Each subsequent 4-level bracket doubles the
              allowance. Debt ceilings are <strong className="text-foreground">bracket-based</strong>,
              not cumulative — exceeding your bracket means the DM must
              remove mirrors or grant a respec.
            </p>
            {mirroredPrimitives.length > 0 && (
              <>
                <p className="mt-3 text-[11px] font-semibold text-foreground">
                  Your mirrored primitives:
                </p>
                <ul className="mt-1 space-y-1 text-[11px]">
                  {mirroredPrimitives.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded border border-border bg-background/40 px-2 py-1"
                    >
                      <span>{p.name}</span>
                      <span className="font-mono text-muted-foreground">
                        -{p.mirrorBuCredit} BU @L{p.acquiredAtLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ),
      }}
      onClose={onClose}
    />
  );
}
