"use client";
import { PhonePiecePicker } from "./phone-piece-picker";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { DetailModal } from "@/components/ui/detail-modal";
import { PhonePieceDetails } from "./phone-piece-details";
import { readFlavorReference, writeFlavorReference } from "@/lib/capabilities/flavor-reference";
import { RollResolutionEditor } from "./roll-resolution-editor";
import { EMPTY_RESOLUTION, readRollResolution, writeRollResolution, type RollResolution } from "@/lib/capabilities/roll-resolution";
import { readJsonResponse } from "@/lib/http/read-json-response";
import { RecipePrimitiveIdentity } from "./recipe-primitive-identity";
import { RecipeComposition, RecipeEntityIdentity, primitiveLinksBu } from "./recipe-composition";
import { AuthorChapters, AuthorChapter } from "./author-chapters";
import { SortableBundleList,SortableMember } from "@/components/characters/workspace/sortable-bundle-list";

// CapabilityForm: controlled form-only composer for capabilities.
// Slots primitives with role + quantity. Save handles both POST (create) and
// PATCH (update via initialCapability).

import { Trash2 } from "lucide-react";
import { useMemo, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CapabilityFormState,
  CapabilitySlot,
} from "./capability-form-preview";
import { type CharacterSlotMetadata, useCharacterAuthoring, useCharacterFormRecovery } from "./character-authoring-context";
import { AuthorPublishFields } from "./author-publish-fields";
import { saveIntentLabel } from "@/lib/publishing/save-intent";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  makeDraftKey,
} from "@/lib/sandbox/form-draft";

type CapabilityRow = {
  id: string;
  userId?: string | null;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    role: string;
    quantity: number;
    sortOrder: number;
    slotLabel: string | null;
    notes?: string | null;
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

function defaultRoleForCategory(category: string): string {
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
    case "INTENSITY_DICE":
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

const DEDICATED_ROLES = ["VERB", "DOMAIN", "RANGE", "OUTPUT"] as const;
type DedicatedRole = (typeof DEDICATED_ROLES)[number];

import { TABLE_AXES, TABLE_HELP, readTableGuidance, writeTableGuidance, type TableAxis, type TableGuidance } from "@/lib/capabilities/table-guidance";

const TABLE_AXIS_OPTIONS = TABLE_AXES;
type TableAxisKey = TableAxis;
type TableDraft = TableGuidance;
const TABLE_AXIS_NOTE_PREFIX = "atelier-table-axis:";

function parseTableAxisNote(notes?: string) {
  if (!notes?.startsWith(TABLE_AXIS_NOTE_PREFIX)) return null;
  const encoded = notes.slice(TABLE_AXIS_NOTE_PREFIX.length);
  const separator = encoded.indexOf(":");
  if (separator < 0) return null;
  return { axis: encoded.slice(0, separator) as TableAxisKey, value: encoded.slice(separator + 1) };
}

function resolvedSlotRole(slot: Pick<CapabilitySlot, "role" | "primitive">): string {
  const inferred = defaultRoleForCategory(slot.primitive.category);
  return DEDICATED_ROLES.includes(inferred as DedicatedRole) ? inferred : slot.role;
}

const blankForm: CapabilityFormState = {
  name: "",
  type: "ACTIVE",
  sourceType: "PHYSICAL",
  verboseDescription: "",
  sourceOrigin: "",
  tags: "",
  isPublic: false,
  // Phase 8: per-entity iconography
  iconSource: null,
  iconKey: null,
  iconUrl: null,
  iconColor: "#ffffff",
};

export function CapabilityForm({
  initialCapability,
  saveRequest = fetch,
  slotEvents,
  initialPrimitiveIds = [],
  initialPrimitiveSlots = {},
  initialEffectIds = [],
  availablePrimitives: sourcePrimitives,
  availableEffects: sourceEffects,
  intent,
  sourceId: _sourceId, // Phase 2: kept for the future when forms use sourceId in the body; the PATCH route reads it from the URL.
  onStateChange,
  onSaved,
  onReset,
}: {
  saveRequest?: typeof fetch;
  slotEvents?: EventTarget;
  initialPrimitiveIds?: number[];
  initialPrimitiveSlots?: Record<number, CharacterSlotMetadata>;
  initialEffectIds?: string[];
  initialCapability?: CapabilityRow | null;
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
    mechanicalOutputText?: string | null;
    narrativeRule?: string | null;
  }>;
  availableEffects: Array<{ id: string; name: string; narrativeDescription?: string | null; primitiveLinks?: Array<{ primitiveId: number; quantity?: number; primitive: { id?: number; name: string; category?: string; buCost: number; mechanicalOutputText?: string | null; narrativeRule?: string | null } }> }>;
  /**
   * Phase 2: the save intent from `?intent=fork|load`. The PATCH route
   * reads this from the body to decide between fork-on-save and
   * version-update. Null = greenfield (POST, not PATCH).
   */
  intent?: "fork" | "load" | null;
  /**
   * Phase 2: the source row's id. Currently the URL `/api/capabilities/[id]`
   * carries this, but forms that need it for client-side logic can read
   * it from here. The PATCH route uses the URL param.
   */
  sourceId?: string | number | null;
  onStateChange?: (state: {
    form: CapabilityFormState;
    slots: CapabilitySlot[];
    effectIds: string[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     */
    isDirty: boolean;
  }) => void;
  onSaved?: (capability: CapabilityRow) => void;
  onReset?: () => void;
}) {
  const phone = useIsMobile();
  const [phoneSlot, setPhoneSlot] = useState<DedicatedRole | null>(null);
  const characterAuthoring = useCharacterAuthoring();
  const [recoveredCatalog, setRecoveredCatalog] = useState<{ primitives: typeof sourcePrimitives; effects: typeof sourceEffects } | null>(null);
  const availablePrimitives = useMemo(() => [...sourcePrimitives, ...(recoveredCatalog?.primitives ?? []).filter((entry) => !sourcePrimitives.some((current) => current.id === entry.id))], [sourcePrimitives, recoveredCatalog]);
  const availableEffects = useMemo(() => [...sourceEffects, ...(recoveredCatalog?.effects ?? []).filter((entry) => !sourceEffects.some((current) => current.id === entry.id))], [sourceEffects, recoveredCatalog]);

  const [orderChanged,setOrderChanged]=useState(false);
  const [form, setForm] = useState<CapabilityFormState>(blankForm);
  const scopedInitial=useRef<typeof initialCapability>(undefined);
  const [slots, setSlots] = useState<CapabilitySlot[]>(() => {
    const seeded = initialPrimitiveIds.flatMap((id, index) => {
      const primitive = availablePrimitives.find((entry) => entry.id === id);
      return primitive ? [{ primitiveId: id, primitive, quantity: 1, isMirrored: false, role: defaultRoleForCategory(primitive.category), sortOrder: index, slotLabel: null, ...initialPrimitiveSlots[id] }] : [];
    });
    if (seeded.length || initialCapability) return seeded;
    const touch = availablePrimitives.find((primitive) => primitive.category === "RANGE" && primitive.name.toLowerCase() === "touch range");
    return touch ? [{ primitiveId: touch.id, primitive: touch, quantity: 1, isMirrored: false, role: "RANGE", sortOrder: 0, slotLabel: touch.name }] : [];
  });
  const [effectIds, setEffectIds] = useState<string[]>(initialEffectIds);
  const [resolution,setResolution] = useState<RollResolution>({...EMPTY_RESOLUTION});
  const [includeTable, setIncludeTable] = useState(false);
  const [customAxes, setCustomAxes] = useState<Partial<Record<TableAxisKey,boolean>>>({});
  const [tableDraft, setTableDraft] = useState<TableDraft>({
    target: "Single", shape: "Direct", size: "One target", placement: "Target",
    range: "Touch", output: "None", duration: "Instant", casting: "Action",
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  const recovery = useCharacterFormRecovery("capability", { catalog: { primitives: availablePrimitives.filter((entry) => slots.some((slot) => slot.primitiveId === entry.id)), effects: availableEffects.filter((entry) => effectIds.includes(entry.id)) }, form, slots, effectIds, tableDraft, includeTable, resolution, orderChanged }, isDirty, (saved) => {
    setRecoveredCatalog(saved.catalog); setForm(saved.form); setSlots(saved.slots); setEffectIds(saved.effectIds); setTableDraft(saved.tableDraft); setIncludeTable(saved.includeTable ?? false); setResolution(saved.resolution ?? {...EMPTY_RESOLUTION}); setOrderChanged(saved.orderChanged);
    setIsDirty(true); setMessage("Restored your unfinished character piece.");
  });

  const bootstrappedRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (recovery.restored) return;
    const id = initialCapability?.id ?? null;
    // Only bootstrap on first mount OR when the user loads a different
    // entity (different id). Re-bootstrapping resets the form to the new
    // entity's data and clears the dirty flag.
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialCapability) return;
    if(slotEvents && scopedInitial.current===initialCapability)return;
    scopedInitial.current=initialCapability;
    // Check for a saved draft (e.g. when the form unmounted in the panel
    // and remounted in the drawer). If a draft exists for this entity,
    // restore the slots/effects from it instead of the initial data.
    const draftKey = makeDraftKey("capability", id, characterAuthoring?.namespace);
    const draft = loadDraft(draftKey);
    const guidance = readTableGuidance(initialCapability.verboseDescription);
    setIncludeTable(!!guidance.table);
    // Loading another capability must rehydrate its optional declaration alongside its form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guidance.table) setTableDraft(guidance.table);
    const resolved = readRollResolution(guidance.description);
    setResolution(resolved.resolution);
    setForm({
      name: initialCapability.name,
      type: initialCapability.type,
      sourceType: initialCapability.sourceType,
      verboseDescription: resolved.description,
      sourceOrigin: initialCapability.sourceOrigin ?? "",
      tags: (initialCapability.tags ?? []).join(", "),
      isPublic: initialCapability.isPublic,
      // Phase 8: per-entity iconography
      iconSource: initialCapability.iconSource,
      iconKey: initialCapability.iconKey,
      iconUrl: initialCapability.iconUrl,
      iconColor: initialCapability.iconColor ?? "#ffffff",
    });
    if (draft) {
      // Restore effectIds from the draft.
      setEffectIds(draft.effectIds);
      setIsDirty(true); // draft = user was editing
      setMessage("Restored your in-progress edits.");
      clearDraft(draftKey);
      // Restore primitive slots from the draft, re-deriving the primitive
      // object from availablePrimitives. Slots in the draft that can't be
      // matched (e.g. primitive not in the current page) are dropped.
      const restoredSlots: CapabilitySlot[] = [];
      for (const sid of draft.primitiveIds) {
        const prim = availablePrimitives.find((p) => p.id === sid);
        if (!prim) continue;
        restoredSlots.push({
          primitiveId: sid,
          role: defaultRoleForCategory(prim.category),
          quantity: 1,
          sortOrder: restoredSlots.length,
          slotLabel: prim.name,
          // Phase 7 Q-M-UX: default to false on draft restore. The
          // workshop composer (template-composer) is the canonical
          // place to flag mirrors; sandbox drafts default to off.
          isMirrored: false,
          primitive: prim,
        });
      }
      setSlots(restoredSlots);
      return;
    }
    setSlots(
      initialCapability.primitiveLinks.map((link) => ({
        primitiveId: link.primitiveId,
        role: link.role ?? "OTHER",
        quantity: link.quantity,
        sortOrder: link.sortOrder,
        slotLabel: link.slotLabel ?? link.primitive.name,
        notes: link.notes ?? undefined,
        // Phase 7 Q-M-UX: read per-slot Mirrored flag from the link.
        isMirrored: link.isMirrored ?? false,
        primitive: link.primitive,
      })),
    );
    setEffectIds(
      (initialCapability as unknown as { effectLinks?: Array<{ effectId: string }> })
        .effectLinks?.map((l) => l.effectId) ?? [],
    );
    setIsDirty(false); // pristine after load
    setMessage(
      characterAuthoring ? "Editing this character’s draft. Apply changes after review." : initialCapability.userId
        ? "Loaded your capability for editing."
        : "Loaded library capability. Saving creates your private copy.",
    );
  }, [initialCapability, availablePrimitives]);

  // Save draft on unmount — when the form unmounts in the panel (split
  // mode exit) or in the drawer, save the current slots/effects so the
  // other instance can restore them on mount.
  useEffect(() => {
    if (characterAuthoring) return;
    return () => {
      const id = initialCapability?.id ?? null;
      const draftKey = makeDraftKey("capability", id);
      if (slots.length > 0 || effectIds.length > 0) {
        saveDraft(draftKey, {
          primitiveIds: slots.map((s) => s.primitiveId),
          effectIds,
          capabilityIds: [],
          notesByIndex: {},
        });
      } else {
        clearDraft(draftKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, effectIds, initialCapability?.id]);

  useEffect(() => {
    onStateChange?.({ form:{...form,verboseDescription:writeTableGuidance(writeRollResolution(form.verboseDescription,resolution),includeTable ? tableDraft : null)}, slots, effectIds, isDirty });
  }, [form, slots, effectIds, onStateChange, isDirty, includeTable, tableDraft, resolution]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  // External slot trigger: capabilities accept primitives AND effects
  // (per the user's spec). The form's primitive-slot state is already
  // wired; we now also accept effects and add them to `effectIds`.
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{
        kind: "primitive" | "effect" | "capability";
        id: number | string;
        label: string;
        operation?: "add-reference";
      } & CharacterSlotMetadata>;
      if (e.detail.kind === "primitive") {
        const id =
          typeof e.detail.id === "string" ? Number(e.detail.id) : e.detail.id;
        if (!Number.isFinite(id)) return;
        addSlot(id, e.detail.operation === "add-reference", {
          ...(e.detail.isMirrored !== undefined ? { isMirrored: e.detail.isMirrored } : {}),
          ...(e.detail.quantity !== undefined ? { quantity: e.detail.quantity } : {}),
          ...(e.detail.role !== undefined ? { role: e.detail.role } : {}),
        });
        return;
      }
      if (e.detail.kind === "effect") {
        const id = String(e.detail.id);
        setEffectIds((prev) =>
          prev.includes(id) ? prev : [...prev, id],
        );
        setIsDirty(true);
        return;
      }
      // capability kind — not supported on capability form.
    };
    (slotEvents ?? window).addEventListener("sw-sandbox-slot", handler);
    return () => (slotEvents ?? window).removeEventListener("sw-sandbox-slot", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePrimitives]);

  function updateForm(field: keyof CapabilityFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addSlot(primitiveId: number, referenceOnly = false, metadata: CharacterSlotMetadata = {}) {
    const primitive = availablePrimitives.find((p) => p.id === primitiveId);
    if (!primitive) return;
    const role = metadata.role ?? defaultRoleForCategory(primitive.category);
    setIsDirty(true);
    setSlots((prev) => {
      if (referenceOnly && prev.some(s=>s.primitiveId===primitiveId)) return Object.keys(metadata).length ? prev.map((slot) => slot.primitiveId === primitiveId ? { ...slot, ...metadata } : slot) : prev;
      const next = {
        primitiveId,
        role,
        quantity: 1,
        sortOrder: prev.length,
        slotLabel: primitive.name,
        // Phase 7 Q-M-UX: per-slot Mirrored flag.
        isMirrored: false,
        primitive,
        ...metadata,
      };
      if (DEDICATED_ROLES.includes(role as DedicatedRole)) {
        const retained = prev.filter((slot) => resolvedSlotRole(slot) !== role);
        return [...retained, {...next, sortOrder: retained.length}];
      }
      return [...prev, next];
    });
  }

  function chooseRulePrimitive(role: string, primitiveId: number | null) {
    setIsDirty(true);
    setSlots((current) => {
      const retained = current.filter((slot) => resolvedSlotRole(slot) !== role);
      if (primitiveId === null) return retained.map((slot, index) => ({ ...slot, sortOrder: index }));
      const primitive = availablePrimitives.find((item) => item.id === primitiveId);
      if (!primitive) return current;
      return [...retained, { primitiveId, primitive, role, quantity: 1, isMirrored: false, sortOrder: retained.length, slotLabel: primitive.name }];
    });
  }

  function removeSlot(index: number) {
    setIsDirty(true);
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlotRole(index: number, role: string) {
    setIsDirty(true);
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, role } : slot)),
    );
  }

  function updateSlotQuantity(index: number, quantity: number) {
    setIsDirty(true);
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === index ? { ...slot, quantity: Math.max(1, quantity) } : slot,
      ),
    );
  }

  function removeEffect(id: string) {
    setIsDirty(true);
    setEffectIds((prev) => prev.filter((x) => x !== id));
  }

  function resetEditor() {
    recovery.clear();
    setForm(blankForm);
    const touch = availablePrimitives.find((primitive) => primitive.category === "RANGE" && primitive.name.toLowerCase() === "touch range");
    setSlots(touch ? [{ primitiveId: touch.id, primitive: touch, role: "RANGE", quantity: 1, isMirrored: false, sortOrder: 0, slotLabel: touch.name }] : []);
    setEffectIds([]);
    setResolution({...EMPTY_RESOLUTION});
    setIncludeTable(false); setCustomAxes({});
    setTableDraft({ target: "Single", shape: "Direct", size: "One target", placement: "Target", range: "Touch", output: "None", duration: "Instant", casting: "Action" });
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh capability.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.();
  }

  function submitCapability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Capability name is required.");
      return;
    }
    if (slots.length === 0) {
      setMessage(characterAuthoring ? "Choose at least one rule for this capability." : "Add at least one primitive to compile.");
      return;
    }

    const body: Record<string, unknown> = {
      ...(orderChanged?{membershipOrder:[...slots.map(s=>`primitive:${s.primitiveId}:${s.role}`),...effectIds.map(id=>`effect:${id}`)]}:{}),
      name: form.name.trim(),
      type: form.type,
      sourceType: form.sourceType,
      verboseDescription: writeTableGuidance(writeRollResolution(form.verboseDescription,resolution), includeTable ? tableDraft : null),
      sourceOrigin: form.sourceOrigin.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isPublic: characterAuthoring ? false : form.isPublic,
      primitiveSlots: slots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        sortOrder: s.sortOrder,
        slotLabel: s.slotLabel,
        notes: s.notes ?? "",
        // Phase 7 Q-M-UX: per-slot Mirrored flag.
        isMirrored: s.isMirrored,
      })),
      effectSlots: effectIds.map((id, idx) => ({
        effectId: id,
        sortOrder: idx,
      })),
    };

    // Phase 2: thread `intent` into the PATCH body so the server's
    // dispatch matrix can decide fork vs version-update vs no-op.
    // POST (greenfield) doesn't need intent — the row is always new.
    if (intent && initialCapability) {
      body["intent"] = intent;
    }

    const url = initialCapability
      ? `/api/capabilities/${initialCapability.id}`
      : "/api/capabilities";
    const method = initialCapability ? "PATCH" : "POST";

    startTransition(async () => {
      try {
      const response = await saveRequest(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await readJsonResponse(response);

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to save capability.";
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

      const capability =
        payload && typeof payload === "object" && "capability" in payload
          ? (payload.capability as CapabilityRow)
          : null;

      if (capability) {
        window.dispatchEvent(new CustomEvent("sw:library-changed"));
      recovery.clear();
      onSaved?.(capability);
      }
      resetEditor();
      if (!characterAuthoring) router.refresh();
      setMessage(characterAuthoring ? "Saved to the character draft. Review changes before applying." : `Capability "${capability?.name ?? "(unnamed)"}" saved.`);
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save. Your edits are still here; please retry."); }
    });
  }

  const directBu = slots.reduce(
    (sum, slot) => sum + Math.abs(slot.primitive.buCost * slot.quantity),
    0,
  );
  const effectBu = effectIds.reduce((sum, id) => {
    const effect = availableEffects.find((entry) => entry.id === id);
    return sum + primitiveLinksBu(effect?.primitiveLinks?.map((link) => ({
      ...link,
      primitive: { ...link.primitive, id: link.primitiveId, category: link.primitive.category ?? "OTHER" },
    })));
  }, 0);
  const previewBu = directBu + effectBu;
  const regularSlots = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => !DEDICATED_ROLES.includes(resolvedSlotRole(slot) as DedicatedRole));
  const rangeSlot = slots.find((slot) => resolvedSlotRole(slot) === "RANGE");
  const outputSlot = slots.find((slot) => resolvedSlotRole(slot) === "OUTPUT");
  const selectedRange = rangeSlot?.primitive.name.replace(/\s+Range$/i, "") || "Touch";
  const selectedOutput = (outputSlot ? `${outputSlot.primitive.name} ${outputSlot.primitive.mechanicalOutputText ?? ""}` : "").match(/d(?:4|6|8|10|12|20)\b/i)?.[0].toLowerCase() || "None";

  const primitiveSearchText = (primitive: (typeof availablePrimitives)[number]) =>
    `${primitive.name} ${primitive.mechanicalOutputText ?? ""}`.toLowerCase();
  const rangePrimitive = (label: string) => {
    const needle = label.toLowerCase();
    return availablePrimitives.find((primitive) => primitive.category === "RANGE" && (
      primitive.name.toLowerCase() === `${needle} range` ||
      primitive.name.toLowerCase() === needle ||
      primitiveSearchText(primitive).includes(`range to ${needle}`)
    ));
  };
  const outputPrimitive = (die: string) => availablePrimitives.find((primitive) =>
    (primitive.category === "INTENSITY_DICE" || primitive.category === "OUTPUT") &&
    primitiveSearchText(primitive).includes(die.toLowerCase()),
  );
  const tableAxisSlot = (axis: TableAxisKey) => slots
    .map((slot, index) => ({ slot, index, meta: parseTableAxisNote(slot.notes) }))
    .find(({ slot, meta }) =>
      meta?.axis === axis ||
      (axis === "duration" && !meta && slot.primitive.category === "DURATION") ||
      (axis === "casting" && !meta && slot.primitive.category === "SPEED_QUICKENING"),
    );
  const tableAxisValue = (axis: TableAxisKey) => tableDraft[axis];
  const replaceTableAxisPrimitive = (axis: TableAxisKey, value: string) => {
    setIsDirty(true);
    setCustomAxes(current=>({...current,[axis]:value === "Custom"}));
    setTableDraft(current=>({...current,[axis]:value === "Custom" ? "" : value}));
  };
  const removeTableAxisPrimitive = (axis: TableAxisKey) => {
    const selected = tableAxisSlot(axis);
    if (!selected) return;
    setSlots((current) => current.filter((_, index) => index !== selected.index).map((slot, index) => ({ ...slot, sortOrder: index })));
    setIsDirty(true);
    setMessage(`${TABLE_AXIS_OPTIONS[axis].label} stays “${tableDraft[axis]}” in the spoken intent; its primitive was removed from Pieces.`);
  };
  const chooseTableRange = (label: string) => {
    if (label === "Touch") { chooseRulePrimitive("RANGE", null); setTableDraft(current=>({...current,range:"Touch"})); return; }
    const primitive = rangePrimitive(label);
    if (primitive) {
      setTableDraft((current) => ({ ...current, range: label }));
      setIsDirty(true);
      setSlots((current) => {
        const retained = current.filter((slot) => resolvedSlotRole(slot) !== "RANGE");
        return [...retained, { primitiveId: primitive.id, primitive, role: "RANGE", quantity: 1, isMirrored: false, sortOrder: retained.length, slotLabel: primitive.name }];
      });
      setMessage(`${primitive.name} included in Pieces. Range beyond touch requires this purchased access.`);
    } else {
      setMessage(`No ${label} range primitive is available in this library.`);
    }
  };
  const chooseTableOutput = (die: string) => {
    if (die === "None") {
      setTableDraft((current) => ({ ...current, output: die }));
      chooseRulePrimitive("OUTPUT", null);
      setMessage("Output die removed from Pieces.");
      return;
    }
    const primitive = outputPrimitive(die);
    if (primitive) {
      setTableDraft((current) => ({ ...current, output: die }));
      setIsDirty(true);
      setSlots((current) => {
        const retained = current.filter((slot) => resolvedSlotRole(slot) !== "OUTPUT");
        return [...retained, { primitiveId: primitive.id, primitive, role: "OUTPUT", quantity: 1, isMirrored: false, sortOrder: retained.length, slotLabel: primitive.name }];
      });
      setMessage(`${primitive.name} included in Pieces. An output die requires this purchased access.`);
    } else {
      setMessage(`No ${die} output primitive is available in this library.`);
    }
  };

  const renderDedicatedSlot = (
    role: DedicatedRole,
    label: string,
    matches: (primitive: (typeof availablePrimitives)[number]) => boolean,
  ) => {
    const selectedEntry = slots
      .map((slot, index) => ({ slot, index }))
      .find(({ slot }) => resolvedSlotRole(slot) === role);
    const selectedPrimitive = selectedEntry?.slot.primitive;
    const flavorLabel=role === "DOMAIN" ? "domain" : role === "VERB" ? "verb" : null;
    const flavor=flavorLabel ? readFlavorReference(form.verboseDescription,flavorLabel) : "";
    if (phone) return <button type="button" className="phone-reference-slot" data-dedicated-role={role} onClick={()=>setPhoneSlot(role)}><span>{label}</span><strong>{selectedPrimitive?.name ?? (flavor ? `${flavor} · flavor` : "Not set")}</strong><small>{selectedPrimitive ? `${selectedPrimitive.buCost} BU · Edit` : flavorLabel ? "Choose or add flavor" : "Choose rule"}</small></button>;
    return <article className="group min-w-0 rounded-md border border-border bg-background/80 px-2.5 py-2 transition-colors hover:border-[#b88a39]" data-dedicated-role={role}>
      <div className="flex min-w-0 items-center gap-2">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <details className="relative min-w-0 flex-1">
          <summary className="flex min-w-0 cursor-pointer list-none items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-accent/60">
            <span className={selectedPrimitive ? "min-w-0 flex-1 truncate font-medium text-foreground" : "min-w-0 flex-1 truncate text-muted-foreground"}>{selectedPrimitive?.name ?? (flavor ? `${flavor} · flavor only` : `Choose ${label.toLowerCase()}`)}</span>
            {selectedPrimitive ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{selectedPrimitive.buCost} BU</span> : null}
            <span className="shrink-0 text-xs text-primary">{selectedPrimitive ? "edit" : "add"}</span>
          </summary>
          <div className="v12-foundation-menu">
            <button type="button" onClick={() => chooseRulePrimitive(role, null)}>Open / none</button>
            {availablePrimitives.filter(matches).map((primitive) => <button type="button" aria-pressed={primitive.id === selectedPrimitive?.id} onClick={() => {
              chooseRulePrimitive(role, primitive.id);
              if (role === "RANGE") setTableDraft((current) => ({ ...current, range: primitive.name.replace(/\s+Range$/i, "") }));
              if (role === "OUTPUT") {
                const die = `${primitive.name} ${primitive.mechanicalOutputText ?? ""}`.match(/d(?:4|6|8|10|12|20)/i)?.[0];
                if (die) setTableDraft((current) => ({ ...current, output: die.toLowerCase() }));
              }
            }} key={primitive.id}>{primitive.name} · {primitive.buCost} BU</button>)}
          </div>
        </details>
        {selectedPrimitive && selectedEntry ? <button type="button" onClick={() => removeSlot(selectedEntry.index)} aria-label={`Remove ${selectedPrimitive.name}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-accent"><Trash2 className="size-3.5" /></button> : null}
      </div>
      {flavorLabel && <label className="v12-flavor-reference">{flavorLabel === "domain" ? "Domain flavor" : "Verb flavor"} <small>Optional narrative reference; no purchased access</small><input aria-label={`${flavorLabel} flavor`} value={flavor} maxLength={120} placeholder={flavorLabel === "domain" ? "Fire, ice, memory…" : "Strike, reveal, reshape…"} onChange={event=>{updateForm("verboseDescription",writeFlavorReference(form.verboseDescription,flavorLabel,event.target.value));}}/></label>}
      {role === "VERB" && selectedEntry ? <label className="v12-verb-note mt-1.5 block text-xs"><span className="sr-only">Verbs used</span><input aria-label="Verbs used (optional)" value={selectedEntry.slot.notes ?? ""} onChange={(event) => { const notes = event.target.value; setSlots((current) => current.map((item, index) => index === selectedEntry.index ? {...item, notes} : item)); setIsDirty(true); }} placeholder="Verbs used: move, strike, reshape…" /></label> : null}
    </article>;
  };

  const renderTableAxis = (axis: TableAxisKey) => {
    const config = TABLE_AXIS_OPTIONS[axis];
    const selectedValue = tableAxisValue(axis);
    const pinned = tableAxisSlot(axis);
    const custom = customAxes[axis] || !(config.values as readonly string[]).includes(selectedValue);
    if (phone) return <details key={axis} className="phone-table-axis"><summary><span>{config.label}</span><strong>{selectedValue}</strong></summary><label><span className="sr-only">{config.label}</span><select value={custom ? "Custom" : selectedValue} onChange={event=>replaceTableAxisPrimitive(axis,event.target.value)}>{config.values.map(value=><option key={value} value={value}>{value}</option>)}</select></label>{custom ? <input aria-label={`Custom ${config.label.toLowerCase()}`} value={selectedValue} maxLength={240} onChange={event=>{setTableDraft(current=>({...current,[axis]:event.target.value}));setIsDirty(true);}}/> : null}{TABLE_HELP[axis] ? <p>{TABLE_HELP[axis]?.[selectedValue] ?? TABLE_HELP[axis]?.["Custom"]}</p> : null}{pinned ? <p>{pinned.slot.primitive.name} included in Pieces.</p> : null}</details>;
    return <section key={axis} className="v12-table-axis">
      <h3>{config.label}</h3>
      <div>{config.values.map((value) => <button
        type="button"
        key={value}
        aria-pressed={value === "Custom" ? custom : selectedValue === value}
        onClick={() => replaceTableAxisPrimitive(axis, value)}
      title={TABLE_HELP[axis]?.[value]}>{value}</button>)}</div>
      {custom && <label>Custom {config.label.toLowerCase()}<input aria-label={`Custom ${config.label.toLowerCase()}`} value={selectedValue} maxLength={240} onChange={event=>{setTableDraft(current=>({...current,[axis]:event.target.value}));setIsDirty(true);}} placeholder={axis === "shape" ? "A star, crescent, branching arc…" : "Describe your intent…"}/></label>}
      {TABLE_HELP[axis] && <p>{TABLE_HELP[axis]?.[selectedValue] ?? TABLE_HELP[axis]?.["Custom"]}</p>}
      {pinned ? <div className="v12-table-pin" role="status">
        <span><b>{pinned.slot.primitive.name}</b>{pinned.slot.quantity > 1 ? ` ×${pinned.slot.quantity}` : ""} is also included in Pieces as a Primitive.</span>
        <button type="button" onClick={() => removeTableAxisPrimitive(axis)}>Keep declaration only</button>
      </div> : <small>Optional spoken intent. This choice does not purchase a primitive; negotiate its scale and Strain in play.</small>}
    </section>;
  };

  return (
    <form
      className="v12-capability-author grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 sm:p-4"
      onSubmit={submitCapability}
    >
      <div className="v12-capability-author-head flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {characterAuthoring ? (initialCapability ? "Edit capability" : "Build a capability") : initialCapability ? "Edit Capability" : "Compiler Inputs"}
          </p>
          {(() => {
            if (characterAuthoring) return null;
            const label = saveIntentLabel(
              intent ?? null,
              initialCapability?.name ?? null,
            );
            if (!label) return null;
            const isFork = intent === "fork";
            return (
              <span
                data-testid="save-intent-chip"
                className={
                  isFork
                    ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary"
                    : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
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
          data-drawer-reset
            onClick={resetEditor}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
        >
          Reset
        </button>
      </div>

      <AuthorChapters defaultActive="identity" order={["identity", "pieces", "table", "publish"]} guideKind="capability">
        <AuthorChapter id="pieces" title="Pieces">
      <PhonePiecePicker entries={[...availablePrimitives.map(entry=>({id:entry.id,name:entry.name,kind:"primitive" as const,description:entry.mechanicalOutputText,buCost:entry.buCost})),...availableEffects.map(entry=>({id:entry.id,name:entry.name,kind:"effect" as const,description:entry.narrativeDescription}))]} onChoose={entry=>{if(entry.kind === "primitive") addSlot(Number(entry.id),true);if(entry.kind === "effect") setEffectIds(previous=>previous.includes(String(entry.id))?previous:[...previous,String(entry.id)]);setIsDirty(true);}}/>
      <section className="v12-foundation-pieces v12-dedicated-slots rounded-lg border border-border bg-background/60 p-2.5">
        <header className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="v12-kicker">Mechanical references</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Vocabulary, reach, and output.</p>
          </div>
          <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-muted-foreground">Optional</span>
        </header>
        <div className="v12-dedicated-slot-grid grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {renderDedicatedSlot("VERB", "Verb tier", (primitive) => primitive.category === "VERB_TIER")}
          {renderDedicatedSlot("DOMAIN", "Domain", (primitive) => primitive.category === "DOMAIN")}
          {renderDedicatedSlot("RANGE", "Range", (primitive) => primitive.category === "RANGE")}
          {renderDedicatedSlot("OUTPUT", "Output die", (primitive) => primitive.category === "INTENSITY_DICE" || primitive.category === "OUTPUT")}
        </div>
      </section>
      <section className="v12-capability-primitives rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Primitive Slots</h3>
          <span className="v12-kicker">Direct composition</span>
        </div>

        {regularSlots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {phone ? "No additional primitives yet. Use Add a piece above." : <>No additional primitives slotted yet. Pick a primitive from the Library column and use its &ldquo;Add to active capability&rdquo; action.</>}
          </p>
        ) : (
          <SortableBundleList className="mt-3 space-y-2" ids={regularSlots.map(({slot})=>`${slot.primitiveId}:${slot.role}`)} onOrder={()=>{}}>
            {regularSlots.map(({slot, index: idx}) => (
              <SortableMember id={`${slot.primitiveId}:${slot.role}`} label={slot.primitive.name}
                key={`${slot.primitiveId}-${idx}`}
                className="v12-author-recipe-piece flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                <RecipePrimitiveIdentity primitive={{...availablePrimitives.find(p => p.id === slot.primitiveId),...slot.primitive,id:slot.primitiveId}} />
                <div className="v12-recipe-member-controls flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </SortableMember>
            ))}
          </SortableBundleList>
        )}
      </section>

      <section className="v12-capability-effects rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Bundled Effects</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Effects nested inside this capability. Pick from the library or
              use the &ldquo;Add to active capability&rdquo; action on a library card.
            </p>
          </div>
        </div>

        {effectIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {phone ? "No effects yet. Use Add a piece above." : <>No effects bundled yet. Pick an effect from the Library column and use its &ldquo;Add to active capability&rdquo; action.</>}
          </p>
        ) : (
          <SortableBundleList className="mt-3 space-y-2" ids={effectIds} onOrder={order=>{setEffectIds(order);setOrderChanged(true);setIsDirty(true);}}>
            {effectIds.map((id) => {
              const effect = availableEffects.find((e) => e.id === id);
              return (
                <SortableMember id={id} label={effect?.name ?? id}
                  key={id}
                  className="v12-composite-member group rounded-lg border border-border bg-card p-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <RecipeEntityIdentity targetType="EFFECT" id={id} kicker={`Bundled effect · ${effect?.primitiveLinks?.length ?? 0} primitives`} name={effect?.name ?? id} buCost={primitiveLinksBu(effect?.primitiveLinks?.map((link) => ({...link, primitive: {...link.primitive, id: link.primitiveId, category: link.primitive.category ?? "OTHER"}})))} />
                    <button
                      type="button"
                      onClick={() => removeEffect(id)}
                      aria-label={`Remove ${effect?.name ?? id}`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground opacity-70 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {effect?.primitiveLinks?.length ? <div className="mt-2 border-t border-border/60 pt-1"><PhonePieceDetails><RecipeComposition id={id} effectLinks={[{effectId:id,effect:{...effect,primitiveLinks:effect.primitiveLinks.map((link)=>({...link,primitive:{...link.primitive,id:link.primitiveId,category:link.primitive.category ?? availablePrimitives.find((primitive)=>primitive.id===link.primitiveId)?.category ?? "OTHER"}}))}}]} /></PhonePieceDetails></div> : null}
                </SortableMember>
              );
            })}
          </SortableBundleList>
        )}
      </section>

        </AuthorChapter>
        <AuthorChapter id="identity" title="Identity">
      {/*
        Mobile compact layout. Mashu (round 3): "In
        capability build the type and source should be
        their own row below both name and icon."

        The previous attempt put Icon | Name in row 1 and
        Type | Source in row 2 of the same `auto_1fr` grid,
        but because the grid was auto_1fr, Type/Source
        landed in column 2 alongside the Name input. The
        new layout uses TWO independent grids:

          Row 1:  [Icon] [Name........]      (grid-cols-auto-1fr)
          Row 2:  [Type] [Source]            (grid-cols-2, full width)

      */}
      <div className="space-y-2 md:hidden">
        <div className="grid grid-cols-[auto_1fr] items-center gap-2">
          <IconSlot
            appearance="medallion"
            iconSource={(form.iconSource as IconSource | null) ?? null}
            iconKey={form.iconKey ?? null}
            iconUrl={form.iconUrl ?? null}
            iconColor={form.iconColor ?? "#ffffff"}
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
            label=""
            helper=""
          />
          <label className="block text-sm font-medium">
            Capability Name
            <input
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="e.g. Fire Strike"
              required
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-medium">
            Type
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
              value={form.type}
              onChange={(e) => updateForm("type", e.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="PASSIVE">Passive</option>
              <option value="AUGMENT">Augment</option>
            </select>
          </label>
          <label className="block text-[11px] font-medium">
            Source
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none ring-ring focus:ring-2"
              value={form.sourceType}
              onChange={(e) => updateForm("sourceType", e.target.value)}
            >
              <option value="PHYSICAL">Physical</option>
              <option value="MAGICAL">Magical</option>
              <option value="PSYCHIC">Psychic</option>
            </select>
          </label>
        </div>
      </div>

      {/* Desktop layout — original full-width stack.
          Hidden on mobile (md:hidden on the mobile block
          above gates this), shown on md+. */}
      <div className="capability-desktop-identity hidden md:block">
        <IconSlot
          appearance="medallion"
          iconSource={(form.iconSource as IconSource | null) ?? null}
          iconKey={form.iconKey ?? null}
          iconUrl={form.iconUrl ?? null}
          iconColor={form.iconColor ?? "#ffffff"}
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
      </div>

      <label className="capability-desktop-identity hidden text-sm font-medium md:block">
        Capability Name
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          placeholder="e.g. Fire Strike"
          required
        />
      </label>

      <div className="capability-desktop-identity hidden gap-4 md:grid md:grid-cols-2">
        <label className="block text-sm font-medium">
          Type
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.type}
            onChange={(e) => updateForm("type", e.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="PASSIVE">Passive</option>
            <option value="AUGMENT">Augment</option>
          </select>
        </label>

        <label className="block text-sm font-medium">
          Source
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={form.sourceType}
            onChange={(e) => updateForm("sourceType", e.target.value)}
          >
            <option value="PHYSICAL">Physical</option>
            <option value="MAGICAL">Magical</option>
            <option value="PSYCHIC">Psychic</option>
          </select>
        </label>
      </div>

      <label className="v12-capability-description block text-sm font-medium">
        Verbose Description
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          value={form.verboseDescription}
          onChange={(e) => updateForm("verboseDescription", e.target.value)}
          placeholder="What does this capability do and feel like in play?"
          rows={3}
        />
      </label>

        </AuthorChapter>
        <AuthorChapter id="table" title="At the table">
      <RollResolutionEditor value={resolution} onChange={value=>{setResolution(value);setIsDirty(true);}}/>
      <label className="v12-table-optional"><input type="checkbox" checked={includeTable} onChange={event=>{setIncludeTable(event.target.checked);setIsDirty(true);}}/> Add scaling options</label>
      <p>Optional examples, not the capability’s core rules. Shape, targets, size, placement, duration, and timing need no extra primitive. Range and output dice use purchased pieces. Negotiate greater intent and its Strain before rolling.</p>
      <div hidden={!includeTable} className="v12-table-builder grid gap-2 md:grid-cols-2">
        {(Object.keys(TABLE_AXIS_OPTIONS) as TableAxisKey[]).map(renderTableAxis)}
        <section className="v12-table-axis"><h3>Range</h3><div>{["Touch", "Close", "Near", "Far", "Very Far", "Extreme"].map(value=><button type="button" key={value} aria-pressed={selectedRange===value} title={TABLE_HELP["range"]?.[value]} onClick={()=>chooseTableRange(value)}>{value}</button>)}</div><p>{TABLE_HELP["range"]?.[selectedRange]}</p>{rangeSlot ? <div className="v12-table-pin" role="status"><span><b>{rangeSlot.primitive.name}</b> is also included in Pieces as a Primitive.</span><button type="button" onClick={() => chooseTableRange("Touch")}>Remove range access</button></div> : <small>Touch is the default declaration. Choosing another range pins or replaces its primitive in Pieces.</small>}</section>
        <section className="v12-table-axis"><h3>Output die</h3><div>{["None", "d4", "d6", "d8", "d10", "d12", "d20"].map(value=><button type="button" key={value} aria-pressed={selectedOutput===value} onClick={()=>chooseTableOutput(value)}>{value}</button>)}</div>{outputSlot ? <div className="v12-table-pin" role="status"><span><b>{outputSlot.primitive.name}</b> is also included in Pieces as a Primitive.</span><button type="button" onClick={() => chooseTableOutput("None")}>Remove output die</button></div> : <small>Choosing a die pins or replaces its primitive in Pieces.</small>}</section>
        <div className="v12-table-readout">
          <div className="v12-table-intent"><p className="v12-kicker">Spoken intent</p><h3>{form.name || "Untitled capability"}</h3><p>{tableAxisValue("casting")} · {tableAxisValue("target")} · {tableAxisValue("shape")} · {tableAxisValue("size")} · {tableAxisValue("placement")} · {selectedRange} · {selectedOutput} · {tableAxisValue("duration")}</p></div>
          <dl className="v12-table-metrics"><div><dt>Base BU</dt><dd>{previewBu}</dd></div><div><dt>Scaled CV</dt><dd>{previewBu}</dd></div><div><dt>Strain</dt><dd>DM</dd></div></dl>
          <p className="v12-table-recipe-count">{slots.length} direct pieces · {effectIds.length} effects · {previewBu} BU total</p>
          <details className="v12-table-disclaimer"><summary>Scaling reference and optional pinned defaults</summary><p>A creator may save examples, but the player declares scaling at the table. Player and DM negotiate its cost from the scaled CV and the fiction. Consequences may spend vitality, impose a story complication, suspend access to a capability, or apply a numeric penalty to a relevant value.</p></details>
        </div>
      </div>

        </AuthorChapter>
        <AuthorChapter id="publish" title="Publish">
      <AuthorPublishFields
        tags={form.tags}
        sourceOrigin={form.sourceOrigin}
        isPublic={form.isPublic}
        onTagsChange={(value) => updateForm("tags", value)}
        onSourceOriginChange={(value) => updateForm("sourceOrigin", value)}
        onPublicChange={(value) => updateForm("isPublic", value)}
        tagsPlaceholder="combat, fire, aoe"
        sourcePlaceholder="optional"
      />

        </AuthorChapter>
      </AuthorChapters>
      {phone && phoneSlot ? <DetailModal isOpen onClose={()=>setPhoneSlot(null)} title={`Edit ${phoneSlot === "VERB" ? "verb tier" : phoneSlot === "DOMAIN" ? "domain" : phoneSlot === "RANGE" ? "range" : "output die"}`}>
        <div className="phone-slot-editor">
          <label>Purchased rule<select value={slots.find(slot=>resolvedSlotRole(slot)===phoneSlot)?.primitiveId ?? ""} onChange={event=>{
            const id=event.target.value ? Number(event.target.value) : null;
            chooseRulePrimitive(phoneSlot,id);
            const primitive=availablePrimitives.find(entry=>entry.id===id);
            if(phoneSlot === "RANGE" && primitive) setTableDraft(current=>({...current,range:primitive.name.replace(/\s+Range$/i,"")}));
            if(phoneSlot === "OUTPUT" && primitive) {const die=`${primitive.name} ${primitive.mechanicalOutputText ?? ""}`.match(/d(?:4|6|8|10|12|20)/i)?.[0];if(die)setTableDraft(current=>({...current,output:die.toLowerCase()}));}
          }}><option value="">Not set</option>{availablePrimitives.filter(primitive=>phoneSlot === "VERB" ? primitive.category === "VERB_TIER" : phoneSlot === "OUTPUT" ? ["INTENSITY_DICE","OUTPUT"].includes(primitive.category) : primitive.category === phoneSlot).map(primitive=><option key={primitive.id} value={primitive.id}>{primitive.name} · {primitive.buCost} BU</option>)}</select></label>
          {phoneSlot === "VERB" || phoneSlot === "DOMAIN" ? <label>Optional flavor<input value={readFlavorReference(form.verboseDescription,phoneSlot === "VERB" ? "verb" : "domain")} onChange={event=>updateForm("verboseDescription",writeFlavorReference(form.verboseDescription,phoneSlot === "VERB" ? "verb" : "domain",event.target.value))}/><small>Flavor describes the idea; it grants no purchased access.</small></label> : null}
          <button type="button" className="v12-metal-button" onClick={()=>setPhoneSlot(null)}>Done</button>
        </div>
      </DetailModal> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-sandbox-submit
          disabled={isPending}
          className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : characterAuthoring
              ? characterAuthoring.isEditing ? "Update draft" : "Add to draft"
            : initialCapability
              ? "Save Changes"
              : "Compile Capability"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}
