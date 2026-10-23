export const ATELIER_SESSION_PREFIX = "sw-atelier-experiment:v1:";
export const ATELIER_AUTH_RESUME = `${ATELIER_SESSION_PREFIX}auth-resume`;
export const ATELIER_FLUSH_EVENT = "sw-atelier-experiment-flush";
const MAX_RECORD = 256_000;
const MAX_TOTAL = 1_000_000;
const MAX_AGE = 24 * 60 * 60 * 1000;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function readAtelierExperiment(storage: StorageLike, key: string, now = Date.now()): unknown | null {
  try {
    const raw = storage.getItem(ATELIER_SESSION_PREFIX + key);
    if (!raw || raw.length > MAX_RECORD) return null;
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !Number.isFinite(record.updatedAt) || now - record.updatedAt > MAX_AGE || record.updatedAt > now + 60000) return null;
    return record.state ?? null;
  } catch { return null; }
}

export function writeAtelierExperiment(storage: StorageLike, key: string, state: unknown, now = Date.now()): boolean {
  try {
    const raw = JSON.stringify({ version: 1, updatedAt: now, state });
    if (raw.length > MAX_RECORD) return false;
    const entries: { key: string; bytes: number; time: number }[] = [];
    for (let index = 0; index < storage.length; index++) {
      const name = storage.key(index);
      if (!name?.startsWith(ATELIER_SESSION_PREFIX) || name === ATELIER_SESSION_PREFIX + key || name === ATELIER_AUTH_RESUME) continue;
      const old = storage.getItem(name) ?? "";
      let time = 0; try { time = JSON.parse(old).updatedAt ?? 0; } catch { /* Evict corrupt records first. */ }
      entries.push({ key: name, bytes: old.length, time });
    }
    let total = raw.length + entries.reduce((sum, entry) => sum + entry.bytes, 0);
    entries.sort((a, b) => a.time - b.time);
    const evict: string[] = [];
    while (entries.length >= 16 || total > MAX_TOTAL) {
      const oldest = entries.shift(); if (!oldest) return false;
      evict.push(oldest.key); total -= oldest.bytes;
    }
    // Quota rejection must not destroy older recoverable work.
    storage.setItem(ATELIER_SESSION_PREFIX + key, raw);
    for (const old of evict) storage.removeItem(old);
    return true;
  } catch { return false; }
}

export function clearAtelierExperiment(storage: StorageLike, key: string) {
  try { storage.removeItem(ATELIER_SESSION_PREFIX + key); } catch { /* Optional browser recovery. */ }
}
