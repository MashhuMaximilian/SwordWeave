"use client";

// CapabilityForm: controlled form-only composer for capabilities.
// Slots primitives with role + quantity. Save handles both POST (create) and
// PATCH (update via initialCapability).

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CapabilityFormState,
  CapabilitySlot,
} from "./capability-form-preview";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";
import { saveIntentLabel } from "@/lib/publishing/save-intent";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  makeDraftKey,
} from "@/lib/sandbox/form-draft";

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
    notes?: string | null;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

const SLOT_ROLES = [
  "VERB",
  "DOMAIN",
  "SIZING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "AUGMENT",
  "OTHER",
] as const;

function defaultRoleForCategory(category: string): string {
  switch (category) {
    case "VERB_TIER":
      return "VERB";
    case "DOMAIN":
      return "DOMAIN";
    case "SIZING":
      return "SIZING";
    case "TARGETING":
      return "OTHER";
    case "RANGE":
      return "RANGE";
    case "DURATION":
      return "DURATION";
    case "OUTPUT":
      return "OUTPUT";
    case "CONDITION":
      return "OTHER";
    case "STRUCTURAL":
      return "OTHER";
    case "SHEET_AUGMENT":
      return "AUGMENT";
    case "DEFENSE":
      return "OTHER";
    default:
      return "OTHER";
  }
}

const blankForm: CapabilityFormState = {
  name: "",
  type: "ACTIVE",
  sourceType: "PHYSICAL",
  verboseDescription: "",
  sourceOrigin: "",
  tags: "",
  isPublic: false,
};

export function CapabilityForm({
  initialCapability,
  availablePrimitives,
  availableEffects,
  intent,
  sourceId: _sourceId, // Phase 2: kept for the future when forms use sourceId in the body; the PATCH route reads it from the URL.
  onStateChange,
  onSaved,
  onReset,
}: {
  initialCapability?: CapabilityRow | null;
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  availableEffects: Array<{ id: string; name: string }>;
  /**
   * Phase 2: the save intent from `?intent=fork|load`. The PATCH route
   * reads this from the body to decide between fork-on-save and
   * version-update. Null = greenfield (POST, not PATCH).
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 2: the source row's id. Currently the URL `/api/capabilities/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
  onStateChange?: (state: {
    form: CapabilityFormState;
    slots: CapabilitySlot[];
    effectIds: string[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (capability: CapabilityRow) => void;
  onReset?: () => void;
}) {
  const [form, setForm] = useState<CapabilityFormState>(blankForm);
  const [slots, setSlots] = useState<CapabilitySlot[]>([]);
  const [effectIds, setEffectIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"primitive" | "effect">(
    "primitive",
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  const bootstrappedRef = useRef<string | number | null>(null);
  useEffect(() => {
    const id = initialCapability?.id ?? null;
    // Only bootstrap on first mount OR when the user loads a different
    // entity (different id). Re-bootstrapping resets the form to the new
    // entity's data and clears the dirty flag.
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialCapability) return;
    // Check for a saved draft (e.g. when the form unmounted in the panel
    // and remounted in the drawer). If a draft exists for this entity,
    // restore the slots/effects from it instead of the initial data.
    const draftKey = makeDraftKey("capability", id);
    const draft = loadDraft(draftKey);
    setForm({
      name: initialCapability.name,
      type: initialCapability.type,
      sourceType: initialCapability.sourceType,
      verboseDescription: initialCapability.verboseDescription,
      sourceOrigin: initialCapability.sourceOrigin ?? "",
      tags: (initialCapability.tags ?? []).join(", "),
      isPublic: initialCapability.isPublic,
    });
    if (draft) {
      // Restore effectIds from the draft.
      setEffectIds(draft.effectIds);
      setIsDirty(true); // draft = user was editing
      setMessage("Restored your in-progress edits.");
      clearDraft(draftKey);
      // Restore primitive slots from the draft, re-deriving the primitive
      // object from availablePrimitives. Slots in the draft that can't be
      // matched (e.g. primitive not in the current page) are dropped.
      const restoredSlots: CapabilitySlot[] = [];
      for (const sid of draft.primitiveIds) {
        const prim = availablePrimitives.find((p) => p.id === sid);
        if (!prim) continue;
        restoredSlots.push({
          primitiveId: sid,
          role: defaultRoleForCategory(prim.category),
          quantity: 1,
          sortOrder: restoredSlots.length,
          slotLabel: prim.name,
          primitive: prim,
        });
      }
      setSlots(restoredSlots);
      return;
    }
    setSlots(
      initialCapability.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        role: link.role ?? "OTHER",
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel ?? link.primitive.name,
        notes: link.notes ?? undefined,
        primitive: link.primitive,
      })),
    );
    setEffectIds(
      (initialCapability as unknown as { effectLinks?: Array<{ effectId: string }> })
        .effectLinks?.map((l) => l.effectId) ?? [],
    );
    setIsDirty(false); // pristine after load
    setMessage(
      initialCapability.userId
        ? "Loaded your capability for editing."
        : "Loaded library capability. Saving creates your private copy.",
    );
  }, [initialCapability, availablePrimitives]);

  // Save draft on unmount — when the form unmounts in the panel (split
  // mode exit) or in the drawer, save the current slots/effects so the
  // other instance can restore them on mount.
  useEffect(() => {
    return () => {
      const id = initialCapability?.id ?? null;
      const draftKey = makeDraftKey("capability", id);
      if (slots.length > 0 || effectIds.length > 0) {
        saveDraft(draftKey, {
          primitiveIds: slots.map((s) => s.primitiveId),
          effectIds,
          capabilityIds: [],
          notesByIndex: {},
        });
      } else {
        clearDraft(draftKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, effectIds, initialCapability?.id]);

  useEffect(() => {
    onStateChange?.({ form, slots, effectIds, isDirty });
  }, [form, slots, effectIds, onStateChange, isDirty]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  // External slot trigger: capabilities accept primitives AND effects
  // (per the user's spec). The form's primitive-slot state is already
  // wired; we now also accept effects and add them to `effectIds`.
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{
        kind: "primitive" | "effect" | "capability";
        id: number | string;
        label: string;
      }>;
      if (e.detail.kind === "primitive") {
        const id =
          typeof e.detail.id === "string" ? Number(e.detail.id) : e.detail.id;
        if (!Number.isFinite(id)) return;
        addSlot(id);
        return;
      }
      if (e.detail.kind === "effect") {
        const id = String(e.detail.id);
        setEffectIds((prev) =>
          prev.includes(id) ? prev : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
      // capability kind — not supported on capability form.
    };
    window.addEventListener("sw-sandbox-slot", handler);
    return () => window.removeEventListener("sw-sandbox-slot", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePrimitives]);

  function updateForm(field: keyof CapabilityFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addSlot(primitiveId: number) {
    const primitive = availablePrimitives.find((p) => p.id === primitiveId);
    if (!primitive) return;
    const role = defaultRoleForCategory(primitive.category);
    setIsDirty(true);
    setSlots((prev) => [
      ...prev,
      {
        primitiveId,
        role,
        quantity: 1,
        sortOrder: prev.length,
        slotLabel: primitive.name,
        primitive,
      },
    ]);
  }

  function removeSlot(index: number) {
    setIsDirty(true);
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlotRole(index: number, role: string) {
    setIsDirty(true);
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, role } : slot)),
    );
  }

  function updateSlotQuantity(index: number, quantity: number) {
    setIsDirty(true);
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === index ? { ...slot, quantity: Math.max(1, quantity) } : slot,
      ),
    );
  }

  function removeEffect(id: string) {
    setIsDirty(true);
    setEffectIds((prev) => prev.filter((x) => x !== id));
  }

  function resetEditor() {
    setForm(blankForm);
    setSlots([]);
    setEffectIds([]);
    setPickerOpen(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh capability.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.();
  }

  function submitCapability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Capability name is required.");
      return;
    }
    if (slots.length === 0) {
      setMessage("Add at least one primitive to compile.");
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      sourceType: form.sourceType,
      verboseDescription: form.verboseDescription.trim(),
      sourceOrigin: form.sourceOrigin.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isPublic: form.isPublic,
      primitiveSlots: slots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        sortOrder: s.sortOrder,
        slotLabel: s.slotLabel,
        notes: s.notes ?? "",
      })),
      effectSlots: effectIds.map((id, idx) => ({
        effectId: id,
        sortOrder: idx,
      })),
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialCapability) {
      body["intent"] = intent;
    }

    const url = initialCapability
      ? `/api/capabilities/${initialCapability.id}`
      : "/api/capabilities";
    const method = initialCapability ? "PATCH" : "POST";

    startTransition(async () => {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save capability.";
        setMessage(error);
        return;
      }

      // Phase 2: handle the dispatchOutcome shape. The server may have
      // returned a no-op (with a user-facing message) instead of a row.
      const outcome =
        payload && typeof payload === "object" && "dispatchOutcome" in payload
          ? (payload.dispatchOutcome as {
              kind: "no-op" | "forked" | "version-update";
              message?: string;
              newId?: string | number;
              swapTarget?: boolean;
            })
          : null;

      if (outcome?.kind === "no-op") {
        setMessage(outcome.message ?? "Nothing to save.");
        return;
      }

      const capability =
        payload && typeof payload === "object" && "capability" in payload
          ? (payload.capability as CapabilityRow)
          : null;

      if (capability) {
        onSaved?.(capability);
      }
      resetEditor();
      router.refresh();
      setMessage(`Capability "${capability?.name ?? "(unnamed)"}" saved.`);
    });
  }

  const previewBu = slots.reduce(
    (sum, slot) => sum + slot.primitive.buCost * slot.quantity,
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 sm:p-4"
      onSubmit={submitCapability}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {initialCapability ? "Edit Capability" : "Compiler Inputs"}
          </p>
          {(() => {
            const label = saveIntentLabel(
              intent ?? null,
              initialCapability?.name ?? null,
            );
            if (!label) return null;
            const isFork = intent === "fork";
            return (
              <span
                data-testid="save-intent-chip"
                className={
                  isFork
                    ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                    : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                }
                title={
                  isFork
                    ? "Save will create a fork owned by you."
                    : "Save will update in place if you own this; otherwise create a fork."
                }
              >
                {label}
              </span>
            );
          })()}
        </div>
        <button
          type="button"
          onClick={resetEditor}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
        >
          Reset
        </button>
      </div>

      <label className="block text-sm font-medium">
        Capability Name
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          placeholder="e.g. Fire Strike"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Type
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.type}
            onChange={(e) => updateForm("type", e.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="PASSIVE">Passive</option>
            <option value="AUGMENT">Augment</option>
          </select>
        </label>

        <label className="block text-sm font-medium">
          Source
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.sourceType}
            onChange={(e) => updateForm("sourceType", e.target.value)}
          >
            <option value="PHYSICAL">Physical</option>
            <option value="MAGICAL">Magical</option>
            <option value="PSYCHIC">Psychic</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        Verbose Description
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.verboseDescription}
          onChange={(e) => updateForm("verboseDescription", e.target.value)}
          placeholder="What does this capability do? Include flavor and mechanical notes."
          rows={3}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Source Origin
          <input
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.sourceOrigin}
            onChange={(e) => updateForm("sourceOrigin", e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="block text-sm font-medium">
          Tags (comma-separated)
          <input
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.tags}
            onChange={(e) => updateForm("tags", e.target.value)}
            placeholder="combat, fire, aoe"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5 text-sm font-medium">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Visibility
        </span>
        <VisibilitySelect
          compact
          value={form.isPublic ? "PUBLIC" : "PRIVATE"}
          onChange={(next) => updateForm("isPublic", next === "PUBLIC")}
        />
        <span className="text-[10px] font-normal text-muted-foreground">
          Public entries appear in the Library. Private and Followers-only
          entries can be promoted to Public from the My Creations page.
        </span>
      </label>

      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Primitive Slots</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {previewBu} BU
            </span>
            <button
              type="button"
              onClick={() => {
                setPickerTarget("primitive");
                setPickerOpen((v) => !v);
              }}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
            >
              {pickerOpen && pickerTarget === "primitive"
                ? "Close picker"
                : "+ Slot primitive"}
            </button>
          </div>
        </div>

        {pickerOpen && pickerTarget === "primitive" ? (
          <SlotPicker
            primitives={availablePrimitives}
            alreadySlotted={new Set(slots.map((s) => s.primitiveId))}
            onSelect={(id) => {
              addSlot(id);
            }}
          />
        ) : null}

        {slots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No primitives slotted yet. Click "+ Slot primitive" to add one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slots.map((slot, idx) => (
              <li
                key={`${slot.primitiveId}-${idx}`}
                className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {slot.primitive.name}
                </span>
                <select
                  value={slot.role}
                  onChange={(e) => updateSlotRole(idx, e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  {SLOT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={slot.quantity}
                  onChange={(e) =>
                    updateSlotQuantity(idx, Number(e.target.value) || 1)
                  }
                  className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-xs"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {slot.primitive.buCost * slot.quantity} BU
                </span>
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Bundled Effects</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Effects nested inside this capability. Pick from the library or
              use the &ldquo;Slot into build&rdquo; action on a library card.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPickerTarget("effect");
              setPickerOpen((v) => !v);
            }}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            {pickerOpen && pickerTarget === "effect"
              ? "Close picker"
              : "+ Slot effect"}
          </button>
        </div>

        {pickerOpen && pickerTarget === "effect" ? (
          <EffectPicker
            effects={availableEffects}
            alreadySlotted={new Set(effectIds)}
            onSelect={(id) => {
              setEffectIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
              setIsDirty(true);
            }}
          />
        ) : null}

        {effectIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No effects bundled yet. Click &ldquo;+ Slot effect&rdquo; to add one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {effectIds.map((id) => {
              const effect = availableEffects.find((e) => e.id === id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {effect?.name ?? id}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEffect(id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-sandbox-submit
          disabled={isPending}
          className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : initialCapability
              ? "Save Changes"
              : "Compile Capability"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}

function EffectPicker({
  effects,
  alreadySlotted,
  onSelect,
}: {
  effects: Array<{ id: string; name: string }>;
  alreadySlotted: Set<string>;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = effects.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.name.toLowerCase().includes(q);
  });
  return (
    <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-card p-2">
      <input
        type="text"
        placeholder="Search effects…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <ul className="divide-y">
        {filtered.map((e) => {
          const isAlready = alreadySlotted.has(e.id);
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
              </div>
              <button
                type="button"
                disabled={isAlready}
                onClick={() => onSelect(e.id)}
                className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {isAlready ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlotPicker({
  primitives,
  alreadySlotted,
  onSelect,
}: {
  primitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  alreadySlotted: Set<number>;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = primitives.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });
  return (
    <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-card p-2">
      <input
        type="text"
        placeholder="Search primitives…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <ul className="divide-y">
        {filtered.map((p) => {
          const isAlready = alreadySlotted.has(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category.replace(/_/g, " ")}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {p.buCost} BU
              </span>
              <button
                type="button"
                disabled={isAlready}
                onClick={() => onSelect(p.id)}
                className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {isAlready ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}