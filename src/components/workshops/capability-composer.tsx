"use client";

import { useMemo, useState, useTransition } from "react";

/**
 * Capability Composer
 *
 * UI for composing capability templates from primitives.
 * Follows the LEGO-feel pattern from UX-WORKFLOW-SPEC.md:
 *   - Pick primitives by category (verb/domain/range/targeting/duration/etc.)
 *   - Drag primitives into slots
 *   - Live BU total updates
 *   - Submit creates the capability record (API POST)
 *
 * Notion's Capability Template v1 schema:
 *   1. Identity (name, type, sourceType)
 *   2. Construction (verbs, domains, effects)
 *   3. Targeting
 *   4. Range
 *   5. Output
 *   6. Duration + casting time
 *   7. Scaling (optional)
 *   8. BU Evaluation
 *   9. Strain (DM layer)
 *   10. CV (nerd layer, optional)
 *   11. Verbose description
 */

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  costTier: string;
  buCost: number;
  narrativeRule: string;
};

type CapabilityPrimitiveLink = {
  primitiveId: number;
  role: string;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  primitive: PrimitiveRow;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: CapabilityPrimitiveLink[];
};

type PrimitiveSlot = {
  primitiveId: number;
  role: "VERB" | "DOMAIN" | "SIZING" | "RANGE" | "DURATION" | "OUTPUT" | "AUGMENT" | "OTHER";
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
};

// Categories that map to specific slots
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

// Map primitive categories to the roles they typically fill
function defaultRoleForCategory(category: string): PrimitiveSlot["role"] {
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

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function capabilityBuTotal(capability: CapabilityRow): number {
  return capability.primitiveLinks.reduce(
    (total, link) => total + link.primitive.buCost * link.quantity,
    0,
  );
}

export function CapabilityComposer({
  initialCapabilities,
  primitives,
}: {
  initialCapabilities: CapabilityRow[];
  primitives: PrimitiveRow[];
}) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<PrimitiveSlot[]>([]);
  const [form, setForm] = useState({
    name: "",
    type: "ACTIVE",
    sourceType: "PHYSICAL",
    verboseDescription: "",
    sourceOrigin: "",
    tags: "",
    isPublic: false,
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(
    () => ["ALL", ...new Set(primitives.map((p) => p.category))],
    [primitives],
  );

  const filteredPrimitives = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return primitives.filter((p) => {
      const categoryMatches =
        selectedCategory === "ALL" || p.category === selectedCategory;
      const queryMatches =
        !normalizedQuery ||
        [p.name, p.category, p.narrativeRule]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [primitives, query, selectedCategory]);

  const selectedPrimitiveRows = useMemo(
    () =>
      selectedSlots.map((slot) => {
        const primitive = primitives.find((p) => p.id === slot.primitiveId);
        return { slot, primitive };
      }),
    [selectedSlots, primitives],
  );

  const previewBu = useMemo(
    () =>
      selectedSlots.reduce((total, slot) => {
        const primitive = primitives.find((p) => p.id === slot.primitiveId);
        return total + (primitive ? primitive.buCost * slot.quantity : 0);
      }, 0),
    [selectedSlots, primitives],
  );

  function addSlot(primitiveId: number) {
    const primitive = primitives.find((p) => p.id === primitiveId);
    if (!primitive) return;
    const role = defaultRoleForCategory(primitive.category);
    setSelectedSlots((prev) => [
      ...prev,
      {
        primitiveId,
        role,
        quantity: 1,
        sortOrder: prev.length,
        slotLabel: primitive.name,
      },
    ]);
  }

  function removeSlot(index: number) {
    setSelectedSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlotRole(index: number, role: PrimitiveSlot["role"]) {
    setSelectedSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, role } : slot)),
    );
  }

  function updateSlotQuantity(index: number, quantity: number) {
    setSelectedSlots((prev) =>
      prev.map((slot, i) =>
        i === index ? { ...slot, quantity: Math.max(1, quantity) } : slot,
      ),
    );
  }

  function resetForm() {
    setSelectedSlots([]);
    setForm({
      name: "",
      type: "ACTIVE",
      sourceType: "PHYSICAL",
      verboseDescription: "",
      sourceOrigin: "",
      tags: "",
      isPublic: false,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Capability name is required.");
      return;
    }

    if (selectedSlots.length === 0) {
      setMessage("Add at least one primitive to compile.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/capabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
            metadata: {
              previewBu,
              compiledAt: new Date().toISOString(),
            },
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessage(data.error ?? "Failed to create capability.");
          return;
        }

        const createdCap = data.capability as { id: string };

        // Link primitives via PATCH
        const linkRes = await fetch(`/api/capabilities/${createdCap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primitiveSlots: selectedSlots,
          }),
        });

        const linkData = await linkRes.json();

        if (!linkRes.ok) {
          setMessage(linkData.error ?? "Failed to link primitives.");
          return;
        }

        setCapabilities((prev) => [...prev, linkData.capability]);
        resetForm();
        setMessage(`Created "${form.name}" (${previewBu} BU).`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unknown error.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Capability Compiler
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Turn grammar into action cards.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Pick primitives by category, slot them into roles, and compile a
          SwordWeave capability with live BU total.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* LEFT: Primitive picker */}
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Primitive Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {primitives.length} core primitives available
          </p>

          <input
            type="search"
            placeholder="Search primitives..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {cat === "ALL" ? "All" : categoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-2">
            {filteredPrimitives.length === 0 ? (
              <p className="text-sm text-muted-foreground">No primitives match.</p>
            ) : (
              filteredPrimitives.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addSlot(p.id)}
                  className="block w-full rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {categoryLabel(p.category)} - {p.costTier}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-mono font-semibold text-primary">
                      {p.buCost} BU
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Compiler form + preview */}
        <section className="rounded-md border border-border bg-card p-5">
          <form onSubmit={handleSubmit}>
            <h2 className="text-lg font-semibold">Compiler Inputs</h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Capability Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Fire Strike"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PASSIVE">Passive</option>
                    <option value="AUGMENT">Augment</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Source
                  </label>
                  <select
                    value={form.sourceType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceType: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="PHYSICAL">Physical</option>
                    <option value="MAGICAL">Magical</option>
                    <option value="PSYCHIC">Psychic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Verbose Description
                </label>
                <textarea
                  value={form.verboseDescription}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      verboseDescription: e.target.value,
                    }))
                  }
                  placeholder="What does this capability do? Include flavor and mechanical notes."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Source Origin
                  </label>
                  <input
                    type="text"
                    value={form.sourceOrigin}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceOrigin: e.target.value,
                      }))
                    }
                    placeholder="optional"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tags: e.target.value }))
                    }
                    placeholder="combat, fire, aoe"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="cap-public"
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isPublic: e.target.checked }))
                  }
                  className="size-4"
                />
                <label htmlFor="cap-public" className="text-sm">
                  Publish to library (visible to everyone)
                </label>
              </div>
            </div>

            {/* Slot preview */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Primitive Slots</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-mono font-semibold text-primary">
                  Total: {previewBu} BU
                </span>
              </div>

              {selectedSlots.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Click primitives on the left to add them here.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedPrimitiveRows.map(({ slot, primitive }, idx) =>
                    primitive ? (
                      <div
                        key={`${slot.primitiveId}-${idx}`}
                        className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
                      >
                        <span className="flex-1 truncate text-sm font-medium">
                          {primitive.name}
                        </span>
                        <select
                          value={slot.role}
                          onChange={(e) =>
                            updateSlotRole(idx, e.target.value as PrimitiveSlot["role"])
                          }
                          className="rounded-md border border-border bg-card px-2 py-1 text-xs"
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
                          className="w-14 rounded-md border border-border bg-card px-2 py-1 text-center text-xs"
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {primitive.buCost * slot.quantity} BU
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSlot(idx)}
                          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
              {message ? (
                <p className="text-sm text-muted-foreground">{message}</p>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-card"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Compiling..." : "Compile Capability"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      {/* Existing capabilities list */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">
          Library ({capabilities.length} capabilities)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Existing capabilities, ordered alphabetically. BU total is computed
          client-side from primitive links.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.slice(0, 24).map((cap) => {
            const bu = capabilityBuTotal(cap);
            return (
              <article
                key={cap.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{cap.name}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                    {bu} BU
                  </span>
                </header>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cap.type} - {cap.sourceType}
                  {cap.sourceOrigin ? ` - ${cap.sourceOrigin}` : ""}
                </p>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {cap.verboseDescription}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {cap.primitiveLinks.length} primitives
                </p>
              </article>
            );
          })}
        </div>

        {capabilities.length > 24 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Showing 24 of {capabilities.length}. Browse full library coming in
            Tier 3.
          </p>
        )}
      </section>
    </div>
  );
}