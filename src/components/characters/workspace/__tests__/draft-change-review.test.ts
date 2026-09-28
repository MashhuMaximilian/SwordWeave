import {describe,expect,it} from "vitest";
import {draftReviewChanges,draftReviewChangeCount,mechanicalRule,type ReviewGraphPreview} from "../draft-change-review-model";
import type {WorkspaceGraph,WorkspaceNode} from "@/lib/character/workspace/model";
const rule:WorkspaceNode={key:"primitive:1",kind:"primitive",id:"1",name:"Strength",bu:4,versionId:"v1",latestVersionId:"v1",userId:"owner",description:"Narrative flavor",data:{mechanicalOutputText:"Add +1 to Physical.",mechanicalDescription:"Legacy text"}};
function graph(nodes:WorkspaceNode[]=[rule]):WorkspaceGraph{return {characterId:"c",revision:0,nodes,edges:[{id:"slot",parent:null,child:"primitive:1",category:"LINEAGE",order:0,isMirrored:false}]};}
function preview(before:WorkspaceGraph,after:WorkspaceGraph):ReviewGraphPreview{return {graph:after,beforeSnapshot:{foundation:{name:"A",level:1},graph:before},afterSnapshot:{foundation:{name:"A",level:1},graph:after}};}
describe("character change review",()=>{
 it("shows the executable mechanical text before a narrative or legacy description",()=>{expect(mechanicalRule(rule)).toBe("Add +1 to Physical.");});
 it("uses beforeSnapshot and omits the unchanged library graph",()=>{const result=draftReviewChanges(preview(graph(),graph()));expect(result.hasBeforeGraph).toBe(true);expect(result.rules).toEqual([]);expect(result.placements).toEqual([]);expect(result.sources).toEqual([]);});
 it("shows before and after mechanical rules even when the title is unchanged",()=>{const next={...rule,data:{...rule.data,mechanicalOutputText:"Add +2 to Physical."}};const result=draftReviewChanges(preview(graph(),graph([next])));expect(result.rules).toEqual([{key:rule.key,title:"Strength",before:"Add +1 to Physical.\n4 BU",after:"Add +2 to Physical.\n4 BU"}]);});
 it("detects a placement-only move without claiming the primitive was edited",()=>{const after=graph();after.edges[0]!.category="MANIFEST";const result=draftReviewChanges(preview(graph(),after));expect(result.rules).toEqual([]);expect(result.placements[0]!.before).toContain("lineage");expect(result.placements[0]!.after).toContain("manifest");});
 it("shows loss of an equipped supply while preserving the same contained primitive",()=>{const item:WorkspaceNode={...rule,key:"item:bag",kind:"item",id:"bag",name:"Charm",data:{}};const before=graph([rule,item]);before.edges=[{id:"equipped",parent:null,child:item.key,category:"ITEM",order:0,isMirrored:false,data:{equipped:true}},{id:"contained",parent:item.key,child:rule.key,category:"ITEM",order:0,isMirrored:false}];const after=structuredClone(before);after.edges[0]!.data!['equipped']=false;const result=draftReviewChanges(preview(before,after));expect(result.rules).toEqual([]);expect(result.sources.find(change=>change.key===rule.key)).toMatchObject({before:"Available from 1 source",after:"Item is not equipped"});});
 it("compares foundation details and leaves unchanged fields out",()=>{const value=preview(graph(),graph());value.afterSnapshot!.foundation={name:"B",level:1,notes:"A trained bear"};const result=draftReviewChanges(value);expect(result.foundation.map(change=>change.title)).toEqual(["Name","Character concept / notes"]);expect(result.foundation[0]).toMatchObject({before:"A",after:"B"});});
 it("reviews the actual inverted rule when a supplied primitive becomes mirrored",()=>{const node={...rule,data:{...rule.data,hardModifiers:[{target:"max_vitality",operation:"add",value:5}]}};const before=graph([node]),after=graph([node]);after.edges[0]!.isMirrored=true;const result=draftReviewChanges(preview(before,after));expect(result.rules[0]!.after).toContain("subtract 5 from Max Vitality");expect(result.placements[0]!.after).toContain("mirrored");});
 it("does not treat a missing baseline as every rule being newly added",()=>{expect(draftReviewChanges({graph:graph()}).rules).toEqual([]);});
});

describe("net review counts", () => {
 it("counts one new piece once while retaining rule, placement, and source details", () => {
  const before=graph([]);before.edges=[];
  const value=preview(before,graph());const changes=draftReviewChanges(value);
  expect(draftReviewChangeCount(value)).toBe(1);
  expect(changes.pieces).toHaveLength(1);
  expect(changes.pieces[0]).toMatchObject({key:rule.key,status:"Added"});
  expect(changes.pieces[0]!.facets.map(f=>f.label)).toEqual(["Rule","Placement","Availability"]);
 });
 it("counts an edited and moved piece once", () => {
  const after=graph([{...rule,bu:8,data:{mechanicalOutputText:"Add +2 to Physical."}}]);after.edges[0]!.category="MANIFEST";
  const value=preview(graph(),after);
  expect(draftReviewChangeCount(value)).toBe(1);
  expect(draftReviewChanges(value).pieces[0]!.facets.map(f=>f.label)).toContain("Placement");
 });
 it("cancels add/remove history, including a detached node retained in the graph cache", () => {
  const before=graph([]);before.edges=[];
  const after=graph();after.edges=[];
  expect(draftReviewChangeCount(preview(before,after))).toBe(0);
  expect(draftReviewChanges(preview(before,after)).pieces).toEqual([]);
 });
 it("reports a removed supply once even if its node remains cached", () => {
  const after=graph();after.edges=[];
  const value=preview(graph(),after);
  expect(draftReviewChangeCount(value)).toBe(1);
  expect(draftReviewChanges(value).pieces[0]!.status).toBe("Removed");
 });
 it("ignores timestamp and saved-version changes when content and placement return to their originals", () => {
  const old={...rule,data:{...rule.data,updatedAt:"2026-09-01",versionId:"v1"}};
  const next={...old,versionId:"v3",data:{...old.data,updatedAt:"2026-09-28",versionId:"v3"}};
  expect(draftReviewChangeCount(preview(graph([old]),graph([next])))).toBe(0);
 });
 it("renders labeled Markdown backstory, preserving paragraphs and formatting", () => {
  const value=preview(graph(),graph());
  value.beforeSnapshot!.foundation={backstory:{origin:"A **sailor**"}};
  value.afterSnapshot!.foundation={backstory:{origin:"A **captain**\n\n> Never surrender",personality:"*Patient*"}};
  const changes=draftReviewChanges(value).foundation;
  expect(changes).toHaveLength(2);
  expect(changes.find(change=>change.key==="backstory.origin")).toMatchObject({title:"Origin & History",before:"A **sailor**",after:"A **captain**\n\n> Never surrender",format:"markdown"});
  expect(changes.find(change=>change.key==="backstory.personality")).toMatchObject({title:"Personality",before:"Not set",after:"*Patient*",format:"markdown"});
  expect(draftReviewChangeCount(value)).toBe(2);
 });
 it("does not count newly initialized empty backstory fields as a change", () => {
  const value=preview(graph(),graph());
  value.beforeSnapshot!.foundation={backstory:{origin:"A sailor"}};
  value.afterSnapshot!.foundation={backstory:{origin:"A sailor",description:"",personality:"",flaw:""}};
  expect(draftReviewChangeCount(value)).toBe(0);
 });
 it("returns unknown rather than an invented zero when a baseline is unavailable", () => {
  expect(draftReviewChangeCount({graph:graph()})).toBeNull();
 });
});
