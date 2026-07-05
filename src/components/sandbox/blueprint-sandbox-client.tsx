"use client";

// /sandbox/blueprint client wrapper.
// Hosts three Build modes: Template | Item | Monster.
// Library column shows templates + items with collapsible filter chips.
// Monster form is a "coming soon" placeholder until the MonsterForm is built.

import { useMemo, useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { TemplateForm } from "./template-form";
import { TemplateFormPreview } from "./template-form-preview";
import { ItemForm } from "./item-form";
import { ItemFormPreview } from "./item-form-preview";
import { BlueprintLibrary } from "./blueprint-library";

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

export function BlueprintSandboxClient({
  initialBuild,
  initialKind,
  initialEditing,
  templates,
  items,
  primitives,
  capabilities,
  effects,
}: {
  initialBuild: BlueprintBuildMode;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
  initialEditing:
    | { kind: "template"; row: TemplateRow }
    | { kind: "item"; row: ItemRow }
    | null;
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
  effects: Array<{ id: string; name: string }>;
}) {
  const [build, setBuild] = useState<BlueprintBuildMode>(initialBuild);
  const [editing, setEditing] = useState<typeof initialEditing>(
    initialEditing,
  );

  function onLibrarySelect(kind: "template" | "item", id: string) {
    if (kind === "template") {
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
  }

  function onSwitchBuild(newMode: BlueprintBuildMode) {
    if (newMode === build) return;
    setBuild(newMode);
    setEditing(null);
  }

  const builderNode = useMemo(() => {
    if (build === "template") {
      return (
        <TemplateForm
          initialTemplate={editing?.kind === "template" ? editing.row : null}
          initialKind={initialKind ?? undefined}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          onStateChange={() => {}}
          onSaved={() => {}}
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
          onStateChange={() => {}}
          onSaved={() => {}}
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
      <div className="flex border-b border-border bg-card">
        {tabs.map((tab) => {
          const active = build === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSwitchBuild(tab.key)}
              className={
                "flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors " +
                (active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
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
    <SandboxLayout
      storageKey="blueprint"
      library={
        <BlueprintLibrary
          build={build}
          templates={templates}
          items={items}
          editingKey={
            editing
              ? `${editing.kind}:${editing.row.id}`
              : null
          }
          onSelect={onLibrarySelect}
        />
      }
      topBar={buildTabs()}
      builder={builderNode}
      preview={previewNode}
    />
  );
}