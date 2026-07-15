"use client";

// EffectForm: controlled form-only composer for effects.
// Receives optional initialEffect for ?edit= pre-fill.
// Fires onStateChange so the page can render a live preview.
// Save logic lives here. Library + preview + saved-effects are owned by the page.
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EffectFormState, SlottedPrimitive } from "./effect-form-preview";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";
import { saveIntentLabel } from "@/lib/publishing/save-intent";
import { computeEffectContentHash } from "@/lib/publishing/hash-content";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";

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
    notes?: string | null;
    /**
     * Phase 7 Q-M-UX: per-slot Mirrored flag from the DB. Defaulted
     * to false when reading legacy rows that predate migration 0034.
     */
    isMirrored?: boolean;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type EffectFormSlot = {
  primitiveId: number;
  quantity: number;
  /**
   * Per-slot notes from the source row. Optional in the UI; the form
   * silently carries them so a "save with no edits" round-trip computes
   * the same content hash as the source's stored hash. Without this, the
   * dispatcher's no-op short-circuit never fires for legacy rows.
   */
  notes?: string | undefined;
  /**
   * Phase 7 Q-M-UX: per-slot Mirrored flag. Drives the BU debt at
   * template/character-creation time but does NOT change the effect's
   * own BU cost. Defaults to false.
   */
  isMirrored: boolean;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
  };
};

const blankForm: EffectFormState = {
  name: "",
  narrativeDescription: "",
  sourceOrigin: "",
  tags: "",
  isPublic: false,
  // Phase 8: per-entity iconography
  iconSource: null,
  iconKey: null,
  iconUrl: null,
  iconColor: "#ffffff",
};

export function EffectForm({
  initialEffect,
  availablePrimitives,
  intent,
  sourceId: _sourceId, // Phase 2: kept for the future when forms use sourceId in the body; the PATCH route reads it from the URL.
  onStateChange,
  onSaved,
  onReset,
}: {
  initialEffect?: EffectRow | null;
  /**
   * The list of primitives the user can slot in. Passed from the page so the
   * picker can be rendered when the user clicks "+ Slot primitive".
   */
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  /**
   * Phase 2: the save intent from `?intent=fork|load`. The PATCH route
   * reads this from the body to decide between fork-on-save and
   * version-update. Null = greenfield (POST, not PATCH).
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 2: the source row's id. Currently the URL `/api/effects/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
  onStateChange?: (state: {
    form: EffectFormState;
    slots: EffectFormSlot[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (effect: EffectRow) => void;
  onReset?: () => void;
}) {
  const [form, setForm] = useState<EffectFormState>(blankForm);
  const [slots, setSlots] = useState<EffectFormSlot[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  // Pre-load from initialEffect — only on mount or when the user loads
  // a different entity (id changes). Without the id check, switching
  // rows in the library would not refresh the form.
  const bootstrappedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = initialEffect?.id ?? null;
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialEffect) return;
    setForm({
      name: initialEffect.name,
      narrativeDescription: initialEffect.narrativeDescription,
      sourceOrigin: initialEffect.sourceOrigin ?? "",
      tags: (initialEffect.tags ?? []).join(", "),
      isPublic: initialEffect.isPublic,
      // Phase 8: per-entity iconography
      iconSource: initialEffect.iconSource,
      iconKey: initialEffect.iconKey,
      iconUrl: initialEffect.iconUrl,
      iconColor: initialEffect.iconColor,
    });
    setSlots(
      initialEffect.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        quantity: link.quantity,
        notes: link.notes ?? undefined,
        // Phase 7 Q-M-UX: read per-slot Mirrored flag from the link.
        // `link.isMirrored` is the DB column we just added in migration 0034.
        isMirrored: link.isMirrored ?? false,
        primitive: link.primitive,
      })),
    );
    setIsDirty(false); // pristine after load
    setMessage(
      initialEffect.userId
        ? "Loaded your effect for editing."
        : "Loaded library effect. Saving creates your private copy.",
    );
  }, [initialEffect]);

  // Fire onStateChange.
  useEffect(() => {
    onStateChange?.({ form, slots, isDirty });
  }, [form, slots, onStateChange, isDirty]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  // External slot trigger: the user clicks a primitive in the Library
  // column and taps "Slot into build" in its preview. EffectForm only
  // accepts primitives, so filter on kind and ignore everything else.
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{
        kind: "primitive" | "effect" | "capability";
        id: number | string;
        label: string;
      }>;
      if (e.detail.kind !== "primitive") return;
      const id =
        typeof e.detail.id === "string" ? Number(e.detail.id) : e.detail.id;
      if (!Number.isFinite(id)) return;
      addSlot(id);
    };
    window.addEventListener("sw-sandbox-slot", handler);
    return () => window.removeEventListener("sw-sandbox-slot", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePrimitives]);

  function updateForm(field: keyof EffectFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addSlot(primitiveId: number) {
    setIsDirty(true);
    setSlots((current) => {
      const existing = current.find((s) => s.primitiveId === primitiveId);
      if (existing) {
        return current.map((s) =>
          s.primitiveId === primitiveId
            ? { ...s, quantity: s.quantity + 1 }
            : s,
        );
      }
      const primitive = availablePrimitives.find((p) => p.id === primitiveId);
      if (!primitive) return current;
      return [
        ...current,
        { primitiveId, quantity: 1, primitive, isMirrored: false },
      ];
    });
  }

  function updateQuantity(primitiveId: number, quantity: number) {
    setIsDirty(true);
    setSlots((current) =>
      current.map((s) =>
        s.primitiveId === primitiveId
          ? { ...s, quantity: Math.max(1, quantity) }
          : s,
      ),
    );
  }

  function removeSlot(primitiveId: number) {
    setIsDirty(true);
    setSlots((current) => current.filter((s) => s.primitiveId !== primitiveId));
  }

  function toggleSlotMirror(primitiveId: number) {
    setIsDirty(true);
    setSlots((current) =>
      current.map((s) =>
        s.primitiveId === primitiveId
          ? { ...s, isMirrored: !s.isMirrored }
          : s,
      ),
    );
  }

  function resetEditor() {
    setForm(blankForm);
    setSlots([]);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh effect.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.();
  }

  function submitEffect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const body: Record<string, unknown> = {
      name: form.name,
      narrativeDescription: form.narrativeDescription,
      sourceOrigin: form.sourceOrigin || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isPublic: form.isPublic,
      primitiveSlots: slots.map((s) => ({
        primitiveId: s.primitiveId,
        quantity: s.quantity,
        notes: s.notes ?? "",
        // Phase 7 Q-M-UX: per-slot Mirrored flag drives the BU debt at
        // template/character-creation time but does NOT change the
        // effect's own BU cost.
        isMirrored: s.isMirrored,
      })),
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialEffect) {
      body["intent"] = intent;
    }

    const url = initialEffect ? `/api/effects/${initialEffect.id}` : "/api/effects";
    const method = initialEffect ? "PATCH" : "POST";

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
            : "Unable to save effect.";
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

      const effect =
        payload && typeof payload === "object" && "effect" in payload
          ? (payload.effect as EffectRow)
          : null;

      if (effect) {
        onSaved?.(effect);
      }
      resetEditor();
      router.refresh();
      setMessage(`Effect "${effect?.name ?? "(unnamed)"}" saved.`);
    });
  }

  const totalBu = slots.reduce(
    (sum, slot) => sum + Math.abs(slot.primitive.buCost * slot.quantity),
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitEffect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {initialEffect ? "Inspect Effect" : "Add New Effect"}
          </p>
          {(() => {
            const label = saveIntentLabel(
              intent ?? null,
              initialEffect?.name ?? null,
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

      {/* Phase 8: per-entity iconography */}
      <IconSlot
        iconSource={(form.iconSource as IconSource | null) ?? null}
        iconKey={form.iconKey}
        iconUrl={form.iconUrl}
        iconColor={form.iconColor}
        onChange={(next) =>
          setForm({
            ...form,
            iconSource: next.iconSource,
            iconKey: next.iconKey ?? null,
            iconUrl: next.iconUrl ?? null,
            iconColor: next.iconColor,
          })
        }
        size={56}
        label="Icon"
        helper="Pick from game-icons.net or upload your own."
      />

      <label className="block text-sm font-medium">
        Effect Name
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.name}
          onChange={(event) => updateForm("name", event.target.value)}
          placeholder="Vertigo Spasms"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Source Origin
          <input
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.sourceOrigin}
            onChange={(event) => updateForm("sourceOrigin", event.target.value)}
            placeholder="Core Campaign"
          />
        </label>

        <label className="block text-sm font-medium">
          Tags (comma-separated)
          <input
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.tags}
            onChange={(event) => updateForm("tags", event.target.value)}
            placeholder="debuff, poison, movement"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm font-medium">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Visibility
        </span>
        <VisibilitySelect
          compact
          value={form.isPublic ? "PUBLIC" : "PRIVATE"}
          onChange={(next) => {
            // Map Visibility → isPublic for the API submit. FOLLOWERS_ONLY
            // is shown in the UI per the user's spec but full publication
            // happens via /creations → visibility endpoint after save.
            updateForm("isPublic", next === "PUBLIC");
          }}
        />
        <span className="text-[10px] font-normal text-muted-foreground">
          Public entries appear in the Library. Private and Followers-only
          entries can be promoted to Public from the My Creations page.
        </span>
      </label>

      <label className="block text-sm font-medium">
        Narrative Rule
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.narrativeDescription}
          onChange={(event) =>
            updateForm("narrativeDescription", event.target.value)
          }
          placeholder="The target loses spatial certainty and struggles to keep balance..."
        />
      </label>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Slotted Primitives</h3>
          <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            {totalBu} BU
          </span>
        </div>
        {slots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No primitives slotted yet. Pick a primitive from the Library
            column and use its &ldquo;Slot into build&rdquo; action.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slots.map((slot) => (
              <li
                key={slot.primitiveId}
                className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_96px_auto_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-bold">{slot.primitive.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.primitive.buCost} BU each
                  </p>
                </div>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                  min={1}
                  type="number"
                  value={slot.quantity}
                  onChange={(event) =>
                    updateQuantity(
                      slot.primitiveId,
                      Number(event.target.value),
                    )
                  }
                />
                <label
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs"
                  title="Phase 7 Q-M-UX: when this slot is mirrored, the consumer pays BU debt at template/character-creation time."
                >
                  <input
                    type="checkbox"
                    checked={slot.isMirrored}
                    onChange={() => toggleSlotMirror(slot.primitiveId)}
                    className="size-3.5"
                  />
                  <span>Mirror</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeSlot(slot.primitiveId)}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
          disabled={isPending}
          type="submit"
          data-sandbox-submit
        >
          {isPending ? "Saving..." : "Save Effect"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}

// DEAD CODE REMOVED — Phase-7 cleanup: the in-form PrimitivePicker
// was removed because the "+ Slot primitive" button was removed.
// Slotting primitives happens via the Library column's "Slot into
// build" action. PrimitivePicker is gone; the slot list is rendered
// directly from the `slots` state.
//
// The function used to live here.