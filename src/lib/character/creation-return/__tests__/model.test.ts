import { describe, it, expect } from "vitest";
import {
  availableLegacyCreationDrafts,
  claimLegacyCreationDraft,
  createCreationReturn,
  readCreationReturn,
  setCreationReturnResult,
  consumeCreationReturn,
  creationDraftKey,
  writeCreationDraft,
  type CreationReturnRecord,
} from "../model";
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  } satisfies Storage;
}
const token = "11111111-1111-4111-8111-111111111111",
  draftId = "22222222-2222-4222-8222-222222222222";
const record = (): CreationReturnRecord => ({
  token,
  draftId,
  accountId: "owner",
  mode: "quick",
  kind: "heritage",
  heritageKind: "MANIFEST",
  createdAt: Date.now(),
});
describe("character creation authoring return", () => {
  it("keeps existing draft fields under the same account and draft identity before opening Atelier", () => {
    const store = storage();
    const key = creationDraftKey("owner", "quick");
    const value = JSON.stringify({
      draftId,
      state: { name: "Vex", backstory: { origin: "Born by the sea" } },
      selection: { LINEAGE: "lineage" },
      itemIds: ["item"],
      step: "foundation",
    });
    writeCreationDraft(store, key, draftId, value);
    const url = createCreationReturn(store, record());
    expect(store.getItem(key)).toBe(value);
    expect(store.getItem(`${key}:${draftId}`)).toBe(value);
    expect(url).toContain("build=heritage");
    expect(url).toContain("kind=manifest");
    expect(url).toContain(`creationReturn=${token}`);
  });
  it("does not recover another account's mode, entry, or return token", () => {
    const store = storage();
    createCreationReturn(store, record());
    setCreationReturnResult(store, token, "owner", {
      targetType: "MANIFEST_TEMPLATE",
      targetId: "new-id",
      name: "New manifest",
    });
    expect(readCreationReturn(store, token, "other")).toBeNull();
    expect(() =>
      setCreationReturnResult(store, token, "other", {
        targetType: "ITEM",
        targetId: "bad",
        name: "bad",
      }),
    ).toThrow();
    expect(creationDraftKey("owner", "quick")).not.toBe(
      creationDraftKey("other", "quick"),
    );
  });
  it("keeps mode and draft identity on return, storing only the saved reference", () => {
    const store = storage();
    createCreationReturn(store, record());
    setCreationReturnResult(store, token, "owner", {
      targetType: "MANIFEST_TEMPLATE",
      targetId: "new-id",
      name: "New manifest",
    });
    const result = readCreationReturn(store, token, "owner");
    expect(result?.mode).toBe("quick");
    expect(result?.draftId).toBe(draftId);
    expect(result?.result).toEqual({
      targetType: "MANIFEST_TEMPLATE",
      targetId: "new-id",
      name: "New manifest",
    });
    expect(result).not.toHaveProperty("definition");
    expect(result).not.toHaveProperty("draft");
  });
  it("preserves multiple character drafts without merging their identities", () => {
    const store = storage();
    const key = creationDraftKey("owner", "complete");
    writeCreationDraft(store, key, draftId, "first draft");
    writeCreationDraft(store, key, token, "second draft");
    expect(store.getItem(`${key}:${draftId}`)).toBe("first draft");
    expect(store.getItem(`${key}:${token}`)).toBe("second draft");
  });
  it("ignores stale and malformed return records", () => {
    const store = storage();
    createCreationReturn(store, {
      ...record(),
      createdAt: Date.now() - 8 * 86400000,
    });
    expect(readCreationReturn(store, token, "owner")).toBeNull();
    expect(
      readCreationReturn(store, "../../other-account", "owner"),
    ).toBeNull();
  });
  it("consumes only the current account's token after selection is merged", () => {
    const store = storage();
    createCreationReturn(store, record());
    consumeCreationReturn(store, token, "other");
    expect(readCreationReturn(store, token, "owner")).not.toBeNull();
    consumeCreationReturn(store, token, "owner");
    expect(readCreationReturn(store, token, "owner")).toBeNull();
  });
});

describe("explicit legacy draft claim", () => {
  it("offers legacy drafts without importing or deleting them", () => {
    const store = storage();
    const original = JSON.stringify({
      state: { name: "Older" },
      step: "foundation",
    });
    store.setItem("swordweave-character-creation-v3", original);
    expect(availableLegacyCreationDrafts(store)).toEqual(["complete"]);
    expect(store.getItem(creationDraftKey("owner", "complete"))).toBeNull();
    claimLegacyCreationDraft(store, "owner", "complete", draftId);
    expect(
      JSON.parse(store.getItem(creationDraftKey("owner", "complete"))!),
    ).toMatchObject({ draftId, step: "foundation", state: { name: "Older" } });
    expect(store.getItem("swordweave-character-creation-v3")).toBe(original);
    expect(availableLegacyCreationDrafts(store)).toEqual([]);
    expect(() =>
      claimLegacyCreationDraft(store, "other", "complete", token),
    ).toThrow();
    expect(store.getItem(creationDraftKey("other", "complete"))).toBeNull();
  });
});
