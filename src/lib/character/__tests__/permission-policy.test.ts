import { describe, expect, it } from "vitest";
import { meetsCharacterPermission, permissionFromShare, type CharacterPermission } from "../permission-policy";
describe("character collaboration permissions", () => {
  const roles: CharacterPermission[] = ["VIEWER", "SUGGESTER", "EDITOR", "OWNER"];
  it.each(roles)("%s can read the character", role => expect(meetsCharacterPermission(role, "VIEWER")).toBe(true));
  it.each(["VIEWER", "SUGGESTER"] as const)("%s cannot apply changes", role => expect(meetsCharacterPermission(role, "EDITOR")).toBe(false));
  it.each(["VIEWER", "SUGGESTER", "EDITOR"] as const)("%s cannot manage sharing or approve proposals", role => expect(meetsCharacterPermission(role, "OWNER")).toBe(false));
  it("suggesters may submit a draft without edit permission", () => expect(meetsCharacterPermission("SUGGESTER", "SUGGESTER")).toBe(true));
  it("preserves existing grants", () => { expect(permissionFromShare(false, false)).toBe("VIEWER"); expect(permissionFromShare(true, false)).toBe("EDITOR"); });
  it("grants suggestion access only explicitly", () => { expect(permissionFromShare(false, true)).toBe("SUGGESTER"); expect(permissionFromShare(true, true)).toBe("EDITOR"); });
});
