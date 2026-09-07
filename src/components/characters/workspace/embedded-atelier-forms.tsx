"use client";

/**
 * Phase 9.3 (Mashu 2026-09-06): Embedded atelier form lifters.
 *
 * The atelier under /atelier owns the canonical authoring forms:
 *   - <PrimitiveForm>
 *   - <CapabilityForm>
 *   - <EffectForm>
 *   - <HeritageForm>
 *   - <ItemForm>
 *
 * Those forms were built for the atelier's full-page sandbox layout.
 * For the character-sheet BUILD-mode workspace we need to embed the
 * SAME forms (Mashu: "same UI and functionality as the one in
 * atelier"). Each lifter below:
 *
 *   1. Wraps the atelier form in a sheet-friendly container that
 *      matches the picker modal's width / dark theme / spacing.
 *   2. Provides seed values via initialPrimitive / initialTemplate
 *      / etc. so the Promote tab can pre-fill from a condition.
 *   3. On onSaved, the lifter calls a "post-save attach" API so
 *      the new entity is also slotted onto this character (and
 *      optionally into the source accordion). This is the one
 *      step the atelier doesn't have — atelier edits library rows;
 *      the character sheet also needs the entity on the character.
 *
 * Why a lifter and not a refactor of the atelier forms:
 *   The atelier forms call /api/primitives (etc) directly. That
 *   contract stays. The lifter just intercepts the save callback
 *   and runs an additional side-effect — like the modal does
 *   today for primitive slots.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { CapabilityForm } from "@/components/sandbox/capability-form";
import { EffectForm } from "@/components/sandbox/effect-form";
import { HeritageForm } from "@/components/sandbox/heritage-form";
import { ItemForm } from "@/components/sandbox/item-form";

import type { ModifierDraft } from "@/components/sandbox/primitive-form";
import type {
  TemplateSlot,
} from "@/components/sandbox/heritage-form-preview";
import type {
  EffectFormSlot,
} from "@/components/sandbox/effect-form";

// =============================================================================
// Shared wrapper styling
// =============================================================================

const SHEET_FORM_CLASS =
  "max-h-[70vh] overflow-y-auto rounded-md border border-border bg-background p-3 sm:p-4";

function SheetError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
    >
      {message}
    </p>
  );
}

function PostSaveStatus({
  pending,
  message,
}: {
  pending: boolean;
  message: string | null;
}) {
  if (!pending && !message) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
      {pending && <Loader2 className="size-3 animate-spin" />}
      {message}
    </div>
  );
}

// =============================================================================
// EmbeddedPrimitiveForm
// =============================================================================

/**
 * Atelier's PrimitiveForm lifted into the character-sheet picker.
 *
 * On save, the lifter:
 *   1. lets PrimitiveForm save the new primitive library row,
 *   2. POSTs /api/characters/[id]/primitives to slot it onto
 *      the source accordion.
 *
 * The Promote tab uses `seed` to pre-fill name + description +
 * the first modifier (the condition itself), so the user gets a
 * "condition wrapped as primitive" experience identical to
 * creating a primitive in /atelier with the condition pre-loaded.
 */

// Atelier's PrimitiveForm / HeritageForm / CapabilityForm / EffectForm
// keep their row types LOCAL (not exported). We declare minimal
// mirror types here so the lifter can type its callbacks. The
// atelier owns the truth; we only read .id from each row.
type AtelierPrimitiveRow = { id: number };
type AtelierHeritageRow = { id: string; name: string };
type AtelierCapabilityRow = { id: string };
type AtelierEffectRow = { id: string };
export interface EmbeddedPrimitiveFormProps {
  characterId: string;
  accordionKind: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";
  /** Optional seed for the Promote tab. */
  seed?: {
    name: string;
    description: string;
    /** If provided, this is added as the first modifier draft so the
     *  user can build on the condition's mechanics directly. */
    startingModifier?: ModifierDraft;
  } | null;
  /** Optional explicit callback after the slot succeeds. */
  onSlot?: (info: { primitiveId: number }) => void;
}

export function EmbeddedPrimitiveForm({
  characterId,
  accordionKind,
  seed,
  onSlot,
}: EmbeddedPrimitiveFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  const handleSaved = useCallback(
    async (primitive: AtelierPrimitiveRow) => {
      setError(null);
      setAttaching(true);
      setAttachMessage("Slotting onto accordion…");
      try {
        const res = await fetch(
          `/api/characters/${characterId}/primitives`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accordion: accordionKind,
              primitiveId: primitive.id,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Slot failed (${res.status}).`,
          );
        }
        setAttachMessage("Slotted.");
        onSlot?.({ primitiveId: primitive.id });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to slot primitive.",
        );
      } finally {
        setAttaching(false);
      }
    },
    [characterId, accordionKind, onSlot],
  );

  return (
    <div>
      {error && <SheetError message={error} />}
      <div className={SHEET_FORM_CLASS}>
        {seed ? (
          // Seed-shape cast: atelier's PrimitiveRow is local to the
          // atelier form; the lifter only needs id / name / narrative.
          // We synthesize a partial row so the form pre-fills the
          // name + description fields. The form's blankForm fills the
          // rest on mount.
          <PrimitiveForm
            initialPrimitive={
              {
                id: 0,
                name: seed.name,
                category: "VERB_TIER",
                buCost: 1,
                narrativeRule: seed.description,
                isMirrorable: false,
                mirrorBuCredit: 0,
                hardModifiers: [],
                isPublic: false,
                userId: null,
              } as never
            }
            // Phase 9.4 (Mashu 2026-09-07): Promote tab pre-adds
            // the chosen condition as a starting ModifierDraft so
            // it appears as a real row in the modifier list (not
            // just a name seed).
            initialModifierDrafts={
              seed.startingModifier ? [seed.startingModifier] : []
            }
            onSaved={(p) => void handleSaved(p as AtelierPrimitiveRow)}
          />
        ) : (
          <PrimitiveForm
            onSaved={(p) => void handleSaved(p as AtelierPrimitiveRow)}
          />
        )}
      </div>
      <PostSaveStatus pending={attaching} message={attachMessage} />
    </div>
  );
}

// =============================================================================
// EmbeddedHeritageForm (formalize accordion → heritage)
// =============================================================================

/**
 * Atelier's HeritageForm lifted into the formalize sheet. Pre-loads
 * the form with the primitives currently slotted to the accordion,
 * so the user can edit metadata + reassign before committing.
 */
export interface EmbeddedHeritageFormProps {
  characterId: string;
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  /** Primitives currently slotted to this accordion — passed in
   *  as availablePrimitives so the user can edit/reorder. */
  primitives: TemplateSlot[];
  /** Existing capabilities on the character — passed in as
   *  availableCapabilities so the user can bundle. */
  capabilities: TemplateSlot[];
  onFormalized?: (info: { heritageId: string; heritageName: string }) => void;
}

export function EmbeddedHeritageForm({
  characterId,
  kind,
  primitives,
  capabilities,
  onFormalized,
}: EmbeddedHeritageFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  // Phase 9.5 follow-up (Mashu 2026-09-07): the modal's
  // header says "Will bundle N primitives" but the form
  // below was empty until the user clicked "Slot into
  // build" on each one. Mashu 2026-09-07: "the primitives
  // nested do not appear there in modal even if it sayd
  // it will bundle the x primitives. When this happens
  // the inheritance also changes bc they are not direct
  // anymore so be careful" — i.e. the user was expecting
  // the formalize to auto-slot everything it counted.
  //
  // Dispatch the slot events exactly once when the form
  // mounts. HeritageForm's `sw-sandbox-slot` listener
  // (line 345 of heritage-form.tsx) handles the rest.
  // We dispatch after a microtask so the listener is
  // attached by the time the events fire.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const p of primitives) {
        window.dispatchEvent(
          new CustomEvent("sw-sandbox-slot", {
            detail: { kind: "primitive", id: p.id, label: p.name },
          }),
        );
      }
      for (const c of capabilities) {
        window.dispatchEvent(
          new CustomEvent("sw-sandbox-slot", {
            detail: { kind: "capability", id: c.id, label: c.name },
          }),
        );
      }
    }, 0);
    return () => window.clearTimeout(t);
  // We intentionally fire on mount once — primitives /
  // capabilities arriving later shouldn't re-prepopulate
  // (the user may have already cleared slots). The modal
  // itself unmounts/remounts on each open so this is fine.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaved = useCallback(
    async (template: AtelierHeritageRow) => {
      setError(null);
      setAttaching(true);
      setAttachMessage("Attaching to character…");
      try {
        const res = await fetch(
          `/api/characters/${characterId}/heritages/formalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accordion: kind,
              heritageId: template.id,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Attach failed (${res.status}).`,
          );
        }
        setAttachMessage("Heritage formalized.");
        onFormalized?.({
          heritageId: template.id,
          heritageName: template.name,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to attach heritage.",
        );
      } finally {
        setAttaching(false);
      }
    },
    [characterId, kind, onFormalized],
  );

  return (
    <div>
      {error && <SheetError message={error} />}
      <div className={SHEET_FORM_CLASS}>
        <HeritageForm
          initialKind={kind}
          availablePrimitives={primitives
            .filter((p) => typeof p.id === "number")
            .map((p) => ({
              id: p.id as number,
              name: p.name,
              category: p.category,
              buCost: p.buCost,
            }))}
          availableCapabilities={capabilities
            .filter((c) => typeof c.id === "string")
            .map((c) => ({
              id: c.id as string,
              name: c.name,
              type: "capability",
              sourceType: "character",
            }))}
          onSaved={(t) => void handleSaved(t as AtelierHeritageRow)}
        />
      </div>
      <PostSaveStatus pending={attaching} message={attachMessage} />
    </div>
  );
}

// =============================================================================
// EmbeddedCapabilityForm
// =============================================================================

/**
 * Atelier's CapabilityForm lifted into the picker. After save, the
 * lifter POSTs /api/characters/[id]/capabilities/attach so the new
 * capability is slotted onto this character. If `targetSlotTab` is
 * provided, the capability gets that slot_tab so it routes into
 * the requested accordion on the sheet.
 */
export interface EmbeddedCapabilityFormProps {
  characterId: string;
  /** Where the new capability should live on the character sheet.
   *  Maps to character_capabilities.slot_tab. */
  targetSlotTab?: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL" | null;
  /** Available primitives (template-level) for the capability body. */
  availablePrimitives?: TemplateSlot[];
  onAttached?: (info: { capabilityId: string }) => void;
}

export function EmbeddedCapabilityForm({
  characterId,
  targetSlotTab,
  availablePrimitives = [],
  onAttached,
}: EmbeddedCapabilityFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  const handleSaved = useCallback(
    async (capability: AtelierCapabilityRow) => {
      setError(null);
      setAttaching(true);
      setAttachMessage("Attaching capability…");
      try {
        const res = await fetch(
          `/api/characters/${characterId}/capabilities/attach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              capabilityId: capability.id,
              slotTab: targetSlotTab,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Attach failed (${res.status}).`,
          );
        }
        setAttachMessage("Capability attached.");
        onAttached?.({ capabilityId: capability.id });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to attach capability.",
        );
      } finally {
        setAttaching(false);
      }
    },
    [characterId, targetSlotTab, onAttached],
  );

  return (
    <div>
      {error && <SheetError message={error} />}
      <div className={SHEET_FORM_CLASS}>
        <CapabilityForm
          availablePrimitives={availablePrimitives
            .filter((p) => typeof p.id === "number")
            .map((p) => ({
              id: p.id as number,
              name: p.name,
              category: p.category,
              buCost: p.buCost,
            }))}
          availableEffects={[]}
          onSaved={(c) => void handleSaved(c as AtelierCapabilityRow)}
        />
      </div>
      <PostSaveStatus pending={attaching} message={attachMessage} />
    </div>
  );
}

// =============================================================================
// EmbeddedEffectForm
// =============================================================================

/**
 * Atelier's EffectForm lifted into the picker. After save, the
 * lifter POSTs /api/characters/[id]/effects/attach so the new
 * effect is attached to this character at the top level
 * (origin_effect_id on a sentinel primitive slot, or a direct
 * effect_links row — implementation detail in the attach route).
 */
export interface EmbeddedEffectFormProps {
  characterId: string;
  /** Optional seed for pre-fill (e.g. from Promote tab). */
  seed?: {
    name: string;
    description: string;
  } | null;
  /** Available primitives (template-level) for the effect body. */
  availablePrimitives?: TemplateSlot[];
  onAttached?: (info: { effectId: string }) => void;
}

export function EmbeddedEffectForm({
  characterId,
  seed,
  availablePrimitives = [],
  onAttached,
}: EmbeddedEffectFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  const handleSaved = useCallback(
    async (effect: AtelierEffectRow) => {
      setError(null);
      setAttaching(true);
      setAttachMessage("Attaching effect…");
      try {
        const res = await fetch(
          `/api/characters/${characterId}/effects/attach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              effectId: effect.id,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Attach failed (${res.status}).`,
          );
        }
        setAttachMessage("Effect attached.");
        onAttached?.({ effectId: effect.id });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to attach effect.",
        );
      } finally {
        setAttaching(false);
      }
    },
    [characterId, onAttached],
  );

  return (
    <div>
      {error && <SheetError message={error} />}
      <div className={SHEET_FORM_CLASS}>
        {seed ? (
          <EffectForm
            initialEffect={
              {
                id: 0,
                name: seed.name,
                narrativeDescription: seed.description,
                sourceOrigin: null,
                isPublic: false,
                userId: null,
              } as never
            }
            availablePrimitives={availablePrimitives
              .filter((p) => typeof p.id === "number")
              .map((p) => ({
                id: p.id as number,
                name: p.name,
                category: p.category,
                buCost: p.buCost,
              }))}
            onSaved={(e) => void handleSaved(e as AtelierEffectRow)}
          />
        ) : (
          <EffectForm
            availablePrimitives={availablePrimitives
              .filter((p) => typeof p.id === "number")
              .map((p) => ({
                id: p.id as number,
                name: p.name,
                category: p.category,
                buCost: p.buCost,
              }))}
            onSaved={(e) => void handleSaved(e as AtelierEffectRow)}
          />
        )}
      </div>
      <PostSaveStatus pending={attaching} message={attachMessage} />
    </div>
  );
}

// =============================================================================
// Re-exports so the picker / formalize sheets can import types from one place
// =============================================================================

export type { ModifierDraft, TemplateSlot };
export type { EffectFormSlot };

// =============================================================================
// EmbeddedItemForm (Phase 9.5 — Mashu 2026-09-07)
// =============================================================================
//
// Atelier's ItemForm lifted into the picker. Items are a library-level
// concept today — they don't attach to a character the way capabilities
// and effects do. Saving an item here just persists it to the library
// with the current user as author. The user can then drag the new
// item from the library onto the character's PERSONAL accordion.
//
// We intentionally don't call a "character_items attach" route here
// because (a) no such route exists yet and (b) the character sheet
// doesn't render attached-items today. This is consistent with the
// "Author item" mode in the AddPanel: it authors + saves, then the
// user slots it like any other library entity.

export interface EmbeddedItemFormProps {
  characterId: string;
  availablePrimitives?: TemplateSlot[];
  onAttached?: (info: { itemId: string }) => void;
}

export function EmbeddedItemForm({
  characterId: _characterId,
  availablePrimitives = [],
  onAttached,
}: EmbeddedItemFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaved = useCallback(
    (item: { id: string }) => {
      setSaveMessage("Item saved to library.");
      onAttached?.({ itemId: item.id });
    },
    [onAttached],
  );

  return (
    <div>
      {error && <SheetError message={error} />}
      <div className={SHEET_FORM_CLASS}>
        <ItemForm
          availablePrimitives={availablePrimitives
            .filter((p) => typeof p.id === "number")
            .map((p) => ({
              id: p.id as number,
              name: p.name,
              category: p.category,
              buCost: p.buCost,
            }))}
          availableCapabilities={[]}
          availableEffects={[]}
          onSaved={(item: { id: string }) => {
            setSaving(false);
            handleSaved({ id: item.id });
          }}
        />
      </div>
      <PostSaveStatus pending={saving} message={saveMessage} />
    </div>
  );
}
