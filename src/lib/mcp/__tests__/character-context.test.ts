import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { EntityKey, WorkspaceEdge, WorkspaceGraph, WorkspaceNode } from "@/lib/character/workspace/model";
import { emptyPlayState, projectCanonicalPlayState } from "@/lib/play-state/model";
import { projectBuildSlots, projectVisibleGraph } from "../character-context";
import { ContextCursorError, contextCursor } from "../context-shared";

function node(key: EntityKey, name: string): WorkspaceNode {
  return { key, name, kind: key.split(":")[0] as WorkspaceNode["kind"], id: key.split(":")[1]!, bu: 0,
    userId: null, description: "Raw authored rules", data: {}, versionId: null, latestVersionId: null };
}

function edge(id: string, parent: EntityKey | null, child: EntityKey, order = 0): WorkspaceEdge {
  return { id, child, parent, category: parent === null ? "MANIFEST" : "ALL", order, isMirrored: false };
}

afterEach(() => vi.useRealTimers());

describe("companion character context", () => {
  it("does not traverse a hidden ancestor even when its descendant has another visible path", () => {
    const graph: WorkspaceGraph = { characterId: "synthetic", revision: 2,
      nodes: [node("heritage:visible", "Visible"), node("capability:hidden", "Hidden"), node("primitive:1", "Public component")],
      edges: [edge("root", null, "heritage:visible"), edge("hidden-membership", "heritage:visible", "capability:hidden"),
        edge("hidden-parent", "capability:hidden", "primitive:1"), edge("direct", null, "primitive:1", 1)] };
    const visible = projectVisibleGraph(graph, new Set(["heritage:visible", "primitive:1"]));
    const projected = projectBuildSlots(visible.graph, "VIEWER");
    expect(visible.restricted).toBe(true);
    expect(projected.slots.map(slot => slot.path)).toEqual([["root"], ["direct"]]);
    expect(projected.slots.every(slot => !slot.canSelectDestination)).toBe(true);
    expect(JSON.stringify(projected)).not.toMatch(/hidden|authored rules/i);
  });

  it("omits ambiguous path IDs and bounds the number of slots", () => {
    const nodes = Array.from({ length: 42 }, (_, index) => node(`primitive:${index + 1}`, `Component ${index}`));
    const graph = { characterId: "synthetic", revision: 0, nodes, edges: nodes.map((node, index) => edge(String(index), null, node.key, index)) };
    graph.edges.push(edge("0", null, "primitive:2"));
    const visible = projectVisibleGraph(graph, new Set(nodes.map(node => node.key)));
    const projected = projectBuildSlots(visible.graph, "EDITOR");
    expect(visible.restricted).toBe(true);
    expect(projected.partial).toBe(true);
    expect(projected.slots).toHaveLength(40);
    expect(projected.slots[0]?.path).toEqual(["1"]);
  });

  it("binds a cursor to its resource, actor, purpose, character and expiry", () => {
    const actor = { id: "actor", clerkId: "user_actor" };
    const config = { resource: "https://example.test/api/mcp", cursorSecret: "fictional-character-context-signing-key" };
    const cursor = contextCursor(actor, config, "character-history", z.number(), "selected");
    vi.useFakeTimers();
    const token = cursor.sign(123)!;
    expect(cursor.parse(token)).toBe(123);
    expect(() => contextCursor({ ...actor, id: "other" }, config, "character-history", z.number(), "selected").parse(token)).toThrow(ContextCursorError);
    expect(() => contextCursor(actor, { ...config, resource: "https://other.test/api/mcp" }, "character-history", z.number(), "selected").parse(token)).toThrow(ContextCursorError);
    expect(() => contextCursor(actor, config, "character-history", z.number(), "other").parse(token)).toThrow(ContextCursorError);
    expect(() => contextCursor(actor, config, "character-roster", z.number()).parse(token)).toThrow(ContextCursorError);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(() => cursor.parse(token)).toThrow(ContextCursorError);
  });

  it("projects absent or divergent play values without changing the original row", () => {
    const empty = emptyPlayState();
    expect(projectCanonicalPlayState(empty, { currentVitality: null })).toBe(empty);
    expect(projectCanonicalPlayState(empty, { currentVitality: 7 })).toEqual({ revision: 1, overrides: { currentVitality: 7 }, fieldRevisions: { currentVitality: 1 } });
    const old = { revision: 4, overrides: { currentVitality: 3, unrelated: true }, fieldRevisions: { currentVitality: 3, unrelated: 4 } };
    expect(projectCanonicalPlayState(old, { currentVitality: null })).toEqual({ revision: 5, overrides: { unrelated: true }, fieldRevisions: { currentVitality: 5, unrelated: 4 } });
    expect(old.overrides.currentVitality).toBe(3);
  });
});
