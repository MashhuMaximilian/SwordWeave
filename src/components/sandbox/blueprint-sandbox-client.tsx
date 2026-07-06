"use client";

// /sandbox/blueprint client wrapper.
// Hosts three Build modes: Template | Item | Monster.
// Library column shows templates + items with collapsible filter chips.
// Monster form is a "coming soon" placeholder until the MonsterForm is built.
//
// Dirty-change guard mirrors grammar route: switching modes or loading
// a different library row triggers a modal if the current form is dirty.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { TemplateForm } from "./template-form";
import { TemplateFormPreview } from "./template-form-preview";
import { ItemForm } from "./item-form";
import { ItemFormPreview } from "./item-form-preview";
import { BlueprintLibrary } from "./blueprint-library";
import { UnsavedChangesModal } from "./unsaved-changes-modal";
import { useGlobalControls } from "@/components/layout/global-controls";
import type { LibraryItem } from "@/lib/publishing/library-query";

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
    };
  }>;
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
  templates,
  items,
  primitives,
  capabilities,
  effects,
  libraryItems,
  sandboxPrimitives,
  sandboxCapabilities,
}: {
  initialBuild: BlueprintBuildMode;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
  initialEditing: EditingState;
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
   * the typed rows.
   */
  libraryItems: LibraryItem[];
  /** Full primitive rows used to resolve sub-entity previews. */
  sandboxPrimitives: import("@/components/library/library-item-preview").SandboxPrimitiveRow[];
  /** Full capability rows used to resolve sub-entity previews. */
  sandboxCapabilities: import("@/components/library/library-item-preview").SandboxCapabilityRow[];
}) {
  const [build, setBuild] = useState<BlueprintBuildMode>(initialBuild);
  const [editing, setEditing] = useState<EditingState>(initialEditing);
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const modalDescRef = useRef<string | undefined>(undefined);

  // Mirror the dirty state into the global controls so the FAB can show
  // a notification dot on the Build & Preview button when the user has
  // anything in their build — either unsaved edits OR a loaded entity
  // that hasn't been saved yet. The global also auto-resets on route
  // change.
  const { setSandboxFormDirty } = useGlobalControls();
  useEffect(() => {
    setSandboxFormDirty(formIsDirty || editing !== null);
  }, [formIsDirty, editing, setSandboxFormDirty]);

  const applyPendingAction = useCallback((action: PendingAction) => {
    if (action.kind === "switchBuild") {
      setBuild(action.mode);
      setEditing(null);
      setFormIsDirty(false); // new mode = fresh form
      return;
    }
    const { entityType, id } = action;
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
  }, [templates, items]);

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
    if (build === "template") {
      return (
        <TemplateForm
          initialTemplate={editing?.kind === "template" ? editing.row : null}
          initialKind={initialKind ?? undefined}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          onStateChange={(state) => setFormIsDirty(state.isDirty)}
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
          onStateChange={(state) => setFormIsDirty(state.isDirty)}
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
  }, [build, editing, primitives, capabilities, effects, initialKind]);

  const previewNode = useMemo(() => {
    if (build === "template") {
      const row = editing?.kind === "template" ? editing.row : null;
      if (!row) {
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
      return (
        <TemplateFormPreview
          form={{
            kind: row.kind,
            name: row.name,
            imageUrl: row.imageUrl ?? "",
            description: row.description ?? "",
            suggestedTraits: row.suggestedTraits ?? "",
            isPublic: row.isPublic,
          }}
          primitives={row.primitiveLinks.map((link) => ({
            id: link.primitiveId,
            name: link.primitive.name,
            category: link.primitive.category,
            buCost: link.primitive.buCost,
          }))}
          capabilities={row.capabilityLinks.map((link) => ({
            id: link.capabilityId,
            name: link.capability.name,
            category: link.capability.type,
            buCost: 0,
          }))}
        />
      );
    }
    if (build === "item") {
      const row = editing?.kind === "item" ? editing.row : null;
      if (!row) {
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
      return (
        <ItemFormPreview
          form={{
            name: row.name,
            itemType: row.itemType,
            rarity: row.rarity,
            buCost: String(row.buCost),
            description: row.description,
            slotCost: String(row.slotCost),
            isTwoHanded: row.isTwoHanded,
            isConsumable: row.isConsumable,
            actsAsFocus: row.actsAsFocus,
            isPublic: row.isPublic,
            sourceOrigin: row.sourceOrigin ?? "",
            tags: row.tags.join(", "),
          }}
          primitiveSlots={row.primitiveLinks.map((link) => ({
            primitiveId: link.primitiveId,
            primitive: link.primitive,
          }))}
          capabilitySlots={[]}
          effectSlots={[]}
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
  }, [build, editing]);

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
            editingKey={
              editing
                ? `${editing.kind}:${editing.row.id}`
                : null
            }
            onSelect={guardedLibrarySelect}
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