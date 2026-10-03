import { primitiveToLibraryItem } from "@/components/sandbox/sandbox-row-mapper";
import { describe, expect, it } from "vitest";
import { matchesLibraryFilters } from "../filter-library-items";
import type { LibraryItem } from "../library-query";
import type { LibraryToolbarState } from "@/components/library/library-toolbar";
const state: LibraryToolbarState = {search:"",sort:"ENGAGEMENT",view:"LIST",typeFilter:"ALL",category:"",author:"",minLikes:"",hasForks:false};
const item = {id:"PRIMITIVE:1",targetType:"PRIMITIVE",name:"Physical Focus",description:"Gain physical power below half vitality",tags:["conditional","physical"],buCost:0,likesCount:2,forkCount:1,sourceOrigin:"SRD",authorId:null,authorUsername:null,authorDisplayName:null,authorIsAdmin:null,publishedAt:new Date("2026-10-03T23:59:59Z"),definitionKind:"EXPRESSION",mirrorable:true,mechanicTargets:["attribute.physical"],recipients:["SELF"],conditional:true,magnitudes:[3]} as LibraryItem;
describe("contextual library filters",()=>{
 it("finds words independently across mechanic fields",()=>{expect(matchesLibraryFilters(item,{...state,search:"vitality physical"})).toBe(true);expect(matchesLibraryFilters(item,{...state,search:"vitality flying"})).toBe(false)});
 it("requires every selected tag",()=>{expect(matchesLibraryFilters(item,{...state,tags:"physical, conditional"})).toBe(true);expect(matchesLibraryFilters(item,{...state,tags:"physical, flying"})).toBe(false)});
 it("keeps free entries and rejects unknown costs from budget bounds",()=>{expect(matchesLibraryFilters(item,{...state,maxBu:"0"})).toBe(true);expect(matchesLibraryFilters({...item,buCost:null},{...state,maxBu:"8"})).toBe(false);expect(matchesLibraryFilters(item,{...state,minBu:"1"})).toBe(false)});
 it("includes the entire upper date and respects visibility",()=>{expect(matchesLibraryFilters(item,{...state,toDate:"2026-10-03"})).toBe(true);expect(matchesLibraryFilters(item,{...state,toDate:"2026-10-02"})).toBe(false);expect(matchesLibraryFilters(item,{...state,visibility:"PRIVATE"})).toBe(false)});
 it("combines actual authored result, recipient, condition and magnitude",()=>{expect(matchesLibraryFilters(item,{...state,mechanicTarget:"physical",recipient:"self",conditionMode:"conditional",minMagnitude:"2",maxMagnitude:"4"})).toBe(true);expect(matchesLibraryFilters(item,{...state,conditionMode:"always"})).toBe(false);expect(matchesLibraryFilters(item,{...state,minMagnitude:"5"})).toBe(false);expect(matchesLibraryFilters(item,{...state,recipient:"target"})).toBe(false)});
 it("filters ready expressions, mirrorability, and System author",()=>{expect(matchesLibraryFilters(item,{...state,definitionKind:"EXPRESSION",mirrorableOnly:true,author:"srd"})).toBe(true);expect(matchesLibraryFilters(item,{...state,definitionKind:"TEMPLATE"})).toBe(false);expect(matchesLibraryFilters({...item,mirrorable:false},{...state,mirrorableOnly:true})).toBe(false)});
});

describe("Atelier row discovery metadata",()=>{
 it("maps the full saved row into a discoverable composite identity",()=>{
 const mapped = primitiveToLibraryItem({id:7,name:"Physical surge",category:"ATTRIBUTE",buCost:4,isPublic:true,mechanicalOutputText:"Add3Physical",narrativeRule:null,sourceOrigin:"SRD",iconSource:null,iconKey:null,iconUrl:null,iconColor:null,definitionKind:"EXPRESSION",isMirrorable:true,hardModifiers:[{target:"attribute.physical",operation:"add",value:3,condition:{op:"lt"},metadata:{recipient:"SELF"}}]});
 expect(mapped.id).toBe("PRIMITIVE:7"); expect(mapped.definitionKind).toBe("EXPRESSION"); expect(mapped.mechanicTargets).toEqual(["attribute.physical"]);expect(mapped.magnitudes).toEqual([3]);expect(mapped.conditional).toBe(true);expect(mapped.mirrorable).toBe(true);
 });
});
