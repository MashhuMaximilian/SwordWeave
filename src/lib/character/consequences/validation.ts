import { z } from "zod";
import type { ConsequenceOccurrence } from "./types";
const restriction = z.object({
  kind: z.enum(["primitive", "capability"]),
  entityId: z.string().min(1).max(100),
  reason: z.string().max(2000),
});
export const consequenceBehaviorSchema = z.object({
  timing: z.literal("on-use"),
  vitalityDelta: z.number().int().min(-100000).max(100000),
  restrictions: z.array(restriction).max(100),
  recovery: z.string().max(10000),
});
const occurrence = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  description: z.string().max(20000),
  tags: z.array(z.string().max(200)).max(100),
  modifiers: z.array(z.record(z.string(), z.unknown())).max(100),
  durationTier: z.enum(["manual", "short_rest", "long_rest"]),
  active: z.boolean(),
  manualOverride: z.boolean().optional(),
  createdAt: z.number().finite(),
  source: z.enum(["custom", "sheet", "sheet-auto"]),
  sourceEntityId: z.string().max(100).optional(),
  sourceEntityType: z.enum(["primitive", "effect", "capability"]).optional(),
  sourceVersionId: z.string().nullable().optional(),
  status: z.enum(["active", "resolved"]).optional(),
  resolvedAt: z.number().nullable().optional(),
  recovery: z.string().max(10000).optional(),
  recoveryNote: z.string().max(10000).optional(),
  restrictions: z.array(restriction).max(100).optional(),
});
export function parseOccurrence(value: unknown): ConsequenceOccurrence {
  return occurrence.parse(value) as unknown as ConsequenceOccurrence;
}
export const consequenceMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("import"),
    commandId: z.string().min(1).max(200),
    occurrences: z.array(z.unknown()).max(2000),
  }),
  z.object({
    operation: z.literal("save"),
    commandId: z.string().min(1).max(200),
    changes: z
      .array(
        z.object({
          id: z.string().min(1).max(200),
          expectedRevision: z.number().int().nonnegative(),
          occurrence: z.unknown().nullable(),
        }),
      )
      .max(2000),
  }),
]);
