"use client";
import { useId } from "react";
import { Globe, Users, Lock } from "lucide-react";
import "./visibility-choices.css";
export type EntryVisibility = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";
export function VisibilityChoices({value,onChange,disabled=false,label="Visibility",hint}:{value:EntryVisibility;onChange:(value:EntryVisibility)=>void;disabled?:boolean;label?:string;hint?:string}) {
 const name=useId();
 return <fieldset className="sw-visibility-choices" disabled={disabled}><legend>{label}</legend><div>{([
 {value:"PRIVATE",label:"Private",hint:"Only you",icon:Lock},
 {value:"FOLLOWERS_ONLY",label:"Followers",hint:"You and your followers",icon:Users},
 {value:"PUBLIC",label:"Public",hint:"Everyone",icon:Globe},
 ] as const).map(option=><label key={option.value} title={option.hint} className={value===option.value?"is-selected":""}><input type="radio" name={name} value={option.value} checked={value===option.value} onChange={()=>onChange(option.value)}/><option.icon size={14}/><span>{option.label}</span></label>)}</div>{hint&&<small>{hint}</small>}</fieldset>;
}
