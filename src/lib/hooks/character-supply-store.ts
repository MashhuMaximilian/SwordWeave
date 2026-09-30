import type { WorkspaceGraph } from "@/lib/character/workspace/model";

type Listener = () => void;
/** One verified graph and one request per mounted character, shared by all stat cards. */
export function createCharacterSupplyStore(
  load: (id: string, signal: AbortSignal) => Promise<WorkspaceGraph>,
  listen: (invalidate: () => void) => () => void,
) {
  type Entry = {
    graph: WorkspaceGraph | null;
    listeners: Set<Listener>;
    controller: AbortController | null;
    dirty: boolean;
    stop: () => void;
  };
  const entries = new Map<string, Entry>();
  async function refresh(id: string, entry: Entry) {
    if (entry.controller) { entry.dirty = true; return; }
    const controller = new AbortController();
    entry.controller = controller;
    try {
      const graph = await load(id, controller.signal);
      if (entries.get(id) === entry && !controller.signal.aborted && graph.characterId === id) {
        entry.graph = graph;
        entry.listeners.forEach(listener => listener());
      }
    } catch { /* Keep the last verified graph on temporary network failures. */ }
    finally {
      entry.controller = null;
      if (entry.dirty && entries.get(id) === entry) {
        entry.dirty = false;
        void refresh(id, entry);
      }
    }
  }
  return {
    getSnapshot: (id: string) => entries.get(id)?.graph ?? null,
    subscribe(id: string, listener: Listener) {
      if (!id) return () => {};
      let entry = entries.get(id);
      if (!entry) {
        entry = { graph: null, listeners: new Set(), controller: null, dirty: false, stop: () => {} };
        entries.set(id, entry);
        const current = entry;
        entry.stop = listen(() => { void refresh(id, current); });
        void refresh(id, entry);
      }
      entry.listeners.add(listener);
      const current = entry;
      return () => {
        current.listeners.delete(listener);
        // React StrictMode immediately subscribes again. Keep the in-flight request
        // through that cycle, but never retain private graphs after leaving the sheet.
        queueMicrotask(() => {
          if (current.listeners.size || entries.get(id) !== current) return;
          entries.delete(id);
          current.stop();
          current.controller?.abort();
        });
      };
    },
  };
}
