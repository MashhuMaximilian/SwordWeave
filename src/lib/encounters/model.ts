import { z } from "zod";
import {
  actorMarkerSchema,
  guestMarkerSchema,
  objectiveSchema,
  clockSchema,
  journalSchema,
} from "./run-state";
const units = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const phases = ["Council", "Fast", "Measured", "Heavy"] as const;
export const encounterDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    visibility: z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]).default("PRIVATE"),
    note: z.string().max(5000).default(""),
    partyBu: units.nullable().default(null),
    partyItemBu: units.nullable().default(null),
    partySize: z.number().int().min(1).max(10000).nullable().default(null),
    budgetSource: z
      .enum(["manual", "characters", "override"])
      .default("manual"),
    characterIds: z.array(z.uuid()).max(30).default([]),
    entries: z
      .array(
        z
          .object({
            templateId: z.uuid(),
            version: z.number().int().positive(),
            quantity: z.number().int().min(1).max(200),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .superRefine((d, c) => {
    if (d.entries.reduce((n, e) => n + e.quantity, 0) > 200)
      c.addIssue({
        code: "custom",
        message:
          "Split encounters larger than 200 creatures into separate runs.",
      });
    if (new Set(d.characterIds).size !== d.characterIds.length)
      c.addIssue({ code: "custom", message: "Duplicate party character." });
    if (
      new Set(d.entries.map((e) => `${e.templateId}:${e.version}`)).size !==
      d.entries.length
    )
      c.addIssue({
        code: "custom",
        message:
          "Adjust the quantity of an existing creature instead of adding it twice.",
      });
  });
export type EncounterDefinition = z.infer<typeof encounterDefinitionSchema>;
export type CreatureSummary = {
  templateId: string;
  version: number;
  name: string;
  budget: number;
  itemBu: number;
  maximum: number;
  environment?: string;
  role?: string;
  tactics?: string;
  unavailable?: boolean;
};
export function appraiseEncounter(
  d: EncounterDefinition,
  creatures: CreatureSummary[],
) {
  let enemyBu = 0,
    enemyItemBu = 0,
    count = 0,
    largest = 0,
    missing = false;
  for (const e of d.entries) {
    count += e.quantity;
    const c = creatures.find(
      (c) => c.templateId === e.templateId && c.version === e.version,
    );
    if (!c || c.unavailable) {
      missing = true;
      continue;
    }
    enemyBu += c.budget * e.quantity;
    enemyItemBu += c.itemBu * e.quantity;
    largest = Math.max(largest, c.budget);
  }
  const enemyTotal = enemyBu + enemyItemBu;
  if (!Number.isSafeInteger(enemyTotal))
    throw new Error("Encounter BU exceeds numeric safety.");
  const partyTotal =
    d.partyBu !== null && d.partyItemBu !== null
      ? d.partyBu + d.partyItemBu
      : null;
  if (partyTotal !== null && !Number.isSafeInteger(partyTotal))
    throw new Error("Party BU exceeds numeric safety.");
  return {
    enemyBu,
    enemyItemBu,
    enemyTotal,
    partyTotal,
    count,
    missing,
    difference:
      partyTotal !== null && !missing ? enemyTotal - partyTotal : null,
    ratio:
      partyTotal !== null && partyTotal > 0 && !missing
        ? enemyTotal / partyTotal
        : null,
    largestShare: enemyBu ? largest / enemyBu : 0,
  };
}
export const runMutationSchema = z
  .object({
    opId: z.uuid(),
    baseRevision: z.number().int().nonnegative().max(2147483646),
    changes: z
      .array(
        z
          .object({
            field: z
              .string()
              .regex(
                /^(round|phase|completed|notes|(?:actor|party|guest|objective|clock|log):[a-f0-9-]{36})$/,
              ),
            value: z.unknown().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict()
  .superRefine((m, c) => {
    if (new Set(m.changes.map((c) => c.field)).size !== m.changes.length)
      c.addIssue({ code: "custom", message: "Duplicate fields." });
    for (const change of m.changes) {
      let valid = true;
      if (change.field === "round")
        valid = z
          .number()
          .int()
          .positive()
          .max(2147483646)
          .safeParse(change.value).success;
      else if (change.field === "phase")
        valid = z.enum(phases).safeParse(change.value).success;
      else if (change.field === "completed")
        valid = z.boolean().safeParse(change.value).success;
      else if (change.field === "notes")
        valid = z.string().max(10000).safeParse(change.value).success;
      else if (change.value !== null)
        valid = (
          change.field.startsWith("guest:")
            ? guestMarkerSchema
            : change.field.startsWith("objective:")
              ? objectiveSchema
              : change.field.startsWith("clock:")
                ? clockSchema
                : change.field.startsWith("log:")
                  ? journalSchema
                  : actorMarkerSchema
        ).safeParse(change.value).success;
      if (!valid)
        c.addIssue({ code: "custom", message: "Invalid encounter marker." });
    }
  });
