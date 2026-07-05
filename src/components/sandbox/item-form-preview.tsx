"use client";

// Live preview for the item being composed in ItemForm.

import { Markdown } from "@/components/ui/markdown";

export type ItemFormState = {
  name: string;
  itemType: string;
  rarity: string;
  buCost: string;
  description: string;
  slotCost: string;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  sourceOrigin: string;
  tags: string;
};

export type ItemPrimitiveSlot = {
  primitiveId: number;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
  };
};

export type ItemCapabilitySlot = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
};

export type ItemEffectSlot = {
  id: string;
  name: string;
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: "bg-secondary text-secondary-foreground",
  RARE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  EPIC: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  LEGENDARY: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function rarityClass(rarity: string): string {
  return RARITY_COLOR[rarity] ?? RARITY_COLOR["COMMON"] ?? "bg-secondary";
}

export function ItemFormPreview({
  form,
  primitiveSlots,
  capabilitySlots,
  effectSlots,
}: {
  form: ItemFormState;
  primitiveSlots: ItemPrimitiveSlot[];
  capabilitySlots: ItemCapabilitySlot[];
  effectSlots: ItemEffectSlot[];
}) {
  const isEmpty =
    !form.name &&
    primitiveSlots.length === 0 &&
    capabilitySlots.length === 0 &&
    effectSlots.length === 0;
  const totalBu = primitiveSlots.reduce(
    (sum, slot) => sum + slot.primitive.buCost,
    0,
  );
  const tags = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-muted-foreground">No item yet</p>
          <p className="text-xs text-muted-foreground">
            Fill in the Build panel. The card updates as you type and slot
            primitives/capabilities/effects.
          </p>
        </div>
      </div>
    );
  }

  const rarityClassName = rarityClass(form.rarity);

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {form.itemType} Item
        </p>
        <h2 className="text-2xl font-semibold leading-tight">
          {form.name || "Unnamed Item"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
            {totalBu} BU
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${rarityClassName}`}
          >
            {form.rarity}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            Slot cost {form.slotCost || 1}
          </span>
          {form.isTwoHanded ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              Two-handed
            </span>
          ) : null}
          {form.isConsumable ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              Consumable
            </span>
          ) : null}
          {form.actsAsFocus ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              Focus
            </span>
          ) : null}
          <span
            className={
              "rounded-full px-2 py-0.5 font-medium " +
              (form.isPublic
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
            }
          >
            {form.isPublic ? "Public" : "Draft"}
          </span>
        </div>
      </header>

      {form.description ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Description
          </h3>
          <div className="prose prose-invert prose-sm max-w-none break-words text-sm leading-7">
            <Markdown>{form.description}</Markdown>
          </div>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-border bg-background px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {primitiveSlots.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Item-augment primitives ({primitiveSlots.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {primitiveSlots.map((slot) => (
              <li
                key={slot.primitiveId}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {slot.primitive.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {slot.primitive.buCost} BU
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {capabilitySlots.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Granted capabilities ({capabilitySlots.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {capabilitySlots.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {c.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.type}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {effectSlots.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Granted effects ({effectSlots.length})
          </h3>
          <ul className="divide-y divide-border rounded-md border">
            {effectSlots.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}