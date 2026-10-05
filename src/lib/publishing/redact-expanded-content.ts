import { visibleEntries } from "@/lib/collections/service";
const children = [["primitiveLinks","primitive","PRIMITIVE"],["capabilityLinks","capability","CAPABILITY"],["effectLinks","effect","EFFECT"],["itemLinks","item","ITEM"]] as const;
/** Expanded API responses are views, not storage. A readable parent never
 * grants access to the complete source metadata of a hidden child. */
export async function redactExpandedContent<T>(value:T,viewer:string|null):Promise<T> {
 const refs=new Map<string,{targetType:string;targetId:string}>();let visited=0;
 function collect(v:unknown){
  if(++visited>50000)throw new Error("Expanded preview exceeds the supported size.");
  if(Array.isArray(v)){v.forEach(collect);return;}
  if(!v||typeof v!=="object")return;
  const row=v as Record<string,unknown>;
  for(const [field,kind,type]of children)if(Array.isArray(row[field]))for(const link of row[field]){
   const id=String(link[`${kind}Id`]??link[kind]?.id??"");if(id)refs.set(`${type}:${id}`,{targetType:type,targetId:id});collect(link[kind]);
  }
 }
 collect(value);if(!refs.size)return value;
 if(refs.size>5000)throw new Error("Too many expanded component references.");
 const allowed=new Set((await visibleEntries([...refs.values()],viewer)).map(r=>`${r.targetType}:${r.targetId}`));
 function clean(v:unknown):unknown{
  if(Array.isArray(v))return v.map(clean);if(!v||typeof v!=="object")return v;
  const row={...v} as Record<string,unknown>;
  for(const [field,kind,type]of children)if(Array.isArray(row[field]))row[field]=row[field].filter(link=>allowed.has(`${type}:${String(link[`${kind}Id`]??link[kind]?.id??"")}`)).map(link=>({...link,[kind]:clean(link[kind])}));
  return row;
 }
 return clean(value) as T;
}
