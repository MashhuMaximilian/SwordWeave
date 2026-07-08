"use client";

// TemplateForm: controlled form-only composer for templates (race/background/archetype).
// Kind selector switches which primitive category is allowed.
// PATCH support via initialTemplate.

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
  TemplateFormState,
  TemplateSlot,
} from "./template-form-preview";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";

type TemplateRow = {
  id: string;
  userId?: string | null;
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
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

const blankForm: TemplateFormState = {
  kind: "RACE",
  name: "",
  imageUrl: "",
  description: "",
  suggestedTraits: "",
  isPublic: false,
};

function expectedCategory(kind: string): string {
  if (kind === "RACE") return "HERITAGE_AUGMENT";
  if (kind === "BACKGROUND") return "BACKGROUND_AUGMENT";
  if (kind === "ARCHETYPE") return "CHARACTER_SHEET_AUGMENT";
  return "";
}

function kindSingular(kind: string): string {
  if (kind === "RACE") return "Race";
  if (kind === "BACKGROUND") return "Background";
  if (kind === "ARCHETYPE") return "Archetype";
  return kind;
}

export function TemplateForm({
  initialTemplate,
  initialKind,
  availablePrimitives,
  availableCapabilities,
  intent,
  sourceId: _sourceId, // Phase 2: kept for the future when forms use sourceId in the body; the PATCH route reads it from the URL.
  onStateChange,
  onSaved,
  onReset,
}: {
  initialTemplate?: TemplateRow | null;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined;
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
  /**
   * Phase 2: the save intent from `?intent=fork|load`. The PATCH route
   * reads this from the body to decide between fork-on-save and
   * version-update. Null = greenfield (POST, not PATCH).
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 2: the source row's id. Currently the URL `/api/templates/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
  onStateChange?: (state: {
    form: TemplateFormState;
    primitives: TemplateSlot[];
    capabilities: TemplateSlot[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (template: TemplateRow) => void;
  onReset?: () => void;
}) {
  const [form, setForm] = useState<TemplateFormState>({
    ...blankForm,
    kind: initialTemplate?.kind ?? initialKind ?? "RACE",
  });
  const [primitiveIds, setPrimitiveIds] = useState<number[]>([]);
  const [capabilityIds, setCapabilityIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"primitive" | "capability">(
    "primitive",
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  const bootstrappedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = initialTemplate?.id ?? null;
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialTemplate) return;
    setForm({
      kind: initialTemplate.kind,
      name: initialTemplate.name,
      imageUrl: initialTemplate.imageUrl ?? "",
      description: initialTemplate.description ?? "",
      suggestedTraits: initialTemplate.suggestedTraits ?? "",
      isPublic: initialTemplate.isPublic,
    });
    // Check for a saved draft (e.g. when the form unmounted in the panel
    // and remounted in the drawer). If a draft exists, restore primitiveIds
    // and capabilityIds from it instead of the initial data.
    const draftKey = makeDraftKey("template", id);
    const draft = loadDraft(draftKey);
    if (draft) {
      setPrimitiveIds(draft.primitiveIds);
      setCapabilityIds(draft.capabilityIds);
      setIsDirty(true);
      setMessage("Restored your in-progress edits.");
      clearDraft(draftKey);
      return;
    }
    setPrimitiveIds(initialTemplate.primitiveLinks.map((l) => l.primitiveId));
    setCapabilityIds([]);
    setIsDirty(false); // pristine after load
    setMessage(
      initialTemplate.userId
        ? "Loaded your template for editing."
        : "Loaded library template. Saving creates your private copy.",
    );
  }, [initialTemplate]);

  // Save draft on unmount — when the form unmounts in the panel (split
  // mode exit) or in the drawer, save the current primitiveIds/capabilityIds
  // so the other instance can restore them on mount.
  useEffect(() => {
    return () => {
      const id = initialTemplate?.id ?? null;
      const draftKey = makeDraftKey("template", id);
      if (primitiveIds.length > 0 || capabilityIds.length > 0) {
        saveDraft(draftKey, {
          primitiveIds,
          effectIds: [],
          capabilityIds,
          notesByIndex: {},
        });
      } else {
        clearDraft(draftKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primitiveIds, capabilityIds, initialTemplate?.id]);

  const allowedCategory = expectedCategory(form.kind);
  const allowedPrimitives = availablePrimitives.filter(
    (p) => p.category === allowedCategory,
  );
  const slottedPrimitives = primitiveIds
    .map((id) => availablePrimitives.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const slottedCapabilities = capabilityIds
    .map((id) => availableCapabilities.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  useEffect(() => {
    onStateChange?.({
      form,
      primitives: slottedPrimitives,
      capabilities: slottedCapabilities.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.type,
        buCost: 0,
      })),
      isDirty,
    });
  }, [form, slottedPrimitives, slottedCapabilities, onStateChange, isDirty]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  // External slot trigger: the user can slot primitives AND capabilities
  // into a template. Effect slots will be added once the schema gains
  // template↔effect link support.
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
      if (e.detail.kind === "capability") {
        const id = String(e.detail.id);
        setCapabilityIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
      // effect kind — no-op until template↔effect links ship.
    };
    window.addEventListener("sw-sandbox-slot", handler);
    return () => window.removeEventListener("sw-sandbox-slot", handler);
  }, []);

  function updateForm(field: keyof TemplateFormState, value: string | boolean) {
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

  function resetEditor() {
    setForm({ ...blankForm, kind: initialKind ?? "RACE" });
    setPrimitiveIds([]);
    setCapabilityIds([]);
    setPickerOpen(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh template.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.();
  }

  function submitTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Name is required.");
      return;
    }

    const body: Record<string, unknown> = {
      kind: form.kind,
      name: form.name.trim(),
      imageUrl: form.imageUrl.trim() || null,
      description: form.description.trim() || null,
      suggestedTraits: form.suggestedTraits.trim() || null,
      isPublic: form.isPublic,
      primitiveIds,
      capabilityIds,
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialTemplate) {
      body["intent"] = intent;
    }

    const url = initialTemplate
      ? `/api/templates/${initialTemplate.id}`
      : "/api/templates";
    const method = initialTemplate ? "PATCH" : "POST";

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
            : "Unable to save template.";
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

      const template =
        payload && typeof payload === "object" && "template" in payload
          ? (payload.template as TemplateRow)
          : null;

      if (template) {
        onSaved?.(template);
      }
      resetEditor();
      router.refresh();
      setMessage(`Template "${template?.name ?? "(unnamed)"}" saved.`);
    });
  }

  const computedBu = slottedPrimitives.reduce(
    (sum, p) => sum + p.buCost,
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitTemplate}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {initialTemplate
            ? `Edit ${kindSingular(form.kind)}`
            : `New ${kindSingular(form.kind)}`}
        </p>
        <div className="flex items-center gap-2">
          {!initialTemplate ? (
            <select
              value={form.kind}
              onChange={(e) =>
                updateForm("kind", e.target.value as TemplateFormState["kind"])
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="RACE">Race</option>
              <option value="BACKGROUND">Background</option>
              <option value="ARCHETYPE">Archetype</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={resetEditor}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <label className="block text-sm font-medium">
        Name
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          placeholder={`e.g. ${form.kind === "RACE" ? "High Elf" : form.kind === "BACKGROUND" ? "Sellsword" : "Glass Cannon Mage"}`}
          required
        />
      </label>

      <label className="block text-sm font-medium">
        Image URL (optional)
        <input
          type="url"
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.imageUrl}
          onChange={(e) => updateForm("imageUrl", e.target.value)}
          placeholder="https://..."
        />
      </label>

      <label className="block text-sm font-medium">
        Description / Lore
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
          placeholder="Lore, mechanics summary, anything notable..."
          rows={4}
        />
      </label>

      <label className="block text-sm font-medium">
        Suggested Traits (markdown)
        <textarea
          className="mt-2 min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.suggestedTraits}
          onChange={(e) => updateForm("suggestedTraits", e.target.value)}
          placeholder="Personality traits, hooks, suggested names..."
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm font-medium">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Visibility
        </span>
        <VisibilitySelect
          compact
          value={form.isPublic ? "PUBLIC" : "PRIVATE"}
          onChange={(next) => updateForm("isPublic", next === "PUBLIC")}
        />
        <span className="text-[10px] font-normal text-muted-foreground">
          Public entries appear in the Library. Private and Followers-only
          entries can be promoted to Public from the My Creations page.
        </span>
      </label>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">
            {kindSingular(form.kind)} Primitives
          </h3>
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
        <p className="mt-1 text-xs text-muted-foreground">
          Only {allowedCategory.toLowerCase().replace(/_/g, "-")} primitives
          can be used in this kind.
        </p>

        {pickerOpen && pickerTarget === "primitive" ? (
          <SlotPicker
            items={allowedPrimitives.map((p) => ({
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
            No primitives slotted. Click "+ Slot primitive" to add one.
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
          <h3 className="text-sm font-bold">Bundled Capabilities</h3>
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
        <p className="mt-1 text-xs text-muted-foreground">
          Capabilities granted automatically when this template is applied.
        </p>

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
            No capabilities bundled.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slottedCapabilities.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.type} · {c.sourceType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCapability(c.id)}
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-sandbox-submit
          disabled={isPending}
          className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : initialTemplate
              ? "Save Changes"
              : `Create ${kindSingular(form.kind)}`}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
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