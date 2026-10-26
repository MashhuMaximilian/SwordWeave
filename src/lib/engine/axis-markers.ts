import type { ResolvedModifiers } from "./resolve-modifiers";

/** Same read-only roll annotations on the app sheet and printed PDF.
 * These are constraints/bias markers, never additions to a numeric modifier. */
export interface AxisMarkerState {
  netAdvantage: number;
  floor: number | null;
  ceiling: number | null;
  conditional: boolean;
}

function hasConditionalMarker(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): boolean {
  return (byTarget[target] ?? []).some(
    (c) => c.hasCondition === true && (c.conditionActive === true || c.conditionComputable === false),
  );
}

/** Phase 8.I i3: count advantage/disadvantage stacks from
 * contributions that used `op: grant` with matching tags. */
function countStacks(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
  tag: string,
): number {
  // Phase 8.K K8: count from BOTH the local byTarget (legacy op=grant + tag)
  // AND the per-axis counter at behavior.advantage.<target> /
  // behavior.disadvantage.<target>.
  const local = (byTarget[target] ?? []).filter((c) =>
    c.op === "grant" && c.tags.includes(tag) && !c.inhibited && c.conditionActive !== false,
  ).length;
  const advKey = `behavior.${tag}.${target}`;
  const perAxis = (byTarget[advKey] ?? []).reduce(
    (sum, c) => sum + (!c.inhibited && c.conditionActive !== false && (c.op === "add" || c.op === "subtract") ? c.value : 0),
    0,
  );
  return Math.max(0, local + perAxis);
}

export function findFloor(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): number | null {
  // Phase 8.L round 45: skip inhibited contributions.
  const vals = (byTarget[target] ?? []).filter(
    (c) =>
      !c.inhibited &&
      (c.op === "min" || (c.op === "set" && c.tags.includes("min"))),
  );
  if (vals.length === 0) return null;
  return Math.min(...vals.map((c) => c.value));
}

export function findCeiling(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): number | null {
  // Phase 8.L round 45: skip inhibited contributions.
  const vals = (byTarget[target] ?? []).filter(
    (c) =>
      !c.inhibited &&
      (c.op === "max" || (c.op === "set" && c.tags.includes("max"))),
  );
  if (vals.length === 0) return null;
  return Math.max(...vals.map((c) => c.value));
}

export function axisMarkerState(byTarget: ResolvedModifiers["byTarget"], target: string): AxisMarkerState {
  return {
    netAdvantage: countStacks(byTarget, target, "advantage") - countStacks(byTarget, target, "disadvantage"),
    floor: findFloor(byTarget, target), ceiling: findCeiling(byTarget, target),
    conditional: hasConditionalMarker(byTarget, target),
  };
}

export function axisMarkerMap(byTarget: ResolvedModifiers["byTarget"]): Record<string, AxisMarkerState> {
  const targets = new Set(Object.keys(byTarget).map(key => key.replace(/^behavior\.(?:advantage|disadvantage)\./, "")));
  return Object.fromEntries([...targets].map(target => [target, axisMarkerState(byTarget, target)]));
}
