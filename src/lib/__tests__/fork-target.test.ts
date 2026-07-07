// =============================================================================
// fork-target.test — covers the targetType → sandbox URL mapping for
// Phase 1's Fork button. The Fork button no longer POSTs /api/fork;
// it navigates to the sandbox with intent=fork. dispatch-save.ts
// materializes the fork at save time.
// =============================================================================

import { describe, expect, it } from "vitest";
import { buildSandboxUrl } from "../publishing/fork-target";

describe("buildSandboxUrl — entity types", () => {
  it("PRIMITIVE → /sandbox/grammar?build=primitive&edit=<id>&intent=fork", () => {
    const url = buildSandboxUrl("PRIMITIVE", "13");
    expect(url).toEqual({
      sandboxPath: "/sandbox/grammar",
      build: "primitive",
      search: "?build=primitive&edit=13&intent=fork",
    });
  });

  it("EFFECT → /sandbox/grammar?build=effect", () => {
    const url = buildSandboxUrl("EFFECT", "abc");
    expect(url?.sandboxPath).toBe("/sandbox/grammar");
    expect(url?.build).toBe("effect");
    expect(url?.search).toContain("build=effect");
    expect(url?.search).toContain("edit=abc");
    expect(url?.search).toContain("intent=fork");
  });

  it("CAPABILITY → /sandbox/grammar?build=capability", () => {
    const url = buildSandboxUrl("CAPABILITY", "cap-1");
    expect(url?.build).toBe("capability");
    expect(url?.search).toContain("build=capability");
    expect(url?.search).toContain("edit=cap-1");
  });

  it("ITEM → /sandbox/blueprint?build=item", () => {
    const url = buildSandboxUrl("ITEM", "item-1");
    expect(url?.sandboxPath).toBe("/sandbox/blueprint");
    expect(url?.build).toBe("item");
    expect(url?.search).toContain("build=item");
  });

  it("RACE_TEMPLATE → /sandbox/blueprint?build=template&kind=RACE", () => {
    const url = buildSandboxUrl("RACE_TEMPLATE", "tpl-1");
    expect(url?.build).toBe("template");
    expect(url?.search).toContain("kind=RACE");
    expect(url?.search).toContain("edit=tpl-1");
  });

  it("BACKGROUND_TEMPLATE → kind=BACKGROUND", () => {
    const url = buildSandboxUrl("BACKGROUND_TEMPLATE", "tpl-2");
    expect(url?.search).toContain("kind=BACKGROUND");
  });

  it("ARCHETYPE_TEMPLATE → kind=ARCHETYPE", () => {
    const url = buildSandboxUrl("ARCHETYPE_TEMPLATE", "tpl-3");
    expect(url?.search).toContain("kind=ARCHETYPE");
  });

  it("CHARACTER → null (not fork-able)", () => {
    expect(buildSandboxUrl("CHARACTER", "char-1")).toBeNull();
  });

  it("BUILD → null (not fork-able)", () => {
    expect(buildSandboxUrl("BUILD", "build-1")).toBeNull();
  });

  it("unknown → null", () => {
    expect(buildSandboxUrl("UNKNOWN", "x")).toBeNull();
  });
});

describe("buildSandboxUrl — intent variants", () => {
  it("explicit intent=load produces intent=load in URL", () => {
    const url = buildSandboxUrl("PRIMITIVE", "13", "load");
    expect(url?.search).toContain("intent=load");
    expect(url?.search).not.toContain("intent=fork");
  });

  it("intent=null omits the intent param", () => {
    const url = buildSandboxUrl("PRIMITIVE", "13", null);
    expect(url?.search).not.toContain("intent=");
  });
});

describe("buildSandboxUrl — composability", () => {
  it("sandboxPath + search yields a valid Next.js URL", () => {
    const url = buildSandboxUrl("PRIMITIVE", "13");
    expect(url).not.toBeNull();
    const full = `${url!.sandboxPath}${url!.search}`;
    expect(full).toBe("/sandbox/grammar?build=primitive&edit=13&intent=fork");
  });
});