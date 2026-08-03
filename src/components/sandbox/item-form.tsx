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
import { SIZE_LOAD } from "@/lib/engine/encumbrance";

type ItemRow = {
  id: string;
  userId?: string | null;
  name: string;
  itemType: string;
  rarity: string;
  // Phase 8.5 / Session H1: item size for encumbrance.
  size: string;
  buCost: number;
  description: string;
  slotCost: number;
  quantity: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  // Phase 8.5 / Session H6 (Mashu 2026-08-03): carried-but-
  // not-equippable. Optional because callers may pass rows
  // that pre-date the column; the form's bootstrap defaults
  // missing values to false.
  isNotEquippable?: boolean;
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

// Phase 8.5 / Session H1: item size for encumbrance (Load + pouch).
const SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;

const blankForm: ItemFormState = {
  name: "",
  itemType: "WEAPON",
  rarity: "COMMON",
  size: "SMALL",
  buCost: "0",
  description: "",
  slotCost: "1",
  quantity: "1",
  isTwoHanded: false,
  isConsumable: false,
  actsAsFocus: true,
  isNotEquippable: false,
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
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

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
      // Phase 8.5 H1: existing items default to SMALL if size was
      // missing on the row (legacy rows pre-0050).
      size: initialItem.size ?? "SMALL",
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
      // Phase 8.5 / Session H6 (Mashu 2026-08-03): default
      // to false for legacy items that pre-date the
      // is_not_equippable column.
      isNotEquippable: initialItem.isNotEquippable ?? false,
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
    // Phase 8.5 H-fix (Mashu 2026-08-03): previously the form
    // hardcoded both arrays to `[]` after a load, which is why
    // loading an existing item into the build modal showed zero
    // capabilities and zero effects even though the row carried
    // them. Now seed from `initialItem.capabilityLinks` /
    // `initialItem.effectLinks` (the columns joined by the
    // atelier `with:` tree). Saving via handleSubmit still POSTs
    // the full arrays, so the bundle round-trips correctly.
    setCapabilityIds(
      (initialItem as { capabilityLinks?: Array<{ capabilityId: string }> })
        .capabilityLinks?.map((cl) => cl.capabilityId) ?? [],
    );
    setEffectIds(
      (initialItem as { effectLinks?: Array<{ effectId: string }> })
        .effectLinks?.map((el) => el.effectId) ?? [],
    );
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

  // Phase 8.5 H-fix2 (Mashu 2026-08-03): previous lookup was against
  // `itemAugmentPrimitives` (the filtered `availablePrimitives.filter(
  // p => p.category === "ITEM_AUGMENT")` pool) — so any primitive
  // slotted into the item whose category wasn't ITEM_AUGMENT
  // would fail the .find() and the render path would show an empty
  // list even though state held the ids (and Save would round-trip
  // correctly). Look up against the FULL availablePrimitives pool
  // so the slotted-section renders primitives regardless of which
  // category they belong to.
  const slottedPrimitives = primitiveIds
    .map((id) => availablePrimitives.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  useEffect(() => {
    onStateChange?.({
      form,
      primitiveSlots: slottedPrimitives.map((p) => ({
        primitiveId: p.id,
        isMirrored: isMirroredIds.has(p.id),
        primitive: p,
      })),
      capabilityIds,
      effectIds,
      isDirty,
    });
  }, [form, slottedPrimitives, capabilityIds, effectIds, onStateChange, isDirty, isMirroredIds]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  // External slot trigger: items accept primitives + effects + capabilities
  // (items are heritage in the user's spec). The form already has state
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
      // Phase 8.5 H1: include size in the save body so PATCH/POST round-trip.
      size: form.size,
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
      // Phase 8.5 / Session H6 (Mashu 2026-08-03): send
      // the carried-but-not-equippable flag in every save
      // payload, including the legacy-form path.
      isNotEquippable: form.isNotEquippable,
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

      <div className="grid grid-cols-2 gap-4">
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

      {/* Phase 8.5 H3-rev: 3 booleans row right under Type/Rarity. */}
      <div className="grid grid-cols-3 gap-3">
        <Checkbox
          label="Two-handed"
          checked={form.isTwoHanded}
          onChange={(v) => {
            // Two-handed bumps slotCost to a minimum of 2.
            const minSlot = v ? 2 : 1;
            const nextSlotCost =
              v && Number(form.slotCost) < minSlot
                ? String(minSlot)
                : form.slotCost;
            updateForm("isTwoHanded", v);
            updateForm("slotCost", nextSlotCost);
          }}
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

      {/* Phase 8.5 / Session H6 (Mashu 2026-08-03):
          Three encumbrance / slot / equip flags stay grouped
          on a single row at desktop (3-up) and stack on mobile
          (1-up via the `sm:` breakpoint). The third column is
          the new "Not equippable" boolean. */}
      {/* Phase 8.5 / Session H6 (Mashu 2026-08-03):
          Three encumbrance / slot / equip flags share a single
          row at ALL widths — desktop AND mobile — per Mashu's
          explicit "same row even on mobile" requirement. This
          uses grid-cols-3 unconditionally; on very narrow phones
          the columns get tight, that's intentional. */}
      <div className="grid grid-cols-3 gap-4">
        {/* Phase 8.5 / Session H1: size drives encumbrance Load. */}
        <label className="block text-sm font-medium">
          Size
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.size}
            onChange={(e) => updateForm("size", e.target.value)}
            title="Drives encumbrance Load. Tiny items use the pouch system (1000 tiny items = 1 Load)."
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {/* Phase 8.5 H4-rev2: pouch-system hint when TINY is selected. */}
          {form.size === "TINY" ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              1000 tiny items = 1 Load (pouch system).
            </span>
          ) : (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {SIZE_LOAD[form.size as keyof typeof SIZE_LOAD] ?? 0} Load per item.
            </span>
          )}
        </label>
        {/* Phase 8.5 H3-rev: slotCost renamed to "Equipped slots",
            user-editable, min 1 or 2 (when Two-handed).
            Phase 8.5 / Session H6: when "Not equippable" is
            on, the field is hidden and a "—" badge shown. */}
        <label className="block text-sm font-medium">
          Equipped slots
          {form.isNotEquippable ? (
            <div
              className="mt-2 inline-flex h-10 items-center rounded-md border border-dashed border-input bg-muted px-3 text-sm text-muted-foreground"
              title="Not equippable items don't occupy equip slots."
            >
              —
            </div>
          ) : (
            <input
              type="number"
              min={form.isTwoHanded ? 2 : 1}
              max={100}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={form.slotCost}
              onChange={(e) => {
                // Allow any digit / empty string while typing.
                // Clamp on blur so the user can clear the field,
                // type freely, and only get nudged on commit.
                updateForm("slotCost", String(Number(e.target.value) || 0));
              }}
              onBlur={(e) => {
                const minSlot = form.isTwoHanded ? 2 : 1;
                const raw = Number(e.target.value) || 0;
                updateForm("slotCost", String(Math.max(minSlot, raw)));
              }}
              title={
                form.isTwoHanded
                  ? "Two-handed items must use ≥ 2 equipped slots"
                  : "Equipped slots used by this item"
              }
            />
          )}
        </label>
        <label className="block text-sm font-medium">
          Not equippable
          {/* Phase 8.5 / Session H6: workshop composer forces
                slotCost = 0 when the user flips this on; the
                atelier form uses the same narrow handler so
                both surfaces agree. The Equipped slots input
                is hidden via the conditional above, but we
                still clear the value so the saved payload is
                consistent. */}
          <label className="mt-2 flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.isNotEquippable}
              onChange={(e) => {
                const checked = e.target.checked;
                updateForm("isNotEquippable", checked);
                if (checked) updateForm("slotCost", "0");
              }}
              title="If checked, the item is carried but never equipped (potions / scrolls / ammo pouches). The character-sheet ItemsTab hides the Equip button."
            />
            <span>{form.isNotEquippable ? "Yes" : "No"}</span>
          </label>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Carried but never equipped. Hides the Equip button on
            the character sheet and skips equip-slot accounting.
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Quantity
          <input
            type="number"
            min={1}
            placeholder="1"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.quantity}
            onChange={(e) => updateForm("quantity", e.target.value)}
            title="Multiplies Load/Capacity per item. Does not affect equipped slots."
          />
        </label>
        <label className="block text-sm font-medium">
          Extra BU cost
          <input
            type="number"
            min={0}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.buCost}
            onChange={(e) => updateForm("buCost", e.target.value)}
          />
          {/* Phase 8.5 H-rev3: helper text below the field flags that
              the proper integration with the deduped primitive
              total is parked in Session J / T16 (see
              swordweave-character-items SKILL "Open followup #2"). */}
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Adds to the summed total of primitives (T16/Session J rework).
          </span>
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
      {/* Phase 8.5 H7 (Mashu 2026-08-03): sourceOrigin was already
          wired in state and submit on the atelier Item form
          but never rendered in the UI, so users couldn't edit
          it. Added as a free-text field matching the other
          ateliers (primitives, capabilities, effects). */}
      <label className="block text-sm font-medium">
        Source origin
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.sourceOrigin}
          onChange={(e) => updateForm("sourceOrigin", e.target.value)}
          placeholder="core campaign"
        />
      </label>
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
          <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            {computedBu} BU
          </span>
        </div>

        {primitiveIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No item-augment primitives slotted. Pick a primitive from the
            Library column and use its &ldquo;Slot into build&rdquo; action.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slottedPrimitives.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
                    {p.buCost} BU
                  </span>
                  <label
                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    title="When this slot is mirrored, the consumer pays BU debt at template/character-creation time."
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
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Granted Capabilities</h3>
        </div>

        {capabilityIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No capabilities granted. Pick a capability from the Library
            column and use its &ldquo;Slot into build&rdquo; action.
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
        </div>

        {effectIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No effects granted. Pick an effect from the Library column and
            use its &ldquo;Slot into build&rdquo; action.
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