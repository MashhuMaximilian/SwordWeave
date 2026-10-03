"use client";
import { PhoneTypeChoices } from "./phone-type-choices";
import type { ReactNode } from "react";
import type { LibraryToolbarState } from "./library-toolbar";
import { libraryFamilyLabel } from "./library-market-rail";

/** Phone filter sheet: the results page owns only search, never a stack of taxonomies. */
export function PhoneLibraryFilters({state,onChange,categories,types,children,source}: {
 state:LibraryToolbarState;onChange:(state:LibraryToolbarState)=>void;
 categories:Array<{value:string;label:string;count:number}>;
 types?:Array<{value:LibraryToolbarState["typeFilter"];label:string}>;
 children?:ReactNode;source?:ReactNode;
}) {
 const patch=(next:Partial<LibraryToolbarState>)=>onChange({...state,...next});
 const options=types ?? [{value:"ALL",label:"All records"},{value:"PRIMITIVE",label:"Primitives"},{value:"EFFECT",label:"Effects"},{value:"CAPABILITY",label:"Capabilities"},{value:"LINEAGE_TEMPLATE",label:"Lineages"},{value:"UPBRINGING_TEMPLATE",label:"Upbringings"},{value:"MANIFEST_TEMPLATE",label:"Manifests"},{value:"ITEM",label:"Items"}];
 return <div className="phone-library-filters">{source}
 <PhoneTypeChoices label="Record type" value={state.typeFilter} options={options} onChange={value=>patch({typeFilter:value as LibraryToolbarState["typeFilter"],category:"",tier:""})}/>
 <label>Rule family<select value={state.category} onChange={event=>patch({category:event.target.value,...(event.target.value?{typeFilter:"PRIMITIVE"}: {})})}><option value="">All families</option>{categories.map(category=><option key={category.value} value={category.value}>{libraryFamilyLabel(category)} ({category.count})</option>)}</select></label>
 <div className="phone-filter-pair"><label>Tier<select value={state.tier??""} onChange={event=>patch({tier:event.target.value})}><option value="">All tiers</option>{[1,2,3,4,5].map(tier=><option key={tier} value={String(tier)}>Tier {tier}</option>)}</select></label><label>Origin<select value={state.origin??"all"} onChange={event=>patch({origin:event.target.value as "all"|"system"|"community"})}><option value="all">All origins</option><option value="system">System</option><option value="community">Community</option></select></label></div>
 <label>Sort<select value={state.sort} onChange={event=>patch({sort:event.target.value as LibraryToolbarState["sort"]})}><option value="ENGAGEMENT">Popular</option><option value="ALPHABETICAL">Name</option><option value="RECENT">Recent</option><option value="BU">BU low → high</option><option value="BU_DESC">BU high → low</option><option value="ALPHABETICAL_DESC">Name Z → A</option><option value="LIKES">Most liked</option><option value="FORKS">Most forked</option></select></label>
 <div className="phone-filter-pair"><label>Min BU<input type="number" min="0" value={state.minBu ?? ""} onChange={event=>patch({minBu:event.target.value})}/></label><label>Max BU<input type="number" min="0" value={state.maxBu ?? ""} onChange={event=>patch({maxBu:event.target.value})}/></label></div>
 {(state.typeFilter === "PRIMITIVE" || state.typeFilter === "ALL" || state.typeFilter === "GROUP_MECHANICS") ? <label>Primitive role<select value={state.definitionKind ?? ""} onChange={event=>patch({definitionKind:event.target.value as NonNullable<LibraryToolbarState["definitionKind"]>})}><option value="">All</option><option value="TEMPLATE">Base families to fork</option><option value="EXPRESSION">Ready-to-use expressions</option></select></label> : null}
 <details><summary>Mechanical filters</summary>
 <label>What it changes<input value={state.mechanicTarget ?? ""} placeholder="Physical, speed, slots…" onChange={event=>patch({mechanicTarget:event.target.value})}/></label>
 <label>Recipient<select value={state.recipient ?? ""} onChange={event=>patch({recipient:event.target.value as NonNullable<LibraryToolbarState["recipient"]>})}><option value="">Anyone</option><option value="self">Self</option><option value="target">Target</option><option value="scene">Scene</option></select></label>
 <label>When it applies<select value={state.conditionMode ?? ""} onChange={event=>patch({conditionMode:event.target.value as NonNullable<LibraryToolbarState["conditionMode"]>})}><option value="">Any trigger</option><option value="always">Always active</option><option value="conditional">Authored condition</option></select></label>
 <div className="phone-filter-pair"><label>Min fixed magnitude<input type="number" min="0" value={state.minMagnitude ?? ""} onChange={event=>patch({minMagnitude:event.target.value})}/></label><label>Max fixed magnitude<input type="number" min="0" value={state.maxMagnitude ?? ""} onChange={event=>patch({maxMagnitude:event.target.value})}/></label></div>
 </details>
 <label>Required tags<input value={state.tags ?? ""} placeholder="Comma-separated" onChange={event=>patch({tags:event.target.value})}/></label>
 <button type="button" onClick={()=>onChange({...state,search:"",typeFilter:"ALL",category:"",tier:"",origin:"all",minBu:"",maxBu:"",author:"",minLikes:"",minForks:"",hasForks:false,fromDate:"",toDate:"",visibility:"ANY",mirrorableOnly:false,definitionKind:"",mechanicTarget:"",recipient:"",conditionMode:"",minMagnitude:"",maxMagnitude:"",tags:""})}>Clear filters</button>
 {children?<details><summary>More filters</summary>{children}</details>:null}
 </div>;
}
