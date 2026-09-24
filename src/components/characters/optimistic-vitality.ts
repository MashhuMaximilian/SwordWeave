export interface VitalityReconciliation {
  visible: number;
  optimistic: number | null;
}

/** Keep a pending optimistic value until the canonical server value reaches it. */
export function reconcileVitality(
  canonical: number,
  optimistic: number | null,
): VitalityReconciliation {
  if (optimistic === null || optimistic === canonical) {
    return { visible: canonical, optimistic: null };
  }
  return { visible: optimistic, optimistic };
}
