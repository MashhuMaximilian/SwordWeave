"use client";

// ItemForm: controlled form-only composer for items.
// Slots primitives (ITEM_AUGMENT category) + capabilities + effects.

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  makeDraftKey,
} from "@/lib/sandbox/form-draft";
import type {
  ItemFormState,
  ItemPrimitiveSlot,
} from "./item-form-preview";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";
import { saveIntentLabel } from "@/lib/publishing/save-intent";

type ItemRow = {
  id: string;
  userId?: string | null;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    /**
     * Phase 7 Q-M-UX: per-slot Mirrored flag from the DB.
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
  iconColor: string | null;
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
  quantity: "1",
  isTwoHanded: false,
  isConsumable: false,
  actsAsFocus: true,
  isPublic: false,
  sourceOrigin: "",
  tags: "",
  // Phase 8: per-entity iconography
  iconSource: null,
  iconKey: null,
  iconUrl: null,
  iconColor: "#ffffff",
};

export function ItemForm({
  initialItem,
  availablePrimitives,
  availableCapabilities,
  availableEffects,
  intent,
  sourceId: _sourceId, // Phase 2: kept for the future when forms use sourceId in the body; the PATCH route reads it from the URL.
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
  /**
   * Phase 2: the save intent from `?intent=fork|load`. The PATCH route
   * reads this from the body to decide between fork-on-save and
   * version-update. Null = greenfield (POST, not PATCH).
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 2: the source row's id. Currently the URL `/api/items/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
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
  // Phase 7 Q-M-UX: parallel Set tracking which primitive slots are
  // mirrored. Same pattern as the template form — flat primitiveIds for
  // UI, primitiveSlots at payload-time.
  const [isMirroredIds, setIsMirroredIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
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

  const bootstrappedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = initialItem?.id ?? null;
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialItem) return;
    setForm({
      name: initialItem.name,
      itemType: initialItem.itemType,
      rarity: initialItem.rarity,
      buCost: String(initialItem.buCost),
      description: initialItem.description,
      slotCost: String(initialItem.slotCost),
      // quantity defaults to 1 for legacy rows that pre-date the field
      // (Drizzle's NOT NULL DEFAULT 1 only applies at the DB level; the
      // old row objects we receive from queryLibrary() / sandbox pages
      // may still be missing the property).
      quantity: String(initialItem.quantity ?? 1),
      isTwoHanded: initialItem.isTwoHanded,
      isConsumable: initialItem.isConsumable,
      actsAsFocus: initialItem.actsAsFocus,
      isPublic: initialItem.isPublic,
      sourceOrigin: initialItem.sourceOrigin ?? "",
      tags: (initialItem.tags ?? []).join(", "),
      // Phase 8: per-entity iconography
      iconSource: initialItem.iconSource,
      iconKey: initialItem.iconKey,
      iconUrl: initialItem.iconUrl,
      iconColor: initialItem.iconColor ?? "#ffffff",
    });
    // Check for a saved draft (e.g. when the form unmounted in the panel
    // and remounted in the drawer). If a draft exists, restore all three
    // slot arrays from it instead of the initial data.
    const draftKey = makeDraftKey("item", id);
    const draft = loadDraft(draftKey);
    if (draft) {
      setPrimitiveIds(draft.primitiveIds);
      setCapabilityIds(draft.capabilityIds);
      setEffectIds(draft.effectIds);
      // Phase 7 Q-M-UX: restore mirrored set from draft if present.
      setIsMirroredIds(
        new Set<number>(
          (draft as { isMirroredIds?: number[] }).isMirroredIds ?? [],
        ),
      );
      setIsDirty(true);
      setMessage("Restored your in-progress edits.");
      clearDraft(draftKey);
      return;
    }
    setPrimitiveIds(initialItem.primitiveLinks.map((l) => l.primitiveId));
    setCapabilityIds([]);
    setEffectIds([]);
    // Phase 7 Q-M-UX: restore mirrored flags from the DB column.
    setIsMirroredIds(
      new Set<number>(
        initialItem.primitiveLinks
          .filter((l) => l.isMirrored)
          .map((l) => l.primitiveId),
      ),
    );
    setIsDirty(false); // pristine after load
    setMessage(
      initialItem.userId
        ? "Loaded your item for editing."
        : "Loaded library item. Saving creates your private copy.",
    );
  }, [initialItem]);

  // Save draft on unmount — when the form unmounts in the panel (split
  // mode exit) or in the drawer, save the current primitiveIds/capabilityIds/
  // effectIds so the other instance can restore them on mount.
  useEffect(() => {
    return () => {
      const id = initialItem?.id ?? null;
      const draftKey = makeDraftKey("item", id);
      if (primitiveIds.length > 0 || capabilityIds.length > 0 || effectIds.length > 0) {
        saveDraft(draftKey, {
          primitiveIds,
          capabilityIds,
          effectIds,
          notesByIndex: {},
          // Phase 7 Q-M-UX: persist mirrored set alongside draft.
          ...({ isMirroredIds: Array.from(isMirroredIds) } as Record<
            string,
            unknown
          >),
        });
      } else {
        clearDraft(draftKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primitiveIds, capabilityIds, effectIds, initialItem?.id]);

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

  // External slot trigger: items accept primitives + effects + capabilities
  // (items are templates in the user's spec). The form already has state
  // for all three (primitiveIds, effectIds, capabilityIds), so this just
  // wires the events into the existing state.
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
        setPrimitiveIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
      if (e.detail.kind === "effect") {
        const id = String(e.detail.id);
        setEffectIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
      if (e.detail.kind === "capability") {
        const id = String(e.detail.id);
        setCapabilityIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
    };
    window.addEventListener("sw-sandbox-slot", handler);
    return () => window.removeEventListener("sw-sandbox-slot", handler);
  }, []);

  function updateForm(field: keyof ItemFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePrimitive(id: number) {
    setIsDirty(true);
    setPrimitiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // Phase 7 Q-M-UX: drop removed primitives from the mirrored set.
    setIsMirroredIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSlotMirror(id: number) {
    setIsDirty(true);
    setIsMirroredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    setIsMirroredIds(new Set<number>());
    setPickerOpen(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh item.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.();
  }

  function submitItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Item name is required.");
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      itemType: form.itemType,
      rarity: form.rarity,
      buCost: Math.max(0, Number(form.buCost) || 0),
      description: form.description,
      slotCost: Math.max(1, Number(form.slotCost) || 1),
      // Quantity: any positive integer, no upper cap (per the user's spec
      // — consumables and other types can stack freely). Empty / 0 / NaN
      // falls back to 1 so the DB NOT NULL constraint never trips.
      quantity: Math.max(1, Number(form.quantity) || 1),
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
      // Phase 7 Q-M-UX: also send primitiveSlots. Server accepts
      // either primitiveIds or primitiveSlots (latter takes precedence).
      primitiveSlots: primitiveIds.map((id) => ({
        primitiveId: id,
        isMirrored: isMirroredIds.has(id),
      })),
      capabilityIds,
      effectIds,
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialItem) {
      body["intent"] = intent;
    }

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

  // Mashu 2026-07-09: Math.abs() per the mirror rule. Defensive.
  const computedBu = slottedPrimitives.reduce(
    (sum, slot) => sum + Math.abs(slot.buCost),
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitItem}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {initialItem ? "Edit Item" : "New Item"}
          </p>
          {(() => {
            const label = saveIntentLabel(
              intent ?? null,
              initialItem?.name ?? null,
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

      <div className="grid gap-4 sm:grid-cols-3">
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
        <label className="block text-sm font-medium">
          Quantity
          <input
            type="number"
            min={1}
            placeholder="1"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.quantity}
            onChange={(e) => updateForm("quantity", e.target.value)}
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
      </div>
      <div className="rounded-md border border-border bg-background p-3 text-sm font-medium">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Visibility
        </p>
        <VisibilitySelect
          compact
          value={form.isPublic ? "PUBLIC" : "PRIVATE"}
          onChange={(next) => updateForm("isPublic", next === "PUBLIC")}
        />
        <p className="mt-2 text-[10px] font-normal text-muted-foreground">
          Public entries appear in the Library. Private and Followers-only
          entries can be promoted to Public from the My Creations page.
        </p>
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
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  title="Phase 7 Q-M-UX: when this slot is mirrored, the consumer pays BU debt at template/character-creation time."
                >
                  <input
                    type="checkbox"
                    checked={isMirroredIds.has(p.id)}
                    onChange={() => toggleSlotMirror(p.id)}
                    className="size-3.5"
                  />
                  <span>Mirror</span>
                </label>
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