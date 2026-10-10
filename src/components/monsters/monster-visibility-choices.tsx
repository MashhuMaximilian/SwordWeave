"use client";
import {VisibilityChoices,type EntryVisibility} from "@/components/library/visibility-choices";
export function MonsterVisibilityChoices({value,onChange,disabled=false}:{value:EntryVisibility;onChange:(value:EntryVisibility)=>void;disabled?:boolean}) {
 return <VisibilityChoices value={value} onChange={onChange} disabled={disabled} hint="Saved with the template. Play copies stay private."/>;
}
