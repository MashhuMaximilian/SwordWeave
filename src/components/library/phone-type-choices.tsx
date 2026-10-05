"use client";
import { IconDisplay } from "@/components/icons/icon-display";

const icons: Record<string, string> = {
  MONSTER:"lorc/monster-grasp", monster:"lorc/monster-grasp",
  ALL: "delapouite/bookshelf", GROUP_MECHANICS: "lorc/cubeforce", mechanics: "lorc/cubeforce",
  PRIMITIVE: "delapouite/cube", primitive: "delapouite/cube",
  EFFECT: "lorc/cubes", effect: "lorc/cubes",
  CAPABILITY: "lorc/cubeforce", capability: "lorc/cubeforce",
  GROUP_HERITAGES: "lorc/dna2", heritage: "lorc/dna2",
  LINEAGE_TEMPLATE: "lorc/dna2", UPBRINGING_TEMPLATE: "delapouite/plant-roots",
  MANIFEST_TEMPLATE: "caro-asercion/tarot-11-justice", ITEM: "lorc/battle-gear", item: "lorc/battle-gear",
};
export const PHONE_RECORD_TYPES = [
  {value:"MONSTER",label:"Monsters & NPCs"},
  {value:"ALL",label:"All"},{value:"PRIMITIVE",label:"Primitives"},{value:"EFFECT",label:"Effects"},
  {value:"CAPABILITY",label:"Capabilities"},{value:"LINEAGE_TEMPLATE",label:"Lineages"},
  {value:"UPBRINGING_TEMPLATE",label:"Upbringings"},{value:"MANIFEST_TEMPLATE",label:"Manifests"},{value:"ITEM",label:"Items"},
];
/** Native buttons retain keyboard and touch semantics while sharing the game's icons. */
export function PhoneTypeChoices({label,value,options,onChange}:{label:string;value:string;options:Array<{value:string;label:string}>;onChange:(value:string)=>void}) {
  return <div className="phone-type-choices" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}><IconDisplay iconSource="GAME_ICONS" iconKey={icons[option.value]??"delapouite/bookshelf"} size={18} alt=""/><span>{option.label}</span></button>)}</div>;
}
