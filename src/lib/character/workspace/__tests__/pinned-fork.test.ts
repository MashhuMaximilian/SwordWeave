import { describe, expect, it, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({ bodies: [] as Record<string, unknown>[], noOp: false }));
vi.mock("@/app/api/effects/[id]/route", () => ({ PATCH: async (request: Request) => {
  state.bodies.push(await request.json());
  if (state.noOp && state.bodies.length === 1) return Response.json({ dispatchOutcome: { kind: "no-op" } });
  return Response.json({ effect: { id: "private" }, dispatchOutcome: { kind: "forked", newId: "private" } });
} }));
import { withDraftExecution } from "../draft-scope";
import { containerPayload, saveWorkspaceEntity } from "../save-entity";
import type { WorkspaceNode } from "../model";
const node: WorkspaceNode = { key: "effect:old", id: "old", kind: "effect", name: "Pinned effect", description: "old description", bu: 4, userId: "source-author", versionId: "v1", latestVersionId: "v2", data: { name: "Pinned effect", narrativeDescription: "old description", workspaceHistoricalVersion: true, workspaceVersionNumber: 1 } };
beforeEach(() => { state.bodies = []; state.noOp = false; });
describe("editing a historical container", () => {
  it("forks saved rules and memberships into a private definition in a draft", async () => {
    const payload = containerPayload(node, [{ id: "child", parent: node.key, child: "primitive:4", category: "ALL", order: 0, isMirrored: true, data: { quantity: 2, notes: "Pinned membership" } }]);
    const result = await withDraftExecution("c", "editor", () => saveWorkspaceEntity(node, { ...payload, narrativeDescription: "edited description" }));
    expect(result.id).toBe("private");
    expect(state.bodies[0]).toMatchObject({ intent: "fork", isPublic: false, narrativeDescription: "edited description", primitiveSlots: [{ primitiveId: 4, isMirrored: true, quantity: 2, notes: "Pinned membership" }] });
  });
  it("creates an explicit private copy if the requested historical edit equals live content", async () => {
    state.noOp = true;
    const result = await withDraftExecution("c", "editor", () => saveWorkspaceEntity(node, { name: "Pinned effect", narrativeDescription: "now matches live" }));
    expect(result.id).toBe("private"); expect(state.bodies).toHaveLength(2);
    expect(state.bodies[1]).toMatchObject({ intent: "fork", isPublic: false, name: "Pinned effect (v1 copy)" });
  });
});
