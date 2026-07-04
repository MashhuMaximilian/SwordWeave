"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";

/**
 * Template Composer
 *
 * Unified form for race, background, and archetype templates.
 * Kind switches which primitive category is allowed:
 *   - RACE → HERITAGE_AUGMENT
 *   - BACKGROUND → BACKGROUND_AUGMENT
 *   - ARCHETYPE → CHARACTER_SHEET_AUGMENT
 *
 * Templates can also bundle capabilities the template grants on application.
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

type TemplatePrimitiveLink = {
  primitiveId: number;
  primitive: PrimitiveRow;
};

type TemplateRow = {
  id: string;
  kind: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  sourceOrigin: string | null;
  primitiveLinks: TemplatePrimitiveLink[];
};

type TemplateKind = "RACE" | "BACKGROUND" | "ARCHETYPE";

const KIND_VALUES: TemplateKind[] = ["RACE", "BACKGROUND", "ARCHETYPE"];

function expectedCategory(kind: TemplateKind): string {
  switch (kind) {
    case "RACE":
      return "HERITAGE_AUGMENT";
    case "BACKGROUND":
      return "BACKGROUND_AUGMENT";
    case "ARCHETYPE":
      return "CHARACTER_SHEET_AUGMENT";
  }
}

function isValidKind(value: string | null | undefined): value is TemplateKind {
  return value === "RACE" || value === "BACKGROUND" || value === "ARCHETYPE";
}

function kindSingular(kind: TemplateKind): string {
  switch (kind) {
    case "RACE":
      return "Race";
    case "BACKGROUND":
      return "Background";
    case "ARCHETYPE":
      return "Archetype";
  }
}

export function TemplateComposer({
  initialKind,
  primitives,
  capabilities,
  editingTemplate,
}: {
  initialKind: TemplateKind;
  primitives: PrimitiveRow[];
  capabilities: CapabilityRow[];
  editingTemplate?: TemplateRow | null;
}) {
  const isEditMode = Boolean(editingTemplate);
  const [kind, setKind] = useState<TemplateKind>(initialKind);
  const allowedCategory = expectedCategory(kind);

  const initialPrimitiveIds = editingTemplate
    ? editingTemplate.primitiveLinks.map((l) => l.primitiveId)
    : [];
  const [selectedPrimitiveIds, setSelectedPrimitiveIds] =
    useState<number[]>(initialPrimitiveIds);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>(
    [],
  );
  const [form, setForm] = useState(
    editingTemplate
      ? {
          name: editingTemplate.name,
          imageUrl: editingTemplate.imageUrl ?? "",
          description: editingTemplate.description ?? "",
          suggestedTraits: editingTemplate.suggestedTraits ?? "",
          isPublic: editingTemplate.isPublic,
        }
      : {
          name: "",
          imageUrl: "",
          description: "",
          suggestedTraits: "",
          isPublic: false,
        },
  );
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

  const filteredPrimitives = useMemo(
    () => primitives.filter((p) => p.category === allowedCategory),
    [primitives, allowedCategory],
  );

  const searchablePrimitives = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredPrimitives;
    return filteredPrimitives.filter((p) =>
      [p.name, p.narrativeRule].join(" ").toLowerCase().includes(q),
    );
  }, [filteredPrimitives, query]);

  const computedBu = useMemo(
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

  function resetForm() {
    setSelectedPrimitiveIds([]);
    setSelectedCapabilityIds([]);
    setForm({
      name: "",
      imageUrl: "",
      description: "",
      suggestedTraits: "",
      isPublic: false,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      showToast("Name is required.", "error");
      return;
    }

    startTransition(async () => {
      try {
        const url =
          isEditMode && editingTemplate
            ? `/api/templates/${editingTemplate.id}`
            : "/api/templates";
        const method = isEditMode ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            name: form.name.trim(),
            imageUrl: form.imageUrl.trim() || null,
            description: form.description.trim() || null,
            suggestedTraits: form.suggestedTraits.trim() || null,
            isPublic: form.isPublic,
            primitiveIds: selectedPrimitiveIds,
            capabilityIds: selectedCapabilityIds,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error ?? "Failed to save template.";
          showToast(errMsg, "error");
          return;
        }

        const successMsg = isEditMode
          ? `Updated ${kindSingular(kind).toLowerCase()} "${form.name}".`
          : `Created ${kindSingular(kind).toLowerCase()} "${form.name}" (${computedBu} BU).`;
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
          Template Composer
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          Author a {kindSingular(kind).toLowerCase()}.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Pick a kind, name it, and slot in the {allowedCategory
            .toLowerCase()
            .replace("_", "-")}{" "}
          primitives that define it. Optionally bundle capabilities the
          template grants on application.
        </p>
      </div>

      {/* Sticky preview bar */}
      <div className="sticky top-0 z-30 mt-6 -mx-5 border-y border-border bg-background/80 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {!isEditMode && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Kind
                </span>
                <select
                  value={kind}
                  onChange={(e) =>
                    isValidKind(e.target.value) && setKind(e.target.value)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
                >
                  {KIND_VALUES.map((k) => (
                    <option key={k} value={k}>
                      {kindSingular(k)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                BU
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-base font-bold text-primary">
                {computedBu}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Primitives
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {selectedPrimitiveIds.length}
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
              form="template-form"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending
                ? isEditMode
                  ? "Saving..."
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : `Create ${kindSingular(kind)}`}
            </button>
          </div>
        </div>
      </div>

      <form
        id="template-form"
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]"
      >
        {/* LEFT: metadata */}
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Identity</h2>
          <div className="mt-4 space-y-3">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={`e.g. ${kind === "RACE" ? "High Elf" : kind === "BACKGROUND" ? "Sellsword" : "Glass Cannon Mage"}`}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                placeholder="https://..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description / Lore">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Lore, mechanics summary, anything notable..."
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Suggested Traits (markdown)">
              <textarea
                value={form.suggestedTraits}
                onChange={(e) =>
                  setForm((f) => ({ ...f, suggestedTraits: e.target.value }))
                }
                placeholder="Personality traits, hooks, suggested names..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="pt-2">
              <Checkbox
                label="Public (visible to everyone in Library)"
                checked={form.isPublic}
                onChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>
          </div>
        </section>

        {/* RIGHT: selections */}
        <section className="space-y-4">
          {/* Primitives */}
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {kindSingular(kind)} Primitives
              </h2>
              <span className="text-xs text-muted-foreground">
                {selectedPrimitiveIds.length} of {filteredPrimitives.length}{" "}
                selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Only {allowedCategory.toLowerCase().replace("_", "-")} primitives
              can be used in this kind.
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
                  No {allowedCategory.toLowerCase().replace("_", "-")}{" "}
                  primitives in the library yet. Author some in the Primitives
                  workshop first.
                </p>
              ) : (
                searchablePrimitives.map((p) => {
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
              <h2 className="text-lg font-semibold">Bundled Capabilities</h2>
              <span className="text-xs text-muted-foreground">
                {selectedCapabilityIds.length} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Capabilities granted automatically when this template is applied
              to a character or build.
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