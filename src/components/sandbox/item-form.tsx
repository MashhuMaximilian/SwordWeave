"use client";

// ItemForm: controlled form-only composer for items.
// Slots primitives (ITEM_AUGMENT category) + capabilities + effects.

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ItemFormState,
  ItemPrimitiveSlot,
} from "./item-form-preview";

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

const ITEM_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

const blankForm: ItemFormState = {
  name: "",
  itemType: "WEAPON",
  rarity: "COMMON",
  buCost: "0",
  description: "",
  slotCost: "1",
  isTwoHanded: false,
  isConsumable: false,
  actsAsFocus: true,
  isPublic: false,
  sourceOrigin: "",
  tags: "",
};

export function ItemForm({
  initialItem,
  availablePrimitives,
  availableCapabilities,
  availableEffects,
  onStateChange,
  onSaved,
  onReset,
}: {
  initialItem?: ItemRow | null;
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  availableCapabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
  }>;
  availableEffects: Array<{
    id: string;
    name: string;
  }>;
  onStateChange?: (state: {
    form: ItemFormState;
    primitiveSlots: ItemPrimitiveSlot[];
    capabilityIds: string[];
    effectIds: string[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (item: ItemRow) => void;
  onReset?: () => void;
}) {
  const [form, setForm] = useState<ItemFormState>(blankForm);
  const [primitiveIds, setPrimitiveIds] = useState<number[]>([]);
  const [capabilityIds, setCapabilityIds] = useState<string[]>([]);
  const [effectIds, setEffectIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<
    "primitive" | "capability" | "effect"
  >("primitive");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  const itemAugmentPrimitives = availablePrimitives.filter(
    (p) => p.category === "ITEM_AUGMENT",
  );

  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (!initialItem) return;
    setForm({
      name: initialItem.name,
      itemType: initialItem.itemType,
      rarity: initialItem.rarity,
      buCost: String(initialItem.buCost),
      description: initialItem.description,
      slotCost: String(initialItem.slotCost),
      isTwoHanded: initialItem.isTwoHanded,
      isConsumable: initialItem.isConsumable,
      actsAsFocus: initialItem.actsAsFocus,
      isPublic: initialItem.isPublic,
      sourceOrigin: initialItem.sourceOrigin ?? "",
      tags: (initialItem.tags ?? []).join(", "),
    });
    setPrimitiveIds(initialItem.primitiveLinks.map((l) => l.primitiveId));
    setIsDirty(false); // pristine after load
    setMessage(
      initialItem.userId
        ? "Loaded your item for editing."
        : "Loaded library item. Saving creates your private copy.",
    );
  }, [initialItem]);

  const slottedPrimitives = primitiveIds
    .map((id) => itemAugmentPrimitives.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  useEffect(() => {
    onStateChange?.({
      form,
      primitiveSlots: slottedPrimitives.map((p) => ({
        primitiveId: p.id,
        primitive: p,
      })),
      capabilityIds,
      effectIds,
      isDirty,
    });
  }, [form, slottedPrimitives, capabilityIds, effectIds, onStateChange, isDirty]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  function updateForm(field: keyof ItemFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePrimitive(id: number) {
    setIsDirty(true);
    setPrimitiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCapability(id: string) {
    setIsDirty(true);
    setCapabilityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleEffect(id: string) {
    setIsDirty(true);
    setEffectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function resetEditor() {
    setForm(blankForm);
    setPrimitiveIds([]);
    setCapabilityIds([]);
    setEffectIds([]);
    setPickerOpen(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh item.");
    bootstrappedRef.current = true;
    onReset?.();
  }

  function submitItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Item name is required.");
      return;
    }

    const body = {
      name: form.name.trim(),
      itemType: form.itemType,
      rarity: form.rarity,
      buCost: Math.max(0, Number(form.buCost) || 0),
      description: form.description,
      slotCost: Math.max(1, Number(form.slotCost) || 1),
      isTwoHanded: form.isTwoHanded,
      isConsumable: form.isConsumable,
      actsAsFocus: form.actsAsFocus,
      isPublic: form.isPublic,
      sourceOrigin: form.sourceOrigin.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      primitiveIds,
      capabilityIds,
      effectIds,
    };

    const url = initialItem ? `/api/items/${initialItem.id}` : "/api/items";
    const method = initialItem ? "PATCH" : "POST";

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
            : "Unable to save item.";
        setMessage(error);
        return;
      }

      const item =
        payload && typeof payload === "object" && "item" in payload
          ? (payload.item as ItemRow)
          : null;

      if (item) {
        onSaved?.(item);
      }
      resetEditor();
      router.refresh();
      setMessage(`Item "${item?.name ?? "(unnamed)"}" saved.`);
    });
  }

  const computedBu = slottedPrimitives.reduce(
    (sum, slot) => sum + slot.buCost,
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitItem}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {initialItem ? "Edit Item" : "New Item"}
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
        Name
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          placeholder="e.g. Flamebrand Longsword"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Type
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.itemType}
            onChange={(e) => updateForm("itemType", e.target.value)}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Rarity
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.rarity}
            onChange={(e) => updateForm("rarity", e.target.value)}
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Slot Cost
          <input
            type="number"
            min={1}
            max={100}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.slotCost}
            onChange={(e) => updateForm("slotCost", e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Manual BU
          <input
            type="number"
            min={0}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.buCost}
            onChange={(e) => updateForm("buCost", e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Description
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
          placeholder="Lore, mechanics, anything notable..."
          rows={3}
        />
      </label>

      <label className="block text-sm font-medium">
        Tags (comma separated)
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.tags}
          onChange={(e) => updateForm("tags", e.target.value)}
          placeholder="fire, knight, focus"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Checkbox
          label="Two-handed"
          checked={form.isTwoHanded}
          onChange={(v) => updateForm("isTwoHanded", v)}
        />
        <Checkbox
          label="Consumable"
          checked={form.isConsumable}
          onChange={(v) => updateForm("isConsumable", v)}
        />
        <Checkbox
          label="Acts as focus"
          checked={form.actsAsFocus}
          onChange={(v) => updateForm("actsAsFocus", v)}
        />
        <Checkbox
          label="Public"
          checked={form.isPublic}
          onChange={(v) => updateForm("isPublic", v)}
        />
      </div>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Item-augment Primitives</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {computedBu} BU
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
            items={itemAugmentPrimitives.map((p) => ({
              id: p.id,
              name: p.name,
              subtitle: p.category.replace(/_/g, " "),
              badge: `${p.buCost} BU`,
            }))}
            alreadyAdded={new Set(primitiveIds)}
            onSelect={(id) => {
              togglePrimitive(Number(id));
            }}
          />
        ) : null}

        {primitiveIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No item-augment primitives slotted.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slottedPrimitives.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
                  {p.buCost} BU
                </span>
                <button
                  type="button"
                  onClick={() => togglePrimitive(p.id)}
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

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Granted Capabilities</h3>
          <button
            type="button"
            onClick={() => {
              setPickerTarget("capability");
              setPickerOpen((v) => !v);
            }}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            {pickerOpen && pickerTarget === "capability"
              ? "Close picker"
              : "+ Slot capability"}
          </button>
        </div>

        {pickerOpen && pickerTarget === "capability" ? (
          <SlotPicker
            items={availableCapabilities.map((c) => ({
              id: c.id,
              name: c.name,
              subtitle: `${c.type} · ${c.sourceType}`,
              badge: null,
            }))}
            alreadyAdded={new Set(capabilityIds)}
            onSelect={(id) => {
              toggleCapability(String(id));
            }}
          />
        ) : null}

        {capabilityIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No capabilities granted.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {capabilityIds.map((id) => {
              const cap = availableCapabilities.find((c) => c.id === id);
              if (!cap) return null;
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{cap.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cap.type} · {cap.sourceType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCapability(id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Granted Effects</h3>
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
          <SlotPicker
            items={availableEffects.map((e) => ({
              id: e.id,
              name: e.name,
              subtitle: "Effect",
              badge: null,
            }))}
            alreadyAdded={new Set(effectIds)}
            onSelect={(id) => {
              toggleEffect(String(id));
            }}
          />
        ) : null}

        {effectIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No effects granted.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {effectIds.map((id) => {
              const eff = availableEffects.find((e) => e.id === id);
              if (!eff) return null;
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {eff.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleEffect(id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
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
            : initialItem
              ? "Save Changes"
              : "Create Item"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SlotPicker({
  items,
  alreadyAdded,
  onSelect,
}: {
  items: Array<{
    id: number | string;
    name: string;
    subtitle: string;
    badge: string | null;
  }>;
  alreadyAdded: Set<number | string>;
  onSelect: (id: number | string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    );
  });
  return (
    <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-card p-2">
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <ul className="divide-y">
        {filtered.map((item) => {
          const isAlready = alreadyAdded.has(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              {item.badge ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {item.badge}
                </span>
              ) : null}
              <button
                type="button"
                disabled={isAlready}
                onClick={() => onSelect(item.id)}
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