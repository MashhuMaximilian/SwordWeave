// =============================================================================
// fork-target — Phase 1 of the edit-creates-fork refactor (§11 of
// docs/architecture/edit-creates-fork.md).
//
// Maps an entity targetType (from LikeForkBar etc.) to the sandbox
// route + build-mode + URL suffix that the Fork button should navigate
// to. Clicking Fork now just navigates; the actual fork is created
// at save time via dispatch-save.ts.
//
// Example outputs (for targetType="PRIMITIVE", targetId="13"):
//   { sandboxPath: "/sandbox/grammar", build: "primitive", search: "?build=primitive&edit=13&intent=fork" }
// =============================================================================

import type { SaveIntent } from "./save-intent";

export type SandboxPath =
  | "/sandbox/grammar"
  | "/sandbox/blueprint"
  // characters/builds sandboxes are read-only for Phase 1 — Fork
  // doesn't apply to them (you can't fork a character). The shape
  // is reserved for future expansion.
  | "/sandbox/characters"
  | "/sandbox/builds";

export interface ForkTarget {
  sandboxPath: SandboxPath;
  build: string;
  search: string;
}

/**
 * Convert a targetType string (PRIMITIVE / EFFECT / CAPABILITY /
 * ITEM / RACE_TEMPLATE / etc.) into the sandbox URL pieces the Fork
 * button should navigate to. Returns null when the target isn't
 * fork-able (characters, builds — reserved).
 *
 * `intent` defaults to "fork" since this helper is specifically for
 * the Fork button; pass "load" to use the same mapping for the
 * "Load into build" entry points.
 */
export function buildSandboxUrl(
  targetType: string,
  targetId: string,
  intent: SaveIntent = "fork",
): ForkTarget | null {
  switch (targetType) {
    case "PRIMITIVE":
      return {
        sandboxPath: "/sandbox/grammar",
        build: "primitive",
        search: buildSearch({ build: "primitive", edit: targetId, intent }),
      };
    case "EFFECT":
      return {
        sandboxPath: "/sandbox/grammar",
        build: "effect",
        search: buildSearch({ build: "effect", edit: targetId, intent }),
      };
    case "CAPABILITY":
      return {
        sandboxPath: "/sandbox/grammar",
        build: "capability",
        search: buildSearch({ build: "capability", edit: targetId, intent }),
      };
    case "ITEM":
      return {
        sandboxPath: "/sandbox/blueprint",
        build: "item",
        search: buildSearch({ build: "item", edit: targetId, intent }),
      };
    case "RACE_TEMPLATE":
      return {
        sandboxPath: "/sandbox/blueprint",
        build: "template",
        search: buildSearch({
          build: "template",
          kind: "RACE",
          edit: targetId,
          intent,
        }),
      };
    case "BACKGROUND_TEMPLATE":
      return {
        sandboxPath: "/sandbox/blueprint",
        build: "template",
        search: buildSearch({
          build: "template",
          kind: "BACKGROUND",
          edit: targetId,
          intent,
        }),
      };
    case "ARCHETYPE_TEMPLATE":
      return {
        sandboxPath: "/sandbox/blueprint",
        build: "template",
        search: buildSearch({
          build: "template",
          kind: "ARCHETYPE",
          edit: targetId,
          intent,
        }),
      };
    case "CHARACTER":
    case "BUILD":
      // Characters + builds are not fork-able in Phase 1. Return null
      // so the Fork button can decide whether to hide itself, disable
      // itself, or show a "coming soon" toast. The original POST
      // /api/fork handler still rejects these — defensive code stays
      // intact for the (transitional) case where this helper is bypassed.
      return null;
    default:
      return null;
  }
}

function buildSearch(params: {
  build: string;
  edit: string;
  intent: SaveIntent;
  kind?: string;
}): string {
  const usp = new URLSearchParams();
  usp.set("build", params.build);
  if (params.kind) usp.set("kind", params.kind);
  usp.set("edit", params.edit);
  if (params.intent) usp.set("intent", params.intent);
  return `?${usp.toString()}`;
}