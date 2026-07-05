"use client";

// /sandbox/grammar client wrapper.
// One page hosts three Build modes (Primitive | Effect | Capability).
// Library column shows the relevant subset depending on current mode.
// Switching Build mode resets the form (user must click Reset to save draft).
//
// Dirty-change guard: if the active form has unsaved edits, switching modes
// or loading a different library row opens a confirmation modal. Pristine
// switches happen silently.

import { useCallback, useMemo, useRef, useState } from "react";
import { SandboxLayout } from "@/components/sandbox/sandbox-layout";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { PrimitiveFormPreview } from "@/components/sandbox/primitive-form-preview";
import { EffectForm } from "@/components/sandbox/effect-form";
import { EffectFormPreview } from "@/components/sandbox/effect-form-preview";
import { CapabilityForm } from "@/components/sandbox/capability-form";
import { CapabilityFormPreview } from "@/components/sandbox/capability-form-preview";
import { GrammarLibrary } from "@/components/sandbox/grammar-library";
import { UnsavedChangesModal } from "@/components/sandbox/unsaved-changes-modal";
import type { LibraryItem } from "@/lib/publishing/library-query";

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
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
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
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export type GrammarBuildMode = "primitive" | "effect" | "capability";

type EditingState =
  | { kind: "primitive"; row: PrimitiveRow }
  | { kind: "effect"; row: EffectRow }
  | { kind: "capability"; row: CapabilityRow }
  | null;

// Pending action: what to run when the user confirms the unsaved-changes modal.
type PendingAction =
  | { kind: "switchBuild"; mode: GrammarBuildMode }
  | { kind: "loadFromLibrary"; entityType: GrammarBuildMode; id: string | number };

export function GrammarSandboxClient({
  initialBuild,
  initialEditing,
  primitives,
  effects,
  capabilities,
  libraryItems,
}: {
  initialBuild: GrammarBuildMode;
  initialEditing: EditingState;
  primitives: PrimitiveRow[];
  effects: EffectRow[];
  capabilities: CapabilityRow[];
  /**
   * Unified LibraryItem[] for the left column. Produced server-side from
   * the typed rows. The sandbox does NOT show engagement metrics in its
   * library column (those live on /library/browse).
   */
  libraryItems: LibraryItem[];
}) {
  const [build, setBuild] = useState<GrammarBuildMode>(initialBuild);
  const [editing, setEditing] = useState<EditingState>(initialEditing);
  // Mirrored from the form's onStateChange. Drives the dirty-check gate.
  const [formIsDirty, setFormIsDirty] = useState(false);
  // Pending action waits for the user to confirm/cancel in the modal.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  // Tracks the most recent description so the modal copy can adapt.
  const modalDescRef = useRef<string | undefined>(undefined);

  // ---- Apply pending action (called on modal confirm) ---------------------

  const applyPendingAction = useCallback((action: PendingAction) => {
    if (action.kind === "switchBuild") {
      setBuild(action.mode);
      setEditing(null);
      setFormIsDirty(false); // new mode = fresh form, force pristine
      return;
    }
    // loadFromLibrary
    const { entityType, id } = action;
    if (entityType === "primitive") {
      const row = primitives.find((p) => p.id === id);
      if (!row) return;
      setBuild("primitive");
      setEditing({ kind: "primitive", row });
    } else if (entityType === "effect") {
      const row = effects.find((e) => e.id === id);
      if (!row) return;
      setBuild("effect");
      setEditing({ kind: "effect", row });
    } else {
      const row = capabilities.find((c) => c.id === id);
      if (!row) return;
      setBuild("capability");
      setEditing({ kind: "capability", row });
    }
    setFormIsDirty(false); // loaded entity starts pristine
  }, [primitives, effects, capabilities]);

  // ---- Dirty-check interceptors ------------------------------------------

  function guardedSwitchBuild(newMode: GrammarBuildMode) {
    if (newMode === build) return;
    if (!formIsDirty) {
      applyPendingAction({ kind: "switchBuild", mode: newMode });
      return;
    }
    modalDescRef.current = `You have unsaved changes in the ${buildLabel(build)} form. Switching to ${buildLabel(newMode)} will lose them.`;
    setPendingAction({ kind: "switchBuild", mode: newMode });
  }

  function guardedLibrarySelect(
    entityType: GrammarBuildMode,
    id: string | number,
  ) {
    // If the user clicks a row in the SAME build mode + SAME id, no-op.
    if (build === entityType && editing?.kind === entityType) {
      const editingId =
        entityType === "primitive"
          ? (editing as { row: { id: string | number } }).row.id
          : (editing as { row: { id: string | number } }).row.id;
      if (editingId === id) return;
    }
    if (!formIsDirty) {
      applyPendingAction({ kind: "loadFromLibrary", entityType, id });
      return;
    }
    modalDescRef.current = `You have unsaved changes in the ${buildLabel(build)} form. Loading another row will discard them.`;
    setPendingAction({ kind: "loadFromLibrary", entityType, id });
  }

  const builderNode = useMemo(() => {
    if (build === "primitive") {
      return (
        <PrimitiveForm
          initialPrimitive={editing?.kind === "primitive" ? editing.row : null}
          onStateChange={(state) => setFormIsDirty(state.isDirty)}
          onSaved={() => {
            /* router.refresh inside PrimitiveForm */
          }}
          onReset={() => setEditing(null)}
        />
      );
    }
    if (build === "effect") {
      const editingPrimitives = primitives.filter(
        (p) => p.category === "ITEM_AUGMENT",
      );
      return (
        <EffectForm
          initialEffect={editing?.kind === "effect" ? editing.row : null}
          availablePrimitives={editingPrimitives.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            buCost: p.buCost,
          }))}
          onStateChange={(state) => setFormIsDirty(state.isDirty)}
          onSaved={() => {}}
          onReset={() => setEditing(null)}
        />
      );
    }
    return (
      <CapabilityForm
        initialCapability={
          editing?.kind === "capability" ? editing.row : null
        }
        availablePrimitives={primitives.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          buCost: p.buCost,
        }))}
        onStateChange={(state) => setFormIsDirty(state.isDirty)}
        onSaved={() => {}}
        onReset={() => setEditing(null)}
      />
    );
  }, [build, editing, primitives]);

  // Preview is sourced directly from the editing row (read-only canonical render).
  const previewNode = useMemo(() => {
    if (build === "primitive") {
      const row = editing?.kind === "primitive" ? editing.row : null;
      if (!row) {
        return (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Pick a primitive from the Library
              </p>
              <p className="text-xs text-muted-foreground">
                Click any primitive in the Library column to load it here.
              </p>
            </div>
          </div>
        );
      }
      return (
        <PrimitiveFormPreview
          form={{
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
          }}
          modifiers={[]}
        />
      );
    }
    if (build === "effect") {
      const row = editing?.kind === "effect" ? editing.row : null;
      if (!row) {
        return (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Pick an effect from the Library
              </p>
              <p className="text-xs text-muted-foreground">
                Click any effect to load it. You can also slot primitives into
                the Build form for a new effect.
              </p>
            </div>
          </div>
        );
      }
      return (
        <EffectFormPreview
          form={{
            name: row.name,
            narrativeDescription: row.narrativeDescription,
            sourceOrigin: row.sourceOrigin ?? "",
            tags: row.tags.join(", "),
            isPublic: row.isPublic,
          }}
          slots={row.primitiveLinks.map((link) => ({
            primitiveId: link.primitiveId,
            quantity: link.quantity,
            primitive: link.primitive,
          }))}
        />
      );
    }
    const row = editing?.kind === "capability" ? editing.row : null;
    if (!row) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div className="max-w-xs space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Pick a capability from the Library
            </p>
            <p className="text-xs text-muted-foreground">
              Click any capability to load it. Slot primitives + effects into
              the Build form for a new one.
            </p>
          </div>
        </div>
      );
    }
    return (
      <CapabilityFormPreview
        form={{
          name: row.name,
          type: row.type,
          sourceType: row.sourceType,
          verboseDescription: row.verboseDescription,
          sourceOrigin: row.sourceOrigin ?? "",
          tags: row.tags.join(", "),
          isPublic: row.isPublic,
        }}
        slots={row.primitiveLinks.map((link) => ({
          primitiveId: link.primitiveId,
          role: link.role ?? "OTHER",
          quantity: link.quantity,
          sortOrder: link.sortOrder,
          slotLabel: link.slotLabel ?? link.primitive.name,
          primitive: link.primitive,
        }))}
      />
    );
  }, [build, editing]);

  // Tab strip across the top of the Build column.
  function buildTabs() {
    const tabs: { key: GrammarBuildMode; label: string }[] = [
      { key: "primitive", label: "Primitive" },
      { key: "effect", label: "Effect" },
      { key: "capability", label: "Capability" },
    ];
    return (
      <div className="flex border-b border-border bg-card">
        {tabs.map((tab) => {
          const active = build === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => guardedSwitchBuild(tab.key)}
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
    <>
      <SandboxLayout
        storageKey="grammar"
        library={
          <GrammarLibrary
            build={build}
            libraryItems={libraryItems}
            primitives={primitives}
            effects={effects}
            capabilities={capabilities}
            editingKey={
              editing
                ? `${editing.kind}:${
                    editing.kind === "primitive"
                      ? editing.row.id
                      : editing.row.id
                  }`
                : null
            }
            onSelect={guardedLibrarySelect}
          />
        }
        topBar={buildTabs()}
        builder={builderNode}
        preview={previewNode}
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

function buildLabel(mode: GrammarBuildMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}