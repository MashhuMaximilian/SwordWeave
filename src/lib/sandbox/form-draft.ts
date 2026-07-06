"use client";

// =============================================================================
// useFormDraft — saves the form's slot/effect/note state to a module-level
// store on unmount, and restores it on mount. This keeps the build form's
// in-progress state alive when the form unmounts in one place (panel) and
// remounts in another (drawer) — e.g. when toggling split-screen mode.
//
// Keyed by `${buildMode}:${editingId ?? "new"}` so loading a different
// entity gives a different draft.
//
// Simpler than useBuildFormDraft: this version doesn't use useSyncExternalStore.
// It just provides save/load functions that the form calls on mount/unmount.
// =============================================================================

type Draft = {
  primitiveIds: number[];
  effectIds: string[];
  capabilityIds: string[];
  notesByIndex: Record<number, string>;
};

const store = new Map<string, Draft>();

export function saveDraft(key: string, draft: Draft) {
  store.set(key, draft);
}

export function loadDraft(key: string): Draft | null {
  return store.get(key) ?? null;
}

export function clearDraft(key: string) {
  store.delete(key);
}

export function makeDraftKey(
  buildMode: string,
  editingId: string | number | null,
): string {
  return `${buildMode}:${editingId ?? "new"}`;
}
