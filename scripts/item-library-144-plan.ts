import { seedOrigin } from "./srd-seed-identity";
import { readFileSync } from "node:fs";
import { db } from "@/db/client";
import {capabilities,capabilityEffects,capabilityPrimitives,effectPrimitives,effects,items,primitives} from "@/db/schema";
import {itemShelf,ITEM_SHELF_ORIGIN} from "./item-library-144-data";
import {expansionPrimitives,expansionEffects,expansionCapabilities} from "./phase4-expansion-data-2026-10";
export const itemSlug=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export async function planItemShelf(){
 const [ps,es,cs,eps,cps,ces,existing]=await Promise.all([db.select().from(primitives),db.select().from(effects),db.select().from(capabilities),db.select().from(effectPrimitives),db.select().from(capabilityPrimitives),db.select().from(capabilityEffects),db.select().from(items)]);
 const prefer=<T extends {name:string;isPublic:boolean;sourceOrigin:string|null}>(rows:T[])=>new Map(rows.filter(x=>x.isPublic).sort((a,b)=>Number(!!seedOrigin(a)?.startsWith("system"))-Number(!!seedOrigin(b)?.startsWith("system"))).map(x=>[x.name,x]));
 const p=prefer(ps),e=prefer(es),c=prefer(cs);
 const knownP=new Map(expansionPrimitives.map(x=>[x.name,x])),knownE=new Map(expansionEffects.map(x=>[x.name,x])),knownC=new Map(expansionCapabilities.map(x=>[x.name,x]));
 const iconJSON=JSON.parse(readFileSync("src/lib/icons/game-icons-index.json","utf8"));
 const iconKeys=new Set<string>();function walk(x:unknown){if(Array.isArray(x)){for(const y of x)walk(y)}else if(x&&typeof x==="object"){const row=x as Record<string,unknown>;if(typeof row["key"]==="string")iconKeys.add(row["key"]);if(typeof row["author"]==="string"&&typeof row["slug"]==="string")iconKeys.add(`${row["author"]}/${row["slug"]}`);for(const v of Object.values(row))if(v&&typeof v==="object")walk(v)}}walk(iconJSON);
 // Current index stores entries with slug and author (or key); fail closed for unknown icons.
 const raw=readFileSync("src/lib/icons/game-icons-index.json","utf8");
 const pending=new Set<string>();
 const collect=(kind:"p"|"e"|"c",name:string,out:Map<string,number>,seen:Set<string>)=>{
  const tag=`${kind}:${name}`;if(seen.has(tag))return;seen.add(tag);
  if(kind==="p"){const row=p.get(name),draft=knownP.get(name);if(!row&&!draft)throw new Error(`Unknown primitive ${name}`);out.set(name,row?.buCost??draft!.bu);if(!row)pending.add(tag);return;}
  if(kind==="e"){const row=e.get(name),draft=knownE.get(name);if(!row&&!draft)throw new Error(`Unknown effect ${name}`);if(row){for(const link of eps.filter(x=>x.effectId===row.id)){const pr=ps.find(x=>x.id===link.primitiveId);if(!pr||!pr.isPublic)throw new Error(`Nonpublic effect ingredient ${name}`);collect("p",pr.name,out,seen)}}else{pending.add(tag);for(const pn of draft!.primitives)collect("p",pn,out,seen)}return;}
  const row=c.get(name),draft=knownC.get(name);if(!row&&!draft)throw new Error(`Unknown capability ${name}`);if(row){for(const link of cps.filter(x=>x.capabilityId===row.id)){const pr=ps.find(x=>x.id===link.primitiveId);if(!pr||!pr.isPublic)throw new Error(`Nonpublic capability ingredient ${name}`);collect("p",pr.name,out,seen)}for(const link of ces.filter(x=>x.capabilityId===row.id)){const er=es.find(x=>x.id===link.effectId);if(!er||!er.isPublic)throw new Error(`Nonpublic capability effect ${name}`);collect("e",er.name,out,seen)}}else{pending.add(tag);for(const pn of draft!.primitives)collect("p",pn,out,seen);for(const en of draft!.effects)collect("e",en,out,seen)}
 };
 const plan=itemShelf.map(item=>{
  if(!iconKeys.has(item.iconKey)&&!raw.includes(`"${item.iconKey}"`))throw new Error(`Invalid icon ${item.iconKey}`);
  if(item.isTwoHanded&&item.slotCost<2)throw new Error(`Two-handed minimum ${item.name}`);
  if(item.description.length<100)throw new Error(`Incomplete description ${item.name}`);
  const ingredients=new Map<string,number>(),seen=new Set<string>();
  for(const n of item.primitives)collect("p",n,ingredients,seen);for(const n of item.effects)collect("e",n,ingredients,seen);for(const n of item.capabilities)collect("c",n,ingredients,seen);
  if(!ingredients.size)throw new Error(`Empty recipe ${item.name}`);
  return{...item,buCost:[...ingredients.values()].reduce((a,b)=>a+b,0),sourceOrigin:ITEM_SHELF_ORIGIN+itemSlug(item.name),ingredients:[...ingredients.keys()]};
 });
 if(plan.length!==144||new Set(plan.map(x=>x.name)).size!==144)throw new Error("Item shelf count/unique names");
 const counts=new Map<string,number>();for(const x of plan)counts.set(x.category,(counts.get(x.category)??0)+1);if(counts.size!==12||[...counts.values()].some(x=>x!==12))throw new Error("Category coverage must be12x12");
 return{plan,p,e,c,existing,pending:[...pending],counts:Object.fromEntries(counts)};
}
