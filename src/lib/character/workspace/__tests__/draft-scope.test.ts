import { describe, expect, it } from "vitest";
import { withDraftExecution, isAuthorizedDraftExecution, shouldIsolateDraftEntity, markDraftAuthoredEntity } from "../draft-scope";
describe("character-local draft authoring", () => {
  it("forks existing definitions once, then edits only the new local definition", async () => {
    await withDraftExecution("character-a", "editor", async () => {
      expect(shouldIsolateDraftEntity("effect:original")).toBe(true);
      markDraftAuthoredEntity("effect:private-copy");
      expect(shouldIsolateDraftEntity("effect:private-copy")).toBe(false);
      expect(shouldIsolateDraftEntity("effect:original")).toBe(true);
    });
    expect(isAuthorizedDraftExecution("character-a", "editor")).toBe(false);
  });
  it("never grants its internal write scope to another character or actor", async () => {
    await withDraftExecution("character-a", "editor", async () => {
      expect(isAuthorizedDraftExecution("character-a", "editor")).toBe(true);
      expect(isAuthorizedDraftExecution("character-b", "editor")).toBe(false);
      expect(isAuthorizedDraftExecution("character-a", "viewer")).toBe(false);
    });
  });
  it("does not leak authored identities into a later replay", async () => {
    await withDraftExecution("a", "editor", async () => markDraftAuthoredEntity("effect:1"));
    await withDraftExecution("a", "editor", async () => expect(shouldIsolateDraftEntity("effect:1")).toBe(true));
  });
});
