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
 <label>Sort<select value={state.sort} onChange={event=>patch({sort:event.target.value as LibraryToolbarState["sort"]})}><option value="ENGAGEMENT">Popular</option><option value="ALPHABETICAL">Name</option><option value="RECENT">Recent</option><option value="BU">BU cost</option><option value="LIKES">Most liked</option><option value="FORKS">Most forked</option></select></label>
 {children?<details><summary>More filters</summary>{children}</details>:null}
 </div>;
}
