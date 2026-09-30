export type ToggleSnapshot = {
  offCapabilityIds: Set<string>;
  offEffectIds: Set<string>;
  hydrated: boolean;
};
export const emptyToggleSnapshot: ToggleSnapshot = { offCapabilityIds: new Set(), offEffectIds: new Set(), hydrated: false };
const sameIds = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(id => b.has(id));
/** One storage read per character event, regardless of the number of stat consumers. */
export function createToggleStateStore(
  read: (id: string) => Omit<ToggleSnapshot, "hydrated">,
  listen: (id: string, refresh: () => void) => () => void,
) {
  const entries = new Map<string, { snapshot: ToggleSnapshot; listeners: Set<() => void>; stop: () => void }>();
  const refresh = (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;
    const next = read(id), previous = entry.snapshot;
    if (previous.hydrated && sameIds(previous.offCapabilityIds, next.offCapabilityIds) && sameIds(previous.offEffectIds, next.offEffectIds)) return;
    entry.snapshot = { ...next, hydrated: true };
    entry.listeners.forEach(listener => listener());
  };
  return {
    refresh,
    getSnapshot: (id: string) => entries.get(id)?.snapshot ?? emptyToggleSnapshot,
    subscribe(id: string, listener: () => void) {
      if (!id) return () => {};
      let entry = entries.get(id);
      if (!entry) {
        entry = { snapshot: emptyToggleSnapshot, listeners: new Set(), stop: () => {} };
        entries.set(id, entry);
        entry.stop = listen(id, () => refresh(id));
        refresh(id);
      }
      entry.listeners.add(listener);
      const current = entry;
      return () => {
        current.listeners.delete(listener);
        queueMicrotask(() => {
          if (current.listeners.size || entries.get(id) !== current) return;
          current.stop(); entries.delete(id);
        });
      };
    },
  };
}
