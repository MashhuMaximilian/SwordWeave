import { describe, expect, it } from "vitest";
import { mapDraftIdentities, registerDraftIdentities, virtualIdentity } from "../draft-aliases";
import type { WorkspaceGraph } from "../model";
const operationId = "26ca493d-20cf-48aa-b0fb-f5567bcb7925";
const graph: WorkspaceGraph = { characterId: "character", revision: 0, nodes: [], edges: [] };
describe("draft identities across rolled-back previews", () => {
  it("reuses the same virtual identity across database replays", () => {
    expect(virtualIdentity(operationId, "primitive:0", true)).toBe(virtualIdentity(operationId, "primitive:0", true));
    expect(Number(virtualIdentity(operationId, "primitive:0", true))).toBeLessThan(0);
    expect(virtualIdentity(operationId, "effect:0")).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
  });
  it("rewrites node keys, paths, primitive slots and replacement keys together", () => {
    const aliases = new Map([["-123", "25"], ["old-instance", "new-instance"]]);
    const payload = { target: "primitive:-123", path: ["MANIFEST:effect:abc:primitive:-123", "old-instance"],
      draft: { primitiveIds: [-123], primitiveSlots: [{ primitiveId: -123 }], buCost: -123 }, replacements: { "primitive:-123": "primitive:-123" } };
    expect(mapDraftIdentities(payload, aliases)).toEqual({ target: "primitive:25", path: ["MANIFEST:effect:abc:primitive:25", "new-instance"],
      draft: { primitiveIds: [25], primitiveSlots: [{ primitiveId: 25 }], buCost: -123 }, replacements: { "primitive:25": "primitive:25" } });
  });
  it("does not rewrite costs, counts or narrative merely because they equal a primitive ID", () => {
    expect(mapDraftIdentities({ bu: 25, revision: 25, count: 25, description: "Spend 25 BU", id: 25 }, new Map([["25", "-123"]])))
      .toEqual({ bu: 25, revision: 25, count: 25, description: "Spend 25 BU", id: -123 });
  });
  it("keeps existing Library child identities when authoring a new containing bundle", () => {
    const aliases = new Map<string, string>();
    const after: WorkspaceGraph = { ...graph, nodes: [
      { key: "primitive:12", id: "12", kind: "primitive", name: "Existing", bu: 4, data: {}, versionId: null, latestVersionId: null, userId: null, description: "" },
      { key: "effect:new", id: "new", kind: "effect", name: "New", bu: 4, data: {}, versionId: null, latestVersionId: null, userId: null, description: "" },
    ], edges: [] };
    registerDraftIdentities(graph, after, operationId, aliases, new Set(["new"]));
    expect([...aliases.values()]).toEqual(["new"]);
  });
  it("round trips the saved draft's new entity references to the current preview's real IDs", () => {
    const virtual = virtualIdentity(operationId, "primitive:0", true);
    const toPreview = new Map([["1954", virtual]]);
    const toApply = new Map([[virtual, "2012"]]);
    const action = { child: "primitive:1954", draft: { primitiveIds: [1954] } };
    expect(mapDraftIdentities(mapDraftIdentities(action, toPreview), toApply)).toEqual({ child: "primitive:2012", draft: { primitiveIds: [2012] } });
  });
});
