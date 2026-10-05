import { expect, it } from "vitest";
import { validatePlayReferences } from "../references";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
const graph: WorkspaceGraph = { characterId: "c", revision: 0, nodes: [{ key: "capability:a", kind: "capability", id: "a", name: "A", bu: 0, versionId: "v1", latestVersionId: "v1", userId: "u", description: "", data: {} }], edges: [{ id: "edge", parent: null, child: "capability:a", category: "MANIFEST", order: 0, isMirrored: false }] };
const mutation = (field: string, value: unknown = true) => ({ opId: "11111111-1111-4111-8111-111111111111", baseRevision: 0, changes: [{ field, value }] });
it("rejects orphan toggles and accepts attached capabilities", () => {
  expect(() => validatePlayReferences(graph, mutation("cap:a"))).not.toThrow();
  expect(() => validatePlayReferences(graph, mutation("cap:orphan"))).toThrow(/no longer part/);
  expect(() => validatePlayReferences(graph, mutation("eff:orphan"))).toThrow(/no longer part/);
  expect(() => validatePlayReferences(graph, mutation("itemcap:foreign:a"))).toThrow(/no longer part/);
});
it("permits removal of obsolete overrides without resurrecting orphan references", () => {
  expect(() => validatePlayReferences(graph, mutation("cap:orphan", null))).not.toThrow();
});
