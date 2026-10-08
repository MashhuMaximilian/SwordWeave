"use client";
import {useAccount} from "@/components/account/account-provider";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";

// =============================================================================
// LibraryToolbar — controlled filter + sort + view toolbar.
//
// All state lives in the parent. The toolbar is purely presentational.
//
// The available type-filter chips are gated by the `availableTypes` prop so
// the sandbox left column can hide chips that don't make sense for the
// current build mode (e.g. hiding the Capability chip when in Primitive mode).
//
// Sub-kind filtering (Templates → RACE/BACKGROUND/ARCHETYPE) is supported via
// the `subKindAvailable` + `subKinds` + `onSubKindsChange` props. When set, a
// second chip row appears under the type chips, scoped to the active type.
//
// This replaces the inline filter UI that /library/browse shipped with so the
// same controls can be reused in the sandbox left column.
// =============================================================================

import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { LibraryTargetType } from "@/lib/publishing/library-query";
import type { LibrarySort } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

export interface LibraryToolbarState {
  collectionId?: string;
  origin?: "all" | "system" | "community";
  tier?: string;
  search: string;
  sort: LibrarySort;
  view: LibraryView;
  typeFilter: LibraryTargetType | "ALL" | "GROUP_MECHANICS" | "GROUP_HERITAGES";
  category: string;
  author: string;
  minLikes: string;
  hasForks: boolean;
  /** Advanced filters (all optional). */
  minForks?: string;
  minBu?: string;
  maxBu?: string;
  fromDate?: string;
  toDate?: string;
  /** "ANY" (default), "PUBLIC", or "PRIVATE". */
  visibility?: "ANY" | "PUBLIC" | "PRIVATE";
  mirrorableOnly?: boolean;
  definitionKind?: "" | "TEMPLATE" | "EXPRESSION";
  mechanicTarget?: string;
  recipient?: "" | "self" | "target" | "scene";
  conditionMode?: "" | "conditional" | "always";
  minMagnitude?: string;
  maxMagnitude?: string;
  /** Comma-separated tag list. */
  tags?: string;
}

// Default state for /library/browse when no cookie is set. List view
// is the new default (was GRID). Same rationale as the /creations
// page: the 2-column mobile grid was cramped, list reads better on
// narrow viewports, and the server-side readLibraryPreferences()
// already overrides to LIST on mobile UAs (see src/lib/preferences/
// library-prefs.ts) so this default only matters for desktop sessions
// without a saved preference.
export const EMPTY_LIBRARY_TOOLBAR_STATE: LibraryToolbarState = {
  search: "",
  sort: "ENGAGEMENT",
  view: "LIST",
  typeFilter: "ALL",
  category: "",
  author: "",
  minLikes: "",
  hasForks: false,
  minForks: "",
  minBu: "",
  maxBu: "",
  fromDate: "",
  toDate: "",
  visibility: "ANY",
  mirrorableOnly: false,
  tags: "",
};

export interface LibraryTypeChip {
  key: LibraryToolbarState["typeFilter"];
  label: string;
}

export interface LibrarySubKindChip {
  key: string;
  label: string;
}

interface LibraryToolbarProps {
  state: LibraryToolbarState;
  onStateChange: (next: LibraryToolbarState) => void;
  /**
   * The chip row shown above the result set. If omitted, a default set
   * (ALL/PRIMITIVE/CAPABILITY/EFFECT/RACE/BACKGROUND/ARCHETYPE) is rendered.
   */
  availableTypes?: LibraryTypeChip[];
  /**
   * If provided, an additional sub-chip row appears under the type chips.
   * Visible only when the active type filter matches `subKindParent`.
   */
  subKindParent?: LibraryTargetType;
  subKinds?: LibrarySubKindChip[];
  activeSubKinds?: string[];
  onSubKindsChange?: (next: string[]) => void;
  /**
   * Primitive categories for the "Category" chip row in advanced filters.
   * Pass empty array to hide the section.
   */
  primitiveCategories?: Array<{ value: string; label: string; count: number }>;
  /**
   * Distinct item tags (with counts) for the chip-based tag filter.
   * Rendered as a chip row above the type chips when the active type
   * is ITEM. Clicking a chip toggles it in the active set and pushes
   * the new tag list to the URL.
   */
  itemTags?: Array<{ value: string; label: string; count: number }>;
  /**
   * Initial active tag set. Mirrors the URL ?tag= param so chips
   * render in their active state on first paint. Once mounted, the
   * toolbar derives the active set from `state.tags` instead.
   */
  activeTags?: string[];
  /**
   * If true, render advanced filters (category, hasForks, minLikes).
   * Defaults to true.
   */
  showAdvancedFilters?: boolean;
  showVisibilityFilter?: boolean;
  /**
   * If true, render the search bar. Defaults to true.
   */
  showSearch?: boolean;
  /**
   * Placeholder for the search input.
   */
  searchPlaceholder?: string;
  /**
   * When the toolbar is mounted inside the right-side GlobalControls filter
   * panel, the user has already explicitly chosen to see filters — there is
   * no point collapsing the chip rows on mobile. Setting this to true makes
   * the toolbar always render its filter sections, regardless of viewport.
   */
  forceExpandFilters?: boolean;
}

const DEFAULT_TYPE_CHIPS: LibraryTypeChip[] = [
  { key: "ALL", label: "All" },
  { key: "MONSTER", label: "Monsters & NPCs" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "CAPABILITY", label: "Capabilities" },
  { key: "EFFECT", label: "Effects" },
  { key: "ITEM", label: "Items" },
  { key: "LINEAGE_TEMPLATE", label: "Lineages" },
  { key: "UPBRINGING_TEMPLATE", label: "Upbringings" },
  { key: "MANIFEST_TEMPLATE", label: "Manifests" },
  // Mashu 2026-07-09: builds surfaced as a public library browse
  // option. The chip label is "Builds"; the URL value remains
  // "BUILD_TEMPLATE" so it matches the engagement enum + library-query.
  { key: "BUILD_TEMPLATE", label: "Builds" },
];

const SORT_OPTIONS = [
  ["ENGAGEMENT", "Popular"], ["LIKES", "Most liked"], ["FORKS", "Most forked"],
  ["RECENT", "Newest first"], ["ALPHABETICAL", "Name A → Z"],
  ["ALPHABETICAL_DESC", "Name Z → A"], ["BU", "BU low → high"], ["BU_DESC", "BU high → low"],
] as const;

function FilterField({label, children, hint}: {label:string; children:React.ReactNode; hint?:string}) {
  return <label className="sw-discovery-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function FilterSection({title, children, active=false}: {title:string; children:React.ReactNode; active?:boolean}) {
  return <details className="sw-discovery-section"><summary><span>{title}</span>{active ? <i aria-label="Filters applied">Applied</i> : null}<ChevronDown aria-hidden="true" /></summary><div className="sw-discovery-grid">{children}</div></details>;
}

export function LibraryToolbar({
  state,onStateChange,availableTypes=DEFAULT_TYPE_CHIPS,subKindParent,subKinds,activeSubKinds=[],onSubKindsChange,
  primitiveCategories=[],itemTags=[],activeTags=[],showAdvancedFilters=true,showVisibilityFilter=true,
  showSearch=true,searchPlaceholder="Search by name…",forceExpandFilters=false,
}:LibraryToolbarProps) {
  const {isGameMaster}=useAccount();
  const [collectionRows,setCollectionRows]=useState<{id:string;name:string}[]>([]);
  useEffect(()=>{fetch("/api/collections").then(r=>r.json()).then(d=>setCollectionRows(d.collections??[])).catch(()=>{});},[]);
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(forceExpandFilters);
  const [familySearch,setFamilySearch]=useState("");
  const filterId=useId();
  const tags=(state.tags === undefined ? activeTags : state.tags.split(",").map(tag=>tag.trim()).filter(Boolean));
  const primitiveScope=["ALL","PRIMITIVE","GROUP_MECHANICS"].includes(state.typeFilter);
  const update=<K extends keyof LibraryToolbarState>(key:K,value:LibraryToolbarState[K])=>onStateChange({...state,[key]:value});
  const mechanicsActive=!!(state.definitionKind||state.mechanicTarget||state.recipient||state.conditionMode||state.minMagnitude||state.maxMagnitude||state.mirrorableOnly);
  const publicationActive=!!(state.author||state.minLikes||state.minForks||state.hasForks||state.fromDate||state.toDate||(state.visibility && state.visibility!=="ANY"));
  const hasActiveFilters=!!state.collectionId||state.search!==""||state.typeFilter!=="ALL"||!!state.category||!!state.tier||(state.origin??"all")!=="all"||!!state.minBu||!!state.maxBu||tags.length>0||mechanicsActive||publicationActive||activeSubKinds.length>0;
  const clear=()=>{
    setFamilySearch("");
    onSubKindsChange?.([]);
    onStateChange({...EMPTY_LIBRARY_TOOLBAR_STATE,view:state.view,sort:state.sort,definitionKind:"",mechanicTarget:"",recipient:"",conditionMode:"",minMagnitude:"",maxMagnitude:"",origin:"all",tier:""});
  };
  const toggleTag=(value:string)=>update("tags",(tags.includes(value)?tags.filter(tag=>tag!==value):[...tags,value]).join(","));
  const familyOptions=primitiveCategories.filter(category=>category.value===state.category||category.label.toLowerCase().includes(familySearch.toLowerCase()));
  const showSubKinds=subKindParent===state.typeFilter&&!!subKinds?.length;
  return <div className="v12-library-toolbar sw-discovery">
    <div className="sw-discovery-search-row">
      {showSearch ? <label className="sw-discovery-search"><Search aria-hidden="true"/><input aria-label="Search library" type="search" value={state.search} onChange={event=>update("search",event.target.value)} placeholder={searchPlaceholder}/></label> : null}
      {!forceExpandFilters ? <button type="button" className="sw-discovery-mobile-toggle md:hidden" aria-expanded={mobileFiltersOpen} aria-controls={filterId} onClick={()=>setMobileFiltersOpen(open=>!open)}><SlidersHorizontal aria-hidden="true"/>Filters{hasActiveFilters?" •":""}</button> : null}
    </div>
    <div id={filterId} className={cn("sw-discovery-body",forceExpandFilters||mobileFiltersOpen?"block":"hidden md:block")}>
      <div className="sw-discovery-grid sw-discovery-primary">
        {collectionRows.length>0&&<FilterField label="Collection"><select value={state.collectionId??""} onChange={event=>update("collectionId",event.target.value)}><option value="">All entries</option>{collectionRows.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FilterField>}
        <FilterField label="Browse"><div className="sw-discovery-type-select"><EntityTypeIcon type={state.typeFilter}/><select value={state.typeFilter} onChange={event=>onStateChange({...state,typeFilter:event.target.value as LibraryToolbarState["typeFilter"],category:"",tier:""})}>{!availableTypes.some(type=>type.key===state.typeFilter&&(isGameMaster||type.key!=="MONSTER"))?<option value={state.typeFilter}>Current selection</option>:null}{availableTypes.filter(type=>isGameMaster||type.key!=="MONSTER").map(type=><option key={type.key} value={type.key}>{type.label}</option>)}</select></div></FilterField>
        <FilterField label="Sort by"><select value={state.sort} onChange={event=>update("sort",event.target.value as LibrarySort)}>{SORT_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></FilterField>
      </div>
      <div className="sw-discovery-grid">
        <FilterField label="Source"><select value={state.origin??"all"} onChange={event=>update("origin",event.target.value as NonNullable<LibraryToolbarState["origin"]>)}><option value="all">All sources</option><option value="system">System / SRD</option><option value="community">Community</option></select></FilterField>
        {primitiveScope?<FilterField label="Tier"><select value={state.tier??""} onChange={event=>update("tier",event.target.value)}><option value="">All tiers</option>{[1,2,3,4,5].map(tier=><option key={tier} value={tier}>Tier {tier}</option>)}</select></FilterField>:null}
        <FilterField label="Minimum BU"><input type="number" min="0" placeholder="No minimum" value={state.minBu??""} onChange={event=>update("minBu",event.target.value)}/></FilterField>
        <FilterField label="Maximum BU"><input type="number" min="0" placeholder="No maximum" value={state.maxBu??""} onChange={event=>update("maxBu",event.target.value)}/></FilterField>
      </div>
      <div className="sw-discovery-actions"><label className="sw-discovery-check"><input type="checkbox" checked={state.maxBu==="0"&&!state.minBu} onChange={()=>onStateChange({...state,minBu:"",maxBu:state.maxBu==="0"?"":"0"})}/>Free entries only</label><div className="sw-discovery-view" aria-label="Result layout">{(["LIST","GRID"] as const).map(view=><button key={view} type="button" aria-pressed={state.view===view} onClick={()=>update("view",view)}>{view==="LIST"?"List":"Grid"}</button>)}</div></div>
      {primitiveScope&&primitiveCategories.length>0?<div className="sw-discovery-family"><FilterField label="Rule family"><input type="search" aria-label="Find a rule family" placeholder="Find a family…" value={familySearch} onChange={event=>setFamilySearch(event.target.value)}/><select aria-label="Rule family" value={state.category} onChange={event=>update("category",event.target.value)}><option value="">All families</option>{familyOptions.map(category=><option key={category.value} value={category.value}>{category.label} ({category.count})</option>)}</select></FilterField>{familyOptions.length===0?<small>No matching families.</small>:null}</div>:null}
      {showSubKinds?<div className="sw-discovery-chips">{subKinds!.map(kind=><button key={kind.key} type="button" aria-pressed={activeSubKinds.includes(kind.key)} onClick={()=>onSubKindsChange?.(activeSubKinds.includes(kind.key)?activeSubKinds.filter(value=>value!==kind.key):[...activeSubKinds,kind.key])}>{kind.label}</button>)}</div>:null}
      {showAdvancedFilters?<>
        {primitiveScope?<FilterSection title="Mechanical details" active={mechanicsActive}>
          <FilterField label="Primitive role"><select value={state.definitionKind??""} onChange={event=>update("definitionKind",event.target.value as LibraryToolbarState["definitionKind"])}><option value="">All roles</option><option value="TEMPLATE">Base families to fork</option><option value="EXPRESSION">Ready-to-use expressions</option></select></FilterField>
          <FilterField label="What it changes" hint="Physical, awareness, speed, slots…"><input value={state.mechanicTarget??""} placeholder="Result or permission" onChange={event=>update("mechanicTarget",event.target.value)}/></FilterField>
          <FilterField label="Recipient"><select value={state.recipient??""} onChange={event=>update("recipient",event.target.value as LibraryToolbarState["recipient"])}><option value="">Anyone</option><option value="self">Self</option><option value="target">Target</option><option value="scene">Scene</option></select></FilterField>
          <FilterField label="When it applies"><select value={state.conditionMode??""} onChange={event=>update("conditionMode",event.target.value as LibraryToolbarState["conditionMode"])}><option value="">Any trigger</option><option value="always">Always active</option><option value="conditional">Authored condition</option></select></FilterField>
          <FilterField label="Minimum fixed value"><input type="number" value={state.minMagnitude??""} placeholder="Any value" onChange={event=>update("minMagnitude",event.target.value)}/></FilterField>
          <FilterField label="Maximum fixed value" hint="Signed numbers; excludes dice and formulas."><input type="number" value={state.maxMagnitude??""} placeholder="Any value" onChange={event=>update("maxMagnitude",event.target.value)}/></FilterField>
          <label className="sw-discovery-check sw-discovery-full"><input type="checkbox" checked={!!state.mirrorableOnly} onChange={event=>update("mirrorableOnly",event.target.checked)}/>Mirrorable primitives only</label>
        </FilterSection>:null}
        <FilterSection title="Tags" active={tags.length>0}><FilterField label="Required tags" hint="Every listed tag must match."><input value={state.tags??""} placeholder="Comma-separated tags" onChange={event=>update("tags",event.target.value)}/></FilterField>{state.typeFilter==="ITEM"&&itemTags.length>0?<div className="sw-discovery-chips sw-discovery-full">{itemTags.map(tag=><button key={tag.value} type="button" aria-pressed={tags.includes(tag.value)} onClick={()=>toggleTag(tag.value)}>{tag.label} <small>{tag.count}</small></button>)}</div>:null}</FilterSection>
        <FilterSection title="Publication & activity" active={publicationActive}>
          <FilterField label="Author"><input value={state.author} placeholder="Username" onChange={event=>update("author",event.target.value)}/></FilterField>
          {showVisibilityFilter?<FilterField label="Visibility"><select value={state.visibility??"ANY"} onChange={event=>update("visibility",event.target.value as LibraryToolbarState["visibility"])}><option value="ANY">Any visibility</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select></FilterField>:null}
          <FilterField label="Minimum likes"><input type="number" min="0" value={state.minLikes} onChange={event=>update("minLikes",event.target.value)}/></FilterField>
          <FilterField label="Minimum forks"><input type="number" min="0" value={state.minForks??""} onChange={event=>update("minForks",event.target.value)}/></FilterField>
          <FilterField label="Published after"><input type="date" value={state.fromDate??""} onChange={event=>update("fromDate",event.target.value)}/></FilterField>
          <FilterField label="Published before"><input type="date" value={state.toDate??""} onChange={event=>update("toDate",event.target.value)}/></FilterField>
          <label className="sw-discovery-check sw-discovery-full"><input type="checkbox" checked={state.hasForks} onChange={event=>update("hasForks",event.target.checked)}/>Entries with forks only</label>
        </FilterSection>
      </>:null}
      <div className="sw-discovery-footer"><span>{hasActiveFilters?"Filters apply as you choose.":"Explore the full collection."}</span><button type="button" onClick={clear} disabled={!hasActiveFilters}>Clear filters</button></div>
    </div>
  </div>;
}
