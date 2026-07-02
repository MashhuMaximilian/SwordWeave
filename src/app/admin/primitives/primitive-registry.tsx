"use client";

import { useMemo, useState, useTransition } from "react";

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  hardModifiers: unknown;
};

const categories = [
  "VERB_TIER",
  "DOMAIN",
  "SIZING",
  "TARGETING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "CONDITION",
  "DEFENSE",
  "STRUCTURAL",
  "SHEET_AUGMENT",
] as const;

const costTiers = [
  "Tier 1: Minor (1-2 BU)",
  "Tier 2: Standard (3-5 BU)",
  "Tier 3: Major (6-10 BU)",
  "Tier 4: Core Axis (11-20 BU)",
  "Tier 5: Narrative Layer (21-64+ BU)",
] as const;

const blankForm = {
  name: "",
  category: "VERB_TIER",
  costTier: "Tier 1: Minor (1-2 BU)",
  buCost: "1",
  mechanicalOutputText: "",
  narrativeRule: "",
  hardModifiers: "[]",
};

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function PrimitiveRegistry({
  initialPrimitives,
}: {
  initialPrimitives: PrimitiveRow[];
}) {
  const [primitives, setPrimitives] = useState(initialPrimitives);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [form, setForm] = useState(blankForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredPrimitives = useMemo(() => {
    if (selectedCategory === "ALL") {
      return primitives;
    }

    return primitives.filter((primitive) => primitive.category === selectedCategory);
  }, [primitives, selectedCategory]);

  function updateForm(field: keyof typeof blankForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitPrimitive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/primitives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save primitive.";
        setMessage(error);
        return;
      }

      const primitive =
        payload && typeof payload === "object" && "primitive" in payload
          ? (payload.primitive as PrimitiveRow)
          : null;

      if (primitive) {
        setPrimitives((current) => {
          const withoutDuplicate = current.filter(
            (item) =>
              !(
                item.name === primitive.name &&
                item.category === primitive.category
              ),
          );

          return [...withoutDuplicate, primitive].sort((a, b) =>
            `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`),
          );
        });
      }

      setForm(blankForm);
      setMessage("Primitive saved.");
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-0 lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-border bg-card px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Master Sandbox
              </p>
              <h1 className="text-xl font-semibold">Primitive Registry</h1>
            </div>
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {primitives.length}
            </span>
          </div>

          <label className="mb-3 block text-sm font-medium" htmlFor="category-filter">
            Filter
          </label>
          <select
            id="category-filter"
            className="mb-5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {filteredPrimitives.map((primitive) => (
              <article
                key={primitive.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold">{primitive.name}</h2>
                  <span className="shrink-0 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                    {primitive.buCost} BU
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {categoryLabel(primitive.category)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm">
                  {primitive.mechanicalOutputText || "No mechanical output yet."}
                </p>
              </article>
            ))}
          </div>
        </aside>

        <section className="px-5 py-6">
          <div className="mb-6 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Atomic Engine Input
            </p>
            <h2 className="text-2xl font-semibold">Add New Primitive</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Store the cost, category, and executable modifier teeth for a reusable
              SwordWeave building block.
            </p>
          </div>

          <form
            className="grid max-w-3xl grid-cols-1 gap-4 rounded-md border border-border bg-card p-5 md:grid-cols-2"
            onSubmit={submitPrimitive}
          >
            <label className="block text-sm font-medium md:col-span-2">
              Name
              <input
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Kinetic Velocity Arrest"
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Lexicon Category
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Cost Tier Bracket
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                value={form.costTier}
                onChange={(event) => updateForm("costTier", event.target.value)}
              >
                {costTiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Exact BU
              <input
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                value={form.buCost}
                onChange={(event) => updateForm("buCost", event.target.value)}
                min={0}
                step={1}
                type="number"
                required
              />
            </label>

            <label className="block text-sm font-medium md:col-span-2">
              Mechanical Output Text
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                value={form.mechanicalOutputText}
                onChange={(event) =>
                  updateForm("mechanicalOutputText", event.target.value)
                }
                placeholder="Reduces target movement coordinates to 0."
              />
            </label>

            <label className="block text-sm font-medium md:col-span-2">
              Verbose Narrative Rule
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                value={form.narrativeRule}
                onChange={(event) => updateForm("narrativeRule", event.target.value)}
                placeholder="Roots an entity to its current spatial coordinate..."
              />
            </label>

            <label className="block text-sm font-medium md:col-span-2">
              Hard Modifiers JSON
              <textarea
                className="mt-2 min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none ring-ring focus:ring-2"
                value={form.hardModifiers}
                onChange={(event) => updateForm("hardModifiers", event.target.value)}
              />
            </label>

            <div className="flex items-center gap-3 md:col-span-2">
              <button
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Saving..." : "Save Primitive"}
              </button>
              {message ? (
                <p className="text-sm text-muted-foreground">{message}</p>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
