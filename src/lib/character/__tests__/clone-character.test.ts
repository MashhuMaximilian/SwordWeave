import { beforeEach, describe, expect, it, vi } from "vitest";
import { characters, characterPrimitives, characterCapabilities, characterHeritages, characterItems, characterEffects } from "@/db/schema";
import { cloneCharacter } from "../clone-character";

const mocks = vi.hoisted(() => ({ source: vi.fn(), publication: vi.fn(), access: vi.fn(), transaction: vi.fn(), effects: vi.fn() }));
vi.mock("@/db/client", () => ({ db: {
  query: { characters: { findFirst: mocks.source }, publications: { findFirst: mocks.publication } },
  transaction: mocks.transaction,
  select: () => ({ from: () => ({ where: mocks.effects }) }),
} }));
vi.mock("../can-resolve-character", () => ({ canResolveCharacterForPage: mocks.access }));

const original = {
  id: "source", userId: "other", name: "Astral Scout", isPublic: false, notes: "Private notes", dmNotes: "Secret",
  level: 10, size: "SMALL", attrMental: 5, portraitUrl: "/images/scout.webp", portraitFrame: { x: 50, y: 35, zoom: 1 },
  primitiveLinks: [{ primitiveId: 42, source: "MANIFEST", directSource: "MANIFEST", isMirrored: true, versionId: "old-pin", slotSource: "PINNED", originHeritageId: "heritage", acquiredAtLevel: 4 }],
  capabilityLinks: [{ capabilityId: "cap", versionId: "old-cap", slotTab: "MANIFEST", acquiredAtLevel: 3 }],
  heritageLinks: [{ heritageId: "heritage", versionId: "old-heritage", isMirrored: false, slotSource: "PINNED" }],
  itemLinks: [{ itemId: "item", versionId: "old-item", slotSource: "PINNED", quantity: 2, equipped: true }],
};
let inserted: Map<unknown, unknown>;
beforeEach(() => {
  vi.clearAllMocks(); inserted = new Map();
  mocks.source.mockResolvedValue(original);
  mocks.publication.mockResolvedValue({ visibility: "PUBLIC", unpublishedAt: null });
  mocks.access.mockResolvedValue(null);
  mocks.effects.mockResolvedValue([{ effectId: "standalone", category: "LINEAGE", versionId: "old-effect", slotSource: "PINNED" }]);
  mocks.transaction.mockImplementation(async (fn) => fn({
    insert: (table: unknown) => ({ values: (value: unknown) => {
      inserted.set(table, value);
      return { returning: async () => [{ id: "private-copy" }], then: (done: (v: unknown[]) => void) => done([]) };
    } }),
    query: { characters: { findFirst: async () => ({ id: "private-copy", ...inserted.get(characters) as object }) } },
  }));
});

describe("fork a character for play", () => {
  it("makes a private owned copy of an explicitly published character with its saved build intact", async () => {
    const result = await cloneCharacter("source", "new-owner");
    expect(result).toMatchObject({ id: "private-copy", userId: "new-owner", isPublic: false, dmNotes: null, notes: null, level: 10, portraitUrl: original.portraitUrl });
    expect(inserted.get(characterPrimitives)).toEqual([expect.objectContaining({ characterId: "private-copy", primitiveId: 42, isMirrored: true, versionId: "old-pin", directSource: "MANIFEST" })]);
    expect(inserted.get(characterCapabilities)).toEqual([expect.objectContaining({ characterId: "private-copy", versionId: "old-cap", slotTab: "MANIFEST" })]);
    expect(inserted.get(characterHeritages)).toEqual([expect.objectContaining({ characterId: "private-copy", versionId: "old-heritage" })]);
    expect(inserted.get(characterItems)).toEqual([expect.objectContaining({ characterId: "private-copy", versionId: "old-item", quantity: 2, equipped: true })]);
    expect(inserted.get(characterEffects)).toEqual([expect.objectContaining({ characterId: "private-copy", versionId: "old-effect", effectId: "standalone" })]);
    expect(original.userId).toBe("other");
  });
  it.each(["PRIVATE", "FOLLOWERS_ONLY"])("does not fork a %s character without a grant", async visibility => {
    mocks.publication.mockResolvedValue({ visibility, unpublishedAt: null });
    expect(await cloneCharacter("source", "stranger")).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not fork an unpublished character despite the legacy flag", async () => {
    mocks.source.mockResolvedValue({ ...original, isPublic: true });
    mocks.publication.mockResolvedValue({ visibility: "PUBLIC", unpublishedAt: new Date() });
    expect(await cloneCharacter("source", "stranger")).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps the normal owner/shared clone flow and owner notes", async () => {
    mocks.access.mockResolvedValue({ permission: "OWNER" });
    mocks.publication.mockResolvedValue(null);
    expect(await cloneCharacter("source", "owner")).toMatchObject({ userId: "owner", notes: original.notes, dmNotes: null });
  });
});
