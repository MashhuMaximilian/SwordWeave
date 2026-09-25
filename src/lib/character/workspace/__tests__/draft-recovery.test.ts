import { describe, expect, it } from "vitest";
import { compareDraftRecovery, draftRecoveryKey, parseDraftRecovery, sameDraftRecovery, type DraftRecoveryJournal } from "../draft-recovery";
import type { WorkspaceDraft } from "../draft-types";

const operation = { id: "op-one", type: "character" as const, payload: { name: "Bartholomew" } };
const journal: DraftRecoveryJournal = { schema: 1, authorId: "owner", characterId: "character", savedAt: "2026-09-25T10:00:00Z", request: { draftId: "draft-one", expectedVersion: 2, baseRevision: 4, operations: [operation] } };
const server: WorkspaceDraft = { id: "draft-one", authorId: "owner", baseRevision: 4, version: 2, status: "editing", operations: [], updatedAt: journal.savedAt };

describe("draft recovery journal", () => {
  it("recovers only the account and character encoded in the journal", () => {
    expect(parseDraftRecovery(JSON.stringify(journal), "owner", "character")).toEqual(journal);
    expect(parseDraftRecovery(JSON.stringify(journal), "someone-else", "character")).toBeNull();
    expect(parseDraftRecovery(JSON.stringify(journal), "owner", "other-character")).toBeNull();
    expect(draftRecoveryKey("a:b", "c")).not.toBe(draftRecoveryKey("a", "b:c"));
  });
  it("does not clear a different tab's recovery with the same timestamp", () => {
    expect(sameDraftRecovery(journal, structuredClone(journal))).toBe(true);
    expect(sameDraftRecovery(journal, { ...journal, request: { ...journal.request, operations: [{ ...operation, payload: { name: "Another tab" } }] } })).toBe(false);
  });
  it("ignores corrupt and incomplete recovery payloads", () => {
    expect(parseDraftRecovery("{", "owner", "character")).toBeNull();
    expect(parseDraftRecovery(JSON.stringify({ ...journal, request: { ...journal.request, operations: null } }), "owner", "character")).toBeNull();
    expect(parseDraftRecovery(JSON.stringify({ ...journal, request: { ...journal.request, expectedVersion: -1 } }), "owner", "character")).toBeNull();
  });
  it("recognizes a successful save whose response was lost using the complete payload", () => {
    expect(compareDraftRecovery(journal, { ...server, version: 3, operations: [{ payload: { name: "Bartholomew" }, type: "character", id: "op-one" }] }, 4).status).toBe("saved");
    expect(compareDraftRecovery(journal, { ...server, version: 3, operations: [{ ...operation, payload: { name: "Different edit" } }] }, 4).status).toBe("conflict");
  });
  it("permits a retry only against the same version and character base", () => {
    expect(compareDraftRecovery(journal, server, 4).status).toBe("recoverable");
    expect(compareDraftRecovery(journal, { ...server, version: 3 }, 4).status).toBe("conflict");
    expect(compareDraftRecovery(journal, { ...server, id: "replacement" }, 4).status).toBe("conflict");
    expect(compareDraftRecovery(journal, server, 5).status).toBe("conflict");
    expect(compareDraftRecovery(journal, null, 4).status).toBe("conflict");
  });
  it("recognizes an uncertain first save without creating a second draft", () => {
    const first = { ...journal, request: { expectedVersion: 0, baseRevision: 4, operations: [operation] } };
    expect(compareDraftRecovery(first, null, 4).status).toBe("recoverable");
    expect(compareDraftRecovery(first, { ...server, id: "server-created-id", version: 1, operations: [operation] }, 4).status).toBe("saved");
    expect(compareDraftRecovery(first, server, 4).status).toBe("conflict");
  });
  it("never overwrites another author, an applied draft, or reordered operations", () => {
    expect(compareDraftRecovery(journal, { ...server, authorId: "other" }, 4).status).toBe("conflict");
    expect(compareDraftRecovery(journal, { ...server, status: "applied" }, 4).status).toBe("conflict");
    const next = { ...operation, id: "op-two", payload: { name: "Vey" } };
    expect(compareDraftRecovery({ ...journal, request: { ...journal.request, operations: [operation, next] } }, { ...server, version: 3, operations: [next, operation] }, 4).status).toBe("conflict");
  });
});
