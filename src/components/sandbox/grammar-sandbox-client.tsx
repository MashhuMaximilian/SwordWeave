"use client";

// /sandbox/grammar client wrapper.
// One page hosts three Build modes (Primitive | Effect | Capability).
// Library column shows the relevant subset depending on current mode.
// Switching Build mode resets the form (user must click Reset to save draft).
//
// Dirty-change guard: if the active form has unsaved edits, switching modes
// or loading a different library row opens a confirmation modal. Pristine
// switches happen silently.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SandboxLayout } from "@/components/sandbox/sandbox-layout";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { PrimitiveFormPreview } from "@/components/sandbox/primitive-form-preview";
import { EffectForm } from "@/components/sandbox/effect-form";
import { EffectFormPreview } from "@/components/sandbox/effect-form-preview";
import { CapabilityForm } from "@/components/sandbox/capability-form";
import { CapabilityFormPreview } from "@/components/sandbox/capability-form-preview";
import { GrammarLibrary } from "@/components/sandbox/grammar-library";
import { UnsavedChangesModal } from "@/components/sandbox/unsaved-changes-modal";
import { useGlobalControls } from "@/components/layout/global-controls";
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
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: {
      id: string;
      name: string;
      narrativeDescription: string | null;
      sourceOrigin: string | null;
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
  dataLoadFailed = false,
  primitives,
  effects,
  capabilities,
  libraryItems,
  primitiveCategories,
}: {
  initialBuild: GrammarBuildMode;
  initialEditing: EditingState;
  /**
   * When true, the DB query batch on the server failed and the rows
   * below are empty arrays. The page renders a small banner explaining
   * that the library is empty because the database is being uncooperative,
   * and the form remains editable so the user doesn't lose their work.
   */
  dataLoadFailed?: boolean;
  primitives: PrimitiveRow[];
  effects: EffectRow[];
  capabilities: CapabilityRow[];
  /**
   * Unified LibraryItem[] for the left column. Produced server-side from
   * the typed rows. The sandbox does NOT show engagement metrics in its
   * library column (those live on /library/browse).
   */
  libraryItems: LibraryItem[];
  /**
   * Primitive category chips for the "Category" filter row in the
   * sandbox's filter panel. Forwarded to GrammarLibrary.
   */
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
}) {
  const [build, setBuild] = useState<GrammarBuildMode>(initialBuild);
  const [editing, setEditing] = useState<EditingState>(initialEditing);
  // Mirrored from the form's onStateChange. Drives the dirty-check gate.
  const [formIsDirty, setFormIsDirty] = useState(false);
  // Live form snapshot — drives the preview column/drawer so it updates
  // as the user types, not just when they load a row. The previous
  // implementation sourced the preview from `editing` (the loaded row
  // from the library), which meant the preview never reflected in-progress
  // edits — a bug the user reported in the 7th round.
  const [formSnapshot, setFormSnapshot] = useState<{
    form: Record<string, unknown>;
    slots: unknown[];
    effectIds: string[];
  } | null>(null);
  // Pending action waits for the user to confirm/cancel in the modal.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  // Tracks the most recent description so the modal copy can adapt.
  const modalDescRef = useRef<string | undefined>(undefined);

  // Mirror the dirty state into the global controls so the FAB can show
  // a notification dot on the Build & Preview button when the user has
  // anything in their build — either unsaved edits OR a loaded entity
  // that hasn't been saved yet. The global also auto-resets on route
  // change so we don't need a manual clear here.
  const { setSandboxFormDirty } = useGlobalControls();
  // URL sync — switchBuild needs to push ?build=<mode> so refresh /
  // deep-link lands on the right mode. Without this the URL stays on
  // whatever was set in the initial request, which is confusing once
  // the in-memory state drifts away from the URL.
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  useEffect(() => {
    setSandboxFormDirty(formIsDirty || editing !== null);
  }, [formIsDirty, editing, setSandboxFormDirty]);

  // ---- Apply pending action (called on modal confirm) ---------------------

  const applyPendingAction = useCallback((action: PendingAction) => {
    if (action.kind === "switchBuild") {
      setBuild(action.mode);
      setEditing(null);
      setFormIsDirty(false); // new mode = fresh form, force pristine
      // URL sync — preserve all other search params, just update build.
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
  }, [
    primitives,
    effects,
    capabilities,
    router,
    pathname,
    currentSearchParams,
  ]);

  // ---- Dirty-check interceptors ------------------------------------------

  function guardedSwitchBuild(newMode: GrammarBuildMode) {
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
    // Warn if the form has any state.
    if (!formIsDirty && editing === null) {
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
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({ form: state.form as unknown as Record<string, unknown>, slots: [], effectIds: [] });
          }}
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
          onStateChange={(state) => {
            setFormIsDirty(state.isDirty);
            setFormSnapshot({ form: state.form as unknown as Record<string, unknown>, slots: state.slots, effectIds: [] });
          }}
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
        availableEffects={effects.map((e) => ({
          id: e.id,
          name: e.name,
        }))}
        onStateChange={(state) => {
          setFormIsDirty(state.isDirty);
          setFormSnapshot({ form: state.form as unknown as Record<string, unknown>, slots: state.slots, effectIds: state.effectIds });
        }}
        onSaved={() => {}}
        onReset={() => setEditing(null)}
      />
    );
  }, [build, editing, primitives, effects]);

  // Preview is sourced from the live form snapshot when available, so it
  // updates as the user types. Falls back to the loaded `editing` row for
  // the initial render (before the first onStateChange fires). This fixes
  // the "preview doesn't update" bug — the previous implementation only
  // re-rendered the preview when `editing` changed (i.e. when loading a
  // row), so typing in the form had no effect on the preview.
  const previewNode = useMemo(() => {
    if (build === "primitive") {
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
          }
        | undefined;
      if (!snapForm && !editing) {
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
      } : null);
      if (!form) return null;
      return (
        <PrimitiveFormPreview
          form={form}
          modifiers={[]}
        />
      );
    }
    if (build === "effect") {
      const snapForm = formSnapshot?.form as
        | {
            name: string;
            narrativeDescription: string;
            sourceOrigin: string;
            tags: string;
            isPublic: boolean;
          }
        | undefined;
      const snapSlots = formSnapshot?.slots as
        | Array<{
            primitiveId: number;
            quantity: number;
            primitive: { id: number; name: string; category: string; buCost: number };
          }>
        | undefined;
      if (!snapForm && !editing) {
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
      const row = editing?.kind === "effect" ? editing.row : null;
      const form = snapForm ?? (row ? {
        name: row.name,
        narrativeDescription: row.narrativeDescription,
        sourceOrigin: row.sourceOrigin ?? "",
        tags: row.tags.join(", "),
        isPublic: row.isPublic,
      } : null);
      const slots = snapSlots ?? (row ? row.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        quantity: link.quantity,
        primitive: link.primitive,
      })) : []);
      if (!form) return null;
      return (
        <EffectFormPreview
          form={form}
          slots={slots}
        />
      );
    }
    const snapForm = formSnapshot?.form as
      | {
          name: string;
          type: string;
          sourceType: string;
          verboseDescription: string;
          sourceOrigin: string;
          tags: string;
          isPublic: boolean;
        }
      | undefined;
    const snapSlots = formSnapshot?.slots as
      | Array<{
          primitiveId: number;
          role: string;
          quantity: number;
          sortOrder: number;
          slotLabel: string | null;
          primitive: { id: number; name: string; category: string; buCost: number };
        }>
      | undefined;
    const snapEffectIds = formSnapshot?.effectIds as string[] | undefined;
    if (!snapForm && !editing) {
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
    const row = editing?.kind === "capability" ? editing.row : null;
    const form = snapForm ?? (row ? {
      name: row.name,
      type: row.type,
      sourceType: row.sourceType,
      verboseDescription: row.verboseDescription,
      sourceOrigin: row.sourceOrigin ?? "",
      tags: row.tags.join(", "),
      isPublic: row.isPublic,
    } : null);
    const slots = snapSlots ?? (row ? row.primitiveLinks.map((link) => ({
      primitiveId: link.primitiveId,
      role: link.role ?? "OTHER",
      quantity: link.quantity,
      sortOrder: link.sortOrder,
      slotLabel: link.slotLabel ?? link.primitive.name,
      primitive: link.primitive,
    })) : []);
    // Resolve effect references: prefer the live form snapshot
    // (state.effectIds from the capability form), fall back to whatever
    // the loaded row carries. The capability form lets the user add
    // effects via the EffectPicker; those need to show in the preview
    // so the user can see their composition take shape.
    const effectRefs = snapEffectIds
      ? snapEffectIds
          .map((id) => effects.find((e) => e.id === id))
          .filter((e): e is (typeof effects)[number] => Boolean(e))
          .map((e) => ({
            id: e.id,
            name: e.name,
            narrativeDescription: e.narrativeDescription,
          }))
      : [];
    if (!form) return null;
    return (
      <CapabilityFormPreview
        form={form}
        slots={slots}
        effects={effectRefs}
      />
    );
  }, [build, editing, formSnapshot, effects]);

  // Tab strip across the BOTTOM of the page. Acts as the in-page type
  // selector — the user moved it from the top to free vertical space
  // for the library column. Rendered as a bottomBar so the FAB can sit
  // above it without overlap (we leave 4rem of bottom padding on the
  // AppShell's <main> to keep room for both).
  function buildTabs() {
    const tabs: { key: GrammarBuildMode; label: string }[] = [
      { key: "primitive", label: "Primitive" },
      { key: "effect", label: "Effect" },
      { key: "capability", label: "Capability" },
    ];
    return (
      <div
        role="tablist"
        aria-label="Build mode"
        className="flex bg-card"
      >
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
        storageKey="grammar"
        library={
          <GrammarLibrary
            build={build}
            libraryItems={libraryItems}
            primitives={primitives}
            effects={effects}
            capabilities={capabilities}
            primitiveCategories={primitiveCategories}
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

function buildLabel(mode: GrammarBuildMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}