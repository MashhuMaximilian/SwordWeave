"use client";
import type { ReactNode } from "react";
import { LibraryToolbar, type LibraryToolbarState } from "./library-toolbar";

/** One filter form shared by narrow drawers and full-width Library panels. */
export function PhoneLibraryFilters({state,onChange,categories,types,children,source}: {
  state:LibraryToolbarState; onChange:(state:LibraryToolbarState)=>void;
  categories:Array<{value:string;label:string;count:number}>;
  types?:Array<{value:LibraryToolbarState["typeFilter"];label:string}>;
  children?:ReactNode; source?:ReactNode;
}) {
  return <div>{source}<LibraryToolbar state={state} onStateChange={onChange} primitiveCategories={categories} {...(types?{availableTypes:types.map(type=>({key:type.value,label:type.label}))}:{})} showVisibilityFilter={false} showSearch={false} forceExpandFilters/>{children?<details className="sw-discovery-section"><summary>More filters</summary>{children}</details>:null}</div>;
}
