import { randomUUID } from "node:crypto";

const receipts = new Map<string, string>();

export function readFixture(userId: string, configuredIds: readonly string[], write: boolean) {
  const index = configuredIds.indexOf(userId);
  if (index < 0) return null;
  let receipt = receipts.get(userId);
  if (write && !receipt) {
    receipt = randomUUID();
    receipts.set(userId, receipt);
  }
  return { displayName: `Fictional SwordWeave player ${index + 1}`, receipt: receipt ?? null };
}
