import type { PlayMutation, PlayOverrides } from "./model";

export const SHORT_REST_RECOVERY_USED = "shortRestRecoveryUsed";
export type RestType = "short" | "long";

/** Preserve the established half-maximum, rounded-up recovery allowance. */
export function restRecoveryAllowance(maximum: number, overrides: PlayOverrides) {
  const allowance = Math.ceil(Math.max(0, maximum) / 2);
  const raw = overrides[SHORT_REST_RECOVERY_USED];
  const used = typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
  return { allowance, used, remaining: Math.max(0, allowance - used) };
}

/** Absolute paired assignments share one revision/conflict and offline operation.
 * A rest is explicitly recorded after table agreement; elapsed time never applies it.
 * Only the actual healing consumes short-rest recovery. Long rests reset the pool,
 * including when the table permits less than a full Vitality restoration.
 */
export function restRecoveryChanges(
  type: RestType, maximum: number, current: number, overrides: PlayOverrides,
  recoveryAmount?: number,
): PlayMutation["changes"] {
  const { remaining, used } = restRecoveryAllowance(maximum, overrides);
  const previous = Math.max(0, Math.min(maximum, current));
  const limit = type === "short" ? Math.min(remaining, maximum - previous) : maximum - previous;
  const amount = recoveryAmount ?? limit;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > limit) throw new Error("Recovery must be within the available Vitality allowance.");
  return [
    { field: "currentVitality", value: previous + amount },
    { field: SHORT_REST_RECOVERY_USED, value: type === "long" ? 0 : used + amount },
  ];
}
