import { describe, expect, it } from "vitest";
import { popDraftAction } from "../draft-history";
import type { DraftOperation } from "../draft-types";
const op = (id:string, groupId?:string):DraftOperation => ({id,type:"character",payload:{name:id},...(groupId?{groupId}:{})});
describe("draft action history",()=>{
  it("undoes a replacement as one action",()=>{
    const first=op("first"), add=op("add","replace"),remove=op("remove","replace");
    expect(popDraftAction([first,add,remove])).toEqual({remaining:[first],action:[add,remove]});
  });
  it("keeps earlier and independent actions",()=>{
    const first=op("first","batch"),second=op("second");
    expect(popDraftAction([first,second])).toEqual({remaining:[first],action:[second]});
    expect(popDraftAction([])).toEqual({remaining:[],action:[]});
  });
});
