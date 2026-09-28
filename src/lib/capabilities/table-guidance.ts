/** Play declarations, not purchased mechanics. Stored as a readable section of the narrative. */
export const TABLE_AXES = {
  target: {label:"Targets",values:["Single","Multiple","Area","Custom"]},
  shape: {label:"Shape",values:["Direct","Cone","Line","Sphere","Zone","Beam","Custom"]},
  size: {label:"Size",values:["One target","5 ft","10 ft","20 ft","Custom"]},
  placement: {label:"Placement",values:["Self","Target","Point","Directional","Custom"]},
  duration: {label:"Effect duration",values:["Instant","Short","Medium","Long","Scene","Persistent","Permanent","Custom"]},
  casting: {label:"Casting time",values:["Action","Reaction","Instant","Short","Medium","Long","Scene","Custom"]},
} as const;
export type TableAxis = keyof typeof TABLE_AXES;
export type TableGuidance = Record<TableAxis,string> & {range:string;output:string};
export const DEFAULT_TABLE: TableGuidance = {target:"Single",shape:"Direct",size:"One target",placement:"Target",duration:"Instant",casting:"Action",range:"Touch",output:"None"};
export const TABLE_HELP: Record<string,Record<string,string>> = {
 duration:{Instant:"One resolution; no ongoing effect.",Short:"Brief persistence, measured in rounds.",Medium:"Encounter-length presence within the scene.",Long:"Continues across multiple scenes or a narrative segment.",Scene:"Lasts until this scene ends.",Persistent:"Ongoing until removed or its ending condition is met.",Permanent:"A lasting change requiring explicit reversal.",Custom:"Describe its ending condition or intended length."},
 casting:{Action:"Normal action resolution.",Reaction:"Triggered by a stated event; declare the trigger and negotiate interruption timing.",Instant:"Immediate resolution on declaration; compressing time can raise Strain.",Short:"A brief preparation. Agree the exact time before rolling; this label grants no extra action.",Medium:"A deliberate preparation, longer than a brief action. Agree its duration with the DM.",Long:"An extended preparation or ritual. Specify the time and what can interrupt it.",Scene:"Preparation occupies a scene.",Custom:"Describe the timing, trigger, or preparation required."},
 range:{Touch:"Self, touch, or melee contact within 5 ft.",Close:"5–10 ft; immediate proximity.",Near:"30 ft; standard combat range.",Far:"60 ft; extended tactical reach.","Very Far":"120 ft; across a battlefield.",Extreme:"240 ft–3 miles; agree the applicable scope of the purchased primitive."}
};
const heading = "\n\n### At the table · suggested intent\n";
export function writeTableGuidance(description:string, table:TableGuidance|null):string {
 const base=readTableGuidance(description).description.trim();
 if(!table)return base;
 return base+heading+Object.entries(TABLE_AXES).map(([key,axis])=>`- ${axis.label}: ${table[key as TableAxis].replaceAll("\n"," ")}`).join("\n")+"\n\nThese are optional play declarations. Greater scale, impact, complexity, or time compression raises Strain; agree the cost before rolling. Range and output use purchased primitives.";
}
export function readTableGuidance(text:string):{description:string;table:TableGuidance|null} {
 const index=text.indexOf(heading);if(index<0)return {description:text,table:null};
 const section=text.slice(index+heading.length);const table={...DEFAULT_TABLE};
 for(const [key,axis] of Object.entries(TABLE_AXES)) {const line=section.split("\n").find(row=>row.startsWith(`- ${axis.label}: `));if(line)table[key as TableAxis]=line.slice(axis.label.length+4);}
 return {description:text.slice(0,index),table};
}
