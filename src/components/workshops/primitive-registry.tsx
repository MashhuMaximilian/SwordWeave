"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type {
  HardModifier,
  JsonValue,
  ModifierOperation,
  ModifierStackingMode,
  ModifierTarget,
} from "@/types/swordweave";

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

type ModifierDraft = {
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
  "Tier 1: Minor (1-2 BU)",
  "Tier 2: Standard (3-5 BU)",
  "Tier 3: Major (6-10 BU)",
  "Tier 4: Core Axis (11-20 BU)",
  "Tier 5: Narrative Layer (21-64+ BU)",
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

const blankForm = {
  name: "",
  category: "VERB_TIER",
  isPublic: false,
  costTier: "Tier 1: Minor (1-2 BU)",
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

function parseValue(value: string, valueKind: ModifierDraft["valueKind"]): JsonValue {
  if (valueKind === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  if (valueKind === "boolean") {
    return value === "true";
  }

  return value;
}

function toHardModifier(modifier: ModifierDraft): HardModifier {
  const hardModifier: HardModifier = {
    kind: "modify",
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

function createModifier(id: number): ModifierDraft {
  return {
    ...blankModifier,
    id: `modifier-${id}`,
  };
}

function stringifyModifierValue(value: JsonValue | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function valueKindFromValue(value: JsonValue | undefined): ModifierDraft["valueKind"] {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return "number";
  }

  return "text";
}

function isHardModifier(value: unknown): value is HardModifier {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["kind"] === "modify"
  );
}

function fromHardModifier(modifier: HardModifier, index: number): ModifierDraft {
  const valueKind = valueKindFromValue(modifier.value);

  return {
    id: `modifier-${index + 1}`,
    target: modifier.target,
    operation: modifier.operation,
    value: stringifyModifierValue(modifier.value),
    valueKind,
    conditionMode: modifier.condition ? "custom" : "always",
    conditionKey: modifier.condition?.key ?? "",
    conditionOperator: modifier.condition?.operator ?? "equals",
    conditionValue: stringifyModifierValue(modifier.condition?.value),
    stacking: modifier.stacking ?? "stack",
  };
}

export function PrimitiveRegistry({
  initialPrimitives,
}: {
  initialPrimitives: PrimitiveRow[];
}) {
  const [primitives, setPrimitives] = useState(initialPrimitives);
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveRow | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(blankForm);
  const [modifierCounter, setModifierCounter] = useState(1);
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([blankModifier]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const importInputRef = useRef<HTMLInputElement>(null);

  const hardModifiers = useMemo(
    () => modifiers.map((modifier) => toHardModifier(modifier)),
    [modifiers],
  );

  const primitiveJsonPreview = useMemo(
    () => ({
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
          hardModifiers,
        },
      ],
    }),
    [form, hardModifiers],
  );

  const filteredPrimitives = useMemo(() => {
    const categoryFiltered =
      selectedCategory === "ALL"
        ? primitives
        : primitives.filter((primitive) => primitive.category === selectedCategory);
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return categoryFiltered;
    }

    return categoryFiltered.filter((primitive) =>
      [
        primitive.name,
        primitive.category,
        primitive.mechanicalOutputText,
        primitive.narrativeRule,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [primitives, searchQuery, selectedCategory]);

  function updateForm(
    field: keyof typeof blankForm,
    value: string | boolean,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModifier(
    id: string,
    field: keyof ModifierDraft,
    value: string,
  ) {
    setModifiers((current) =>
      current.map((modifier) =>
        modifier.id === id ? { ...modifier, [field]: value } : modifier,
      ),
    );
  }

  function addModifier() {
    setModifierCounter((current) => current + 1);
    setModifiers((current) => [...current, createModifier(modifierCounter + 1)]);
  }

  function removeModifier(id: string) {
    setModifiers((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((modifier) => modifier.id !== id);
    });
  }

  function resetEditor() {
    setSelectedPrimitive(null);
    setForm(blankForm);
    setModifierCounter(1);
    setModifiers([blankModifier]);
    setShowJsonPreview(false);
  }

  function selectPrimitive(primitive: PrimitiveRow) {
    const storedModifiers = Array.isArray(primitive.hardModifiers)
      ? primitive.hardModifiers.filter(isHardModifier)
      : [];
    const modifierDrafts =
      storedModifiers.length > 0
        ? storedModifiers.map(fromHardModifier)
        : [blankModifier];

    setSelectedPrimitive(primitive);
    setForm({
      name: primitive.name,
      category: primitive.category,
      isPublic: primitive.isPublic,
      costTier: primitive.costTier,
      buCost: String(primitive.buCost),
      mechanicalOutputText: primitive.mechanicalOutputText,
      narrativeRule: primitive.narrativeRule,
      isMirrorable: primitive.isMirrorable,
      mirrorVector: primitive.mirrorVector,
      mirrorBuCredit: String(primitive.mirrorBuCredit),
      mirrorEligibilityNotes: primitive.mirrorEligibilityNotes,
    });
    setModifiers(modifierDrafts);
    setModifierCounter(modifierDrafts.length);
    setShowJsonPreview(false);
    setMessage(
      primitive.userId
        ? "Loaded your primitive for editing."
        : "Loaded library primitive. Saving creates your private copy.",
    );
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
        body: JSON.stringify({
          ...form,
          mirrorVector: form.isMirrorable
            ? form.mirrorVector
            : "STANDARD_ONLY",
          mirrorBuCredit: form.isMirrorable ? form.mirrorBuCredit : "0",
          hardModifiers,
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
        setPrimitives((current) => {
          const withoutDuplicate = current.filter(
            (item) =>
              !(
                item.name === primitive.name &&
                item.category === primitive.category &&
                item.userId === primitive.userId
              ),
          );

          return [...withoutDuplicate, primitive].sort((a, b) =>
            `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`),
          );
        });
      }

      resetEditor();
      setMessage("Primitive saved to your account.");
    });
  }

  async function exportPrimitives() {
    setMessage("");
    const response = await fetch("/api/primitives/export");

    if (!response.ok) {
      setMessage("Unable to export primitives.");
      return;
    }

    const packageJson = await response.json();
    const blob = new Blob([JSON.stringify(packageJson, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "swordweave-primitives.package.json";
    anchor.click();
    window.URL.revokeObjectURL(url);
    setMessage("Primitive package exported.");
  }

  async function importPrimitives(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMessage("");

    try {
      const packageJson = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/primitives/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(packageJson),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const error =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Unable to import primitives.";
        setMessage(error);
        return;
      }

      const imported =
        payload && typeof payload === "object" && "imported" in payload
          ? (payload.imported as PrimitiveRow[])
          : [];

      setPrimitives((current) => {
        const merged = [...current];

        for (const primitive of imported) {
          const existingIndex = merged.findIndex(
            (item) =>
              item.name === primitive.name && item.category === primitive.category,
          );

          if (existingIndex >= 0) {
            merged[existingIndex] = primitive;
          } else {
            merged.push(primitive);
          }
        }

        return merged.sort((a, b) =>
          `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`),
        );
      });
      setMessage(`Imported ${imported.length} primitive records.`);
    } catch (error) {
      const importError = error instanceof Error ? error.message : "Unknown error.";
      setMessage(`Import failed: ${importError}`);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-0 xl:grid-cols-[340px_1fr]">
        <aside className="border-b border-border bg-card px-4 py-5 sm:px-5 xl:border-b-0 xl:border-r">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Master Sandbox
              </p>
              <h1 className="font-display text-3xl font-semibold uppercase leading-none">
                Primitive Registry
              </h1>
            </div>
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {primitives.length}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
              onClick={exportPrimitives}
              type="button"
            >
              Export JSON
            </button>
            <button
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              Import JSON
            </button>
            <input
              accept="application/json"
              className="hidden"
              onChange={importPrimitives}
              ref={importInputRef}
              type="file"
            />
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

          <label className="mb-3 block text-sm font-medium" htmlFor="primitive-search">
            Search
          </label>
          <input
            className="mb-5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            id="primitive-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, rule, category..."
            value={searchQuery}
          />

          <div className="space-y-2">
            {filteredPrimitives.map((primitive) => (
              <button
                key={primitive.id}
                className={`w-full rounded-md border bg-background p-3 text-left transition-colors hover:border-primary ${
                  selectedPrimitive?.id === primitive.id
                    ? "border-primary"
                    : "border-border"
                }`}
                onClick={() => selectPrimitive(primitive)}
                type="button"
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {primitive.userId
                    ? primitive.isPublic
                      ? "Your public library record"
                      : "Private copy"
                    : "Core library record"}
                </p>
                {primitive.isMirrorable ? (
                  <p className="mt-2 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
                    Mirror: -{primitive.mirrorBuCredit} BU
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm">
                  {primitive.mechanicalOutputText || "No mechanical output yet."}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="px-4 py-6 sm:px-5">
          <div className="mb-6 max-w-4xl">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Atomic Engine Input
            </p>
            <h2 className="font-display text-4xl font-semibold uppercase leading-none">
              {selectedPrimitive ? "Inspect Primitive" : "Add New Primitive"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedPrimitive?.userId
                ? "Edit your private primitive record."
                : selectedPrimitive
                  ? "Review a library primitive. Saving creates a private copy on your account."
                  : "Store the cost, category, and mechanical teeth for a reusable SwordWeave building block."}
            </p>
            {selectedPrimitive ? (
              <button
                className="mt-3 h-9 rounded-md border border-border bg-card px-3 text-sm font-bold text-foreground"
                onClick={resetEditor}
                type="button"
              >
                New Primitive
              </button>
            ) : null}
          </div>

          <div className="grid max-w-6xl gap-4 2xl:grid-cols-[1fr_320px]">
          <form
            className="grid grid-cols-1 gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2 sm:p-5"
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

            <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium md:col-span-2">
              <input
                checked={form.isPublic}
                className="mt-1 size-4"
                onChange={(event) => updateForm("isPublic", event.target.checked)}
                type="checkbox"
              />
              <span>
                Publish to Library
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Leave unchecked to keep this primitive private to your account.
                  Imported packages always start private.
                </span>
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
                  Mark whether this primitive can be inverted into a real
                  drawback for BU credit.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm font-medium md:col-span-2">
                <input
                  checked={form.isMirrorable}
                  className="mt-1 size-4"
                  onChange={(event) =>
                    updateForm("isMirrorable", event.target.checked)
                  }
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
                  onChange={(event) =>
                    updateForm("mirrorVector", event.target.value)
                  }
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
                  onChange={(event) =>
                    updateForm("mirrorBuCredit", event.target.value)
                  }
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

              {modifiers.map((modifier, index) => (
                <div
                  className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-2"
                  key={modifier.id}
                >
                  <div className="flex items-center justify-between gap-3 md:col-span-2">
                    <p className="text-sm font-medium">Modifier {index + 1}</p>
                    <button
                      className="h-8 rounded-md border border-border px-2 text-xs text-muted-foreground disabled:opacity-40"
                      disabled={modifiers.length === 1}
                      onClick={() => removeModifier(modifier.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <label className="block text-sm font-medium">
                    What changes?
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
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
              onToggle={(event) =>
                setShowJsonPreview(event.currentTarget.open)
              }
            >
              <summary className="cursor-pointer text-sm font-semibold">
                Full Primitive JSON Preview
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 text-xs">
                {JSON.stringify(primitiveJsonPreview, null, 2)}
              </pre>
            </details>

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
          <aside className="rounded-md border border-border bg-card p-4 2xl:sticky 2xl:top-6 2xl:self-start">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Live Preview
            </p>
            <div className="mt-3 rounded-md border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-3xl font-semibold uppercase leading-none">
                  {form.name || "Unnamed Primitive"}
                </h3>
                <span className="shrink-0 rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                  {form.buCost || 0} BU
                </span>
              </div>
              <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">
                {categoryLabel(form.category)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
                  {form.isPublic ? "Public Library" : "Private Draft"}
                </span>
                {selectedPrimitive ? (
                  <span className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
                    {selectedPrimitive.userId
                      ? "Account-owned"
                      : "Core Library Source"}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {form.mechanicalOutputText ||
                  "Mechanical output will appear here as you write it."}
              </p>
              {form.narrativeRule ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {form.narrativeRule}
                </p>
              ) : null}
              {form.isMirrorable ? (
                <div className="mt-4 rounded-md border border-border bg-card p-3">
                  <p className="text-xs font-bold uppercase text-warning">
                    Mirror Credit
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Grants up to {form.mirrorBuCredit || 0} BU as a drawback via{" "}
                    {form.mirrorVector}.
                  </p>
                  {form.mirrorEligibilityNotes ? (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {form.mirrorEligibilityNotes}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <details className="mt-4 rounded-md border border-border bg-card p-3">
                <summary className="cursor-pointer text-xs font-bold uppercase text-muted-foreground">
                  Modifier Details
                </summary>
                <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-background p-3 text-xs">
                  {JSON.stringify(hardModifiers, null, 2)}
                </pre>
              </details>
            </div>
          </aside>
          </div>
        </section>
    </div>
  );
}
