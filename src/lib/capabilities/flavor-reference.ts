export type FlavorKind="domain"|"verb";
export function readFlavorReference(text:string,kind:FlavorKind):string{
 const prefix=`Flavor ${kind}: `;
 return text.split("\n").find(line=>line.startsWith(prefix))?.slice(prefix.length).split(".")[0]?.trim()??"";
}
export function writeFlavorReference(text:string,kind:FlavorKind,value:string):string{
 const base=text.split("\n").filter(line=>!line.startsWith(`Flavor ${kind}: `)).join("\n").trim();
 const flavor=value.replace(/[.\n]/g,"");
 return base+(flavor?`\n\nFlavor ${kind}: ${flavor}. Narrative reference only; no purchased access.`:"");
}
