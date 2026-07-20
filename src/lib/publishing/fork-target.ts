// Maps an entity targetType (from LikeForkBar etc.) to the sandbox
// route + build-mode + URL suffix that the Fork button should navigate
// to. Clicking Fork now just navigates; the actual fork is created
// at save time via dispatch-save.ts.
//
// The unified sandbox lives at /atelier (formerly /sandbox/atelier, and
// before that the per-type /sandbox/grammar + /sandbox/blueprint routes).
// The route is always "/atelier"; the ?build=<kind> query selects the
// form, so this helper only emits that single host route.
//
// Example outputs (for targetType="PRIMITIVE", targetId="13"):
//   { sandboxPath: "/atelier", build: "primitive", search: "?build=primitive&edit=13&intent=fork" }

import type { SaveIntent } from "./save-intent";

export type SandboxPath = "/atelier";

export interface ForkTarget {
  sandboxPath: SandboxPath;
  build: string;
  search: string;
}

/**
 * Convert a targetType string (PRIMITIVE / EFFECT / CAPABILITY /
 * ITEM / LINEAGE_TEMPLATE / etc.) into the sandbox URL pieces the Fork
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
  let build: string;
  let kind: string | undefined;
  switch (targetType) {
    case "PRIMITIVE":
      build = "primitive";
      break;
    case "EFFECT":
      build = "effect";
      break;
    case "CAPABILITY":
      build = "capability";
      break;
    case "ITEM":
      build = "item";
      break;
    case "LINEAGE_TEMPLATE":
      build = "heritage";
      kind = "lineage";
      break;
    case "UPBRINGING_TEMPLATE":
      build = "heritage";
      kind = "upbringing";
      break;
    case "MANIFEST_TEMPLATE":
      build = "heritage";
      kind = "manifest";
      break;
    case "CHARACTER":
    case "BUILD":
    case "BUILD_TEMPLATE":
      // Characters + builds are not fork-able in Phase 1. Return null
      // so the Fork button can decide whether to hide itself, disable
      // itself, or show a "coming soon" toast. The original POST
      // /api/fork handler still rejects these — defensive code stays
      // intact for the (transitional) case where this helper is bypassed.
      return null;
    default:
      return null;
  }
  return {
    sandboxPath: "/atelier",
    build,
    search: buildSearch({ build, edit: targetId, intent, ...(kind ? { kind } : {}) }),
  };
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