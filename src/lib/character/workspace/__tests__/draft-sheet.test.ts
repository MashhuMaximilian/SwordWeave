import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGraph } from "../model";
const mocks=vi.hoisted(()=>({read:vi.fn(),character:vi.fn(),aggregate:vi.fn(),pins:vi.fn(),conditions:vi.fn()}));
vi.mock("@/db/client",()=>({db:{query:{characters:{findFirst:mocks.character}},select:()=>({from:()=>({where:mocks.conditions})})}}));
vi.mock("../read",()=>({readWorkspace:mocks.read}));
vi.mock("../effective-primitives",()=>({effectivePrimitiveLinks:mocks.pins}));
vi.mock("@/lib/engine/sheet",()=>({aggregateCharacterSheet:mocks.aggregate}));
import {readDraftSheet} from "../draft-sheet";
const graph:WorkspaceGraph={characterId:"character",revision:4,nodes:[],edges:[]};
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.character.mockResolvedValue({id:"character",level:1,primitiveLinks:[],capabilityLinks:[],itemLinks:[],practiceSlices:{},attrProficient:"PHYSICAL",currentVitality:null});
  mocks.read.mockResolvedValue(graph);mocks.pins.mockResolvedValue([]);mocks.conditions.mockResolvedValue([]);
  mocks.aggregate.mockReturnValue({vitality:{max:12},dc:10,proficiencyBonus:2,savingThrows:[],behaviorVariables:[],attributes:{},practices:[]});
});
describe("draft sheet graph reuse",()=>{
  it("uses the supplied transaction graph without a redundant workspace read",async()=>{
    const result=await readDraftSheet("character",graph);
    expect(result.vitality.max).toBe(12);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.character).toHaveBeenCalledOnce();
    expect(mocks.pins).toHaveBeenCalledOnce();
    expect(mocks.aggregate).toHaveBeenCalledTimes(2);
    expect(mocks.aggregate.mock.calls[1]?.[0].conditionContext.character.vitalityMax).toBe(12);
  });
  it("loads a graph for standalone callers and produces the same result",async()=>{
    const supplied=await readDraftSheet("character",graph);
    const standalone=await readDraftSheet("character");
    expect(standalone).toEqual(supplied);
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledWith("character");
  });
  it("still rejects missing characters before resolving graph or sheet",async()=>{
    mocks.character.mockResolvedValue(undefined);
    await expect(readDraftSheet("missing",graph)).rejects.toThrow("Character not found");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
