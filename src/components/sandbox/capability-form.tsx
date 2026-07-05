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
  onStateChange?: (state: {
    form: CapabilityFormState;
    slots: CapabilitySlot[];
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (!initialCapability) return;
    setForm({
      name: initialCapability.name,
      type: initialCapability.type,
      sourceType: initialCapability.sourceType,
      verboseDescription: initialCapability.verboseDescription,
      sourceOrigin: initialCapability.sourceOrigin ?? "",
      tags: (initialCapability.tags ?? []).join(", "),
      isPublic: initialCapability.isPublic,
    });
    setSlots(
      initialCapability.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        role: link.role ?? "OTHER",
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel ?? link.primitive.name,
        primitive: link.primitive,
      })),
    );
    setIsDirty(false); // pristine after load
    setMessage(
      initialCapability.userId
        ? "Loaded your capability for editing."
        : "Loaded library capability. Saving creates your private copy.",
    );
  }, [initialCapability]);

  useEffect(() => {
    onStateChange?.({ form, slots, isDirty });
  }, [form, slots, onStateChange, isDirty]);

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

  function resetEditor() {
    setForm(blankForm);
    setSlots([]);
    setPickerOpen(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh capability.");
    bootstrappedRef.current = true;
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

    const body = {
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
      })),
    };

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
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitCapability}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {initialCapability ? "Edit Capability" : "Compiler Inputs"}
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

      <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium">
        <input
          checked={form.isPublic}
          className="mt-1 size-4"
          onChange={(e) => updateForm("isPublic", e.target.checked)}
          type="checkbox"
        />
        <span>
          Publish to library (visible to everyone)
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Leave unchecked to keep this capability private to your account.
          </span>
        </span>
      </label>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Primitive Slots</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {previewBu} BU
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
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2"
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
          type="submit"
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