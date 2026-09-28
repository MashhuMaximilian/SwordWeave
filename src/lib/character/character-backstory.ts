/**
 * character-backstory.ts — Phase 8.2 batch 3
 *
 * Backstory shape lives in `characters.backstory jsonb` (migration
 * 0039). The schema is freeform: the current keys are
 * `description | personality | origin | motivation | ties | flaw`, but new ones can be added
 * without migration.
 *
 * This helper:
 *   1. Defines the canonical TS shape (`CharacterBackstory`)
 *   2. Defines the display order + label/icon for each key
 *   3. Provides a parser that coerces unknown JSON into the shape
 *      with safe defaults
 *
 * The Backstory tab on the character sheet uses this to render
 * the story fields as labeled cards, and to validate input from
 * the edit modal.
 */

export type BackstoryKey = "description" | "personality" | "origin" | "motivation" | "ties" | "flaw";

export interface CharacterBackstory {
  manifestDescription?: string;
  description: string;
  personality: string;
  origin: string;
  motivation: string;
  ties: string;
  flaw: string;
}

export interface BackstoryFieldMeta {
  key: BackstoryKey;
  label: string;
  description: string;
  /** Lucide icon component — resolved at render time */
  iconKey: "scroll" | "flame" | "users" | "alert";
}

/** Display order + label. Keep in sync with the icon registry. */
export const BACKSTORY_FIELDS: ReadonlyArray<BackstoryFieldMeta> = [
  { key: "description", label: "Full description", description: "What do they look, sound, and move like? Describe the details that make them recognizable.", iconKey: "scroll" },
  { key: "personality", label: "Personality", description: "How do they think and act? Their temperament, habits, values, and contradictions.", iconKey: "users" },
  {
    key: "origin",
    label: "Origin & History",
    description: "Where do they come from? What shaped them?",
    iconKey: "scroll",
  },
  {
    key: "motivation",
    label: "Motivation & Goals",
    description: "What drives them? What are they reaching for?",
    iconKey: "flame",
  },
  {
    key: "ties",
    label: "Ties & Allies",
    description: "Who matters to them? Who owes them a favor?",
    iconKey: "users",
  },
  {
    key: "flaw",
    label: "Flaw & Conflict",
    description: "What holds them back? Internal or external?",
    iconKey: "alert",
  },
];

/**
 * Parse arbitrary input (form data, JSONB row, API payload) into
 * the canonical CharacterBackstory shape. Unknown keys are dropped;
 * non-string values become empty strings. Never throws.
 */
export function parseBackstory(value: unknown): CharacterBackstory {
  const out: CharacterBackstory = {
    description: "",
    personality: "",
    origin: "",
    motivation: "",
    ties: "",
    flaw: "",
  };
  if (!value || typeof value !== "object") return out;
  const obj = value as Record<string, unknown>;
  if (typeof obj["manifestDescription"] === "string") out.manifestDescription = obj["manifestDescription"];
  for (const key of Object.keys(out) as BackstoryKey[]) {
    const v = obj[key];
    if (typeof v === "string") {
      out[key] = v;
    } else if (v && typeof v === "object") {
      // Best-effort: serialize nested objects as JSON.
      try {
        out[key] = JSON.stringify(v);
      } catch {
        out[key] = "";
      }
    }
  }
  return out;
}

/**
 * Trim and clamp each field to a sane length. The DB column is
 * jsonb (no hard cap), but unbounded text in a textarea is a UX
 * trap — 4000 chars per field is generous for character backstory.
 */
export function sanitizeBackstory(input: Partial<CharacterBackstory>): CharacterBackstory {
  const cap = (s: string | undefined): string => {
    const t = (s ?? "").trim();
    return t.length > 4000 ? t.slice(0, 4000) : t;
  };
  return {
    ...(input.manifestDescription !== undefined ? { manifestDescription: cap(input.manifestDescription) } : {}),
    description: cap(input.description),
    personality: cap(input.personality),
    origin: cap(input.origin),
    motivation: cap(input.motivation),
    ties: cap(input.ties),
    flaw: cap(input.flaw),
  };
}

/**
 * Returns true if every backstory field is empty (used to decide
 * whether to render an empty-state placeholder on the Backstory tab).
 */
export function isBackstoryEmpty(b: Partial<CharacterBackstory>): boolean {
  return BACKSTORY_FIELDS.every(({ key }) => !(b[key] ?? "").trim());
}
