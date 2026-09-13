import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/ui/markdown", () => ({Markdown: ({children}:{children:string}) => children}));
import { CapabilityFormPreview, type CapabilityFormState } from "../capability-form-preview";

import { HeritageFormPreview } from "../heritage-form-preview";

const form:CapabilityFormState = {name:"Ember Lance",type:"ACTIVE",sourceType:"MAGICAL",verboseDescription:"A narrow line of heat.",sourceOrigin:"Test source",tags:"fire, focus",isPublic:false,iconSource:null,iconKey:null,iconUrl:null,iconColor:"#ffffff"};
const primitive = {id:1,name:"Heat",category:"DOMAIN",buCost:4,mechanicalOutputText:"Grant fire access.",narrativeRule:"Speak to the flame."};

describe("live V12 capability card",()=>{
  it("keeps nested composition, slot information and metadata while deduplicating the displayed BU",()=>{
    const html=renderToStaticMarkup(createElement(CapabilityFormPreview,{form,slots:[{primitiveId:1,role:"DOMAIN",quantity:2,sortOrder:0,slotLabel:"Kindling",isMirrored:true,notes:"Keep the flame close.",primitive}],effects:[{id:"wake",name:"Scorching Wake",narrativeDescription:"Leaves heat behind.",primitiveLinks:[{primitiveId:1,quantity:1,primitive},{primitiveId:2,quantity:1,primitive:{...primitive,id:2,name:"Lingering Harm",buCost:6,mechanicalOutputText:"Apply burning."}}]}]}));
    for(const text of ["Scorching Wake","Lingering Harm","Apply burning.","Kindling","Mirrored","Keep the flame close.","Speak to the flame.","Test source","fire","focus","14","Private draft","Inspect effect and provenance"]) expect(html).toContain(text);
    expect(html).not.toContain("text-[10px]");
  });
  it("does not present a partial recipe cost as a complete total",()=>{
    const html=renderToStaticMarkup(createElement(CapabilityFormPreview,{form,slots:[],effects:[{id:"missing",name:"Unavailable effect"}]}));
    expect(html).toContain("direct rules");
    expect(html).toContain("Unavailable effect");
  });
});

describe("live V12 heritage card",()=>{
  it("retains fiction, suggested traits and nested capability rules",()=>{
    const html=renderToStaticMarkup(createElement(HeritageFormPreview,{form:{...form,kind:"LINEAGE",imageUrl:"",description:"Protective instinct.",suggestedTraits:"Patient and steadfast."},primitives:[primitive],capabilities:[{id:"aegis",name:"Aegis Shield",category:"REACTION",buCost:0,description:"Brace for impact.",primitiveLinks:[{primitiveId:1,quantity:1,primitive}],effects:[{id:"brace",name:"Brace",primitiveLinks:[{primitiveId:2,quantity:1,primitive:{...primitive,id:2,name:"Impact Sink",buCost:6,mechanicalOutputText:"Reduce incoming physical damage."}}]}]}]}));
    for(const text of ["Protective instinct.","Patient and steadfast.","Aegis Shield","Brace for impact.","Impact Sink","Reduce incoming physical damage.","Direct lineage primitives","Inspect capability and provenance","10"]) expect(html).toContain(text);
  });
});
