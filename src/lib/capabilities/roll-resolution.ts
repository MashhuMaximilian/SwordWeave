export type RollMode = "unspecified"|"action"|"save"|"practice"|"opposed"|"automatic";
export type RollResolution = {mode:RollMode;check:string;dc:string;outcome:string};
export const EMPTY_RESOLUTION:RollResolution={mode:"unspecified",check:"",dc:"",outcome:""};
const modes:Record<RollMode,string>={unspecified:"Not specified",action:"I make an action roll",save:"Target makes a saving throw",practice:"Target makes a practice check",opposed:"Opposed checks",automatic:"No roll"};
const heading="\n\n### Roll resolution\n";
export function readRollResolution(text:string):{description:string;resolution:RollResolution}{
 const start=text.indexOf(heading);if(start<0)return {description:text,resolution:{...EMPTY_RESOLUTION}};
 const contentStart=start+heading.length;const end=text.indexOf("\n\n### ",contentStart);const section=text.slice(contentStart,end<0?undefined:end);
 const read=(label:string)=>section.split("\n").find(line=>line.startsWith(`- ${label}: `))?.slice(label.length+4)??"";
 const stored=read("Mode");const mode=Object.entries(modes).find(([,label])=>label===stored)?.[0]??stored;const known:RollMode[]=["unspecified","action","save","practice","opposed","automatic"];
 return {description:text.slice(0,start)+(end<0?"":text.slice(end)),resolution:{mode:known.includes(mode as RollMode)?mode as RollMode:"unspecified",check:read("Check"),dc:read("Against"),outcome:read("Outcome")}};
}
export function writeRollResolution(description:string,resolution:RollResolution):string{
 const base=readRollResolution(description).description.trim();if(resolution.mode==="unspecified")return base;
 const labels={mode:"Mode",check:"Check",dc:"Against",outcome:"Outcome"};
 return base+heading+Object.entries(resolution).filter(([,value])=>value).map(([key,value])=>`- ${labels[key as keyof RollResolution]}: ${(key==="mode"?modes[value as RollMode]:value).replaceAll("\n"," ")}`).join("\n");
}
