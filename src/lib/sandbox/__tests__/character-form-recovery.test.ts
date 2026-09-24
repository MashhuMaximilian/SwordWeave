import { describe, expect, it } from "vitest";
import { characterFormRecoveryKey, decodeCharacterFormRecovery } from "../character-form-recovery";

describe("character authoring recovery", () => {
  const shape = { form: { name: "" }, slots: [] as { id: number; isMirrored: boolean; quantity: number; notes: string }[], orderChanged: false };
  it("recovers authored text and all slot details, not only source IDs", () => {
    const state = { form: { name: "An unfinished ward" }, slots: [{ id: 18, isMirrored: true, quantity: 3, notes: "Only while concentrating" }], orderChanged: true };
    expect(decodeCharacterFormRecovery(JSON.stringify({ version: 1, state }), shape)).toEqual(state);
  });
  it("rejects corrupt, obsolete, and incomplete recovery instead of blanking a form", () => {
    for (const raw of [null, "not json", JSON.stringify({ version: 0, state: shape }), JSON.stringify({version:1,state:{form:null,slots:[],orderChanged:false}}), JSON.stringify({version:1,state:{form:{},orderChanged:false}})]) {
      expect(decodeCharacterFormRecovery(raw, shape)).toBeNull();
    }
  });
  it("separates characters, destinations/editor sessions, and form types", () => {
    const keys = [characterFormRecoveryKey("character:a:manifest-new", "primitive"), characterFormRecoveryKey("character:b:manifest-new", "primitive"), characterFormRecoveryKey("character:a:lineage-new", "primitive"), characterFormRecoveryKey("character:a:manifest-new", "capability")];
    expect(new Set(keys).size).toBe(4);
  });
});
