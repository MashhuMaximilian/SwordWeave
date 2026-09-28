import { describe, expect, it } from "vitest";
import { proceduralRules, generateProposals, proposalBudget } from "../procedural-generator";
import type { WorkspaceGraph } from "../../model";
import { selectionForModifier } from "@/lib/primitives/modifier-scope";
import { validateModifierDraft } from "@/lib/primitives/modifier-validator";
const rng = (initial = 73) => { let state = initial; return () => { state = (state * 16807) % 2147483647; return state / 2147483647; }; };

describe("new procedural definitions", () => {
  it("uses distinct canonical prices for attributes, Vitality, practice advantage and defenses", () => {
    expect(proceduralRules("attribute").map(rule => rule.buCost)).toEqual([12,12,12]);
    expect(proceduralRules("vitality").map(rule => [rule.hardModifiers[0]?.["value"], rule.buCost])).toEqual([[{kind:"number",value:5},4],[{kind:"number",value:12},8],[{kind:"number",value:20},12]]);
    expect(proceduralRules("advantage").every(rule => rule.buCost === 6)).toBe(true);
    expect(new Set(proceduralRules("defense").map(rule => rule.buCost))).toEqual(new Set([8,20]));
    for (const rule of proceduralRules("any")) {
      for (const modifier of rule.hardModifiers) {
        const draft = selectionForModifier(modifier);
        expect(validateModifierDraft({...draft, freeTextNarrowFocus: draft.freeTextNarrowFocus ?? String((modifier["metadata"] as {scopeName?: string} | undefined)?.scopeName ?? "")})).toBeNull();
      }
    }
  });
  it("generates distinct editable options within the allowance and excludes prior combinations", () => {
    const options = {kind:"primitive",family:"any",budget:6} as const;
    const first = generateProposals(options,rng());
    const next = generateProposals({...options,exclude:first.map(item=>item.key)},rng(92));
    expect(first).toHaveLength(3); expect(next).toHaveLength(3);
    expect(new Set([...first,...next].map(item=>item.key)).size).toBe(6);
    expect([...first,...next].every(item=>item.newBuCost<=6&&item.pieces.length===1)).toBe(true);
    expect(generateProposals({...options,family:"attribute",budget:11},rng())).toEqual([]);
  });
  it("assembles complete active capabilities at the minimum budget without level-tier locks", () => {
    const low = generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:8},rng());
    expect(low).toHaveLength(3);
    expect(low.every(item=>item.pieces.length===4&&item.newBuCost<=8)).toBe(true);
    const high = generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:80},rng(),8);
    expect(high.some(item=>item.pieces.some(piece=>piece.seed.key==="verb-access-4"))).toBe(true);
    expect(high.every(item=>item.buCost===item.pieces.reduce((total,piece)=>total+piece.seed.buCost,0))).toBe(true);
  });
  it("reuses exact owned pieces, never mirrored or merely similar ones, without mutating the graph", () => {
    const proposal = generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:8},rng())[0]!;
    const graph:WorkspaceGraph = {characterId:"test",revision:0,nodes:proposal.pieces.map((piece,index)=>({key:`primitive:${index+1}`,id:String(index+1),kind:"primitive",name:piece.seed.name,bu:piece.seed.buCost,versionId:null,latestVersionId:null,userId:null,description:"",data:{...piece.seed}})),edges:proposal.pieces.map((_piece,index)=>({id:String(index),parent:null,child:`primitive:${index+1}`,category:"MANIFEST",order:index,isMirrored:false}))};
    const before = structuredClone(graph);
    const reused = generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:0,reuseOwned:true,graph},rng());
    expect(reused.length).toBeGreaterThan(0); expect(reused[0]?.pieces.every(piece=>!!piece.ownedKey)).toBe(true);
    expect(reused[0]?.newBuCost).toBe(0); expect(graph).toEqual(before);
    const restricted = structuredClone(graph);
    (restricted.nodes[0]!.data["mechanicalRule"] as Record<string, unknown>)["conditionText"] = "only during a storm";
    expect(generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:0,reuseOwned:true,graph:restricted},rng())).toEqual([]);
    expect(generateProposals({kind:"capability",family:"access",domainMode:"mechanical",verbMode:"mechanical",minPieces:0,maxPieces:0,budget:0,reuseOwned:true,graph:{...graph,edges:graph.edges.map(edge=>({...edge,isMirrored:true}))}},rng())).toEqual([]);
  });
  it("conditions restrict generated numeric rules without making up a discount", () => {
    const [proposal] = generateProposals({kind:"primitive",family:"practice",budget:4,condition:"scene-dim"},rng());
    expect(proposal?.newBuCost).toBe(4);
    expect(proposal?.pieces[0]?.seed.hardModifiers[0]?.["condition"]).toMatchObject({presetKey:"scene-dim"});
    const [talent] = generateProposals({kind:"capability",family:"defense",budget:8},rng());
    expect(talent?.capabilityType).toBe("PASSIVE");
    expect(talent?.newBuCost).toBe(8);
  });
});

describe("composition controls",()=>{
 it("bounds the additional cost and composition size for every generated kind",()=>{
  for(const kind of ["primitive","effect","capability","heritage"] as const){
   const results=generateProposals({kind,family:"any",budget:24,minBudget:8,minPieces:kind==="primitive"?1:2,maxPieces:4},rng(32),8);
   expect(results.length).toBeGreaterThan(0);
   for(const result of results){expect(result.kind).toBe(kind);expect(result.newBuCost).toBeGreaterThanOrEqual(8);expect(result.newBuCost).toBeLessThanOrEqual(24);expect(result.pieces.filter(p=>kind!=="capability" || !["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"].includes(p.seed.familyKey)).length).toBeLessThanOrEqual(4);expect(new Set(result.pieces.map(p=>p.seed.key)).size).toBe(result.pieces.length);}
  }
 });
 it("keeps flavor free, omits unwanted access, and saves optional custom play guidance",()=>{
  const options={kind:"capability",family:"vitality",capabilityMode:"ACTIVE",budget:24,domainMode:"flavor",verbMode:"none",includeRange:false,includeOutput:false,includeTable:true,theme:"Ice",shape:"Star"} as const;
  const results=generateProposals(options,rng());expect(results.length).toBeGreaterThan(0);
  for(const result of results){expect(result.name).toContain("Ice");expect(result.description).toContain("- Shape: Star");expect(result.description).toContain("grants no domain access");expect(result.pieces.every(piece=>piece.seed.familyKey==="VITALITY")).toBe(true);}
  expect(generateProposals({...options,minBudget:25},rng())).toEqual([]);
 });
 it("does not exceed a piece limit just to force required access",()=>{
  expect(generateProposals({kind:"capability",family:"access",budget:100,domainMode:"mechanical",verbMode:"mechanical",maxPieces:1},rng())).toEqual([]);
 });
 it("reproduces a roll from its seed and never edits its input graph",async()=>{
  const {seededRandom}=await import("../procedural-generator");
  const options={kind:"heritage",family:"any",budget:40} as const;
  expect(generateProposals(options,seededRandom("silver-star"))).toEqual(generateProposals(options,seededRandom("silver-star")));
 });
});

describe("distribution and requested access",()=>{
 it("draws across available price levels rather than taking the first cheap recipes",()=>{
  const proposals=generateProposals({kind:"primitive",family:"vitality",budget:12,minBudget:4},rng(),3);
  expect(proposals.map(item=>item.newBuCost).sort((a,b)=>a-b)).toEqual([4,8,12]);
  for(const kind of ["effect","heritage"] as const){
   const batch=generateProposals({kind,family:"vitality",budget:24,minBudget:4,maxPieces:3},rng(),3);
   expect(Math.max(...batch.map(item=>item.newBuCost))).toBeGreaterThanOrEqual(20);
   expect(Math.min(...batch.map(item=>item.newBuCost))).toBeLessThanOrEqual(12);
  }
 });
 it("never silently drops requested mechanical slots in passive or mixed capabilities",()=>{
  for(const capabilityMode of ["PASSIVE","mixed"] as const){
   const batch=generateProposals({kind:"capability",family:"any",budget:80,minPieces:0,maxPieces:0,capabilityMode,domainMode:"mechanical",verbMode:"mechanical",includeRange:true,includeOutput:true},rng());
   expect(batch).toHaveLength(3);
   for(const item of batch)expect(new Set(item.pieces.map(piece=>piece.seed.familyKey))).toEqual(new Set(["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"]));
  }
 });
 it("persists custom conditions on numeric mechanics and keeps their authored cost",()=>{
  const condition={kind:"narrative",text:"Only while protecting my sworn companion"} as const;
  const result=generateProposals({kind:"primitive",family:"vitality",budget:12,authoredCondition:condition},rng());
  expect(result).toHaveLength(3);for(const item of result){expect(item.pieces[0]!.seed.hardModifiers[0]?.["condition"]).toEqual(condition);expect([4,8,12]).toContain(item.newBuCost);}
 });
});

it("keeps requested resolution together with optional table declarations",()=>{
 const options={kind:"capability" as const,family:"vitality" as const,budget:40,maxPieces:5,includeRange:true,includeOutput:true,includeTable:true,resolution:{mode:"save" as const,check:"Mental save",dc:"My Magical DC",outcome:"Failure: distracted; success: unaffected."}};
 const proposals=generateProposals(options,()=>0.37,1);
 expect(proposals).toHaveLength(1);
 expect(proposals[0]!.description).toContain("Target makes a saving throw");
 expect(proposals[0]!.description).toContain("My Magical DC");
 expect(proposals[0]!.description).toContain("At the table");
 expect(proposals[0]!.pieces.length).toBeGreaterThan(1);
});

it("counts additional rules separately from all four capability references",()=>{
 const batch=generateProposals({kind:"capability",family:"vitality",budget:100,minPieces:2,maxPieces:2,domainMode:"mechanical",verbMode:"mechanical",includeRange:true,includeOutput:true},rng());
 expect(batch).toHaveLength(3);
 for(const proposal of batch)expect(proposal.pieces).toHaveLength(6);
});
it("does not generate capability scaling declarations for effects and keeps random resolution optional",()=>{
 const none=generateProposals({kind:"effect",family:"vitality",budget:20,includeTable:true},rng())[0]!;
 expect(none.description).not.toContain("At the table");expect(none.description).not.toContain("Roll resolution");
 const random=generateProposals({kind:"effect",family:"vitality",budget:20,randomResolution:true},rng())[0]!;
 expect(random.description).toContain("Roll resolution");
});


describe("Library compositions",()=>{
 const primitive=(id:number,cost:number)=>({key:`primitive:${id}` as const,kind:"primitive" as const,name:`Library ${id}`,description:"",mechanicalDescription:"An authored rule",tags:[],family:"",structuredRules:"",origin:"system" as const,cost,versionNumber:null});
 const catalog=[primitive(1,4),primitive(2,8),primitive(3,12),primitive(4,16)];
 const graph:WorkspaceGraph={characterId:"test",revision:0,nodes:[{key:"primitive:1",id:"1",kind:"primitive",name:"Owned",bu:4,description:"",data:{},versionId:null,latestVersionId:null,userId:null}],edges:[{id:"owned",parent:null,child:"primitive:1",category:"MANIFEST",order:0,isMirrored:false}]};
 it("uses exact additional counts from the whole Library, including rules without recipe seeds",()=>{
  const proposals=generateProposals({kind:"capability",family:"any",budget:80,catalog,minPieces:3,maxPieces:3,includeRange:true,includeOutput:true},rng(),8);
  expect(proposals.length).toBeGreaterThan(0);
  for(const proposal of proposals){expect(proposal.libraryPieces).toHaveLength(3);expect(proposal.pieces).toHaveLength(2);expect(proposal.newBuCost).toBeLessThanOrEqual(80);}
 });
 it("counts nested leaves once and subtracts only owned leaves",()=>{
  const effect={...primitive(10,12),key:"effect:e" as const,kind:"effect" as const,primitiveCosts:[{key:"primitive:1" as const,cost:4},{key:"primitive:2" as const,cost:8}]};
  const options={kind:"capability" as const,family:"any" as const,budget:20,reuseOwned:true,graph};
  expect(proposalBudget([],[effect,catalog[0]!,catalog[1]!],options)).toEqual({buCost:12,newBuCost:8});
  expect(proposalBudget([],[effect],{...options,kind:"item"})).toEqual({buCost:12,newBuCost:12});
  expect(proposalBudget([],[effect],{...options,reuseOwned:false})).toEqual({buCost:12,newBuCost:12});
 });
 it("supports each allowed nested type and never inserts disallowed children",()=>{
  const effect={...primitive(10,4),key:"effect:e" as const,kind:"effect" as const,primitiveCosts:[{key:"primitive:1" as const,cost:4}]};
  const capability={...effect,key:"capability:c" as const,kind:"capability" as const};
  for(const kind of ["effect","capability","heritage","item"] as const){
   const results=generateProposals({kind,family:"any",catalog:[...catalog,effect,capability],includeEffects:true,includeCapabilities:true,includePrimitives:kind==="effect",budget:80,minPieces:1,maxPieces:1,includeRange:false,includeOutput:false},rng(),8);
   expect(results.length).toBeGreaterThan(0);
   const permitted=kind==="effect"?["primitive"]:kind==="capability"?["effect"]:kind==="heritage"?["capability"]:["effect","capability"];
   for(const result of results)expect(permitted).toContain(result.libraryPieces![0]!.kind);
  }
 });
 it("uses the full min–max count range and refuses impossible counts",()=>{
  const results=generateProposals({kind:"effect",family:"any",catalog,budget:100,minPieces:1,maxPieces:4},rng(),8);
  expect(new Set(results.map(p=>p.libraryPieces!.length)).size).toBeGreaterThan(1);
  expect(generateProposals({kind:"effect",family:"any",catalog:catalog.slice(0,1),budget:100,minPieces:2,maxPieces:2},rng())).toEqual([]);
 });
 it("can generate a zero-new-BU composition from owned rules",()=>{
  const results=generateProposals({kind:"effect",family:"any",catalog,budget:0,minPieces:1,maxPieces:1,reuseOwned:true,graph},rng());
  expect(results.length).toBeGreaterThan(0);expect(results[0]!.newBuCost).toBe(0);expect(results[0]!.buCost).toBe(4);
 });
});
