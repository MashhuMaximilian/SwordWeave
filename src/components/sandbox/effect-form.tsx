"use client";

// EffectForm: controlled form-only composer for effects.
// Receives optional initialEffect for ?edit= pre-fill.
// Fires onStateChange so the page can render a live preview.
// Save logic lives here. Library + preview + saved-effects are owned by the page.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { EffectFormState, SlottedPrimitive } from "./effect-form-preview";

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

export type EffectFormSlot = {
  primitiveId: number;
  quantity: number;
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
};

export function EffectForm({
  initialEffect,
  availablePrimitives,
  onStateChange,
  onSaved,
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
  onStateChange?: (state: {
    form: EffectFormState;
    slots: EffectFormSlot[];
  }) => void;
  onSaved?: (effect: EffectRow) => void;
}) {
  const [form, setForm] = useState<EffectFormState>(blankForm);
  const [slots, setSlots] = useState<EffectFormSlot[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Pre-load from initialEffect once.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (!initialEffect) return;
    setForm({
      name: initialEffect.name,
      narrativeDescription: initialEffect.narrativeDescription,
      sourceOrigin: initialEffect.sourceOrigin ?? "",
      tags: (initialEffect.tags ?? []).join(", "),
      isPublic: initialEffect.isPublic,
    });
    setSlots(
      initialEffect.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        quantity: link.quantity,
        primitive: link.primitive,
      })),
    );
    setMessage(
      initialEffect.userId
        ? "Loaded your effect for editing."
        : "Loaded library effect. Saving creates your private copy.",
    );
  }, [initialEffect]);

  // Fire onStateChange.
  useEffect(() => {
    onStateChange?.({ form, slots });
  }, [form, slots, onStateChange]);

  function updateForm(field: keyof EffectFormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addSlot(primitiveId: number) {
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
        { primitiveId, quantity: 1, primitive },
      ];
    });
  }

  function updateQuantity(primitiveId: number, quantity: number) {
    setSlots((current) =>
      current.map((s) =>
        s.primitiveId === primitiveId
          ? { ...s, quantity: Math.max(1, quantity) }
          : s,
      ),
    );
  }

  function removeSlot(primitiveId: number) {
    setSlots((current) => current.filter((s) => s.primitiveId !== primitiveId));
  }

  function resetEditor() {
    setForm(blankForm);
    setSlots([]);
    setPickerOpen(false);
    setMessage("Started a fresh effect.");
    bootstrappedRef.current = true;
  }

  function submitEffect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const body = {
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
      })),
    };

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
    (sum, slot) => sum + slot.primitive.buCost * slot.quantity,
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitEffect}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {initialEffect ? "Inspect Effect" : "Add New Effect"}
        </p>
        <button
          type="button"
          onClick={resetEditor}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
        >
          Reset
        </button>
      </div>

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

      <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium">
        <input
          checked={form.isPublic}
          className="mt-1 size-4"
          onChange={(event) => updateForm("isPublic", event.target.checked)}
          type="checkbox"
        />
        <span>
          Public Library Candidate
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Auth and publishing gates will decide who can actually publish this
            later.
          </span>
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
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {totalBu} BU
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
            >
              {pickerOpen ? "Close picker" : "+ Slot primitive"}
            </button>
          </div>
        </div>

        {pickerOpen ? (
          <PrimitivePicker
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
            {slots.map((slot) => (
              <li
                key={slot.primitiveId}
                className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_96px_auto] sm:items-center"
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

function PrimitivePicker({
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
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
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