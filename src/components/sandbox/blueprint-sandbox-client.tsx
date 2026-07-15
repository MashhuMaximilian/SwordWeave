"use client";

// /sandbox/blueprint client wrapper.
// Hosts three Build modes: Template | Item | Monster.
// Library column shows templates + items with collapsible filter chips.
// Monster form is a "coming soon" placeholder until the MonsterForm is built.
//
// Dirty-change guard mirrors grammar route: switching modes or loading
// a different library row triggers a modal if the current form is dirty.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SandboxLayout } from "./sandbox-layout";
import { TemplateForm } from "./template-form";
import { TemplateFormPreview } from "./template-form-preview";
import { ItemForm } from "./item-form";
import { ItemFormPreview } from "./item-form-preview";
import { BlueprintLibrary } from "./blueprint-library";
import { UnsavedChangesModal } from "./unsaved-changes-modal";
import { useGlobalControls } from "@/components/layout/global-controls";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { SaveIntent } from "@/lib/publishing/save-intent";

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
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: {
      id: string;
      name: string;
      type: string;
      primitiveLinks?: Array<{
        primitiveId: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
    };
  }>;
  // Phase 8: per-entity iconography
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
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: {
      id: string;
      name: string;
      narrativeDescription: string | null;
      primitiveLinks?: Array<{
        primitiveId: number;
        quantity: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
    };
  }>;
  capabilityLinks: Array<{
    capabilityId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    capability: {
      id: string;
      name: string;
      type: string;
      primitiveLinks?: Array<{
        primitiveId: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
    };
  }>;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type BlueprintBuildMode = "template" | "item" | "monster";

type EditingState =
  | { kind: "template"; row: TemplateRow }
  | { kind: "item"; row: ItemRow }
  | null;

type PendingAction =
  | { kind: "switchBuild"; mode: BlueprintBuildMode }
  | { kind: "loadFromLibrary"; entityType: "template" | "item"; id: string };

export function BlueprintSandboxClient({
  initialBuild,
  initialKind,
  initialEditing,
  initialIntent,
  initialSourceId,
  dataLoadFailed = false,
  templates,
  items,
  primitives,
  capabilities,
  effects,
  libraryItems,
  sandboxPrimitives,
  sandboxCapabilities,
  primitiveCategories,
  engagement,
  currentUserInternalId,
  versionMap,
}: {
  initialBuild: BlueprintBuildMode;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
  initialEditing: EditingState;
  /**
   * Phase 1: see grammar-sandbox-client.tsx for the matching
   * documentation. Same intent flag + sourceId contract.
   */
  initialIntent?: SaveIntent;
  initialSourceId?: string | null;
  /**
   * When true, the DB query batch on the server failed and the rows
   * below are empty arrays. The page renders a small banner explaining
   * that the library is empty because the database is being uncooperative,
   * and the form remains editable so the user doesn't lose their work.
   */
  dataLoadFailed?: boolean;
  templates: TemplateRow[];
  items: ItemRow[];
  primitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
  }>;
  effects: import("@/components/library/library-item-preview").SandboxEffectRow[];
  /**
   * Unified LibraryItem[] for the left column. Produced server-side from
   * the typed rows. Engagement is threaded in so the compact
   * LikeForkBar on each card shows the right active state for the
   * viewer (filled heart when liked, fork disabled on own content).
   */
  libraryItems: LibraryItem[];
  /** Full primitive rows used to resolve sub-entity previews. */
  sandboxPrimitives: import("@/components/library/library-item-preview").SandboxPrimitiveRow[];
  /** Full capability rows used to resolve sub-entity previews. */
  sandboxCapabilities: import("@/components/library/library-item-preview").SandboxCapabilityRow[];
  /**
   * Primitive category chips for the "Category" filter row in the
   * sandbox's filter panel. Forwarded to BlueprintLibrary.
   */
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  /**
   * Pre-fetched engagement snapshot (same shape as /library/browse).
   * Keyed by `LibraryItem.id`.
   */
  engagement: { reactions: Record<string, "LIKE" | "DISLIKE" | null>; following: Record<string, boolean> };
  /**
   * Current viewer's internal ID. `null` when signed out.
   */
  currentUserInternalId: string | null;
  /** Map of "type:id" → latest published version number. Used to show
   *  version chips in the preview modal header. */
  versionMap?: Record<string, number>;
}) {
  const [build, setBuild] = useState<BlueprintBuildMode>(initialBuild);
  const [editing, setEditing] = useState<EditingState>(initialEditing);
  const [formIsDirty, setFormIsDirty] = useState(false);
  // Live form snapshot — drives the preview column/drawer so it updates
  // as the user types, not just when they load a row.
  const [formSnapshot, setFormSnapshot] = useState<{
    form: Record<string, unknown>;
    primitiveIds: string[];
    capabilityIds: string[];
    effectIds: string[];
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const modalDescRef = useRef<string | undefined>(undefined);

  // Mirror the dirty state into the global controls so the FAB can show
  // a notification dot on the Build & Preview button when the user has
  // anything in their build — either unsaved edits OR a loaded entity
  // that hasn't been saved yet. The global also auto-resets on route
  // change.
  const { setSandboxFormDirty, openDrawer, sandboxSplit, setSandboxBottomTab } =
    useGlobalControls();
  // URL sync — when the user switches build mode via the bottom tab
  // bar, push ?build=<mode> so a refresh / deep-link lands on the same
  // mode. Without this the URL stays on whatever was set in the
  // initial request, which is confusing once the in-memory state
  // drifts away from the URL.
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  useEffect(() => {
    setSandboxFormDirty(formIsDirty || editing !== null);
  }, [formIsDirty, editing, setSandboxFormDirty]);

  // Auto-open the build preview when the sandbox loads with ?edit=<id>.
  // Same rationale as grammar-sandbox-client — clicking "Edit in sandbox"
  // from the fork modal, Creations, etc. should land the user with the
  // build/preview panel already visible. Split mode just switches the
  // bottom tab.
  useEffect(() => {
    if (initialEditing !== null) {
      if (sandboxSplit) {
        setSandboxBottomTab("build");
      } else {
        openDrawer("build");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPendingAction = useCallback((action: PendingAction) => {
    if (action.kind === "switchBuild") {
      setBuild(action.mode);
      setEditing(null);
      setFormIsDirty(false); // new mode = fresh form
      // Drop the previous form snapshot — its shape (template vs item) is
      // tied to the build mode we're leaving, and the new preview can
      // crash if it reads fields like `tags` that don't exist on the
      // destination form. The new form's onStateChange repopulates this.
      setFormSnapshot(null);
      // Sync the URL so refresh / deep-link lands on the right mode.
      // Preserve all other search params (kind, edit, etc.) so the
      // user's previous state isn't lost.
      const nextParams = new URLSearchParams(
        currentSearchParams?.toString() ?? "",
      );
      nextParams.set("build", action.mode);
      router.replace(
        nextParams.toString()
          ? `${pathname}?${nextParams.toString()}`
          : pathname,
      );
      // Tab switches must NOT pop the drawer — per the user's spec,
      // only slot/load actions open the build panel. The form mounts
      // in the drawer's build tab automatically when the user later
      // taps "Build & Preview" from the FAB.
      return;
    }
    const { entityType, id } = action;
    // Phase 1: also update the URL with ?build=<entityType>&edit=<id>&intent=load
    // so the intent flag flows into the form AND the server's `initialBuild`
    // agrees with what we just set. Setting `build=` here fixes the
    // "Load into build always lands on the first tab" bug — without it,
    // the server returns `initialBuild` based on the OLD `build` query
    // param, and the `setBuild(initialBuild)` sync effect resets the
    // build state. See grammar-sandbox-client.tsx for the matching fix.
    const nextParams = new URLSearchParams(
      currentSearchParams?.toString() ?? "",
    );
    nextParams.set("build", entityType);
    nextParams.set("edit", String(id));
    nextParams.set("intent", "load");
    router.replace(
      nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname,
    );
    if (entityType === "template") {
      const row = templates.find((t) => t.id === id);
      if (!row) return;
      setBuild("template");
      setEditing({ kind: "template", row });
    } else {
      const row = items.find((i) => i.id === id);
      if (!row) return;
      setBuild("item");
      setEditing({ kind: "item", row });
    }
    setFormIsDirty(false); // loaded entity starts pristine
    // Open the build panel so the user actually sees the loaded row —
    // same fix as grammar-sandbox-client.
    if (sandboxSplit) {
      setSandboxBottomTab("build");
    } else {
      openDrawer("build");
    }
  }, [
    templates,
    items,
    router,
    pathname,
    currentSearchParams,
    sandboxSplit,
    openDrawer,
    setSandboxBottomTab,
  ]);

  function guardedSwitchBuild(newMode: BlueprintBuildMode) {
    if (newMode === build) return;
    // Warn if the form has any state — either unsaved edits OR a loaded
    // entity that hasn't been saved yet (the user said "build is filled").
    if (!formIsDirty && editing === null) {
      applyPendingAction({ kind: "switchBuild", mode: newMode });
      return;
    }
    modalDescRef.current = `You have unsaved changes in the ${buildLabel(build)} form. Switching to ${buildLabel(newMode)} will lose them.`;
    setPendingAction({ kind: "switchBuild", mode: newMode });
  }

  function guardedLibrarySelect(entityType: "template" | "item", id: string) {
    // Same-mode same-id click is a no-op.
    if (build === entityType && editing?.kind === entityType) {
      if (editing.row.id === id) return;
    }
    // Warn if the form has any state.
    if (!formIsDirty && editing === null) {
      applyPendingAction({ kind: "loadFromLibrary", entityType, id });
      return;
    }
    modalDescRef.current = `You have unsaved changes in the ${buildLabel(build)} form. Loading another row will discard them.`;
    setPendingAction({ kind: "loadFromLibrary", entityType, id });
  }

  const builderNode = useMemo(() => {
    // Phase 1: read intent + sourceId live from URL — same pattern as
    // grammar-sandbox-client. See §6.7 of edit-creates-fork.md.
    const urlIntent = (currentSearchParams?.get("intent") ?? null) as
      | "fork"
      | "load"
      | null;
    const urlEdit = currentSearchParams?.get("edit") ?? null;
    const liveIntent = urlIntent ?? initialIntent ?? null;
    const liveSourceId = urlEdit ?? initialSourceId ?? null;
    const formCommon = {
      intent: liveIntent,
      sourceId: liveSourceId,
    };
    if (build === "template") {
      return (
        <TemplateForm
          initialTemplate={editing?.kind === "template" ? editing.row : null}
          initialKind={initialKind ?? undefined}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          {...formCommon}
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({
              form: state.form as unknown as Record<string, unknown>,
              primitiveIds: state.primitives.map((p) => String(p.id)),
              capabilityIds: state.capabilities.map((c) => String(c.id)),
              effectIds: [],
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
              primitiveIds: state.primitiveSlots.map((p) => String(p.primitiveId)),
              capabilityIds: state.capabilityIds,
              effectIds: state.effectIds,
            });
          }}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    // Monster — placeholder until the monster form is built.
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center">
        <h2 className="font-display text-2xl font-semibold uppercase">
          Monster Builder
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Monster authoring is queued. The schema is in place — the
          composer will be migrated from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            /sandbox/blueprint?build=monster
          </code>{" "}
          once the data model stabilizes.
        </p>
      </div>
    );
  }, [build, editing, primitives, capabilities, effects, initialKind, initialIntent, initialSourceId, currentSearchParams]);

  const previewNode = useMemo(() => {
    if (build === "template") {
      // Live form snapshot is preferred so the preview updates as the
      // user types. Fall back to the loaded `editing` row for the
      // initial paint. Empty state when both are absent.
      const snapForm = formSnapshot?.form as
        | {
            kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
            name: string;
            imageUrl: string;
            description: string;
            suggestedTraits: string;
            isPublic: boolean;
            // Phase 8: per-entity iconography (mirrors TemplateFormState).
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapPrimitiveIds = formSnapshot?.primitiveIds as
        | string[]
        | undefined;
      const snapCapabilityIds = formSnapshot?.capabilityIds as
        | string[]
        | undefined;
      const row = editing?.kind === "template" ? editing.row : null;
      if (!snapForm && !row) {
        return (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Pick a template from the Library
              </p>
              <p className="text-xs text-muted-foreground">
                Click any template to load it. Or build a new one in the Build
                form.
              </p>
            </div>
          </div>
        );
      }
      const form = snapForm ?? (row ? {
        kind: row.kind,
        name: row.name,
        imageUrl: row.imageUrl ?? "",
        description: row.description ?? "",
        suggestedTraits: row.suggestedTraits ?? "",
        isPublic: row.isPublic,
        // Phase 8: per-entity iconography
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      // Map primitive IDs → primitive rows for the preview. We have
      // `primitives` (sandbox-supplied list of all primitives) so we
      // can resolve IDs into the full row shape the preview expects.
      const primitiveSlots = snapPrimitiveIds
        ? snapPrimitiveIds
            .map((id) =>
              primitives.find((p) => String(p.id) === id),
            )
            .filter((p): p is (typeof primitives)[number] => Boolean(p))
            .map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              buCost: p.buCost,
            }))
        : (row ? row.primitiveLinks.map((link) => ({
            id: link.primitiveId,
            name: link.primitive.name,
            category: link.primitive.category,
            buCost: link.primitive.buCost,
          })) : []);
      const capabilitySlots = snapCapabilityIds
        ? snapCapabilityIds
            .map((id) =>
              capabilities.find((c) => String(c.id) === id),
            )
            .filter((c): c is (typeof capabilities)[number] => Boolean(c))
            .map((c) => ({
              id: c.id,
              name: c.name,
              category: c.type,
              buCost: 0,
            }))
        : (row ? row.capabilityLinks.map((link) => ({
            id: link.capabilityId,
            name: link.capability.name,
            category: link.capability.type,
            buCost: 0,
          })) : []);
      if (!form) return null;
      return (
        <TemplateFormPreview
          form={form}
          primitives={primitiveSlots}
          capabilities={capabilitySlots}
        />
      );
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
            // Phase 8: per-entity iconography (mirrors ItemFormState).
            iconSource: string | null;
            iconKey: string | null;
            iconUrl: string | null;
            iconColor: string;
          }
        | undefined;
      const snapPrimitiveIds = formSnapshot?.primitiveIds as
        | string[]
        | undefined;
      const snapCapabilityIds = formSnapshot?.capabilityIds as
        | string[]
        | undefined;
      const snapEffectIds = formSnapshot?.effectIds as string[] | undefined;
      const row = editing?.kind === "item" ? editing.row : null;
      if (!snapForm && !row) {
        return (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Pick an item from the Library
              </p>
              <p className="text-xs text-muted-foreground">
                Click any item to load it. Or build a new one in the Build
                form.
              </p>
            </div>
          </div>
        );
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
        // Phase 8: per-entity iconography
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      } : null);
      // Coerce any null icon fields to defaults — ItemFormState requires
      // iconColor: string (not nullable). Nulls only happen when a row
      // predates the migration; new rows always have these populated.
      const formWithDefaults = form
        ? {
            ...form,
            iconSource: form.iconSource ?? null,
            iconKey: form.iconKey ?? null,
            iconUrl: form.iconUrl ?? null,
            iconColor: form.iconColor ?? "#ffffff",
          }
        : null;
      const primitiveSlots = snapPrimitiveIds
        ? snapPrimitiveIds
            .map((id) => {
              const p = primitives.find((p) => String(p.id) === id);
              return p;
            })
            .filter((p): p is (typeof primitives)[number] => Boolean(p))
            .map((p) => ({
              primitiveId: p.id,
              primitive: p,
            }))
        : (row ? row.primitiveLinks.map((link) => ({
            primitiveId: link.primitiveId,
            isMirrored: (link as { isMirrored?: boolean }).isMirrored,
            primitive: link.primitive,
          })) : []);
      const capabilitySlots = snapCapabilityIds
        ? snapCapabilityIds
            .map((id) =>
              capabilities.find((c) => String(c.id) === id),
            )
            .filter((c): c is (typeof capabilities)[number] => Boolean(c))
            .map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              sourceType: c.sourceType,
            }))
        : [];
      const effectSlots = snapEffectIds
        ? snapEffectIds
            .map((id) => effects.find((e) => e.id === id))
            .filter((e): e is (typeof effects)[number] => Boolean(e))
            .map((e) => ({
              id: e.id,
              name: e.name,
            }))
        : [];
      if (!formWithDefaults) return null;
      return (
        <ItemFormPreview
          form={formWithDefaults}
          primitiveSlots={primitiveSlots}
          capabilitySlots={capabilitySlots}
          effectSlots={effectSlots}
        />
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Monster preview not yet implemented.
        </p>
      </div>
    );
  }, [build, editing, formSnapshot, primitives, capabilities, effects]);

  function buildTabs() {
    const tabs: { key: BlueprintBuildMode; label: string }[] = [
      { key: "template", label: "Template" },
      { key: "item", label: "Item" },
      { key: "monster", label: "Monster" },
    ];
    return (
      <div role="tablist" aria-label="Build mode" className="flex bg-card">
        {tabs.map((tab) => {
          const active = build === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => guardedSwitchBuild(tab.key)}
              className={
                "flex-1 border-t-2 px-3 py-2.5 text-sm font-medium transition-colors " +
                (active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <SandboxLayout
        storageKey="blueprint"
        library={
          <BlueprintLibrary
            build={build}
            libraryItems={libraryItems}
            templates={templates}
            items={items}
            primitives={sandboxPrimitives}
            capabilities={sandboxCapabilities}
            effects={effects}
            primitiveCategories={primitiveCategories}
            engagement={engagement}
            currentUserInternalId={currentUserInternalId}
            editingKey={
              editing
                ? `${editing.kind}:${editing.row.id}`
                : null
            }
            onSelect={guardedLibrarySelect}
            versionMap={versionMap}
          />
        }
        builder={builderNode}
        preview={previewNode}
        bottomBar={buildTabs()}
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

function buildLabel(mode: BlueprintBuildMode): string {
  if (mode === "template") return "Template";
  if (mode === "item") return "Item";
  return "Monster";
}