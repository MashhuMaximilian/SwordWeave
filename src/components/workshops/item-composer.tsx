"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";

/**
 * Item Composer
 *
 * UI for creating items. Items compose:
 *   - Required metadata (name, type, rarity)
 *   - Item-augment primitives (e.g. "Sharp", "Heavy", "Focus")
 *   - Optional capabilities granted when equipped
 *   - Optional effects granted when equipped
 *
 * BU total = sum of selected item-augment primitive costs (decoupled from
 * the character's progression pool per Q3 Mashu).
 *
 * Pattern follows the capability composer (sticky preview bar, toasts,
 * server-authoritative validation).
 */

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  narrativeRule: string;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
};

type EffectRow = {
  id: string;
  name: string;
};

type ItemPrimitiveLink = {
  primitiveId: number;
  primitive: PrimitiveRow;
};

type ItemRow = {
  id: string;
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
  primitiveLinks: ItemPrimitiveLink[];
};

type EditingItem = ItemRow;

const ITEM_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

export function ItemComposer({
  primitives,
  capabilities,
  effects,
  editingItem,
}: {
  primitives: PrimitiveRow[];
  capabilities: CapabilityRow[];
  effects: EffectRow[];
  editingItem?: EditingItem | null;
}) {
  const isEditMode = Boolean(editingItem);

  const initialPrimitiveIds = editingItem
    ? editingItem.primitiveLinks.map((l) => l.primitiveId)
    : [];

  const initialForm = editingItem
    ? {
        name: editingItem.name,
        itemType: editingItem.itemType,
        rarity: editingItem.rarity,
        buCost: editingItem.buCost,
        description: editingItem.description,
        slotCost: editingItem.slotCost,
        isTwoHanded: editingItem.isTwoHanded,
        isConsumable: editingItem.isConsumable,
        actsAsFocus: editingItem.actsAsFocus,
        isPublic: editingItem.isPublic,
        sourceOrigin: editingItem.sourceOrigin ?? "",
        tags: editingItem.tags.join(", "),
      }
    : {
        name: "",
        itemType: "WEAPON",
        rarity: "COMMON",
        buCost: 0,
        description: "",
        slotCost: 1,
        isTwoHanded: false,
        isConsumable: false,
        actsAsFocus: true,
        isPublic: false,
        sourceOrigin: "",
        tags: "",
      };

  const [selectedPrimitiveIds, setSelectedPrimitiveIds] =
    useState<number[]>(initialPrimitiveIds);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>(
    [],
  );
  const [selectedEffectIds, setSelectedEffectIds] = useState<string[]>([]);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

  const filteredPrimitives = useMemo(() => {
    const q = query.trim().toLowerCase();
    return primitives.filter(
      (p) =>
        !q ||
        [p.name, p.narrativeRule].join(" ").toLowerCase().includes(q),
    );
  }, [primitives, query]);

  const computedPrimitiveBu = useMemo(
    () =>
      selectedPrimitiveIds.reduce((total, id) => {
        const primitive = primitives.find((p) => p.id === id);
        return total + (primitive?.buCost ?? 0);
      }, 0),
    [selectedPrimitiveIds, primitives],
  );

  function togglePrimitive(id: number) {
    setSelectedPrimitiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCapability(id: string) {
    setSelectedCapabilityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleEffect(id: string) {
    setSelectedEffectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function resetForm() {
    setSelectedPrimitiveIds([]);
    setSelectedCapabilityIds([]);
    setSelectedEffectIds([]);
    setForm({
      name: "",
      itemType: "WEAPON",
      rarity: "COMMON",
      buCost: 0,
      description: "",
      slotCost: 1,
      isTwoHanded: false,
      isConsumable: false,
      actsAsFocus: true,
      isPublic: false,
      sourceOrigin: "",
      tags: "",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      showToast("Item name is required.", "error");
      return;
    }

    startTransition(async () => {
      try {
        const url = isEditMode && editingItem
          ? `/api/items/${editingItem.id}`
          : "/api/items";
        const method = isEditMode ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            itemType: form.itemType,
            rarity: form.rarity,
            buCost: form.buCost,
            description: form.description.trim(),
            slotCost: form.slotCost,
            isTwoHanded: form.isTwoHanded,
            isConsumable: form.isConsumable,
            actsAsFocus: form.actsAsFocus,
            isPublic: form.isPublic,
            sourceOrigin: form.sourceOrigin.trim() || null,
            tags: form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            primitiveIds: selectedPrimitiveIds,
            capabilityIds: selectedCapabilityIds,
            effectIds: selectedEffectIds,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error ?? "Failed to save item.";
          showToast(errMsg, "error");
          return;
        }

        const successMsg = isEditMode
          ? `Updated "${form.name}".`
          : `Created "${form.name}" (${computedPrimitiveBu} BU from primitives).`;
        showToast(successMsg, "success");
        if (!isEditMode) resetForm();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Item Composer
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Forge an item.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Combine item-augment primitives into weapons, armor, trinkets,
          artifacts, and consumables. Optionally grant capabilities or effects
          while equipped.
        </p>
      </div>

      {/* Sticky preview bar */}
      <div className="sticky top-0 z-30 mt-6 -mx-5 border-y border-border bg-background/80 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Primitive BU
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-base font-bold text-primary">
                {computedPrimitiveBu}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Manual BU
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {form.buCost}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Slots
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {form.slotCost}
              </span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isEditMode
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-green-500/10 text-green-700 dark:text-green-300"
                }`}
              >
                {isEditMode ? "Editing" : "New"}
              </span>
            </div>
            {form.name && (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Name
                </span>
                <span className="truncate text-sm font-medium">
                  {form.name}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
            >
              Reset
            </button>
            <button
              type="submit"
              form="item-form"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending
                ? isEditMode
                  ? "Saving..."
                  : "Forging..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Item"}
            </button>
          </div>
        </div>
      </div>

      <form id="item-form" onSubmit={handleSubmit} className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* LEFT: metadata form */}
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Identity</h2>
          <div className="mt-4 space-y-3">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Flamebrand Longsword"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  value={form.itemType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, itemType: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rarity">
                <select
                  value={form.rarity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rarity: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slot Cost">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.slotCost}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      slotCost: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Manual BU">
                <input
                  type="number"
                  min={0}
                  value={form.buCost}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      buCost: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Lore, mechanics, anything notable..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Tags (comma separated)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="fire, knight, focus"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <Checkbox
                label="Two-handed"
                checked={form.isTwoHanded}
                onChange={(v) => setForm((f) => ({ ...f, isTwoHanded: v }))}
              />
              <Checkbox
                label="Consumable"
                checked={form.isConsumable}
                onChange={(v) => setForm((f) => ({ ...f, isConsumable: v }))}
              />
              <Checkbox
                label="Acts as focus"
                checked={form.actsAsFocus}
                onChange={(v) => setForm((f) => ({ ...f, actsAsFocus: v }))}
              />
              <Checkbox
                label="Public"
                checked={form.isPublic}
                onChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>
          </div>
        </section>

        {/* RIGHT: selection panels */}
        <section className="space-y-4">
          {/* Primitives picker */}
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Item-augment Primitives</h2>
              <span className="text-xs text-muted-foreground">
                {selectedPrimitiveIds.length} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Only item-augment primitives can be slotted into items.
            </p>
            <input
              type="search"
              placeholder="Search primitives..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {filteredPrimitives.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No item-augment primitives available. Add some via the
                  Primitives workshop.
                </p>
              ) : (
                filteredPrimitives.map((p) => {
                  const selected = selectedPrimitiveIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePrimitive(p.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{p.name}</div>
                        {p.narrativeRule && (
                          <div className="truncate text-xs text-muted-foreground">
                            {p.narrativeRule}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs font-bold">
                        {p.buCost} BU
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Capability grants */}
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Granted Capabilities</h2>
              <span className="text-xs text-muted-foreground">
                {selectedCapabilityIds.length} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Capabilities the wielder can use while this item is equipped.
            </p>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {capabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No capabilities in the library yet.
                </p>
              ) : (
                capabilities.map((c) => {
                  const selected = selectedCapabilityIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCapability(c.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.type} · {c.sourceType}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Effect grants */}
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Granted Effects</h2>
              <span className="text-xs text-muted-foreground">
                {selectedEffectIds.length} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Effects applied while this item is equipped.
            </p>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {effects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No effects in the library yet.
                </p>
              ) : (
                effects.map((e) => {
                  const selected = selectedEffectIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEffect(e.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium">{e.name}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </form>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
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
      <span>{label}</span>
    </label>
  );
}