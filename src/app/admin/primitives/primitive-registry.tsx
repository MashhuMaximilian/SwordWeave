"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  HardModifier,
  JsonValue,
  ModifierOperation,
  ModifierStackingMode,
  ModifierTarget,
} from "@/types/swordweave";

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
  costTier: "Tier 1: Minor (1-2 BU)",
  buCost: "1",
  mechanicalOutputText: "",
  narrativeRule: "",
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

export function PrimitiveRegistry({
  initialPrimitives,
}: {
  initialPrimitives: PrimitiveRow[];
}) {
  const [primitives, setPrimitives] = useState(initialPrimitives);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [form, setForm] = useState(blankForm);
  const [modifierCounter, setModifierCounter] = useState(1);
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([blankModifier]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const hardModifiers = useMemo(
    () => modifiers.map((modifier) => toHardModifier(modifier)),
    [modifiers],
  );

  const filteredPrimitives = useMemo(() => {
    if (selectedCategory === "ALL") {
      return primitives;
    }

    return primitives.filter((primitive) => primitive.category === selectedCategory);
  }, [primitives, selectedCategory]);

  function updateForm(field: keyof typeof blankForm, value: string) {
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

  function submitPrimitive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/primitives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, hardModifiers }),
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
      setModifierCounter(1);
      setModifiers([blankModifier]);
      setShowJsonPreview(false);
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
              Store the cost, category, and mechanical teeth for a reusable
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
                Advanced JSON Preview
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 text-xs">
                {JSON.stringify(hardModifiers, null, 2)}
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
        </section>
      </div>
    </main>
  );
}
