"use client";

// PrimitiveForm: controlled form-only composer.
// Receives optional initial state (for ?edit= pre-fill).
// Fires onStateChange on every keystroke so the parent can render a live preview.
// Save logic lives here so the form remains a self-contained save unit.
//
// The library list, live preview sidebar, and saved-records grid are NOT in this
// component. They live in the SandboxLayout columns owned by the page.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ModifierOperation,
  ModifierStackingMode,
  ModifierTarget,
} from "@/types/swordweave";
import type { PrimitiveFormState } from "./primitive-form-preview";
import { VisibilitySelect, type Visibility } from "@/components/library/visibility-select";

type PrimitiveRow = {
  id: number;
  userId?: string | null;
  name: string;
  category: string;
  isPublic: boolean;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: unknown;
};

export type ModifierDraft = {
  id: string;
  target: ModifierTarget | string;
  operation: ModifierOperation;
  value: string;
  valueKind: "number" | "text" | "boolean";
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal"
    | "includes"
    | "exists";
  conditionValue: string;
  stacking: ModifierStackingMode;
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
  "Tier 1: Minor (4 BU anchor)",
  "Tier 2: Standard (8 BU anchor)",
  "Tier 3: Major (12 BU anchor)",
  "Tier 4: Core Axis (16 BU anchor)",
  "Tier 5: Narrative Layer (32+ BU anchor)",
] as const;

const targetOptions: Array<{ label: string; value: ModifierTarget | string }> = [
  { label: "Physical Attribute", value: "character.attribute.physical" },
  { label: "Mental Attribute", value: "character.attribute.mental" },
  { label: "Magical Attribute", value: "character.attribute.magical" },
  { label: "Max Vitality", value: "character.maxVitality" },
  { label: "Current Vitality", value: "character.currentVitality" },
  { label: "Land Speed", value: "character.movement.land" },
  { label: "Fly Speed", value: "character.movement.fly" },
  { label: "Swim Speed", value: "character.movement.swim" },
  { label: "Physical DC", value: "character.defense.physicalDc" },
  { label: "Mental DC", value: "character.defense.mentalDc" },
  { label: "Magical DC", value: "character.defense.magicalDc" },
  { label: "Skill / Practice Check", value: "character.skill" },
  { label: "Proficiency Bonus", value: "character.proficiencyBonus" },
  { label: "Action Roll", value: "action.roll" },
  { label: "Damage / Healing Output", value: "action.damage" },
  { label: "Action Range", value: "action.range" },
  { label: "Target Count", value: "action.targetCount" },
  { label: "Area Size", value: "action.areaSize" },
  { label: "Duration", value: "action.duration" },
  { label: "Strain", value: "action.strain" },
  { label: "Item Slot Cost", value: "item.slotCost" },
  { label: "Scene Pace", value: "scene.pace" },
];

const operations: Array<{ label: string; value: ModifierOperation }> = [
  { label: "Add", value: "add" },
  { label: "Subtract", value: "subtract" },
  { label: "Multiply", value: "multiply" },
  { label: "Divide", value: "divide" },
  { label: "Set To", value: "set" },
  { label: "Minimum", value: "min" },
  { label: "Maximum", value: "max" },
  { label: "Grant", value: "grant" },
  { label: "Revoke", value: "revoke" },
  { label: "Toggle", value: "toggle" },
];

const conditionOperators: ModifierDraft["conditionOperator"][] = [
  "equals",
  "not-equals",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "includes",
  "exists",
];

const stackingOptions: ModifierStackingMode[] = [
  "stack",
  "highest-only",
  "lowest-only",
  "unique-by-primitive",
  "unique-by-target",
];

const mirrorVectors = [
  {
    label: "Standard Only - cannot be mirrored",
    value: "STANDARD_ONLY",
  },
  {
    label: "Variable Vector - numeric or metric downside",
    value: "VARIABLE_VECTOR",
  },
  {
    label: "Structural Fault - vulnerability or exposed weakness",
    value: "STRUCTURAL_FAULT",
  },
  {
    label: "Cost Instability - extra strain or vitality costs",
    value: "COST_INSTABILITY",
  },
] as const;

const blankModifier: ModifierDraft = {
  id: "modifier-1",
  target: "action.roll",
  operation: "add",
  value: "1",
  valueKind: "number",
  conditionMode: "always",
  conditionKey: "",
  conditionOperator: "equals",
  conditionValue: "",
  stacking: "stack",
};

const blankForm: PrimitiveFormState = {
  name: "",
  category: "VERB_TIER",
  isPublic: false,
  costTier: "Tier 1: Minor (4 BU anchor)",
  buCost: "1",
  mechanicalOutputText: "",
  narrativeRule: "",
  isMirrorable: false,
  mirrorVector: "STANDARD_ONLY",
  mirrorBuCredit: "0",
  mirrorEligibilityNotes: "",
};

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function toModifierDraft(modifier: ModifierDraft, index: number): ModifierDraft {
  return { ...modifier, id: `modifier-${index + 1}` };
}

function isHardModifierLike(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["kind"] === "modify"
  );
}

function fromHardModifier(modifier: Record<string, unknown>, index: number): ModifierDraft {
  const rawValue = modifier["value"];
  const valueKind: ModifierDraft["valueKind"] =
    typeof rawValue === "boolean"
      ? "boolean"
      : typeof rawValue === "number"
        ? "number"
        : "text";
  const value =
    rawValue === undefined || rawValue === null
      ? ""
      : typeof rawValue === "string"
        ? rawValue
        : String(rawValue);

  const condition = modifier["condition"];
  const cond =
    condition && typeof condition === "object"
      ? (condition as Record<string, unknown>)
      : null;
  const condRawValue = cond?.["value"];
  const condValue =
    condRawValue === undefined || condRawValue === null
      ? ""
      : typeof condRawValue === "string"
        ? condRawValue
        : String(condRawValue);

  return {
    id: `modifier-${index + 1}`,
    target: String(modifier["target"] ?? "action.roll"),
    operation: String(modifier["operation"] ?? "add") as ModifierOperation,
    value,
    valueKind,
    conditionMode: cond ? "custom" : "always",
    conditionKey: String(cond?.["key"] ?? ""),
    conditionOperator:
      (String(cond?.["operator"] ?? "equals") as ModifierDraft["conditionOperator"]),
    conditionValue: condValue,
    stacking: (String(modifier["stacking"] ?? "stack") as ModifierStackingMode),
  };
}

function parseValue(value: string, valueKind: ModifierDraft["valueKind"]): unknown {
  if (valueKind === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }
  if (valueKind === "boolean") {
    return value === "true";
  }
  return value;
}

function toHardModifier(modifier: ModifierDraft) {
  const hardModifier = {
    kind: "modify" as const,
    target: modifier.target,
    operation: modifier.operation,
    value: parseValue(modifier.value, modifier.valueKind),
    stacking: modifier.stacking,
  };

  if (modifier.conditionMode === "custom" && modifier.conditionKey.trim()) {
    return {
      ...hardModifier,
      condition: {
        key: modifier.conditionKey.trim(),
        operator: modifier.conditionOperator,
        value:
          modifier.conditionOperator === "exists"
            ? true
            : parseValue(modifier.conditionValue, modifier.valueKind),
      },
    };
  }

  return hardModifier;
}

export function PrimitiveForm({
  initialPrimitive,
  onStateChange,
  onSaved,
  onReset,
}: {
  /**
   * If provided, the form opens pre-loaded with this primitive for editing.
   */
  initialPrimitive?: PrimitiveRow | null;
  /**
   * Fires whenever the form or modifiers change. Used by the page to drive
   * the live Preview column.
   */
  onStateChange?: (state: {
    form: PrimitiveFormState;
    modifiers: ModifierDraft[];
    hardModifiers: unknown[];
    /**
     * True once the user has touched the form since the last reset/save/load.
     * Page uses this to decide whether to show the unsaved-changes modal on
     * build-mode or library-row switches.
     */
    isDirty: boolean;
  }) => void;
  /**
   * Fires when the user clicks the Reset button. The parent uses this to
   * clear the Preview pane (set editing = null) so Reset returns the user
   * to the empty-form / empty-preview state.
   */
  onReset?: () => void;
  /**
   * Fires after a successful save. Used by the page to refresh the Library
   * table without re-mounting the form.
   */
  onSaved?: (primitive: PrimitiveRow) => void;
}) {
  const [form, setForm] = useState<PrimitiveFormState>(blankForm);
  const [modifierCounter, setModifierCounter] = useState(1);
  // Modifiers are optional. Many primitives (Domain: Darkvision,
  // Resistance: Fire, etc.) describe a feature that needs no
  // numerical mechanical patch — the "narrative rule" alone is the
  // primitive. We start with an empty list and let the user add
  // modifiers only when they actually need them.
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  // Tracks unsaved edits. Flipped to true on the first user mutation after a
  // load/reset/save; flipped back to false by resetEditor() and after a
  // successful save (resetEditor runs there too).
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  // Pre-load from initialPrimitive — only on mount or when the user
  // loads a different primitive (id changes). Without the id check,
  // switching rows in the library would not refresh the form.
  const bootstrappedRef = useRef<number | null>(null);
  useEffect(() => {
    const id = initialPrimitive?.id ?? null;
    if (bootstrappedRef.current === id) return;
    bootstrappedRef.current = id;
    if (!initialPrimitive) return;

    const stored = Array.isArray(initialPrimitive.hardModifiers)
      ? (initialPrimitive.hardModifiers as unknown[]).filter(isHardModifierLike)
      : [];
    // Empty stored list = no modifiers. Don't pre-populate a blank one
    // (the user has actively chosen to have no modifiers).
    const drafts =
      stored.length > 0
        ? stored.map((m, i) =>
            fromHardModifier(m as Record<string, unknown>, i),
          )
        : [];

    setForm({
      name: initialPrimitive.name,
      category: initialPrimitive.category,
      isPublic: initialPrimitive.isPublic,
      costTier: initialPrimitive.costTier,
      buCost: String(initialPrimitive.buCost),
      mechanicalOutputText: initialPrimitive.mechanicalOutputText,
      narrativeRule: initialPrimitive.narrativeRule,
      isMirrorable: initialPrimitive.isMirrorable,
      mirrorVector: initialPrimitive.mirrorVector,
      mirrorBuCredit: String(initialPrimitive.mirrorBuCredit),
      mirrorEligibilityNotes: initialPrimitive.mirrorEligibilityNotes,
    });
    setModifiers(drafts);
    setModifierCounter(drafts.length);
    setIsDirty(false); // pristine after load
    setMessage(
      initialPrimitive.userId
        ? "Loaded your primitive for editing."
        : "Loaded library primitive. Saving creates your private copy.",
    );
  }, [initialPrimitive]);

  // Fire onStateChange on every form/modifier change.
  useEffect(() => {
    onStateChange?.({
      form,
      modifiers,
      hardModifiers: modifiers.map(toHardModifier),
      isDirty,
    });
  }, [form, modifiers, onStateChange, isDirty]);

  // External reset trigger from the speed-dial FAB / pinned Save/Reset footer.
  useEffect(() => {
    const handler = () => resetEditor();
    window.addEventListener("sw-sandbox-reset", handler);
    return () => window.removeEventListener("sw-sandbox-reset", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReset]);

  function updateForm(field: keyof PrimitiveFormState, value: string | boolean) {
    setIsDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModifier(
    id: string,
    field: keyof ModifierDraft,
    value: string,
  ) {
    setIsDirty(true);
    setModifiers((current) =>
      current.map((modifier) =>
        modifier.id === id ? { ...modifier, [field]: value } : modifier,
      ),
    );
  }

  function addModifier() {
    setIsDirty(true);
    setModifierCounter((current) => current + 1);
    setModifiers((current) => [
      ...current,
      toModifierDraft(blankModifier, modifierCounter),
    ]);
  }

  function removeModifier(id: string) {
    setIsDirty(true);
    setModifiers((current) =>
      current.filter((modifier) => modifier.id !== id),
    );
  }

  function resetEditor() {
    setForm(blankForm);
    setModifierCounter(1);
    setModifiers([]);
    setShowJsonPreview(false);
    setIsDirty(false); // pristine after reset
    setMessage("Started a fresh primitive.");
    bootstrappedRef.current = null; // allow re-bootstrap on next entity load
    onReset?.(); // tell parent so Preview pane can clear too
  }

  function submitPrimitive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/primitives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send `id` when editing a row the caller actually owns.
          // System content (initialPrimitive.userId === null) must NOT
          // include its id — otherwise the backend UPDATEs the system
          // row, which would either fail the ownership gate (404) or
          // worse, succeed and silently let the caller overwrite
          // library content. For system content we want a fresh INSERT
          // via the UPSERT-on-(name, category, userId) path, which
          // produces a private copy owned by the caller.
          //
          // Without this, clicking "Save" on a library primitive you
          // don't own returns 404 "Primitive not found or not owned by
          // you" — confusing because the user thinks they're editing,
          // not creating.
          ...(initialPrimitive?.id != null && initialPrimitive?.userId
            ? { id: initialPrimitive.id }
            : {}),
          ...form,
          mirrorVector: form.isMirrorable ? form.mirrorVector : "STANDARD_ONLY",
          mirrorBuCredit: form.isMirrorable ? form.mirrorBuCredit : "0",
          hardModifiers: modifiers.map(toHardModifier),
        }),
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
        onSaved?.(primitive);
      }
      resetEditor();
      router.refresh();
      setMessage("Primitive saved to your account.");
    });
  }

  const primitiveJsonPreview = {
    schemaVersion: "swordweave.package.v1",
    kind: "primitive",
    records: [
      {
        name: form.name || "Unnamed Primitive",
        category: form.category,
        isPublic: form.isPublic,
        costTier: form.costTier,
        buCost: Number(form.buCost) || 0,
        mechanicalOutputText: form.mechanicalOutputText,
        narrativeRule: form.narrativeRule,
        isMirrorable: form.isMirrorable,
        mirrorVector: form.isMirrorable ? form.mirrorVector : "STANDARD_ONLY",
        mirrorBuCredit: form.isMirrorable ? Number(form.mirrorBuCredit) || 0 : 0,
        mirrorEligibilityNotes: form.mirrorEligibilityNotes,
        hardModifiers: modifiers.map(toHardModifier),
      },
    ],
  };

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2 sm:p-5"
      onSubmit={submitPrimitive}
    >
      <div className="flex items-center justify-between gap-3 md:col-span-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {initialPrimitive ? "Inspect Primitive" : "Add New Primitive"}
        </p>
        <button
          type="button"
          onClick={resetEditor}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
        >
          Reset
        </button>
      </div>

      <label className="block text-sm font-medium md:col-span-2">
        Name
        <input
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
          value={form.name}
          onChange={(event) => updateForm("name", event.target.value)}
          placeholder="Kinetic Velocity Arrest"
          required
        />
      </label>

      <label className="block text-sm font-medium">
        Lexicon Category
        <select
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
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
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
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
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
          value={form.buCost}
          onChange={(event) => updateForm("buCost", event.target.value)}
          min={0}
          step={1}
          type="number"
          required
        />
      </label>

      <label className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm font-medium md:col-span-2">
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

      <fieldset className="grid gap-3 rounded-md border border-border bg-background p-4 md:col-span-2 md:grid-cols-2">
        <div className="md:col-span-2">
          <legend className="text-sm font-semibold">Mirror Vector</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Mark whether this primitive can be inverted into a real drawback
            for BU credit.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium md:col-span-2">
          <input
            checked={form.isMirrorable}
            className="mt-1 size-4"
            onChange={(event) => updateForm("isMirrorable", event.target.checked)}
            type="checkbox"
          />
          <span>
            Mirrorable
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Valid only when the inverted primitive creates real campaign
              friction the DM can expose.
            </span>
          </span>
        </label>

        <label className="block text-sm font-medium">
          Mirror Vector Type
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2 disabled:opacity-60"
            disabled={!form.isMirrorable}
            value={form.mirrorVector}
            onChange={(event) => updateForm("mirrorVector", event.target.value)}
          >
            {mirrorVectors.map((vector) => (
              <option key={vector.value} value={vector.value}>
                {vector.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Mirror BU Credit
          <input
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2 disabled:opacity-60"
            disabled={!form.isMirrorable}
            min={0}
            onChange={(event) => updateForm("mirrorBuCredit", event.target.value)}
            step={1}
            type="number"
            value={form.mirrorBuCredit}
          />
        </label>

        <label className="block text-sm font-medium md:col-span-2">
          Mirror Exposure Notes
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 disabled:opacity-60"
            disabled={!form.isMirrorable}
            onChange={(event) =>
              updateForm("mirrorEligibilityNotes", event.target.value)
            }
            placeholder="Explain the downside and how a DM can expose it in play."
            value={form.mirrorEligibilityNotes}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-border bg-background p-4 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <legend className="text-sm font-semibold">Modifier Builder</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe what this primitive changes. The app creates the JSON.
            </p>
          </div>
          <button
            className="h-9 rounded-md border border-border px-3 text-sm font-medium"
            onClick={addModifier}
            type="button"
          >
            Add Modifier
          </button>
        </div>

        {modifiers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No modifiers yet. Many primitives (Darkvision, Resistance,
            Domain features) only need a narrative rule above. Add a
            modifier if this primitive grants a numerical mechanical
            bonus.
          </div>
        ) : null}

        {modifiers.map((modifier, index) => (
          <div
            className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-2"
            key={modifier.id}
          >
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <p className="text-sm font-medium">Modifier {index + 1}</p>
              <button
                className="h-8 rounded-md border border-border px-2 text-xs text-muted-foreground disabled:opacity-40"
                onClick={() => removeModifier(modifier.id)}
                type="button"
              >
                Remove
              </button>
            </div>

            <label className="block text-sm font-medium">
              What changes?
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                value={modifier.target}
                onChange={(event) =>
                  updateModifier(modifier.id, "target", event.target.value)
                }
              >
                {targetOptions.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Operation
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                value={modifier.operation}
                onChange={(event) =>
                  updateModifier(modifier.id, "operation", event.target.value)
                }
              >
                {operations.map((operation) => (
                  <option key={operation.value} value={operation.value}>
                    {operation.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Value Type
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                value={modifier.valueKind}
                onChange={(event) =>
                  updateModifier(modifier.id, "valueKind", event.target.value)
                }
              >
                <option value="number">Number</option>
                <option value="text">Text / Dice / Keyword</option>
                <option value="boolean">True / False</option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Value
              {modifier.valueKind === "boolean" ? (
                <select
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                  value={modifier.value}
                  onChange={(event) =>
                    updateModifier(modifier.id, "value", event.target.value)
                  }
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                  value={modifier.value}
                  onChange={(event) =>
                    updateModifier(modifier.id, "value", event.target.value)
                  }
                  placeholder={modifier.valueKind === "number" ? "1" : "1d4"}
                />
              )}
            </label>

            <label className="block text-sm font-medium">
              Applies When
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                value={modifier.conditionMode}
                onChange={(event) =>
                  updateModifier(
                    modifier.id,
                    "conditionMode",
                    event.target.value,
                  )
                }
              >
                <option value="always">Always</option>
                <option value="custom">Only when condition matches</option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Stacking Rule
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                value={modifier.stacking}
                onChange={(event) =>
                  updateModifier(modifier.id, "stacking", event.target.value)
                }
              >
                {stackingOptions.map((stacking) => (
                  <option key={stacking} value={stacking}>
                    {stacking}
                  </option>
                ))}
              </select>
            </label>

            {modifier.conditionMode === "custom" ? (
              <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Condition Key
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                    value={modifier.conditionKey}
                    onChange={(event) =>
                      updateModifier(
                        modifier.id,
                        "conditionKey",
                        event.target.value,
                      )
                    }
                    placeholder="skill.context"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Condition Rule
                  <select
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                    value={modifier.conditionOperator}
                    onChange={(event) =>
                      updateModifier(
                        modifier.id,
                        "conditionOperator",
                        event.target.value,
                      )
                    }
                  >
                    {conditionOperators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operator}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium">
                  Condition Value
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-ring focus:ring-2 md:h-10 md:text-sm"
                    disabled={modifier.conditionOperator === "exists"}
                    value={modifier.conditionValue}
                    onChange={(event) =>
                      updateModifier(
                        modifier.id,
                        "conditionValue",
                        event.target.value,
                      )
                    }
                    placeholder="tracking-creatures"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>

      <details
        className="rounded-md border border-border bg-background p-4 md:col-span-2"
        open={showJsonPreview}
        onToggle={(event) => setShowJsonPreview(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Full Primitive JSON Preview
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 text-xs">
          {JSON.stringify(primitiveJsonPreview, null, 2)}
        </pre>
      </details>

      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={isPending}
          type="submit"
          data-sandbox-submit
        >
          {isPending ? "Saving..." : "Save Primitive"}
        </button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </form>
  );
}