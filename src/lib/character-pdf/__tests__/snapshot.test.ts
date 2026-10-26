import { beforeEach, describe, expect, it, vi } from "vitest";
import source from "../../../../docs/publications/character-sheets/orren-public-source.json";
import type { WorkspaceGraph, WorkspaceNode } from "@/lib/character/workspace/model";
import { aggregateRosterSheet } from "@/lib/character/roster-sheet";
import type { CharacterSheetInput } from "@/lib/engine/sheet";

const mocks = vi.hoisted(() => ({ access: vi.fn(), row: vi.fn(), publication: vi.fn(), visibility: vi.fn(), graph: vi.fn(), sheet: vi.fn(), pins: vi.fn(), conditions: vi.fn(), nodes: vi.fn() }));
vi.mock("@/db/client", () => ({ db: {
  query: { characters: { findFirst: mocks.row }, publications: { findFirst: mocks.publication } },
  select: () => ({ from: () => ({ where: mocks.conditions }) }),
} }));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: mocks.access }));
vi.mock("@/lib/character/workspace/read", () => ({ readWorkspace: mocks.graph }));
vi.mock("@/lib/character/workspace/draft-sheet", () => ({ readDraftSheet: mocks.sheet }));
vi.mock("@/lib/character/workspace/effective-primitives", () => ({ effectivePrimitiveLinks: mocks.pins }));
vi.mock("@/lib/character/workspace/load-nodes", () => ({ loadWorkspaceNodes: mocks.nodes }));
vi.mock("@/lib/publishing/visibility", () => ({ checkVisibility: mocks.visibility }));
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { characterPdfRuleText, createCharacterPdfSnapshot, loadCharacterPdfSnapshot, type CharacterPdfSource } from "../snapshot";

const character = source.character as unknown as CharacterPdfSource;
const graph = source.character.readOnlyGraph as unknown as WorkspaceGraph;
const sheet = aggregateRosterSheet({ ...character, practiceSlices: {}, conditionContext: undefined } as unknown as CharacterSheetInput);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ permission: "OWNER" });
  mocks.row.mockResolvedValue(character);
  mocks.publication.mockResolvedValue(null);
  mocks.visibility.mockResolvedValue({ allowed: false });
  mocks.graph.mockResolvedValue(graph);
  mocks.sheet.mockResolvedValue(sheet);
  mocks.pins.mockImplementation(async links => links);
  mocks.conditions.mockResolvedValue([]);
  mocks.nodes.mockResolvedValue(new Map());
});

describe("character PDF snapshot", () => {
  it("derives actual modifiers and controls without example-character constants", () => {
    const changedSheet = { ...sheet, attributes: { physical: -2, mental: 7, magical: 9 }, dc: 23,
      proficiencyBonus: 6, vitality: { ...sheet.vitality, max: 331 }, speedByType: { WALKING_SPEED: 45, FLYING_SPEED: 90 },
      encumbrance: { ...sheet.encumbrance, equipSlotsUsed: 9, load: 44 } };
    const snapshot = createCharacterPdfSnapshot({ ...character, name: "Another character", level: 23 }, graph, changedSheet, "OWNER");
    expect(snapshot.name).toBe("Another character");
    expect(snapshot.pdfDerived).toMatchObject({ attributes: { physical: -2, mental: 7, magical: 9 }, dc: 23, pb: 6,
      movement: { walk: 45, fly: 90, climb: 0 }, restCap: 166, equippedSlotsUsed: 9, currentLoad: 44 });
    expect(snapshot.conditionContext.character.attributes).toEqual(changedSheet.attributes);
    expect(snapshot.pdfDerived.rollMarkers).toEqual(changedSheet.rollMarkers ?? {});
    expect(snapshot.primitiveLinks).toHaveLength(character.primitiveLinks.length);
  });

  it("retains actual repeated purchases, pins and mirrored wording while references do not duplicate acquisitions", () => {
    const primitive = { id: 1, name: "Lift", mechanicalOutputText: "Add 2 to Physical.", narrativeRule: "A lifted burden.",
      hardModifiers: [{ kind: "modify", target: "physical", operation: "add", value: 2 }] };
    const repeated = [{ instanceId: "a", primitiveId: 1, versionId: "old", isMirrored: false, primitive },
      { instanceId: "b", primitiveId: 1, versionId: "new", isMirrored: true, primitive: { ...primitive, mechanicalOutputText: "Add 4 to Physical.", hardModifiers: [{ kind: "modify", target: "physical", operation: "add", value: 4 }] } }];
    const snapshot = createCharacterPdfSnapshot({ ...character, primitiveLinks: repeated }, graph, sheet, "OWNER");
    expect(snapshot.primitiveLinks).toHaveLength(2);
    expect(snapshot.primitiveLinks.map(link => link.instanceId)).toEqual(["a", "b"]);
    expect(snapshot.primitiveLinks.map(link => link["versionId"])).toEqual(["old", "new"]);
    expect(snapshot.primitiveLinks[1]?.primitive.mechanicalOutputText).toBe(characterPdfRuleText(repeated[1]!.primitive, true));
    expect(snapshot.primitiveLinks[1]?.primitive.mechanicalOutputText).toContain("4");
    expect(snapshot.primitiveLinks[1]?.primitive.originalMechanicalOutputText).toBe("Add 4 to Physical.");
  });

  it("hydrates full item-only capability/effect/primitive rules without placing them in the character ledger", () => {
    const snapshot = createCharacterPdfSnapshot(character, graph, sheet, "OWNER");
    expect(snapshot.itemLinks).toHaveLength(4);
    const doorbrace = snapshot.itemLinks.find(link => link["itemId"] === "ff07d22e-d299-4803-8ff5-97fdb60ed55c")!;
    expect(JSON.stringify(doorbrace)).toContain("Doorway Brace");
    expect(JSON.stringify(doorbrace)).toContain("Physical save");
    const itemOnlyIds = new Set(graph.edges.filter(edge => edge.parent?.startsWith("item:") && edge.child.startsWith("primitive:")).map(edge => Number(edge.child.slice(10))));
    expect(snapshot.primitiveLinks.map(link => link.primitiveId)).toEqual(character.primitiveLinks.map(link => link.primitiveId));
    for (const id of itemOnlyIds) expect(snapshot.primitiveLinks.some(link => link.primitiveId === id)).toBe(character.primitiveLinks.some(link => link.primitiveId === id));
  });

  it("never leaks private DM notes, including nested historical JSON, and limits personal notes to editors", () => {
    const privateGraph = structuredClone(graph);
    privateGraph.nodes[0]!.data["dmNotes"] = "nested secret";
    privateGraph.nodes[0]!.data["history"] = { dm_notes: "historical secret" };
    const row = { ...character, dmNotes: "private secret", notes: "personal notes" };
    const viewer = createCharacterPdfSnapshot(row, privateGraph, sheet, "VIEWER");
    expect(viewer.dmNotes).toBeNull();
    expect(viewer.notes).toBeNull();
    expect(JSON.stringify(viewer)).not.toContain("secret");
    expect(createCharacterPdfSnapshot(row, graph, sheet, "OWNER").notes).toBe("personal notes");
  });

  it("does not mislabel an item capability's effects as independent character effects", () => {
    const effect: WorkspaceNode = { key: "effect:item-only", kind: "effect", id: "item-only", name: "Only from wand", bu: 0,
      versionId: null, latestVersionId: null, userId: null, description: "Wand effect", data: {} };
    const cap: WorkspaceNode = { ...effect, key: "capability:wand", kind: "capability", id: "wand" };
    const isolated: WorkspaceGraph = { characterId: character.id, revision: 1,
      nodes: [{ ...effect, key: "item:wand", kind: "item", id: "wand" }, cap, effect], edges: [
        { id: "root", parent: null, child: "item:wand", category: "ITEM", order: 0, isMirrored: false },
        { id: "cap", parent: "item:wand", child: cap.key, category: "ITEM", order: 0, isMirrored: false },
        { id: "effect", parent: cap.key, child: effect.key, category: "ALL", order: 0, isMirrored: false },
      ] };
    const snapshot = createCharacterPdfSnapshot({ ...character, capabilityLinks: [], heritageLinks: [], itemLinks: [{ itemId: "wand" }] }, isolated, sheet, "OWNER");
    expect(snapshot.effectLinks).toEqual([]);
    expect(JSON.stringify(snapshot.itemLinks)).toContain("Wand effect");
  });

  it("uses canonical equipment quantity, two-hand slots and tiny-pouch load", () => {
    const itemNode: WorkspaceNode = { key: "item:gear", kind: "item", id: "gear", name: "Gear", bu: 3,
      versionId: null, latestVersionId: null, userId: null, description: "", data: { size: "LARGE", slotCost: 1, isTwoHanded: true } };
    const inventory: WorkspaceGraph = { characterId: character.id, revision: 1, nodes: [itemNode], edges: [] };
    const row = { ...character, primitiveLinks: [], capabilityLinks: [], heritageLinks: [], itemLinks: [{ itemId: "gear", quantity: 3, equipped: true,
      item: { id: "gear", name: "Gear", itemType: "WEAPON", rarity: "COMMON", buCost: 3,
        size: "LARGE", slotCost: 1, isTwoHanded: true, isConsumable: false } }] };
    const largeSheet = aggregateRosterSheet({ ...row, practiceSlices: {}, conditionContext: undefined } as unknown as CharacterSheetInput);
    const large = createCharacterPdfSnapshot(row, inventory, largeSheet, "OWNER");
    expect(large.itemLinks[0]).toMatchObject({ load: 12, equippedSlotCost: 6 });
    expect(large.pdfDerived).toMatchObject({ currentLoad: 12, equippedSlotsUsed: 6 });
    expect(large.pdfDerived.currentLoad).toBe(largeSheet.encumbrance.load);
    expect(large.pdfDerived.equippedSlotsUsed).toBe(largeSheet.encumbrance.equipSlotsUsed);
    const tinyRow = { ...row, itemLinks: [{ itemId: "gear", quantity: 1200, equipped: false,
      item: { ...row.itemLinks[0]!.item, size: "TINY", slotCost: 0 } }] };
    const tinySheet = aggregateRosterSheet({ ...tinyRow, practiceSlices: {}, conditionContext: undefined } as unknown as CharacterSheetInput);
    const tiny = createCharacterPdfSnapshot(tinyRow,
      { ...inventory, nodes: [{ ...itemNode, data: { size: "TINY", slotCost: 0 } }] }, tinySheet, "OWNER");
    expect(tiny.itemLinks[0]).toMatchObject({ load: 2, equippedSlotCost: 0 });
    expect(tiny.pdfDerived).toMatchObject({ currentLoad: 2, equippedSlotsUsed: 0 });
    expect(tiny.pdfDerived.currentLoad).toBe(tinySheet.encumbrance.load);
    expect(tiny.pdfDerived.equippedSlotsUsed).toBe(tinySheet.encumbrance.equipSlotsUsed);
  });

  it("authorizes before loading any graph or printable private content", async () => {
    mocks.access.mockRejectedValue(new CharacterAccessDenied(character.id));
    mocks.row.mockResolvedValue({ id: character.id, userId: "owner", isPublic: false });
    await expect(loadCharacterPdfSnapshot(character.id, null)).rejects.toBeInstanceOf(CharacterAccessDenied);
    expect(mocks.graph).not.toHaveBeenCalled();
    expect(mocks.sheet).not.toHaveBeenCalled();
    expect(mocks.conditions).not.toHaveBeenCalled();
  });

  it("supports anonymous public-sheet printing as VIEWER and strips notes", async () => {
    mocks.access.mockRejectedValue(new CharacterAccessDenied(character.id));
    mocks.publication.mockResolvedValue({ visibility: "PUBLIC", unpublishedAt: null });
    mocks.row.mockResolvedValue({ ...character, notes: "private personal notes", dmNotes: "private DM notes" });
    const snapshot = await loadCharacterPdfSnapshot(character.id, null);
    expect(snapshot.viewerPermission).toBe("VIEWER");
    expect(snapshot.notes).toBeNull();
    expect(snapshot.dmNotes).toBeNull();
    expect(mocks.sheet).toHaveBeenCalledWith(character.id, graph);
  });

  it("does not turn an unpublished legacy public flag into access", async () => {
    mocks.access.mockRejectedValue(new CharacterAccessDenied(character.id));
    mocks.publication.mockResolvedValue({ visibility: "PUBLIC", unpublishedAt: new Date() });
    mocks.row.mockResolvedValue({ id: character.id, userId: "owner", isPublic: true });
    await expect(loadCharacterPdfSnapshot(character.id, null)).rejects.toBeInstanceOf(CharacterAccessDenied);
    expect(mocks.graph).not.toHaveBeenCalled();
  });

  it("honours follower visibility without granting editing or personal notes", async () => {
    mocks.access.mockRejectedValue(new CharacterAccessDenied(character.id));
    mocks.publication.mockResolvedValue({ visibility: "FOLLOWERS_ONLY", unpublishedAt: null });
    mocks.visibility.mockResolvedValue({ allowed: true });
    mocks.row.mockResolvedValue({ ...character, isPublic: false, notes: "private personal notes" });
    const snapshot = await loadCharacterPdfSnapshot(character.id, "follower");
    expect(snapshot.viewerPermission).toBe("VIEWER");
    expect(snapshot.notes).toBeNull();
    expect(mocks.visibility).toHaveBeenCalledWith(expect.objectContaining({ viewerId: "follower", targetType: "CHARACTER" }));
  });

  it("fails closed on unexpected access errors", async () => {
    mocks.access.mockRejectedValue(new Error("Permission database unavailable"));
    await expect(loadCharacterPdfSnapshot(character.id, "user")).rejects.toThrow("Permission database unavailable");
    expect(mocks.row).not.toHaveBeenCalled();
    expect(mocks.graph).not.toHaveBeenCalled();
  });
});
