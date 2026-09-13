"use client";

import Link from "next/link";
import { Plus, Shapes } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { value: string; label: string; count: number };

const FAMILY_LABELS: Record<string, string> = {
  VERB_TIER: "Verb Access",
  DOMAIN: "Domain Access",
  SIZING: "Size Tier and Scale",
  TARGETING: "Targeting",
  TARGETING_AOE: "Targeting and Sizing",
  RANGE: "Range Scaling",
  DURATION: "Duration and Persistence",
  SPEED_QUICKENING: "Speed and Quickening",
  INTENSITY_DICE: "Intensity and Damage Dice",
  PERCEPTION_QUALIFIER: "Perception and Detection Qualifiers",
  PRACTICE_PROGRESSION_AUGMENT: "Practice and Character Core Progression",
  TRIGGER_HOOK: "Runtime Trigger Hooks",
  VITALITY: "Vitality Extension",
  DEFENSIVE: "Defense and Resistance",
  PROBABILITY_BIAS: "Probability Bias",
  ACTION_ECONOMY: "Action Economy",
  EVALUATION_STRAIN: "Evaluation and Strain",
  TEMPORAL_CHRONOLOGICAL: "Time and Chronology",
};

export function libraryFamilyLabel(category: Pick<Category, "value" | "label">): string {
  return (
    FAMILY_LABELS[category.value] ??
    category.label
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

const GROUPS: Array<{ label: string; values: string[] }> = [
  {
    label: "Construction language",
    values: ["VERB_TIER", "DOMAIN", "STRUCTURAL"],
  },
  {
    label: "Resolution and expression",
    values: [
      "RANGE",
      "SPEED_QUICKENING",
      "DURATION",
      "TARGETING",
      "TARGETING_AOE",
      "INTENSITY_DICE",
      "OUTPUT",
    ],
  },
  {
    label: "Character foundation",
    values: [
      "VITALITY",
      "PRACTICE_PROGRESSION",
      "PROBABILITY_BIAS",
      "DEFENSE",
      "DEFENSIVE",
      "PERCEPTION_QUALIFIER",
      "SENSORY_ARRAY",
      "MOBILITY_LOCOMOTION",
    ],
  },
  {
    label: "System and reality",
    values: [
      "TRIGGER_HOOK",
      "CONDITION",
      "KINETIC_CONTROL",
      "AGENCY_OVERRIDE",
      "METAMORPHOSIS",
      "ACTION_ECONOMY",
      "EVALUATION_STRAIN",
      "TEMPORAL_CHRONOLOGICAL",
      "BOSS_ECONOMY",
      "TACTICAL",
    ],
  },
];

export function LibraryMarketRail({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string;
  onSelect: (category: string) => void;
}) {
  const byValue = new Map(categories.map((category) => [category.value, category]));
  const grouped = new Set(GROUPS.flatMap((group) => group.values));
  const remainder = categories.filter((category) => !grouped.has(category.value));
  const groups = remainder.length
    ? [...GROUPS, { label: "Additional families", values: remainder.map((c) => c.value) }]
    : GROUPS;

  return (
    <>
      <div className="v12-section-head border-b border-border px-3 py-2 md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lexicon categories">
          <button
            type="button"
            aria-pressed={!selected}
            onClick={() => onSelect("")}
            className="v12-metal-button shrink-0 rounded-md px-3 py-2 text-xs"
          >
            All families
          </button>
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              aria-pressed={selected === category.value}
              onClick={() => onSelect(category.value)}
              className={cn(
                "v12-metal-button shrink-0 rounded-md px-3 py-2 text-xs",
                selected === category.value && "bg-primary text-primary-foreground",
              )}
            >
              {libraryFamilyLabel(category)} · {category.count}
            </button>
          ))}
        </div>
        {selected ? (
          <Link
            href={`/atelier?build=primitive&new=1&category=${encodeURIComponent(selected)}`}
            className="v12-metal-button v12-metal-button--primary mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs"
          >
            <Plus className="size-3.5" /> Create primitive in this family
          </Link>
        ) : null}
      </div>
      <aside className="v12-instrument hidden min-h-0 overflow-hidden md:flex md:flex-col" aria-label="Lexicon categories">
      <header className="v12-section-head shrink-0 px-4 pb-3 pt-5">
        <p className="v12-kicker">Lexicon categories</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="text-lg">{categories.length} Market families</h2>
          <button
            type="button"
            onClick={() => onSelect("")}
            className="v12-metal-button inline-flex size-9 items-center justify-center rounded-md"
            aria-label="Show every Library category"
            title="Show all categories"
          >
            <Shapes className="size-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {groups.map((group) => {
          const entries = group.values.map((value) => byValue.get(value)).filter(Boolean) as Category[];
          if (!entries.length) return null;
          return (
            <section key={group.label} className="mb-5 last:mb-0">
              <h3 className="v12-kicker px-2 pb-1.5">{group.label}</h3>
              <div>
                {entries.map((category) => {
                  const active = selected === category.value;
                  return (
                    <div key={category.value} className="group relative">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(category.value)}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-border/70 px-2 py-2.5 text-left text-sm",
                          active
                            ? "rounded-md border border-primary bg-primary text-primary-foreground"
                            : "hover:bg-primary/5",
                        )}
                      >
                        <span aria-hidden="true" className="text-primary">◇</span>
                        <span className="min-w-0 flex-1 leading-snug">{libraryFamilyLabel(category)}</span>
                        <span className="shrink-0 text-xs opacity-75">{category.count}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      </aside>
    </>
  );
}
