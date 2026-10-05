import { readableMonsterComponents } from "./visibility";
import { loadWorkspaceNodes,type LoadedNode } from "@/lib/character/workspace/load-nodes";
import { resolvePinnedNode } from "@/lib/character/workspace/pinned-versions";
import type { EntityKey,EntityKind } from "@/lib/character/workspace/model";
import type { HardModifier } from "@/types/swordweave";
import type { ConsequenceBehavior } from "@/lib/character/consequences/types";
import type { MonsterDefinition,MonsterReference } from "./model";
import type { MonsterSlot } from "./resolve";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { effectEffects } from "@/db/schema/engine";
export type MonsterComponentPin = { key:string; name:string; kind:EntityKind; id:string; versionId:string|null; links:LoadedNode["links"]; fallback?:Record<string,unknown> };
/** Materialize the existing version-aware composition graph, retaining alternate supply paths. */
export async function resolveMonsterComposition(definition:MonsterDefinition & {componentPins?:MonsterComponentPin[]},userId?:string|null,capture?: (pins:MonsterComponentPin[])=>void,options?:{trustedPinnedComposition?:boolean}):Promise<MonsterSlot[]> {
 const slots:MonsterSlot[]=[];const cache=new Map<EntityKey,LoadedNode>();const captured=new Map<string,MonsterComponentPin>();
 function effective(kind:EntityKind,ref:MonsterReference){const entry=cache.get(`${kind}:${ref.id}`)!;const selected=resolvePinnedNode(kind,entry,ref.versionId?[ref.versionId]:[]);const stored=definition.componentPins?.find(p=>p.kind===kind&&p.id===ref.id&&p.versionId===(ref.versionId??selected.versionId)||p.kind===kind&&p.id===ref.id&&!ref.versionId&&p.versionId===null);if(options?.trustedPinnedComposition&&(!stored||(!stored.versionId&&!stored.fallback)))throw new Error("Pinned play composition is incomplete.");return stored?{...selected,versionId:stored.versionId,row:stored.fallback?{...stored.fallback,id:entry.row["id"],userId:entry.row["userId"]}:selected.row,links:stored.links}:selected; }
 // Read one type batch per graph frontier. Pins travel with each frontier entry.
 let resolutionSteps=0;let frontier=[...definition.references];const expanded=new Set<string>();const nested=new Map<string,{kind:EntityKind;id:string;data:Record<string,unknown>}[]>();
 while(frontier.length){
  if(cache.size>5000)throw new Error("This monster exceeds 5,000 distinct components. Split the composition into smaller templates.");
  const keys=[...new Set(frontier.map(r=>`${r.kind.toLowerCase()}:${r.id}` as EntityKey))].filter(k=>!cache.has(k));
  if(keys.length){const [nodes,readable]=await Promise.all([loadWorkspaceNodes(keys),options?.trustedPinnedComposition?Promise.resolve(new Set(keys)):readableMonsterComponents(keys,userId)]);for(const key of keys){const node=nodes.get(key);if(!node||!readable.has(key))throw new Error(`${key} is unavailable.`);cache.set(key,node);}
   const effectIds=keys.filter(k=>k.startsWith("effect:")).map(k=>k.slice(7));if(effectIds.length)for(const link of await db.select().from(effectEffects).where(inArray(effectEffects.parentEffectId,effectIds)))nested.set(link.parentEffectId,[...(nested.get(link.parentEffectId)??[]),{kind:"effect",id:link.childEffectId,data:{}}]);
  }
  const next:MonsterReference[]=[];
  for(const ref of frontier){const token=`${ref.kind}:${ref.id}:${ref.versionId??"latest"}`;if(expanded.has(token))continue;expanded.add(token);const kind=ref.kind.toLowerCase() as EntityKind;const node=effective(kind,ref);if(node.row["workspaceVersionIssue"])throw new Error(String(node.row["workspaceVersionIssue"]));const links=[...node.links,...(kind==="effect"&&!ref.versionId&&!definition.componentPins?nested.get(ref.id)??[]:[])];captured.set(`${kind}:${ref.id}:${node.versionId??"unpublished"}`,{key:`${kind}:${ref.id}:${node.versionId??"unpublished"}`,name:String(node.row["name"]??ref.id),kind,id:ref.id,versionId:node.versionId,links,...(!node.versionId?{fallback:Object.fromEntries(["name","description","narrativeRule","verboseDescription","narrativeDescription","category","buCost","hardModifiers","isMirrorable","mirrorVector","consequenceBehavior","isNotEquippable"].filter(k=>node.row[k]!==undefined).map(k=>[k,node.row[k]]))}:{})});for(const link of links){const pin="versionId" in link?link.versionId:link.data["versionId"];next.push({kind:link.kind.toUpperCase() as MonsterReference["kind"],id:String(link.id),quantity:1,isMirrored:false,versionId:typeof pin==="string"?pin:null});}}
  frontier=next;
 }
 async function walk(ref:MonsterReference,ancestors:string[]=[],item=false,versions:string[]=[]){
  if(++resolutionSteps>50000)throw new Error("This composition has too many alternate supply paths. Simplify shared nesting before previewing it.");
  const kind=ref.kind.toLowerCase() as EntityKind,key=`${kind}:${ref.id}` as EntityKey;
  if(ancestors.includes(key))throw new Error("Cyclic monster composition.");
  const entry=cache.get(key)!;
  const selected=effective(kind,ref);
  if(selected.row["workspaceVersionIssue"])throw new Error(String(selected.row["workspaceVersionIssue"]));
  const chain=[...ancestors,key], versionChain=[...versions,`${key}:${selected.versionId??"unpublished"}`], isItem=item||kind==="item";
  if(kind==="primitive"){
   if(ref.isMirrored&&selected.row["isMirrorable"]===false)throw new Error("This primitive cannot be mirrored.");
   const dependencyKey=`${key}:${selected.versionId??"unpublished"}:${ref.isMirrored}:${isItem}`;
   const existing=slots.find(s=>s.dependencyKey===dependencyKey);
   if(existing){existing.supplyKeys?.push(chain);existing.supplyNames={...existing.supplyNames,...Object.fromEntries(chain.map((k,i)=>[k,captured.get(versionChain[i]!)?.name??String(cache.get(k as EntityKey)?.row["name"]??k)]))};existing.quantity=Math.max(existing.quantity,ref.quantity);return;}
   const row=selected.row;
   slots.push({primitiveId:Number(ref.id),name:String(row["name"]),category:String(row["category"]),hardModifiers:(row["hardModifiers"]??[]) as HardModifier[],buCost:Number(row["buCost"]??0),isMirrored:ref.isMirrored,isMirrorable:row["isMirrorable"]!==false,mirrorVector:typeof row["mirrorVector"]==="string"?row["mirrorVector"]:null,originHeritageId:chain.find(k=>k.startsWith("heritage:"))?.slice(9)??null,originCapabilityId:chain.find(k=>k.startsWith("capability:"))?.slice(11)??null,originEffectId:chain.find(k=>k.startsWith("effect:"))?.slice(7)??null,originItemId:chain.find(k=>k.startsWith("item:"))?.slice(5)??null,quantity:ref.quantity,dependencyKey,item:isItem,supplyKeys:[chain],supplyNames:Object.fromEntries(chain.map((k,i)=>[k,captured.get(versionChain[i]!)?.name??String(cache.get(k as EntityKey)?.row["name"]??k)])),dependencyVersions:versionChain,consequenceBehavior:(row["consequenceBehavior"]??null) as ConsequenceBehavior|null});return;
  }
  const links=[...selected.links];
  // Legacy live effect memberships include nesting outside the shared loader.
  if(kind==="effect"&&!ref.versionId&&!definition.componentPins&&!links.some(l=>l.kind==="effect"))links.push(...nested.get(ref.id)??[]);
  for(const link of links){const quantity=Number(link.data["quantity"]??1)*ref.quantity;if(!Number.isSafeInteger(quantity)||quantity<1)throw new Error("Reference quantity is outside numeric safety.");const pin="versionId" in link?link.versionId:link.data["versionId"];await walk({kind:link.kind.toUpperCase() as MonsterReference["kind"],id:String(link.id),quantity,isMirrored:ref.isMirrored !== (link.data["isMirrored"]===true),versionId:typeof pin==="string"?pin:null},chain,isItem,versionChain);}
 }
 if(capture)capture([...captured.values()].map(pin=>({...pin,links:pin.links.map(link=>{const explicit="versionId" in link?link.versionId:link.data["versionId"];const child=cache.get(`${link.kind}:${link.id}`);const versionId=typeof explicit==="string"?explicit:child?.versions.filter(v=>v.latest).sort((a,b)=>b.number-a.number)[0]?.id??null;return {...link,data:{...link.data,versionId}};})})));
 for(const ref of definition.references)await walk(ref);
 return slots;
}
