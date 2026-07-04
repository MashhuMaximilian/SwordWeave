"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  mechanicalOutputText: string;
  isMirrorable: boolean;
  mirrorBuCredit: number;
};

type EffectPrimitiveLink = {
  primitiveId: number;
  quantity: number;
  primitive: PrimitiveRow;
};

type EffectRow = {
  id: string;
  name: string;
  narrativeDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: EffectPrimitiveLink[];
};

type SelectedPrimitive = {
  primitiveId: number;
  quantity: number;
};

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function effectBuTotal(effect: EffectRow) {
  return effect.primitiveLinks.reduce(
    (total, link) => total + link.primitive.buCost * link.quantity,
    0,
  );
}

export function EffectComposer({
  initialEffects,
  primitives,
}: {
  initialEffects: EffectRow[];
  primitives: PrimitiveRow[];
}) {
  const [effects, setEffects] = useState(initialEffects);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedPrimitives, setSelectedPrimitives] = useState<
    SelectedPrimitive[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    narrativeDescription: "",
    sourceOrigin: "",
    tags: "",
    isPublic: false,
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

  const categories = useMemo(
    () => ["ALL", ...new Set(primitives.map((primitive) => primitive.category))],
    [primitives],
  );

  const filteredPrimitives = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return primitives.filter((primitive) => {
      const categoryMatches =
        selectedCategory === "ALL" || primitive.category === selectedCategory;
      const queryMatches =
        !normalizedQuery ||
        [primitive.name, primitive.category, primitive.mechanicalOutputText]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return categoryMatches && queryMatches;
    });
  }, [primitives, query, selectedCategory]);

  const selectedPrimitiveRows = useMemo(
    () =>
      selectedPrimitives
        .map((slot) => {
          const primitive = primitives.find((item) => item.id === slot.primitiveId);

          return primitive ? { ...slot, primitive } : null;
        })
        .filter((slot): slot is SelectedPrimitive & { primitive: PrimitiveRow } =>
          Boolean(slot),
        ),
    [primitives, selectedPrimitives],
  );

  const totalBu = selectedPrimitiveRows.reduce(
    (total, slot) => total + slot.primitive.buCost * slot.quantity,
    0,
  );

  function addPrimitive(primitiveId: number) {
    setSelectedPrimitives((current) => {
      const existing = current.find((slot) => slot.primitiveId === primitiveId);

      if (existing) {
        return current.map((slot) =>
          slot.primitiveId === primitiveId
            ? { ...slot, quantity: slot.quantity + 1 }
            : slot,
        );
      }

      return [...current, { primitiveId, quantity: 1 }];
    });
  }

  function updateQuantity(primitiveId: number, quantity: number) {
    setSelectedPrimitives((current) =>
      current.map((slot) =>
        slot.primitiveId === primitiveId
          ? { ...slot, quantity: Math.max(1, quantity) }
          : slot,
      ),
    );
  }

  function removePrimitive(primitiveId: number) {
    setSelectedPrimitives((current) =>
      current.filter((slot) => slot.primitiveId !== primitiveId),
    );
  }

  function submitEffect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/effects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          primitiveSlots: selectedPrimitives,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save effect.";
        setMessage(error);
        showToast(error, "error");
        return;
      }

      const effect =
        payload && typeof payload === "object" && "effect" in payload
          ? (payload.effect as EffectRow)
          : null;

      if (effect) {
        setEffects((current) => [effect, ...current]);
      }

      setForm({
        name: "",
        narrativeDescription: "",
        sourceOrigin: "",
        tags: "",
        isPublic: false,
      });
      setSelectedPrimitives([]);
      const successMsg = `Effect "${effect?.name ?? "(unnamed)"}" saved.`;
      setMessage(successMsg);
      showToast(successMsg, "success");
    });
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-0 xl:grid-cols-[340px_1fr]">
      <aside className="border-b border-border bg-card px-4 py-5 sm:px-5 xl:border-b-0 xl:border-r">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Assembly Bench
            </p>
            <h1 className="font-display text-3xl font-semibold uppercase leading-none">
              Effect Builder
            </h1>
          </div>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {effects.length}
          </span>
        </div>

        <label className="mb-2 block text-sm font-medium" htmlFor="effect-category">
          Primitive Category
        </label>
        <select
          className="mb-4 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          id="effect-category"
          onChange={(event) => setSelectedCategory(event.target.value)}
          value={selectedCategory}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === "ALL" ? "All Categories" : categoryLabel(category)}
            </option>
          ))}
        </select>

        <label className="mb-2 block text-sm font-medium" htmlFor="primitive-query">
          Search Primitives
        </label>
        <input
          className="mb-4 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          id="primitive-query"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Speed, blinded, fire..."
          value={query}
        />

        <div className="space-y-2">
          {filteredPrimitives.map((primitive) => (
            <article
              className="rounded-md border border-border bg-background p-3"
              key={primitive.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold">{primitive.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {categoryLabel(primitive.category)}
                  </p>
                </div>
                <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
                  {primitive.buCost} BU
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {primitive.mechanicalOutputText || "No mechanical output yet."}
              </p>
              <button
                className="mt-3 h-8 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground"
                onClick={() => addPrimitive(primitive.id)}
                type="button"
              >
                Slot Primitive
              </button>
            </article>
          ))}
        </div>
      </aside>

      <section className="px-4 py-6 sm:px-5">
        <div className="mb-6 max-w-4xl">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Reusable State Package
          </p>
          <h2 className="font-display text-4xl font-semibold uppercase leading-none">
            Compose Effect
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Slot primitives into a named effect and store the total mechanical
            package for later capability cards, items, monsters, and sheets.
          </p>
        </div>

        <div className="grid max-w-6xl gap-4 2xl:grid-cols-[1fr_320px]">
          <form
            className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2 sm:p-5"
            onSubmit={submitEffect}
          >
            <label className="block text-sm font-medium md:col-span-2">
              Effect Name
              <input
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Vertigo Spasms"
                required
                value={form.name}
              />
            </label>

            <label className="block text-sm font-medium">
              Source Origin
              <input
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceOrigin: event.target.value,
                  }))
                }
                placeholder="Core Campaign"
                value={form.sourceOrigin}
              />
            </label>

            <label className="block text-sm font-medium">
              Tags
              <input
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="debuff, poison, movement"
                value={form.tags}
              />
            </label>

            <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium md:col-span-2">
              <input
                checked={form.isPublic}
                className="mt-1 size-4"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isPublic: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                Public Library Candidate
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Auth and publishing gates will decide who can actually publish
                  this later.
                </span>
              </span>
            </label>

            <label className="block text-sm font-medium md:col-span-2">
              Narrative Rule
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    narrativeDescription: event.target.value,
                  }))
                }
                placeholder="The target loses spatial certainty and struggles to keep balance..."
                value={form.narrativeDescription}
              />
            </label>

            <div className="rounded-md border border-border bg-background p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Slotted Primitives</h3>
                <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                  {totalBu} BU
                </span>
              </div>

              {selectedPrimitiveRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Select primitives from the left panel to start composing.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedPrimitiveRows.map((slot) => (
                    <div
                      className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_96px_auto] sm:items-center"
                      key={slot.primitiveId}
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
                        onChange={(event) =>
                          updateQuantity(
                            slot.primitiveId,
                            Number(event.target.value),
                          )
                        }
                        type="number"
                        value={slot.quantity}
                      />
                      <button
                        className="h-9 rounded-md border border-border px-3 text-sm font-bold text-muted-foreground"
                        onClick={() => removePrimitive(slot.primitiveId)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
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

          <aside className="rounded-md border border-border bg-card p-4 2xl:sticky 2xl:top-6 2xl:self-start">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Live Output
            </p>
            <h3 className="font-display mt-3 text-3xl font-semibold uppercase leading-none">
              {form.name || "Unnamed Effect"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {form.narrativeDescription ||
                "Narrative description will appear here."}
            </p>
            <div className="mt-4 rounded-md border border-border bg-background p-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Total Cost
              </p>
              <p className="font-display mt-1 text-4xl font-semibold uppercase leading-none text-primary">
                {totalBu} BU
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-6 max-w-6xl">
          <h2 className="font-display text-3xl font-semibold uppercase leading-none">
            Saved Effects
          </h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {effects.map((effect) => (
              <article
                className="rounded-md border border-border bg-card p-4"
                key={effect.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-semibold uppercase leading-none">
                      {effect.name}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {effect.sourceOrigin || "No source origin"}
                    </p>
                  </div>
                  <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
                    {effectBuTotal(effect)} BU
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {effect.narrativeDescription || "No narrative rule yet."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {effect.primitiveLinks.map((link) => (
                    <span
                      className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                      key={`${effect.id}-${link.primitiveId}`}
                    >
                      {link.primitive.name} x{link.quantity}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
