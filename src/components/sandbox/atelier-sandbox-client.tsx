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
import { useModalStack } from "@/components/ui/modal-stack";
import { buildSandboxUrl } from "@/lib/publishing/fork-target";
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

// The concrete `build` value to put in the URL for a kind — matches the
// proven deep-link format (?build=primitive&edit=…&intent=load) used by the
// working Codex/Creations flows. The Atelier tab is a library filter, but the
// URL must carry a concrete build so the server + form resolve it correctly.
function concreteBuildForKind(kind: AtelierEntityKind): string {
  switch (kind) {
    case "primitive":
      return "primitive";
    case "effect":
      return "effect";
    case "capability":
      return "capability";
    case "template":
      return "template";
    case "item":
      return "item";
  }
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
  | {
      kind: "loadFromLibrary";
      entityType: AtelierEntityKind;
      id: string | number;
      intent?: "fork" | "load";
    };

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
  // Intent (fork | load) shown as a chip on the build form. We keep it in
  // React state (not just the URL) because router.push/replace to the SAME
  // pathname does NOT reliably update Next's useSearchParams / address bar
  // in this App Router setup — so we drive the chip from state and sync the
  // URL via window.history.pushState (which always updates the bar).
  const [liveIntent, setLiveIntent] = useState<SaveIntent | null>(initialIntent ?? null);
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
  // Pending off-page navigation awaiting the discard confirmation (when
  // the build is dirty). Set by the nav guard; the UnsavedChangesModal
  // confirms/cancels it. Using the in-app modal (not window.confirm) keeps
  // the UX consistent with the load-into-build discard prompt.
  const [pendingNav, setPendingNav] = useState<string | null>(null);
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

  // Open the build panel (mobile drawer / split bottom tab). No-op on
  // desktop where the build column is always visible. Declared before the
  // effects below so onOpenNew / loadFromLibrary can reference it.
  const openBuildPanel = useCallback(() => {
    if (!isMobile) return;
    if (sandboxSplit) {
      setSandboxBottomTab("build");
    } else {
      openDrawer("build");
    }
  }, [isMobile, sandboxSplit, openDrawer, setSandboxBottomTab]);

  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  // Modal stack — the preview popup is pushed here. When we Load/Fork
  // into build we must clear it explicitly: the pathname stays
  // /sandbox/atelier (unlike the legacy routes), so ModalStackHost's
  // pathname-change auto-clear does NOT fire. Without stack.clear() the
  // preview modal stays on top of the page, hiding the URL change.
  const stack = useModalStack();

  useEffect(() => {
    setBuild(initialBuild);
  }, [initialBuild]);
  useEffect(() => {
    setEditing(initialEditing);
  }, [initialEditing]);

  // Mirrored from the form's onStateChange. Drives the dirty-check gate.
  useEffect(() => {
    setSandboxFormDirty(formIsDirty || editing !== null);
  }, [formIsDirty, editing, setSandboxFormDirty]);

  // Navigation guard: when the build has unsaved changes, warn before
  // leaving the sandbox. The user wants to be able to navigate to
  // /creations, /library, etc., but with the SAME in-app "discard changes
  // or cancel" modal that appears when loading into build over existing
  // work — not the browser's native confirm().
  //  - Internal <Link> clicks to a path outside /sandbox/atelier -> open the
  //    in-app UnsavedChangesModal (pendingNav), confirming navigates there.
  //  - tab close / refresh (beforeunload) -> native browser prompt (cannot
  //    be intercepted with an in-app modal).
  useEffect(() => {
    if (!formIsDirty) return;
    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
        return;
      const anchor = (e.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // Only guard navigation away from the sandbox page.
      if (href.startsWith("/sandbox/atelier")) return;
      if (!href.startsWith("/")) return; // external / hash links ignored
      // Open the in-app discard modal; confirming navigates to href.
      e.preventDefault();
      e.stopPropagation();
      modalDescRef.current =
        "You have unsaved changes in the build. Leaving will discard them. Continue?";
      setPendingNav(href);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onAnchorClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [formIsDirty]);

  // Listen for the FAB "Build & Preview" action.
  //  - If the build column is EMPTY (no entity loaded and nothing typed),
  //    open the new-entity chooser (Point 4). This re-prompts even after
  //    you've picked a blank form and closed it, because a blank form is
  //    still "empty".
  //  - If something is already loaded or you've typed content, do nothing
  //    here: the editor is already shown (desktop) or the FAB just opened
  //    the drawer to reveal it (mobile). Re-opening the chooser would be
  //    the wrong flow (Point 2 / Point 3).
  useEffect(() => {
    function onOpenNew() {
      // If a build is already in progress, don't show the "what do you want
      // to build?" chooser over the loaded content — open the build panel
      // instead (mobile). On desktop the build column is already visible,
      // so openBuildPanel is a no-op there. Only show the chooser when the
      // build is empty.
      if (editing !== null || buildStarted) {
        openBuildPanel();
      } else {
        setShowNewModal(true);
      }
    }
    window.addEventListener("sw-open-new-entity", onOpenNew);
    return () => window.removeEventListener("sw-open-new-entity", onOpenNew);
  }, [editing, buildStarted, openBuildPanel]);

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

  const applyPendingAction = useCallback(

    (action: PendingAction) => {
      if (action.kind === "switchBuild") {
        // A tab is a LIBRARY FILTER only. Switching it must never touch the
        // build form, the editing state, or the URL. The form is decoupled
        // (renderkeyed on editing.kind), so browsing a different tab keeps
        // whatever you loaded in the build intact.
        setBuild(action.mode);
        return;
      }
      const { entityType, id } = action;
      const idStr = String(id);
      // Map to the concrete targetType buildSandboxUrl expects. For
      // templates, "TEMPLATE" isn't a valid key — resolve the concrete
      // sub-kind (RACE/BACKGROUND/ARCHETYPE) from the loaded row.
      let targetType = entityType.toUpperCase();
      if (entityType === "template") {
        const row = templates.find((t) => String(t.id) === idStr);
        targetType = row?.kind ? `${row.kind}_TEMPLATE` : "RACE_TEMPLATE";
      }
      // Close the preview popup (the pathname stays /sandbox/atelier, so
      // ModalStackHost's auto-clear won't fire — clear explicitly).
      stack.clear();
      // Populate the form CLIENT-SIDE immediately. We do NOT rely on
      // router.push re-running the server component (Next treats a push to
      // the same pathname as a soft navigation and may skip the re-render,
      // leaving the form empty). Setting editing here fills the form now;
      // the URL update below keeps it deep-linkable + drives the intent chip.
      // NOTE: ids may arrive as strings (fork's engagement targetId) or
      // numbers (load's row id) — compare with String() on both sides.
      if (entityType === "primitive") {
        const row = primitives.find((p) => String(p.id) === idStr);
        if (!row) return;
        setEditing({ kind: "primitive", row });
      } else if (entityType === "effect") {
        const row = effects.find((e) => String(e.id) === idStr);
        if (!row) return;
        setEditing({ kind: "effect", row });
      } else if (entityType === "capability") {
        const row = capabilities.find((c) => String(c.id) === idStr);
        if (!row) return;
        setEditing({ kind: "capability", row });
      } else if (entityType === "template") {
        const row = templates.find((t) => String(t.id) === idStr);
        if (!row) return;
        setEditing({ kind: "template", row });
      } else if (entityType === "item") {
        const row = items.find((i) => String(i.id) === idStr);
        if (!row) return;
        setEditing({ kind: "item", row });
      }
      // Reset the live form snapshot. The preview is built as
      // `formSnapshot?.form ?? row`; if we DON'T clear it here, a stale
      // snapshot from the previously-loaded entity (e.g. a template, which
      // has no `category` field) is used for the new primitive preview,
      // and PrimitiveFormPreview's categoryLabel(undefined) throws
      // "Cannot read properties of undefined (reading 'split')". Clearing
      // it forces the preview to fall back to `row` (which always has a
      // category) until the newly-loaded form repopulates the snapshot.
      setFormSnapshot(null);
      setFormIsDirty(false);
      setBuildStarted(true);
      setShowNewModal(false);
      // Auto-open the build panel on mobile so the loaded content is
      // visible (desktop already shows it inline).
      openBuildPanel();
      // Update the URL with the concrete ?build=<kind>&edit=<id>&intent=load|fork
      // (same format the working /sandbox/grammar|blueprint routes use).
      // IMPORTANT: do NOT use router.push/replace here. A Next navigation
      // re-renders the server, which re-resolves initialEditing and pushes a
      // server editing row down that the setEditing(initialEditing) sync
      // effect then applies OVER the client editing we just set — during the
      // same commit where editing.kind is switching. That mid-transition
      // swap throws a render error ("reload page") on load-over-content,
      // reset, etc. window.history.replaceState updates the address bar +
      // deep-link state WITHOUT a Next navigation, so no server re-render,
      // no crash. The form is already filled by setEditing above.
      const target = buildSandboxUrl(targetType, String(id), action.intent ?? "load");
      if (target) {
        const url = `/sandbox/atelier${target.search}`;
        window.history.replaceState(null, "", url);
      }
      setLiveIntent((action.intent ?? "load") as SaveIntent);
      return;
    },
    [
      stack,
      router,
      openBuildPanel,
      buildSandboxUrl,
      primitives,
      effects,
      capabilities,
      templates,
      items,
    ],
  );

  function guardedSwitchBuild(newMode: AtelierTab) {
    // Switching tabs never discards your work (Point 5): the per-tab
    // cache in applyPendingAction preserves each tab's form state. So we
    // just switch — no unsaved-changes prompt.
    if (newMode === build) return;
    applyPendingAction({ kind: "switchBuild", mode: newMode });
  }

  // "New entity" picker: open the editor for the chosen kind directly.
  // No discard prompt, no tab-cache wipe — just switch to the target tab
  // with a blank form of the chosen kind. The build column then renders
  // the right editor (Point 3 / Point 5).
  function startNewEntity(choice?: NewEntityChoice) {
    setShowNewModal(false);
    if (choice?.templateSubKind) setTemplateKind(choice.templateSubKind);
    if (choice?.mechanicsSubKind) setMechanicsDraftKind(choice.mechanicsSubKind);
    // NOTE: deliberately do NOT switch the active tab — the tab is a library
    // filter and the build form renders from the chosen draft kind
    // (mechanicsDraftKind / templateKind), independent of the tab.
    setEditing(null);
    setFormSnapshot(null);
    setFormIsDirty(false);
    // buildStarted must go FALSE on reset: it gates the "what do you want
    // to build?" chooser. If we left it true, re-opening the (now empty)
    // build panel would skip the chooser and show a blank form instead of
    // re-prompting — exactly the bug where reset+reopen didn't ask.
    setBuildStarted(false);
    setLiveIntent(null);
    const nextParams = new URLSearchParams(
      currentSearchParams?.toString() ?? "",
    );
    // Clear ALL loaded-entity params so Reset returns to a clean
    // /sandbox/atelier (the user wants the URL stripped on Reset, not
    // left with a stale ?build=). We use replaceState (not router.replace):
    // a Next navigation re-renders the server and re-resolves
    // initialEditing, which can throw during the editing -> null transition
    // (the "reload page" error). replaceState updates the bar + deep-link
    // state without a server re-render.
    nextParams.delete("build");
    nextParams.delete("edit");
    nextParams.delete("intent");
    const clearedUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;
    window.history.replaceState(null, "", clearedUrl);
  }

  function guardedLibrarySelect(
    entityType: AtelierEntityKind,
    id: string | number,
    intent: "fork" | "load" = "load",
  ) {
    // Same entity already loaded? No-op.
    if (editing?.kind === entityType) {
      const editingId = (editing.row as { id: string | number }).id;
      if (editingId === id) return;
    }
    // Fork AND load both replace whatever is in the build. We no
    // longer prompt a discard here: Reset clears the build on demand,
    // and picking a row from the library is an explicit user action to
    // swap the entity — re-asking "discard changes?" on every pick
    // was redundant once Reset existed. The only remaining dirty-guard
    // is navigating OFF the page (FAB links), handled by the
    // separate document-level nav-guard effect, which keeps the
    // in-app UnsavedChangesModal for that case.
    applyPendingAction({ kind: "loadFromLibrary", entityType, id, intent });
  }

  const builderNode = useMemo(() => {
    const urlIntent = (currentSearchParams?.get("intent") ?? null) as
      | "fork"
      | "load"
      | null;
    const urlEdit = currentSearchParams?.get("edit") ?? null;
    // Prefer the live React state (set on load/fork via pushState) over the
    // URL, because a same-pathname pushState doesn't re-render useSearchParams.
    const liveIntentResolved = liveIntent ?? urlIntent ?? initialIntent ?? null;
    const liveSourceId = urlEdit ?? initialSourceId ?? null;
    const formCommon = { intent: liveIntentResolved, sourceId: liveSourceId };
    // The build form is INDEPENDENT of the library tab. Which form renders
    // is driven by what's loaded (editing.kind) or, for a blank "new entity"
    // draft, by the chosen draft kind. The active tab is just a library
    // filter and must never switch/reset the form.
    const formKind: "primitive" | "effect" | "capability" | "template" | "item" | null =
      editing?.kind ??
      (mechanicsDraftKind ? mechanicsDraftKind : templateKind ? "template" : null);

    if (formKind === "primitive") {
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
          onReset={startNewEntity}
        />
      );
    }
    if (formKind === "effect") {
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
          onReset={startNewEntity}
        />
      );
    }
    if (formKind === "capability") {
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
          onReset={startNewEntity}
        />
      );
    }
    if (formKind === "template") {
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
          onReset={startNewEntity}
        />
      );
    }
    if (formKind === "item") {
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
          onReset={startNewEntity}
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
    editing,
    buildStarted,
    mechanicsDraftKind,
    formSnapshot,
    templateKind,
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
    // Form preview is driven by what's loaded (or the blank draft kind),
    // NOT the active library tab. Same decoupling as builderNode.
    const formKind: "primitive" | "effect" | "capability" | "template" | "item" | null =
      editing?.kind ??
      (mechanicsDraftKind ? mechanicsDraftKind : templateKind ? "template" : null);
    if (formKind === "primitive") {
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
    if (formKind === "effect") {
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
    if (formKind === "capability") {
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
    if (formKind === "template") {
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
    if (formKind === "item") {
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
          onFork={(targetType, targetId) =>
            guardedLibrarySelect(
              (targetType === "PRIMITIVE"
                ? "primitive"
                : targetType === "EFFECT"
                  ? "effect"
                  : targetType === "CAPABILITY"
                    ? "capability"
                    : "item") as AtelierEntityKind,
              targetId,
              "fork",
            )
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
        onFork={(targetType, targetId) =>
          guardedLibrarySelect(
            (targetType === "RACE_TEMPLATE" ||
            targetType === "BACKGROUND_TEMPLATE" ||
            targetType === "ARCHETYPE_TEMPLATE"
              ? "template"
              : "item") as AtelierEntityKind,
            targetId,
            "fork",
          )
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
        isOpen={pendingAction !== null || pendingNav !== null}
        onCancel={() => {
          setPendingAction(null);
          setPendingNav(null);
        }}
        onConfirm={() => {
          if (pendingNav) {
            const href = pendingNav;
            setPendingNav(null);
            setPendingAction(null);
            // Hard navigation: bypasses Next's client router entirely, so
            // it works regardless of any URL/router state. (We avoid
            // router.push here because loading into build uses
            // window.history.replaceState, which intentionally does NOT
            // update Next's router — so router.push could be stale.)
            window.location.assign(href);
            return;
          }
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
      { tab: "mechanics", mechanicsSubKind: "primitive", label: "Primitive", hint: "Raw mechanical building block", icon: "delapouite/cube" },
      { tab: "mechanics", mechanicsSubKind: "effect", label: "Effect", hint: "Composed primitive effect", icon: "lorc/cubes" },
      { tab: "mechanics", mechanicsSubKind: "capability", label: "Capability", hint: "Ability built from primitives + effects", icon: "lorc/cubeforce" },
    ],
  },
  {
    heading: "Heritage",
    choices: [
      { tab: "template", templateSubKind: "RACE", label: "Lineage", hint: "Race template", icon: "lorc/dna2" },
      { tab: "template", templateSubKind: "BACKGROUND", label: "Upbringing", hint: "Background template", icon: "delapouite/plant-roots" },
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
