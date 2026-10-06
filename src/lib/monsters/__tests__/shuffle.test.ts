import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/publishing/library-query", () => ({ queryLibrary: mocks.query }));
vi.mock("../service", () => ({ prepareMonster: mocks.prepare }));
import { shuffleMonster } from "../shuffle";
import { monsterDefinitionSchema } from "../model";
import { monsterPreviewInput } from "../draft";
const ref = (kind: string, id: string) => ({ kind, id, quantity: 1, isMirrored: false, versionId: "pinned" });
const draft = { name: "", budget: 25, attributes: { physical: 3, mental: 0, magical: 0 }, references: [ref("PRIMITIVE", "locked"), ref("CAPABILITY", "ability"), ref("ITEM", "gear"), ref("EFFECT", "legacy")] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ items: [{ targetId: "new", buCost: 4 }] });
  mocks.prepare.mockImplementation(async definition => ({ definition, sheet: { spent: definition.references.filter((r: { kind: string }) => r.kind !== "ITEM").length * 4 }, slots: [] }));
});
describe("creature set proposals", () => {
  it("allows unnamed previews while publication still requires a name", () => {
    expect(monsterDefinitionSchema.safeParse(draft).success).toBe(false);
    expect(monsterDefinitionSchema.parse(monsterPreviewInput(draft)).name).toBe("Your creature");
  });
  it("preserves foundation, pinned locks, unrelated kinds and legacy components", async () => {
    const result = await shuffleMonster(draft, "owner", ["reference:0"], { shuffleKinds: ["PRIMITIVE"], shuffleBudget: 20 });
    expect(result.definition.attributes).toEqual(draft.attributes);
    expect(result.definition.references.slice(0, 4)).toEqual(draft.references);
    expect(result.definition.references[4]).toMatchObject({ kind: "PRIMITIVE", id: "new" });
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ targetType: "PRIMITIVE", viewerClerkId: "owner", maxBu: 20 }));
  });
  it("supports capability-only proposals and retains primitives", async () => {
    const result = await shuffleMonster(draft, "owner", [], { shuffleKinds: ["CAPABILITY"] });
    expect(result.definition.references).toContainEqual(draft.references[0]);
    expect(result.definition.references).not.toContainEqual(draft.references[1]);
    expect(result.definition.references.at(-1)).toMatchObject({ kind: "CAPABILITY", id: "new" });
  });
  it("keeps chosen weaknesses when reshuffling strengths without reference locks", async () => {
    const weakness = {...ref("PRIMITIVE", "weakness"),isMirrored:true};
    const result = await shuffleMonster({...draft,references:[weakness]}, "owner", [], {shuffleKinds:["PRIMITIVE"]});
    expect(result.definition.references).toContainEqual(weakness);
    expect(result.definition.references).toContainEqual(expect.objectContaining({id:"new",isMirrored:false}));
  });
  it("does not impose a five-component limit on a set that fits its budget", async () => {
    mocks.query.mockResolvedValue({items:Array.from({length:6},(_,index)=>({targetId:`part-${index}`,buCost:4}))});
    const result=await shuffleMonster({...draft,references:[]},"owner",[],{shuffleKinds:["PRIMITIVE"],shuffleBudget:25});
    expect(result.definition.references).toHaveLength(6);
    expect(result.sheet.spent).toBe(24);
  });
  it("checks actual resolved cost and never returns an over-budget proposal", async () => {
    await expect(shuffleMonster(draft, "owner", [], { shuffleKinds: ["CAPABILITY"], shuffleBudget: 8 })).rejects.toThrow("No published components fit");
  });
  it("rejects a limit below kept costs and invalid categories before querying", async () => {
    await expect(shuffleMonster(draft, "owner", [], { shuffleBudget: 2 })).rejects.toThrow("Kept components");
    await expect(shuffleMonster(draft, "owner", [], { shuffleKinds: [] })).rejects.toThrow("Choose primitives");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
