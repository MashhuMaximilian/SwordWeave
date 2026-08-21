"use client";

/**
 * use-sheet-conditions.ts — Phase 8.L round 68 (Mashu 2026-08-20)
 *
 * Sync primitives/capabilities/effects with NON-COMPUTABLE conditions
 * into the right-drawer's "From sheet" section. The user can toggle
 * each one ON/OFF to engage or inhibit the underlying modifier.
 *
 * WHY:
 * Per Mashu R68: "Some primitives have 'triggers when ...' Those are
 * engaged or inhibited or whatever. We need to show those in the
 * right drawer to check them as true or false too."
 *
 * CATEGORIES:
 * - Computable conditions (HP, attributes) are auto-evaluated by
 *   the engine. The user doesn't need to toggle them.
 * - Non-computable conditions (narrative triggers like
 *   "tracking_animal", "in_dim_light") are always-on by default.
 *   The user needs to toggle them.
 *
 * This hook:
 * 1. Scans primitives for hardModifiers with non-computable conditions
 * 2. Creates a sheet-sourced RuntimeCondition for each one (idempotent)
 * 3. If the user toggles one OFF, the engine respects the override
 *    (treated as inhibited)
 *
 * Storage: localStorage with key `sw:cond:<characterId>:<id>`.
 * The runtime-conditions hook already reads from this storage.
 *
 * The id format is `sheet-primitive-<primitiveId>-<modIndex>` so the
 * scanner is idempotent — running it multiple times doesn't create
 * duplicates.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  useRuntimeConditions,
  type RuntimeCondition,
} from "./use-runtime-conditions";
import { isConditionComputable } from "@/lib/engine/condition-evaluator";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";

type PrimitiveLinkInput = {
  primitiveId: number;
  primitive: {
    id: number;
    name: string;
    hardModifiers: ReadonlyArray<Record<string, unknown>>;
  };
};

type CapabilityLinkInput = {
  capabilityId: string;
  capability: {
    id: string;
    name: string;
    effects?: ReadonlyArray<{
      id: string;
      name: string;
      hardModifiers?: ReadonlyArray<Record<string, unknown>>;
    }>;
  };
};

// Cast helper for traversed unknown shapes
function asRef<T>(v: unknown): T {
  return v as T;
}

/**
 * Build a synthetic ConditionContext for the scanner. We don't need
 * real character state — we just want to know if a condition is
 * NON-computable. The scanner only asks: "does this condition
 * reference target/scene axes that the engine can't evaluate?".
 */
function syntheticContext(): ConditionContext {
  return {
    character: {
      vitality: 0,
      vitalityMax: 0,
      saveDc: 0,
      blockValue: 0,
      attributes: { physical: 0, mental: 0, magical: 0 },
      practices: {
        prowess: 0, finesse: 0, fieldcraft: 0, awareness: 0, reason: 0,
        knowledge: 0, influence: 0, mysticism: 0, communion: 0, intuition: 0,
      },
      proficiencies: new Set(),
      flags: new Set(),
      custom: {},
    },
  };
}

/**
 * Check if a condition has a NON-COMPUTABLE pill token — i.e. a
 * `self:<flag>` that the engine doesn't know about. The engine
 * would return `false` for these flags forever (since they're never
 * set), so the modifier is effectively dead. The user wants to
 * manually toggle these.
 *
 * Returns true if the condition NEEDS manual toggling.
 */
function isConditionEffective(condition: unknown): boolean {
  if (!condition) return false;
  // target/scene references → non-computable (correct)
  const ctx = syntheticContext();
  if (!isConditionComputable(condition as never, ctx)) return true;
  // For compound conditions, check each pill token. If any pill
  // references a self-flag NOT in ALL_FLAGS, that pill can never
  // evaluate to true automatically → it's a manual trigger.
  if (
    typeof condition === "object" &&
    condition !== null &&
    (condition as { kind?: string }).kind === "compound"
  ) {
    const tokens = (condition as { tokens?: readonly string[] }).tokens ?? [];
    const pillTokens = tokens.filter((_t, i) => i % 2 === 0);
    return pillTokens.some((token) => isManualTriggerToken(token));
  }
  return false;
}

function isManualTriggerToken(token: string): boolean {
  const sep = token.indexOf(":");
  if (sep < 0) return false;
  const axis = token.slice(0, sep);
  const payload = token.slice(sep + 1);
  // stat|... is computable (numeric stat read)
  if (payload.startsWith("stat|")) return false;
  // target/scene pills are non-computable but already handled by
  // isConditionComputable.
  if (axis === "target" || axis === "scene") return true;
  if (axis !== "self" && axis !== "actor") return false;
  // actor/self: check if the payload is a known flag.
  // Known flags include proficiency checks, predicates, status flags.
  return !isKnownFlag(payload);
}

function isKnownFlag(label: string): boolean {
  // Proficiency / not_proficient_in_*: computable
  if (label.startsWith("proficient_in(")) return true;
  if (label.startsWith("not_proficient_in(")) return true;
  if (label.startsWith("proficient_in_attribute(")) return true;
  if (label.startsWith("not_proficient_in_attribute(")) return true;
  if (label === "proficient_in(all_practices)") return true;
  if (label === "not_proficient_in(all_practices)") return true;
  if (label === "proficient_in(all_saves)") return true;
  if (label === "not_proficient_in(all_saves)") return true;
  if (label === "proficient") return true;
  if (label === "not_proficient") return true;
  // Status flags — engine would set these from combat events
  // when the character sheet FAB layer wires up. For now, the
  // engine KNOWS about them so we treat them as computable.
  const KNOWN_STATUS_FLAGS = new Set([
    "is_prone", "is_stunned", "is_bleeding", "is_frightened",
    "is_blinded", "is_charmed", "is_grappled", "is_restrained",
    "is_sick", "is_wounded", "is_damaged_last_round",
    "has_stance", "unconscious", "prone", "stunned", "bleeding",
    "frightened", "blinded", "charmed", "grappled", "restrained",
    "sick", "wounded",
  ]);
  return KNOWN_STATUS_FLAGS.has(label);
}

function buildId(prefix: string, sourceId: string, modIndex: number): string {
  return `${prefix}-${sourceId}-${modIndex}`;
}

function makeCondition(
  id: string,
  title: string,
  description: string,
  modifiers: ReadonlyArray<{
    kind?: string;
    target?: string;
    operation?: string;
    value?: unknown;
    metadata?: unknown;
  }>,
  sourceEntityId: string,
  sourceEntityType: "primitive" | "effect",
): RuntimeCondition {
  return {
    id,
    title,
    description,
    active: true,
    source: "sheet",
    sourceEntityId,
    sourceEntityType,
    modifiers: modifiers.map((m) => ({
      kind: "modify" as const,
      target: (m.target ?? "") as never,
      operation: (m.operation as "add" | "subtract" | "multiply" | "divide" | "set" | "min" | "max" | "grant" | "revoke") ?? "add",
      value: m.value as never,
      metadata: m.metadata as never,
    })),
    durationTier: "manual",
    tags: [],
    createdAt: 0,
  };
}

/**
 * Scan primitives for non-computable conditions and return the
 * desired sheet conditions. Each unique (primitiveId, modIndex)
 * becomes one sheet condition.
 */
function scanPrimitives(
  primitives: ReadonlyArray<PrimitiveLinkInput>,
): RuntimeCondition[] {
  const out: RuntimeCondition[] = [];
  for (const link of primitives) {
    const mods = link.primitive.hardModifiers ?? [];
    mods.forEach((mod, idx) => {
      const condition = (mod as Record<string, unknown>)["condition"];
      if (!condition) return;
      if (!isConditionEffective(condition)) return;
      const id = buildId("sheet-primitive", String(link.primitiveId), idx);
      out.push(
        makeCondition(
          id,
          link.primitive.name,
          "Toggle to engage or inhibit this modifier.",
          [mod as unknown as {
            kind?: string;
            target?: string;
            operation?: string;
            value?: unknown;
            metadata?: unknown;
          }],
          String(link.primitiveId),
          "primitive",
        ),
      );
    });
  }
  return out;
}

/**
 * Scan capability effects for non-computable conditions.
 */
function scanCapabilities(
  capabilities: ReadonlyArray<CapabilityLinkInput>,
): RuntimeCondition[] {
  const out: RuntimeCondition[] = [];
  for (const cap of capabilities) {
    const effects = cap.capability.effects ?? [];
    for (const eff of effects) {
      const mods = (eff.hardModifiers ?? []) as ReadonlyArray<Record<string, unknown>>;
      mods.forEach((mod, idx) => {
        const condition = (mod as Record<string, unknown>)["condition"];
        if (!condition) return;
        if (!isConditionEffective(condition)) return;
        const id = buildId("sheet-effect", eff.id, idx);
        out.push(
          makeCondition(
            id,
            `${cap.capability.name} — ${eff.name}`,
            "Toggle to engage or inhibit this modifier.",
            [mod as unknown as {
              kind?: string;
              target?: string;
              operation?: string;
              value?: unknown;
              metadata?: unknown;
            }],
            eff.id,
            "effect",
          ),
        );
      });
    }
  }
  return out;
}

/**
 * ONE-SHOT cleanup of duplicate sheet conditions written by the
 * L68 bug. Runs ONCE per page-load. Bypasses the hook's
 * remove() chain to avoid render loops. Touches localStorage
 * directly, then dispatches a single event.
 *
 * The L68 loop bug created hundreds or thousands of duplicate
 * sheet conditions in some users' localStorage. We group them
 * by deterministic id (sheet-primitive-<id>-<idx>) and keep the
 * most recent. Anything older gets deleted from localStorage
 * directly. After bulk delete, we dispatch ONE
 * sw:conditions-changed event so the UI re-reads localStorage
 * in a single refresh — no cascading re-renders.
 *
 * The ref guard ensures cleanup runs at most once. Subsequent
 * effect runs early-return without touching localStorage.
 */
function dedupeSheetConditionsOnce(
  characterId: string,
  sheetConditions: ReadonlyArray<RuntimeCondition>,
): boolean {
  if (typeof window === "undefined") return false;
  if (sheetConditions.length <= 1) return false;
  const groups = new Map<string, RuntimeCondition[]>();
  for (const c of sheetConditions) {
    const det = deterministicIdFor(c);
    const arr = groups.get(det) ?? [];
    arr.push(c);
    groups.set(det, arr);
  }
  const prefix = `sw:cond:${characterId}:`;
  let removed = 0;
  for (const arr of groups.values()) {
    if (arr.length <= 1) continue;
    const sorted = [...arr].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
    for (const c of sorted.slice(1)) {
      try {
        window.localStorage.removeItem(prefix + c.id);
        removed++;
      } catch {
        // ignore
      }
    }
  }
  if (removed > 0) {
    window.dispatchEvent(new CustomEvent("sw:conditions-changed"));
    return true;
  }
  return false;
}

function deterministicIdFor(c: RuntimeCondition): string {
  if (c.source !== "sheet") return c.id;
  const sourceId = c.sourceEntityId ?? "";
  const modIndex = c.modifiers.length > 1 ? c.modifiers.length - 1 : 0;
  const prefix = c.sourceEntityType === "effect" ? "sheet-effect" : "sheet-primitive";
  return `${prefix}-${sourceId}-${modIndex}`;
}

/**
 * Sync helper: create missing sheet conditions, leave existing ones
 * alone (preserves user toggle state). Returns the desired set; the
 * hook decides what to write.
 */
function reconcile(
  existing: ReadonlyArray<RuntimeCondition>,
  desired: ReadonlyArray<RuntimeCondition>,
): { toCreate: RuntimeCondition[]; ids: Set<string> } {
  const existingIds = new Set(existing.map((c) => c.id));
  const toCreate = desired.filter((c) => !existingIds.has(c.id));
  const ids = new Set(desired.map((c) => c.id));
  return { toCreate, ids };
}

export function useSheetConditions(input: {
  characterId: string | null;
  primitiveLinks: ReadonlyArray<PrimitiveLinkInput>;
  capabilityLinks: ReadonlyArray<CapabilityLinkInput>;
}): {
  sheetConditionIds: ReadonlySet<string>;
} {
  const { characterId, primitiveLinks, capabilityLinks } = input;
  const { conditions, create } = useRuntimeConditions(characterId);

  const desired = useMemo(() => {
    return [
      ...scanPrimitives(primitiveLinks),
      ...scanCapabilities(capabilityLinks),
    ];
  }, [primitiveLinks, capabilityLinks]);

  // Phase 8.L round 70 cleanup: one-shot dedup. Ref guard
  // prevents re-runs. Cleanup happens before the create effect
  // so the next reconcile sees the post-cleanup conditions.
  const dedupRan = useRef(false);
  useEffect(() => {
    if (!characterId || dedupRan.current) return;
    dedupRan.current = true;
    const sheetConds = conditions.filter((c) => c.source === "sheet");
    dedupeSheetConditionsOnce(characterId, sheetConds);
    // The dispatch above will trigger refresh() which fires
    // setConditions. The create effect below will then run
    // ONCE (because reconcile sees the canonical conditions)
    // and create at most the missing ones — which is 0 after
    // cleanup completes.
  }, [characterId, conditions]);

  useEffect(() => {
    if (!characterId) return;
    const { toCreate } = reconcile(conditions, desired);
    for (const c of toCreate) {
      create(c);
    }
  }, [characterId, desired, conditions, create]);

  const sheetConditionIds = useMemo(() => {
    return new Set(conditions.filter((c) => c.source === "sheet").map((c) => c.id));
  }, [conditions]);

  return { sheetConditionIds };
}
