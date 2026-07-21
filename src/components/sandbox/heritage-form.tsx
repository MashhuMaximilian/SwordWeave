"use client";

// HeritageForm: controlled form-only composer for heritage (race/background/archetype).
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
  HeritageFormState,
  TemplateSlot,
} from "./heritage-form-preview";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";
import { saveIntentLabel } from "@/lib/publishing/save-intent";

type HeritageRow = {
  id: string;
  userId?: string | null;
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
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

const blankForm: HeritageFormState = {
  kind: "LINEAGE",
  name: "",
  imageUrl: "",
  description: "",
  suggestedTraits: "",
  isPublic: false,
  // Phase 8: per-entity iconography
  iconSource: null,
  iconKey: null,
  iconUrl: null,
  iconColor: "#ffffff",
};

function expectedCategory(kind: string): string {
  // Mashu 2026-07-09: category restrictions removed. Templates can
  // slot any primitive regardless of category — designers decide what
  // belongs to a race/background/archetype based on intent, not a
  // hard-coded taxonomy. The picker now shows the full primitive
  // library so anything can be added; the slot rules in the
  // relationships schema still enforce primitives + capabilities only
  // (no effects, no items), which is the actual safety constraint.
  //
  // This function is kept (returns empty string) because some callers
  // still reference the variable. If a future constraint returns,
  // this is the single hook point.
  void kind;
  return "";
}

function kindSingular(kind: string): string {
  if (kind === "LINEAGE") return "Lineage";
  if (kind === "UPBRINGING") return "Upbringing";
  if (kind === "MANIFEST") return "Manifest";
  return kind;
}

export function HeritageForm({
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
  initialTemplate?: HeritageRow | null;
  initialKind?: "LINEAGE" | "UPBRINGING" | "MANIFEST" | undefined;
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
   * Phase 2: the source row's id. Currently the URL `/api/heritage/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
  onStateChange?: (state: {
    form: HeritageFormState;
    primitives: TemplateSlot[];
    capabilities: TemplateSlot[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (template: HeritageRow) => void;
  onReset?: () => void;
}) {
  const [form, setForm] = useState<HeritageFormState>({
    ...blankForm,
    kind: initialTemplate?.kind ?? initialKind ?? "LINEAGE",
  });
  const [primitiveIds, setPrimitiveIds] = useState<number[]>([]);
  // Phase 7 Q-M-UX: parallel Set tracking which primitive slots are
  // mirrored. Stored as a Set for O(1) lookup; flattened to primitiveSlots
  // at payload-time. Templates keep the flat primitiveIds array because
  // the UI doesn't need to render per-slot rows for slots (slots are
  // already trivially mirrored-aware via the workspace mirror-canonical
  // table — the sandbox shows the toggle in the chip list below).
  const [isMirroredIds, setIsMirroredIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [capabilityIds, setCapabilityIds] = useState<string[]>([]);
  const [mirroredSet, setMirroredSet] = useState<Set<string>>(new Set());
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
      // Phase 8: per-entity iconography
      iconSource: initialTemplate.iconSource,
      iconKey: initialTemplate.iconKey,
      iconUrl: initialTemplate.iconUrl,
      iconColor: initialTemplate.iconColor ?? "#ffffff",
    });
    // Check for a saved draft (e.g. when the form unmounted in the panel
    // and remounted in the drawer). If a draft exists, restore primitiveIds
    // and capabilityIds from it instead of the initial data.
    const draftKey = makeDraftKey("template", id);
    const draft = loadDraft(draftKey);
    if (draft) {
      setPrimitiveIds(draft.primitiveIds);
      setCapabilityIds(draft.capabilityIds);
      // Phase 7 Q-M-UX: restore mirrored set from draft if present.
      // Legacy drafts (pre-mirror-UX) restore an empty set — every slot
      // defaults to non-mirrored, which is the safe default.
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
    setPrimitiveIds(initialTemplate.primitiveLinks.map((l) => l.primitiveId));
    setCapabilityIds([]);
    // Phase 7 Q-M-UX: restore the per-slot Mirrored flags from the
    // saved row. The DB column was added in migration 0034; legacy
    // rows simply get an empty set (all slots non-mirrored).
    setIsMirroredIds(
      new Set<number>(
        initialTemplate.primitiveLinks
          .filter((l) => l.isMirrored)
          .map((l) => l.primitiveId),
      ),
    );
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
          // Phase 7 Q-M-UX: persist the mirrored set alongside the
          // draft so a round-trip restore re-applies the user's
          // mirror choices. Stored as array for JSON serializability.
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
  }, [primitiveIds, capabilityIds, initialTemplate?.id]);

  // Mashu 2026-07-09: removed the category filter. All primitives are
  // allowed regardless of template kind. Designers slot whatever makes
  // sense; the schema only enforces that heritage contain primitives +
  // capabilities (no effects, no items), which is checked at save time
  // by the heritage API.
  const allowedPrimitives = availablePrimitives;
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

  function updateForm(field: keyof HeritageFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePrimitive(id: number) {
    setIsDirty(true);
    setPrimitiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // Phase 7 Q-M-UX: when removing a primitive, drop it from the
    // mirrored set so it doesn't leak across an add/remove cycle.
    // When adding it back later, the user re-checks Mirror explicitly.
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

  function resetEditor() {
    setForm({ ...blankForm, kind: initialKind ?? "LINEAGE" });
    setPrimitiveIds([]);
    setCapabilityIds([]);
    setIsMirroredIds(new Set<number>());
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
      // Phase 7 Q-M-UX: also send primitiveSlots for clients that support
      // the new schema. Server accepts either primitiveIds or
      // primitiveSlots (the latter takes precedence when both are sent).
      primitiveSlots: primitiveIds.map((id) => ({
        primitiveId: id,
        isMirrored: isMirroredIds.has(id),
      })),
      capabilityIds,
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialTemplate) {
      body["intent"] = intent;
    }

    const url = initialTemplate
      ? `/api/heritage/${initialTemplate.id}`
      : "/api/heritage";
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
          ? (payload.template as HeritageRow)
          : null;

      if (template) {
        onSaved?.(template);
      }
      resetEditor();
      router.refresh();
      setMessage(`Template "${template?.name ?? "(unnamed)"}" saved.`);
    });
  }

  // Mashu 2026-07-09: Math.abs() per the mirror rule. Defensive.
  const computedBu = slottedPrimitives.reduce(
    (sum, p) => sum + Math.abs(p.buCost),
    0,
  );

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 sm:p-5"
      onSubmit={submitTemplate}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {initialTemplate
              ? `Edit ${kindSingular(form.kind)}`
              : `New ${kindSingular(form.kind)}`}
          </p>
          {(() => {
            const label = saveIntentLabel(
              intent ?? null,
              initialTemplate?.name ?? null,
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
        <div className="flex items-center gap-2">
          {/* Phase 8 rev 8: replaced the legacy <select> with a read-only
              badge. The dropdown was redundant (the kind is already set by
              heritageKind from the + New entity chooser, and the form
              won't even render without one), and the option labels used
              the OLD taxonomy (Race / Background / Archetype) that no
              longer matches the rename to Lineage / Upbringing / Manifest.
              A read-only badge is both clearer and prevents the user from
              picking a kind that doesn't match the URL/chooser selection. */}
          {!initialTemplate ? (
            <span className="inline-flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {kindSingular(form.kind)}
            </span>
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
          placeholder={`e.g. ${form.kind === "LINEAGE" ? "High Elf" : form.kind === "UPBRINGING" ? "Sellsword" : "Glass Cannon Mage"}`}
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
          <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            {computedBu} BU
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick any primitive — categories aren't restricted for this kind.
        </p>

        {primitiveIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No primitives slotted. Pick a primitive from the Library
            column and use its &ldquo;Slot into build&rdquo; action.
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
          <h3 className="text-sm font-bold">Bundled Capabilities</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Capabilities granted automatically when this template is applied.
        </p>

        {capabilityIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No capabilities bundled. Pick a capability from the Library
            column and use its &ldquo;Slot into build&rdquo; action.
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