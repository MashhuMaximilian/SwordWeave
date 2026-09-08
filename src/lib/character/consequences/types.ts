import type { HardModifier } from "@/types/swordweave";

export type AccessRestriction = {
  kind: "primitive" | "capability";
  entityId: string;
  reason: string;
};

/** Authored on an atomic primitive; applied only when a player commits a use. */
export interface ConsequenceBehavior {
  timing: "on-use";
  vitalityDelta: number;
  restrictions: readonly AccessRestriction[];
  recovery: string;
}

export interface ConsequenceOccurrence {
  id: string;
  title: string;
  description: string;
  tags: readonly string[];
  modifiers: readonly HardModifier[];
  durationTier: "long_rest" | "short_rest" | "manual";
  active: boolean;
  manualOverride?: boolean | undefined;
  createdAt: number;
  source: "custom" | "sheet" | "sheet-auto";
  sourceEntityId?: string;
  sourceEntityType?: "primitive" | "effect" | "capability";
  sourceVersionId?: string | null;
  status?: "active" | "resolved";
  resolvedAt?: number | null;
  recovery?: string;
  recoveryNote?: string;
  restrictions?: readonly AccessRestriction[];
  applicationId?: string;
  /** Immutable application content; promotion links a definition without replay. */
  applicationSnapshot?: {
    vitalityDelta: number;
    modifiers: readonly HardModifier[];
    restrictions: readonly AccessRestriction[];
  };
  promotedPrimitiveId?: number;
}

export function occurrenceEnabled(c: ConsequenceOccurrence): boolean {
  return c.status !== "resolved" && (c.manualOverride ?? c.active);
}

export function activeRestrictions(
  occurrences: readonly ConsequenceOccurrence[],
): AccessRestriction[] {
  return occurrences
    .filter(occurrenceEnabled)
    .flatMap((c) => [...(c.restrictions ?? [])]);
}
