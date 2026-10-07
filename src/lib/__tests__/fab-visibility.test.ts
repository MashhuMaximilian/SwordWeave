import { describe, expect, it } from "vitest";
import { fabCreationMode, fabWorkspaceVisibility } from "../fab-visibility";

describe("FAB workspace availability", () => {
  it("keeps desktop Atelier workspaces and hides split", () => {
    expect(fabWorkspaceVisibility("/atelier", false)).toEqual({split:false,build:true,character:true,characterSheet:false});
  });
  it("allows split in mobile Atelier", () => {
    expect(fabWorkspaceVisibility("/atelier", true).split).toBe(true);
  });
  it("hides workspace shortcuts on character sheets", () => {
    expect(fabWorkspaceVisibility("/characters/123", true)).toEqual({split:false,build:false,character:false,characterSheet:true});
    expect(fabWorkspaceVisibility("/characters/123", true, true).build).toBe(false);
  });
  it.each(["/", "/library/browse", "/library/collections", "/monsters/123", "/characters/new", "/characters", "/creations", "/collections"]) ("hides contextual workspaces on %s", path => {
    expect(fabWorkspaceVisibility(path, true)).toEqual({split:false,build:false,character:false,characterSheet:false});
  });
});

describe("FAB creation shortcuts", () => {
  it("uses the compact menu in Atelier", () => expect(fabCreationMode("/atelier")).toBe("menu"));
  it.each(["/", "/library", "/library/browse", "/rules"])("offers separate creation shortcuts on %s", path => expect(fabCreationMode(path)).toBe("buttons"));
  it.each(["/creations", "/collections", "/library/collections", "/characters/123", "/characters", "/monsters", "/monsters/123"])("hides creation shortcuts on %s", path => expect(fabCreationMode(path)).toBe("none"));
});
