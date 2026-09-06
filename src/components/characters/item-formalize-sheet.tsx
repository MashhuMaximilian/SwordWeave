"use client";

/**
 * Phase 9.1 (Mashu 2026-09-06): item formalize sheet.
 *
 * Triggered from the items accordion's "Wrap as item" button in
 * BUILD mode. Confirms:
 *   - name, description, itemType, rarity, size, slotCost, buCost
 *   - visibility (private default; flip to public to share)
 *   - initial character_items.quantity
 *   - the count of primitives that will be bundled
 *
 * On submit, POSTs /api/characters/[id]/items/formalize which
 * creates an items row + item_primitives + a character_items pin.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

const ITEM_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;
type ItemType = (typeof ITEM_TYPES)[number];

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
type Rarity = (typeof RARITIES)[number];

const SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
type ItemSize = (typeof SIZES)[number];

interface ItemFormalizeSheetProps {
  characterId: string;
  open: boolean;
  onClose: () => void;
  onFormalized?: () => void;
}

export function ItemFormalizeSheet({
  characterId,
  open,
  onClose,
  onFormalized,
}: ItemFormalizeSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<ItemType>("TRINKET");
  const [rarity, setRarity] = useState<Rarity>("COMMON");
  const [size, setSize] = useState<ItemSize>("SMALL");
  const [slotCost, setSlotCost] = useState(1);
  const [buCost, setBuCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isPublic, setIsPublic] = useState(false);
  const [primitiveCount, setPrimitiveCount] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setItemType("TRINKET");
      setRarity("COMMON");
      setSize("SMALL");
      setSlotCost(1);
      setBuCost(0);
      setQuantity(1);
      setIsPublic(false);
      setPrimitiveCount(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/characters/${characterId}/primitives?kind=PERSONAL`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Failed to count primitives (${res.status}).`);
        }
        const data = (await res.json()) as {
          primitiveInstances?: Array<unknown>;
        };
        if (cancelled) return;
        const unique = new Set(
          (data.primitiveInstances ?? []).map(
            (row: unknown) =>
              (row as { primitiveId: number }).primitiveId,
          ),
        );
        setPrimitiveCount(unique.size);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load count.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, characterId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setError(null);
      setIsPending(true);
      try {
        const res = await fetch(
          `/api/characters/${characterId}/items/formalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim() || undefined,
              itemType,
              rarity,
              size,
              slotCost,
              buCost,
              quantity,
              isPublic,
            }),
          },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ?? `Wrap failed (${res.status}).`,
          );
        }
        onFormalized?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to wrap.");
      } finally {
        setIsPending(false);
      }
    },
    [
      characterId,
      name,
      description,
      itemType,
      rarity,
      size,
      slotCost,
      buCost,
      quantity,
      isPublic,
      onFormalized,
    ],
  );

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wrap items accordion as item"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 overflow-hidden rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Wrap items accordion as an item
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <p className="text-xs text-muted-foreground">
          Bundles every primitive currently slotted to the items
          accordion into a real item row, and pins it to this
          character.
          {primitiveCount !== null && (
            <>
              {" "}
              Will bundle{" "}
              <span className="font-mono font-semibold text-foreground">
                {primitiveCount}
              </span>{" "}
              unique primitive{primitiveCount === 1 ? "" : "s"}.
            </>
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Item name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <SelectField
            label="Type"
            value={itemType}
            options={ITEM_TYPES}
            onChange={(v) => setItemType(v as ItemType)}
          />
          <SelectField
            label="Rarity"
            value={rarity}
            options={RARITIES}
            onChange={(v) => setRarity(v as Rarity)}
          />
          <SelectField
            label="Size"
            value={size}
            options={SIZES}
            onChange={(v) => setSize(v as ItemSize)}
          />
          <NumberField
            label="Slot cost"
            value={slotCost}
            onChange={setSlotCost}
            min={0}
            max={20}
          />
          <NumberField
            label="BU cost"
            value={buCost}
            onChange={setBuCost}
            min={0}
            max={50}
          />
          <NumberField
            label="Starting qty"
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={9999}
          />
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="size-4 rounded border-border bg-background accent-primary"
          />
          <span className="text-foreground">
            Make this item public (shareable in the library)
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || primitiveCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:bg-primary/40"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            Wrap as item
          </button>
        </div>
      </form>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) =>
          onChange(
            Math.max(min, Math.min(max, Math.floor(parseInt(e.target.value, 10) || min))),
          )
        }
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
