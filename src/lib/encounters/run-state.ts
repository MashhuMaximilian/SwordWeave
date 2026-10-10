import { z } from "zod";
import type { PlayOverrides } from "@/lib/play-state/model";

export const tracks = ["Unassigned", "Fast", "Measured", "Heavy"] as const;
export const actorMarkerSchema = z
  .object({
    intent: z.string().max(2000),
    track: z.enum(tracks),
    resolved: z.boolean(),
    presence: z.enum(["in-play", "withdrawn"]).optional(),
    target: z.string().max(200).optional(),
    reminder: z.string().max(1000).optional(),
  })
  .strict();
export const guestMarkerSchema = actorMarkerSchema.extend({
  name: z.string().trim().min(1).max(100),
});
export const objectiveSchema = z
  .object({ text: z.string().trim().min(1).max(1000), done: z.boolean() })
  .strict();
export const clockSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    value: z.number().int().min(0).max(1000),
    maximum: z.number().int().min(1).max(1000),
  })
  .strict()
  .refine((c) => c.value <= c.maximum, "Progress exceeds the countdown.");
export const journalSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    round: z.number().int().positive(),
    phase: z.enum(["Council", "Fast", "Measured", "Heavy"]),
    at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type ActorMarker = z.infer<typeof actorMarkerSchema>;
export type GuestMarker = z.infer<typeof guestMarkerSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type SceneClock = z.infer<typeof clockSchema>;
export type JournalEntry = z.infer<typeof journalSchema>;
export const emptyMarker = (): ActorMarker => ({
  intent: "",
  track: "Unassigned",
  resolved: false,
});
export function readMarker(state: PlayOverrides, field: string): ActorMarker {
  const value = actorMarkerSchema.safeParse(state[field]);
  return value.success ? value.data : emptyMarker();
}
export function runEntries<T>(
  state: PlayOverrides,
  prefix: string,
  schema: z.ZodType<T>,
): { field: string; value: T }[] {
  return Object.entries(state).flatMap(([field, raw]) => {
    if (!field.startsWith(prefix + ":")) return [];
    const result = schema.safeParse(raw);
    return result.success ? [{ field, value: result.data }] : [];
  });
}
/** New Council resets declarations, never sheet state, reminders or scene progress. */
export function nextCouncilChanges(
  state: PlayOverrides,
  round: number,
  actorIds: string[],
  partyIds: string[],
) {
  const fields = new Set([
    ...actorIds.map((id) => `actor:${id}`),
    ...partyIds.map((id) => `party:${id}`),
    ...runEntries(state, "guest", guestMarkerSchema).map((g) => g.field),
  ]);
  return [
    { field: "round", value: (round + 1) as unknown },
    { field: "phase", value: "Council" as unknown },
    ...[...fields].map((field) => {
      const guest = guestMarkerSchema.safeParse(state[field]);
      const old =
        field.startsWith("guest:") && guest.success
          ? guest.data
          : readMarker(state, field);
      return {
        field,
        value: {
          ...old,
          intent: "",
          track: "Unassigned",
          resolved: false,
          target: "",
        } as unknown,
      };
    }),
  ];
}
export function adjustVitality(
  current: number,
  maximum: number,
  amount: number,
  direction: "damage" | "heal",
) {
  if (
    ![current, maximum, amount].every(Number.isSafeInteger) ||
    current < 0 ||
    maximum < 0 ||
    amount < 1
  )
    throw new Error("Enter a whole amount of at least 1.");
  return direction === "damage"
    ? Math.max(0, current - amount)
    : Math.min(maximum, current + amount);
}
export function validDiceExpression(text: string) {
  const match = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,4})?$/i.exec(
    text.trim(),
  );
  return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 20;
}
export function validateRunReferences(
  fields: string[],
  actors: string[],
  party: string[],
) {
  for (const field of fields) {
    if (field.startsWith("actor:") && !actors.includes(field.slice(6)))
      throw new Error("Creature does not belong to this run.");
    if (field.startsWith("party:") && !party.includes(field.slice(6)))
      throw new Error("Character does not belong to this run.");
  }
}
export function validateRunLimits(state: PlayOverrides) {
  for (const [prefix, limit] of [
    ["guest", 50],
    ["objective", 50],
    ["clock", 30],
    ["log", 200],
  ] as const) {
    if (
      Object.keys(state).filter((k) => k.startsWith(prefix + ":")).length >
      limit
    )
      throw new Error(
        `This encounter supports up to ${limit} ${prefix === "guest" ? "manual participants" : prefix === "log" ? "journal entries" : prefix === "clock" ? "countdowns" : "objectives"}. Remove an unused entry first.`,
      );
  }
}
