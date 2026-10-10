"use client";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";

export const PHONE_RECORD_TYPES = [
  {value:"MONSTER",label:"Monsters & NPCs"},{value:"CHARACTER",label:"Characters"},{value:"ENCOUNTER",label:"Encounters"},
  {value:"ALL",label:"All"},{value:"PRIMITIVE",label:"Primitives"},{value:"EFFECT",label:"Effects"},
  {value:"CAPABILITY",label:"Capabilities"},{value:"LINEAGE_TEMPLATE",label:"Lineages"},
  {value:"UPBRINGING_TEMPLATE",label:"Upbringings"},{value:"MANIFEST_TEMPLATE",label:"Manifests"},{value:"ITEM",label:"Items"},{value:"BUILD_TEMPLATE",label:"Builds"},
];
/** Native buttons retain keyboard and touch semantics while sharing the game's icons. */
export function PhoneTypeChoices({label,value,options,onChange}:{label:string;value:string;options:Array<{value:string;label:string}>;onChange:(value:string)=>void}) {
  return <div className="phone-type-choices" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}><EntityTypeIcon type={option.value} size={18}/><span>{option.label}</span></button>)}</div>;
}
