import { loadEntityPreview, previewKind } from "@/components/characters/workspace/workspace-entity-preview";
import { mapPayloadToPreviewItem } from "@/components/library/version-preview-button";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { MonsterReference } from "@/lib/monsters/model";

/** Package cards show the selected published version, never today's replacement. */
export async function loadMonsterComponentPreview(reference: Pick<MonsterReference, "kind" | "id" | "versionId">, signal: AbortSignal, names: Record<string, string> = {}): Promise<SandboxPreviewItem> {
  if (!reference.versionId) return loadEntityPreview(previewKind(reference.kind), reference.id, signal);
  let targetType: string = reference.kind;
  if (reference.kind === "HERITAGE") {
    const entry = await loadEntityPreview("heritage", reference.id, signal);
    if (entry.kind !== "heritage") throw new Error("Heritage preview unavailable.");
    targetType = `${entry.row.kind}_TEMPLATE`;
  }
  let before: number | null = null;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ targetType, targetId: reference.id, ...(before ? { before: String(before) } : {}) });
    const response = await fetch(`/api/versions/list?${query}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("This saved component version is unavailable.");
    const result = await response.json() as { versions: Array<{ id: string; versionNumber: number }>; nextBefore: number | null };
    const selected = result.versions.find(version => version.id === reference.versionId);
    if (selected) {
      query.delete("before"); query.set("version", String(selected.versionNumber));
      const detail = await fetch(`/api/versions/list?${query}`, { signal, cache: "no-store" });
      if (!detail.ok) throw new Error("This saved component version is unavailable.");
      const body = await detail.json() as { version: { payload: Record<string, unknown> } };
      const item = mapPayloadToPreviewItem(targetType, reference.id, body.version.payload, names);
      if (!item) throw new Error("This component cannot be previewed.");
      return { ...item, row: { ...item.row, versionNumber: selected.versionNumber } } as unknown as SandboxPreviewItem;
    }
    if (!result.nextBefore) break;
    before = result.nextBefore;
  }
  throw new Error("The pinned version could not be found. Its current Library entry was not substituted.");
}
