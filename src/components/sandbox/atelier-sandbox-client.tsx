"use client";

// /sandbox/atelier — unified sandbox client.
//
// One route, one 3-column layout (library / build / preview), with a
// bottom tab bar of 6 build modes:
//   Mechanics:  primitive | effect | capability
//   Heritage:   template (race / background / archetype)
//   Items:      item
//   Monsters:   monster (placeholder — no form/schema yet)
//
// This merges the previous grammar-sandbox-client (primitive/effect/
// capability) and blueprint-sandbox-client (template/item/monster) into a
// single client so the page shares one SandboxLayout, one dirty-guard, one
// dispatch pipeline, and one mobile split behaviour.
//
// Mobile split-screen contract (must NOT regress):
//   - On desktop/tablet the build form is mounted inline in the middle
//     column; the build/preview DRAWER must never open there (mobile only).
//   - On mobile the build + preview live in the bottom split panel; the
//     drawer is only used off-split. openDrawer("build") is gated behind
//     useIsMobile() everywhere.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SandboxLayout } from "./sandbox-layout";
import { PrimitiveForm } from "./primitive-form";
import { PrimitiveFormPreview } from "./primitive-form-preview";
import { EffectForm } from "./effect-form";
import { EffectFormPreview } from "./effect-form-preview";
import { CapabilityForm } from "./capability-form";
import { CapabilityFormPreview } from "./capability-form-preview";
import { TemplateForm } from "./template-form";
import { TemplateFormPreview } from "./template-form-preview";
import { ItemForm } from "./item-form";
import { ItemFormPreview } from "./item-form-preview";
import { GrammarLibrary } from "./grammar-library";
import { BlueprintLibrary } from "./blueprint-library";
import { UnsavedChangesModal } from "./unsaved-changes-modal";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useIsDark } from "@/lib/hooks/use-is-dark";
import { IconDisplay } from "@/components/icons/icon-display";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { SaveIntent } from "@/lib/publishing/save-intent";
import type { ModifierDraft } from "./primitive-form-preview";

export type AtelierTab =
  | "mechanics"
  | "template"
  | "item"
  | "monster";

// Concrete library entity kinds (used for load/select; the Mechanics tab
// groups primitive/effect/capability under one tab).
export type AtelierEntityKind =
  | "primitive"
  | "effect"
  | "capability"
  | "template"
  | "item";

// Map a concrete entity kind to its tab (Mechanics groups the three
// mechanics kinds under one tab).
function tabForKind(kind: AtelierEntityKind): AtelierTab {
  if (kind === "primitive" || kind === "effect" || kind === "capability")
    return "mechanics";
  return kind;
}

// ---------------------------------------------------------------------------
// Row shapes (merged from the two legacy clients).
// ---------------------------------------------------------------------------

type PrimitiveRow = {
  id: number;
  userId?: string | null;
  name: string;
  category: string;
  isPublic: boolean;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: unknown;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

type EffectRow = {
  id: string;
  userId?: string | null;
  name: string;
  narrativeDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    isMirrored?: boolean;
    primitive: { id: number; name: string; category: string; buCost: number };
  }>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

type CapabilityRow = {
  id: string;
  userId?: string | null;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    role: string;
    quantity: number;
    sortOrder: number;
    slotLabel: string | null;
    isMirrored?: boolean;
    primitive: { id: number; name: string; category: string; buCost: number };
  }>;
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: { id: string; name: string; narrativeDescription: string | null; sourceOrigin: string | null };
  }>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

type TemplateRow = {
  id: string;
  userId?: string | null;
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: { id: string; name: string; type: string; primitiveLinks?: Array<{ primitiveId: number; primitive: { id: number; name: string; category: string; buCost: number } }> };
  }>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

type ItemRow = {
  id: string;
  userId?: string | null;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  }>;
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: { id: string; name: string; narrativeDescription: string | null; primitiveLinks?: Array<{ primitiveId: number; quantity: number; primitive: { id: number; name: string; category: string; buCost: number } }> };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    capability: { id: string; name: string; type: string; primitiveLinks?: Array<{ primitiveId: number; primitive: { id: number; name: string; category: string; buCost: number } }> };
  }>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

type EditingState =
  | { kind: "primitive"; row: PrimitiveRow }
  | { kind: "effect"; row: EffectRow }
  | { kind: "capability"; row: CapabilityRow }
  | { kind: "template"; row: TemplateRow }
  | { kind: "item"; row: ItemRow }
  | null;

type PendingAction =
  | { kind: "switchBuild"; mode: AtelierTab }
  | { kind: "loadFromLibrary"; entityType: AtelierEntityKind; id: string | number };

export function AtelierSandboxClient({
  initialBuild,
  initialKind,
  initialEditing,
  initialIntent,
  initialSourceId,
  // Deep-linked mechanics sub-kind (primitive/effect/capability) so a
  // fresh /sandbox/atelier?build=effect opens the Effect form blank.
  initialMechanicsKind = "primitive",
  dataLoadFailed = false,
  primitives,
  effects,
  capabilities,
  templates,
  items,
  sandboxPrimitives,
  sandboxCapabilities,
  libraryItems,
  primitiveCategories,
  engagement,
  currentUserInternalId,
  versionMap,
}: {
  initialBuild: AtelierTab;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
  initialEditing: EditingState;
  initialIntent?: SaveIntent;
  initialSourceId?: string | null;
  initialMechanicsKind?: "primitive" | "effect" | "capability";
  dataLoadFailed?: boolean;
  primitives: PrimitiveRow[];
  effects: EffectRow[];
  capabilities: CapabilityRow[];
  templates: TemplateRow[];
  items: ItemRow[];
  sandboxPrimitives: import("@/components/library/library-item-preview").SandboxPrimitiveRow[];
  sandboxCapabilities: import("@/components/library/library-item-preview").SandboxCapabilityRow[];
  libraryItems: LibraryItem[];
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  engagement: { reactions: Record<string, "LIKE" | "DISLIKE" | null>; following: Record<string, boolean> };
  currentUserInternalId: string | null;
  versionMap?: Record<string, number>;
}) {
  const [build, setBuild] = useState<AtelierTab>(initialBuild);
  const [editing, setEditing] = useState<EditingState>(initialEditing);
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [buildStarted, setBuildStarted] = useState(initialEditing !== null);
  const [formSnapshot, setFormSnapshot] = useState<{
    form: Record<string, unknown>;
    slots: unknown[];
    effectIds: string[];
    primitiveIds: string[];
    mirroredPrimitiveIds: number[];
    capabilityIds: string[];
    modifiers: ModifierDraft[];
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [templateKind, setTemplateKind] = useState<
    "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined
  >(initialKind);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mechanicsDraftKind, setMechanicsDraftKind] = useState<
    "primitive" | "effect" | "capability"
  >(initialMechanicsKind);
  // Per-tab form-state cache so switching tabs never discards what you
  // were building (Point 5). Keyed by tab; each entry snapshots the
  // editing state + draft-kind selectors for that tab.
  type TabCacheEntry = {
    editing: EditingState;
    formSnapshot: typeof formSnapshot;
    mechanicsDraftKind: "primitive" | "effect" | "capability";
    templateKind: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
    buildStarted: boolean;
  };
  const [tabCache, setTabCache] = useState<Partial<Record<AtelierTab, TabCacheEntry>>>({});
  const tabCacheRef = useRef(tabCache);
  tabCacheRef.current = tabCache;
  const modalDescRef = useRef<string | undefined>(undefined);

  const { setSandboxFormDirty, openDrawer, sandboxSplit, setSandboxBottomTab } =
    useGlobalControls();
  const isMobile = useIsMobile();
  const isDark = useIsDark();

  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();

  useEffect(() => {
    setBuild(initialBuild);
  }, [initialBuild]);
  useEffect(() => {
    setEditing(initialEditing);
  }, [initialEditing]);

  useEffect(() => {
    setSandboxFormDirty(formIsDirty || editing !== null);
  }, [formIsDirty, editing, setSandboxFormDirty]);

  // Listen for the FAB "Build & Preview" action: when the build column is
  // empty, surface the new-entity chooser (Point 4). The FAB dispatches a
  // window event because it lives outside this client.
  useEffect(() => {
    function onOpenNew() {
      setShowNewModal(true);
    }
    window.addEventListener("sw-open-new-entity", onOpenNew);
    return () => window.removeEventListener("sw-open-new-entity", onOpenNew);
  }, []);

  // Auto-open build panel on server-routed loads (?edit=<id>) — mobile only.
  useEffect(() => {
    if (initialEditing === null) return;
    if (!isMobile) return;
    if (sandboxSplit) {
      setSandboxBottomTab("build");
    } else {
      openDrawer("build");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditing, sandboxSplit, openDrawer, setSandboxBottomTab, isMobile]);

  const openBuildPanel = useCallback(() => {
    if (!isMobile) return;
    if (sandboxSplit) {
      setSandboxBottomTab("build");
    } else {
      openDrawer("build");
    }
  }, [isMobile, sandboxSplit, openDrawer, setSandboxBottomTab]);

  const applyPendingAction = useCallback(
    (action: PendingAction) => {
      if (action.kind === "switchBuild") {
        const nextMode = action.mode;
        // Save the current tab's form state into the cache, then restore
        // the target tab's (if any). Switching tabs never discards what
        // you were building (Point 5).
        const snapshot: TabCacheEntry = {
          editing,
          formSnapshot,
          mechanicsDraftKind,
          templateKind,
          buildStarted,
        };
        const restored = tabCacheRef.current[nextMode];
        setTabCache((prev) => ({ ...prev, [build]: snapshot }));
        setBuild(nextMode);
        if (restored) {
          setEditing(restored.editing);
          setFormSnapshot(restored.formSnapshot);
          setMechanicsDraftKind(restored.mechanicsDraftKind);
          setTemplateKind(restored.templateKind);
          setBuildStarted(restored.buildStarted);
        } else {
          setEditing(null);
          setFormSnapshot(null);
          setBuildStarted(false);
        }
        setFormIsDirty(false);
        const nextParams = new URLSearchParams(
          currentSearchParams?.toString() ?? "",
        );
        nextParams.set("build", nextMode);
        router.replace(
          nextParams.toString()
            ? `${pathname}?${nextParams.toString()}`
            : pathname,
        );
        return;
      }
      const { entityType, id } = action;
      const tab = tabForKind(entityType);
      const nextParams = new URLSearchParams(
        currentSearchParams?.toString() ?? "",
      );
      nextParams.set("build", tab);
      nextParams.set("edit", String(id));
      nextParams.set("intent", "load");
      router.replace(
        nextParams.toString()
          ? `${pathname}?${nextParams.toString()}`
          : pathname,
      );
      if (entityType === "primitive") {
        const row = primitives.find((p) => p.id === id);
        if (!row) return;
        setBuild("mechanics");
        setEditing({ kind: "primitive", row });
      } else if (entityType === "effect") {
        const row = effects.find((e) => e.id === id);
        if (!row) return;
        setBuild("mechanics");
        setEditing({ kind: "effect", row });
      } else if (entityType === "capability") {
        const row = capabilities.find((c) => c.id === id);
        if (!row) return;
        setBuild("mechanics");
        setEditing({ kind: "capability", row });
      } else if (entityType === "template") {
        const row = templates.find((t) => t.id === id);
        if (!row) return;
        setBuild("template");
        setEditing({ kind: "template", row });
      } else if (entityType === "item") {
        const row = items.find((i) => i.id === id);
        if (!row) return;
        setBuild("item");
        setEditing({ kind: "item", row });
      } else {
        // monster — no form yet; just switch the tab.
        setBuild("monster");
        setEditing(null);
      }
      setFormIsDirty(false);
      setBuildStarted(true);
      openBuildPanel();
    },
    [
      primitives,
      effects,
      capabilities,
      templates,
      items,
      router,
      pathname,
      currentSearchParams,
      openBuildPanel,
    ],
  );

  function guardedSwitchBuild(newMode: AtelierTab) {
    // Switching tabs never discards your work (Point 5): the per-tab
    // cache in applyPendingAction preserves each tab's form state. So we
    // just switch — no unsaved-changes prompt.
    if (newMode === build) return;
    applyPendingAction({ kind: "switchBuild", mode: newMode });
  }

  // "New entity" picker: switch to the chosen kind with a BLANK form.
  // If the form currently has state, the dirty-guard (guardedSwitchBuild)
  // intercepts with the unsaved-changes modal; otherwise it lands on a
  // fresh form of the chosen kind immediately.
  function startNewEntity(choice: NewEntityChoice) {
    setShowNewModal(false);
    setBuildStarted(true);
    if (choice.templateSubKind) setTemplateKind(choice.templateSubKind);
    if (choice.mechanicsSubKind) setMechanicsDraftKind(choice.mechanicsSubKind);
    // Already on the target tab with a pristine form → nothing to do.
    if (choice.tab === build && !formIsDirty && editing === null) {
      setEditing(null);
      setFormSnapshot(null);
      return;
    }
    guardedSwitchBuild(choice.tab);
  }

  function guardedLibrarySelect(entityType: AtelierEntityKind, id: string | number) {
    // Same entity already loaded? No-op.
    if (editing?.kind === entityType) {
      const editingId = (editing.row as { id: string | number }).id;
      if (editingId === id) return;
    }
    if (!formIsDirty && editing === null) {
      applyPendingAction({ kind: "loadFromLibrary", entityType, id });
      return;
    }
    modalDescRef.current = `You have unsaved changes in the ${buildLabel(build)} form. Loading another row will discard them.`;
    setPendingAction({ kind: "loadFromLibrary", entityType, id });
  }

  const builderNode = useMemo(() => {
    const urlIntent = (currentSearchParams?.get("intent") ?? null) as
      | "fork"
      | "load"
      | null;
    const urlEdit = currentSearchParams?.get("edit") ?? null;
    const liveIntent = urlIntent ?? initialIntent ?? null;
    const liveSourceId = urlEdit ?? initialSourceId ?? null;
    const formCommon = { intent: liveIntent, sourceId: liveSourceId };
    const activeKind: "primitive" | "effect" | "capability" =
      editing?.kind === "effect" || editing?.kind === "capability"
        ? editing.kind
        : mechanicsDraftKind;

    // Empty build: show the inline "start a new entity" chooser instead
    // of a blank form (Point 4). Once the user picks (or loads) something,
    // buildStarted flips true and the form renders.
    if (!buildStarted) {
      return <EmptyBuildChooser onPick={startNewEntity} />;
    }

    if (build === "mechanics" && activeKind !== "effect" && activeKind !== "capability") {
      return (
        <PrimitiveForm
          initialPrimitive={editing?.kind === "primitive" ? editing.row : null}
          {...formCommon}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              slots: [],
              effectIds: [],
              primitiveIds: [],
              mirroredPrimitiveIds: [],
              capabilityIds: [],
              modifiers: state.modifiers,
            });
          }}
          onSaved={(saved) => {
            const outcome = (saved as { dispatchOutcome?: { swapTarget: boolean; newId: string | number } }).dispatchOutcome;
            if (outcome?.swapTarget && outcome.newId != null) {
              const nextParams = new URLSearchParams(
                currentSearchParams?.toString() ?? "",
              );
              nextParams.set("edit", String(outcome.newId));
              router.replace(
                nextParams.toString()
                  ? `${pathname}?${nextParams.toString()}`
                  : pathname,
              );
              const { dispatchOutcome: _omit, ...newRow } = saved as {
                dispatchOutcome?: unknown;
              } & Record<string, unknown>;
              setEditing({ kind: "primitive", row: newRow as never });
              setFormIsDirty(false);
            }
          }}
          onReset={() => setEditing(null)}
        />
      );
    }
    if (build === "mechanics" && activeKind === "effect") {
      const editingPrimitives = primitives.filter(
        (p) => p.category === "ITEM_AUGMENT",
      );
      return (
        <EffectForm
          initialEffect={editing?.kind === "effect" ? editing.row : null}
          {...formCommon}
          availablePrimitives={editingPrimitives.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            buCost: p.buCost,
          }))}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              slots: state.slots,
              effectIds: [],
              primitiveIds: [],
              mirroredPrimitiveIds: [],
              capabilityIds: [],
              modifiers: [],
            });
          }}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    if (build === "mechanics" && activeKind === "capability") {
      return (
        <CapabilityForm
          initialCapability={
            editing?.kind === "capability" ? editing.row : null
          }
          {...formCommon}
          availablePrimitives={primitives.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            buCost: p.buCost,
          }))}
          availableEffects={effects.map((e) => ({ id: e.id, name: e.name }))}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              slots: state.slots,
              effectIds: state.effectIds,
              primitiveIds: [],
              mirroredPrimitiveIds: [],
              capabilityIds: [],
              modifiers: [],
            });
          }}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    if (build === "template") {
      return (
        <TemplateForm
          initialTemplate={editing?.kind === "template" ? editing.row : null}
          initialKind={templateKind ?? undefined}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          {...formCommon}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              slots: [],
              effectIds: [],
              primitiveIds: state.primitives.map((p) => String(p.id)),
              mirroredPrimitiveIds: [],
              capabilityIds: state.capabilities.map((c) => String(c.id)),
              modifiers: [],
            });
          }}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    if (build === "item") {
      return (
        <ItemForm
          initialItem={editing?.kind === "item" ? editing.row : null}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          availableEffects={effects}
          {...formCommon}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              slots: [],
              effectIds: state.effectIds,
              primitiveIds: state.primitiveSlots.map((p) => String(p.primitiveId)),
              mirroredPrimitiveIds: state.primitiveSlots
                .filter((p) => p.isMirrored)
                .map((p) => p.primitiveId),
              capabilityIds: state.capabilityIds,
              modifiers: [],
            });
          }}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    // monster — placeholder until the monster form is built.
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
        <h2 className="font-display text-2xl font-semibold uppercase">
          Monster Builder
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Monster authoring is queued. The schema is in place — the composer
          will be migrated from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            /sandbox/atelier?build=monster
          </code>{" "}
          once the data model stabilizes.
        </p>
      </div>
    );
  }, [
    build,
    editing,
    primitives,
    effects,
    capabilities,
    initialKind,
    initialIntent,
    initialSourceId,
    currentSearchParams,
    pathname,
    router,
  ]);

  const previewNode = useMemo(() => {
    const activeKind: "primitive" | "effect" | "capability" =
      editing?.kind === "effect" || editing?.kind === "capability"
        ? editing.kind
        : mechanicsDraftKind;
    if (build === "mechanics" && activeKind !== "effect" && activeKind !== "capability") {
      const snapForm = formSnapshot?.form as
        | {
            name: string;
            category: string;
            costTier: string;
            buCost: string;
            mechanicalOutputText: string;
            narrativeRule: string;
            isMirrorable: boolean;
            mirrorVector: string;
            mirrorBuCredit: string;
            mirrorEligibilityNotes: string;
            isPublic: boolean;
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      if (!snapForm && !editing) {
        return emptyPreview("Pick a primitive from the Library", "Click any primitive in the Library column to load it here.");
      }
      const row = editing?.kind === "primitive" ? editing.row : null;
      const form = snapForm ?? (row ? {
        name: row.name,
        category: row.category,
        isPublic: row.isPublic,
        costTier: row.costTier,
        buCost: String(row.buCost),
        mechanicalOutputText: row.mechanicalOutputText,
        narrativeRule: row.narrativeRule,
        isMirrorable: row.isMirrorable,
        mirrorVector: row.mirrorVector,
        mirrorBuCredit: String(row.mirrorBuCredit),
        mirrorEligibilityNotes: row.mirrorEligibilityNotes,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      if (!form) return null;
      return (
        <PrimitiveFormPreview form={form} modifiers={formSnapshot?.modifiers ?? []} />
      );
    }
    if (build === "mechanics" && activeKind === "effect") {
      const snapForm = formSnapshot?.form as
        | {
            name: string;
            narrativeDescription: string;
            sourceOrigin: string;
            tags: string;
            isPublic: boolean;
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapSlots = formSnapshot?.slots as
        | Array<{ primitiveId: number; quantity: number; isMirrored?: boolean; primitive: { id: number; name: string; category: string; buCost: number } }>
        | undefined;
      if (!snapForm && !editing) {
        return emptyPreview("Pick an effect from the Library", "Click any effect to load it. You can also slot primitives into the Build form for a new effect.");
      }
      const row = editing?.kind === "effect" ? editing.row : null;
      const form = snapForm ?? (row ? {
        name: row.name,
        narrativeDescription: row.narrativeDescription,
        sourceOrigin: row.sourceOrigin ?? "",
        tags: row.tags.join(", "),
        isPublic: row.isPublic,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      const slots = snapSlots ?? (row ? row.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        quantity: link.quantity,
        isMirrored: link.isMirrored,
        primitive: link.primitive,
      })) : []);
      if (!form) return null;
      return <EffectFormPreview form={form} slots={slots} />;
    }
    if (build === "mechanics" && activeKind === "capability") {
      const snapForm = formSnapshot?.form as
        | {
            name: string;
            type: string;
            sourceType: string;
            verboseDescription: string;
            sourceOrigin: string;
            tags: string;
            isPublic: boolean;
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapSlots = formSnapshot?.slots as
        | Array<{ primitiveId: number; role: string; quantity: number; sortOrder: number; slotLabel: string | null; isMirrored: boolean; primitive: { id: number; name: string; category: string; buCost: number } }>
        | undefined;
      const snapEffectIds = formSnapshot?.effectIds as string[] | undefined;
      if (!snapForm && !editing) {
        return emptyPreview("Pick a capability from the Library", "Click any capability to load it. Slot primitives + effects into the Build form for a new one.");
      }
      const row = editing?.kind === "capability" ? editing.row : null;
      const form = snapForm ?? (row ? {
        name: row.name,
        type: row.type,
        sourceType: row.sourceType,
        verboseDescription: row.verboseDescription,
        sourceOrigin: row.sourceOrigin ?? "",
        tags: row.tags.join(", "),
        isPublic: row.isPublic,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      const formWithDefaults = form
        ? {
            ...form,
            iconSource: form.iconSource ?? null,
            iconKey: form.iconKey ?? null,
            iconUrl: form.iconUrl ?? null,
            iconColor: form.iconColor ?? "#ffffff",
          }
        : null;
      const slots = snapSlots ?? (row ? row.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        role: link.role ?? "OTHER",
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel ?? link.primitive.name,
        isMirrored: link.isMirrored ?? false,
        primitive: link.primitive,
      })) : []);
      const effectRefs = snapEffectIds
        ? snapEffectIds
            .map((id) => effects.find((e) => e.id === id))
            .filter((e): e is EffectRow => Boolean(e))
            .map((e) => ({ id: e.id, name: e.name, narrativeDescription: e.narrativeDescription }))
        : [];
      if (!formWithDefaults) return null;
      return (
        <CapabilityFormPreview form={formWithDefaults} slots={slots} effects={effectRefs} />
      );
    }
    if (build === "template") {
      const snapForm = formSnapshot?.form as
        | {
            kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
            name: string;
            imageUrl: string;
            description: string;
            suggestedTraits: string;
            isPublic: boolean;
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapPrimitiveIds = formSnapshot?.primitiveIds as string[] | undefined;
      const snapCapabilityIds = formSnapshot?.capabilityIds as string[] | undefined;
      const row = editing?.kind === "template" ? editing.row : null;
      if (!snapForm && !row) {
        return emptyPreview("Pick a template from the Library", "Click any template to load it. Or build a new one in the Build form.");
      }
      const form = snapForm ?? (row ? {
        kind: row.kind,
        name: row.name,
        imageUrl: row.imageUrl ?? "",
        description: row.description ?? "",
        suggestedTraits: row.suggestedTraits ?? "",
        isPublic: row.isPublic,
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      const primitiveSlots = snapPrimitiveIds
        ? snapPrimitiveIds
            .map((id) => primitives.find((p) => String(p.id) === id))
            .filter((p): p is PrimitiveRow => Boolean(p))
            .map((p) => ({ id: p.id, name: p.name, category: p.category, buCost: p.buCost }))
        : (row ? row.primitiveLinks.map((link) => ({ id: link.primitiveId, name: link.primitive.name, category: link.primitive.category, buCost: link.primitive.buCost })) : []);
      const capabilitySlots = snapCapabilityIds
        ? snapCapabilityIds
            .map((id) => capabilities.find((c) => String(c.id) === id))
            .filter((c): c is CapabilityRow => Boolean(c))
            .map((c) => ({ id: c.id, name: c.name, category: c.type, buCost: 0 }))
        : (row ? row.capabilityLinks.map((link) => ({ id: link.capabilityId, name: link.capability.name, category: link.capability.type, buCost: 0 })) : []);
      if (!form) return null;
      return <TemplateFormPreview form={form} primitives={primitiveSlots} capabilities={capabilitySlots} />;
    }
    if (build === "item") {
      const snapForm = formSnapshot?.form as
        | {
            name: string;
            itemType: string;
            rarity: string;
            buCost: string;
            description: string;
            slotCost: string;
            quantity: string;
            isTwoHanded: boolean;
            isConsumable: boolean;
            actsAsFocus: boolean;
            isPublic: boolean;
            sourceOrigin: string;
            tags: string;
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapPrimitiveIds = formSnapshot?.primitiveIds as string[] | undefined;
      const snapCapabilityIds = formSnapshot?.capabilityIds as string[] | undefined;
      const snapEffectIds = formSnapshot?.effectIds as string[] | undefined;
      const row = editing?.kind === "item" ? editing.row : null;
      if (!snapForm && !row) {
        return emptyPreview("Pick an item from the Library", "Click any item to load it. Or build a new one in the Build form.");
      }
      const form = snapForm ?? (row ? {
        name: row.name,
        itemType: row.itemType,
        rarity: row.rarity,
        buCost: String(row.buCost),
        description: row.description,
        slotCost: String(row.slotCost),
        quantity: String(row.quantity ?? 1),
        isTwoHanded: row.isTwoHanded,
        isConsumable: row.isConsumable,
        actsAsFocus: row.actsAsFocus,
        isPublic: row.isPublic,
        sourceOrigin: row.sourceOrigin ?? "",
        tags: row.tags.join(", "),
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      const formWithDefaults = form
        ? { ...form, iconSource: form.iconSource ?? null, iconKey: form.iconKey ?? null, iconUrl: form.iconUrl ?? null, iconColor: form.iconColor ?? "#ffffff" }
        : null;
      const snapMirroredIds = new Set<number>(formSnapshot?.mirroredPrimitiveIds ?? []);
      const primitiveSlots = snapPrimitiveIds
        ? snapPrimitiveIds.map((id) => primitives.find((p) => String(p.id) === id)).filter((p): p is PrimitiveRow => Boolean(p)).map((p) => ({ primitiveId: p.id, isMirrored: snapMirroredIds.has(p.id), primitive: p }))
        : (row ? row.primitiveLinks.map((link) => ({ primitiveId: link.primitiveId, isMirrored: (link as { isMirrored?: boolean }).isMirrored, primitive: link.primitive })) : []);
      const capabilitySlots = snapCapabilityIds
        ? snapCapabilityIds.map((id) => capabilities.find((c) => String(c.id) === id)).filter((c): c is CapabilityRow => Boolean(c)).map((c) => ({ id: c.id, name: c.name, type: c.type, sourceType: c.sourceType }))
        : [];
      const effectSlots = snapEffectIds
        ? snapEffectIds.map((id) => effects.find((e) => e.id === id)).filter((e): e is EffectRow => Boolean(e)).map((e) => ({ id: e.id, name: e.name }))
        : [];
      if (!formWithDefaults) return null;
      return <ItemFormPreview form={formWithDefaults} primitiveSlots={primitiveSlots} capabilitySlots={capabilitySlots} effectSlots={effectSlots} />;
    }
    return emptyPreview("Monster preview not yet implemented.", "The monster composer is queued.");
  }, [build, editing, formSnapshot, primitives, capabilities, effects]);

  // Library column — swap the library component based on the active group.
  const libraryNode = useMemo(() => {
    const isMechanics = build === "mechanics";
    const editingKey = editing
      ? `${editing.kind}:${editing.row.id}`
      : null;
    if (isMechanics) {
      return (
        <GrammarLibrary
          build={build as "mechanics"}
          libraryItems={libraryItems}
          primitives={primitives}
          effects={effects}
          capabilities={capabilities}
          primitiveCategories={primitiveCategories}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
          versionMap={versionMap}
          editingKey={editingKey}
          onSelect={(entityType, id) =>
            guardedLibrarySelect(entityType as AtelierEntityKind, id)
          }
        />
      );
    }
    return (
      <BlueprintLibrary
        build={build as "template" | "item" | "monster"}
        libraryItems={libraryItems}
        templates={templates}
        items={items}
        primitives={sandboxPrimitives}
        capabilities={sandboxCapabilities}
        effects={effects}
        primitiveCategories={primitiveCategories}
        engagement={engagement}
        currentUserInternalId={currentUserInternalId}
        editingKey={editingKey}
        onSelect={(entityType, id) =>
          guardedLibrarySelect(entityType as AtelierEntityKind, id)
        }
        versionMap={versionMap}
      />
    );
  }, [
    build,
    libraryItems,
    primitives,
    effects,
    capabilities,
    templates,
    items,
    sandboxPrimitives,
    sandboxCapabilities,
    primitiveCategories,
    engagement,
    currentUserInternalId,
    versionMap,
    editing,
    guardedLibrarySelect,
  ]);

  return (
    <>
      <SandboxLayout
        storageKey="atelier"
        library={libraryNode}
        builder={
          <BuilderPane
            onNew={() => setShowNewModal(true)}
            showNewModal={showNewModal}
            onPickNew={startNewEntity}
            onCloseNew={() => setShowNewModal(false)}
          >
            {builderNode}
          </BuilderPane>
        }
        preview={previewNode}
        bottomBar={<AtelierTabBar build={build} onSwitch={guardedSwitchBuild} />}
      />
      <UnsavedChangesModal
        isOpen={pendingAction !== null}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) applyPendingAction(pendingAction);
          setPendingAction(null);
        }}
        {...(modalDescRef.current !== undefined && {
          description: modalDescRef.current,
        })}
      />
    </>
  );
}

function emptyPreview(title: string, sub: string) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function buildLabel(mode: AtelierTab): string {
  switch (mode) {
    case "mechanics": return "Mechanics";
    case "template": return "Heritage";
    case "item": return "Items";
    case "monster": return "Monsters";
  }
}

// ---- New-entity picker (Stage 3) ----------------------------------------

type NewEntityChoice = {
  tab: AtelierTab;
  templateSubKind?: "RACE" | "BACKGROUND" | "ARCHETYPE";
  mechanicsSubKind?: "primitive" | "effect" | "capability";
  label: string;
  hint: string;
  icon: string;
};

// The 8 entity kinds the user can start from an empty build. Labels use
// the renamed taxonomy (Lineage / Upbringing / Manifest) per the user's
// rename spec, even though the underlying tab/type keep their canonical
// ids. Grouped for display only.
const NEW_ENTITY_GROUPS: { heading: string; choices: NewEntityChoice[] }[] = [
  {
    heading: "Mechanics",
    choices: [
      { tab: "mechanics", mechanicsSubKind: "primitive", label: "Primitive", hint: "Raw mechanical building block", icon: "lorc/jigsaw-piece" },
      { tab: "mechanics", mechanicsSubKind: "effect", label: "Effect", hint: "Composed primitive effect", icon: "lorc/jigsaw-piece" },
      { tab: "mechanics", mechanicsSubKind: "capability", label: "Capability", hint: "Ability built from primitives + effects", icon: "lorc/jigsaw-piece" },
    ],
  },
  {
    heading: "Heritage",
    choices: [
      { tab: "template", templateSubKind: "RACE", label: "Lineage", hint: "Race template", icon: "caro-asercion/tarot-11-justice" },
      { tab: "template", templateSubKind: "BACKGROUND", label: "Upbringing", hint: "Background template", icon: "caro-asercion/tarot-11-justice" },
      { tab: "template", templateSubKind: "ARCHETYPE", label: "Manifest", hint: "Archetype template", icon: "caro-asercion/tarot-11-justice" },
    ],
  },
  {
    heading: "Other",
    choices: [
      { tab: "item", label: "Item", hint: "Equipable / consumable", icon: "lorc/battle-gear" },
      { tab: "monster", label: "Monster", hint: "Coming soon", icon: "lorc/gluttonous-smile" },
    ],
  },
];

function BuilderPane({
  onNew,
  showNewModal,
  onPickNew,
  onCloseNew,
  children,
}: {
  onNew: () => void;
  showNewModal: boolean;
  onPickNew: (choice: NewEntityChoice) => void;
  onCloseNew: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Build
        </span>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <span className="text-base leading-none">+</span>
          New entity
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {showNewModal ? (
        <NewEntityModal onPick={onPickNew} onClose={onCloseNew} />
      ) : null}
    </div>
  );
}

function NewEntityModal({
  onPick,
  onClose,
}: {
  onPick: (choice: NewEntityChoice) => void;
  onClose: () => void;
}) {
  const isDark = useIsDark();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New entity"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Start a new entity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 hover:bg-accent"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {NEW_ENTITY_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {group.heading}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {group.choices.map((choice) => (
                  <button
                    key={choice.label + (choice.templateSubKind ?? "")}
                    type="button"
                    onClick={() => onPick(choice)}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <IconDisplay
                      iconSource="GAME_ICONS"
                      iconKey={choice.icon}
                      iconColor={isDark ? "#94a3b8" : "#64748b"}
                      size={20}
                      alt={choice.label}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {choice.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {choice.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inline "start a new entity" chooser shown in the build column when it's
// empty (Point 4). Mirrors the new-entity modal's 8 options so the desktop
// middle column and the modal stay consistent.
function EmptyBuildChooser({
  onPick,
}: {
  onPick: (choice: NewEntityChoice) => void;
}) {
  const isDark = useIsDark();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Start something new
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick what you want to build.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-4">
        {NEW_ENTITY_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.heading}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {group.choices.map((choice) => (
                <button
                  key={choice.label + (choice.templateSubKind ?? choice.mechanicsSubKind ?? "")}
                  type="button"
                  onClick={() => onPick(choice)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <IconDisplay
                    iconSource="GAME_ICONS"
                    iconKey={choice.icon}
                    iconColor={isDark ? "#94a3b8" : "#64748b"}
                    size={18}
                    alt={choice.label}
                  />
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 6-tab bottom bar. Icon-only when inactive, icon + label when active.
// Active tab widens to fit the label; inactive tabs are icon-only.
const ATELIER_TABS: {
  key: AtelierTab;
  label: string;
  icon: string; // game-icon key
}[] = [
  { key: "mechanics", label: "Mechanics", icon: "lorc/jigsaw-piece" },
  { key: "template", label: "Heritage", icon: "caro-asercion/tarot-11-justice" },
  { key: "item", label: "Items", icon: "lorc/battle-gear" },
  { key: "monster", label: "Monsters", icon: "lorc/gluttonous-smile" },
];

function AtelierTabBar({
  build,
  onSwitch,
}: {
  build: AtelierTab;
  onSwitch: (mode: AtelierTab) => void;
}) {
  const isDark = useIsDark();
  return (
    <div role="tablist" aria-label="Build mode" className="flex bg-card">
      {ATELIER_TABS.map((tab) => {
        const active = build === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSwitch(tab.key)}
            className={
              "flex items-center justify-center gap-1.5 border-t-2 px-2.5 py-2.5 text-sm font-medium transition-all " +
              (active
                ? "flex-1 border-primary bg-primary/5 text-primary"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            <IconDisplay
              iconSource="GAME_ICONS"
              iconKey={tab.icon}
              iconColor={active ? (isDark ? "#64e1d9" : "#011614") : isDark ? "#94a3b8" : "#64748b"}
              size={18}
              alt={tab.label}
            />
            {active ? <span className="whitespace-nowrap">{tab.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
