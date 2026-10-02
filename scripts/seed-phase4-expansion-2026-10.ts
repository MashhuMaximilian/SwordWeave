/** Separate research expansion. Dry-run unless --apply; transaction, canonical full versions, fork edges. */
import {and,eq} from "drizzle-orm";
import {db,pool,withDatabaseTransaction} from "@/db/client";
import {primitives,primitiveVersions,primitiveMarketClassifications,forks,users,publications,effects,effectVersions,effectPrimitives,capabilities,capabilityVersions,capabilityPrimitives,capabilityEffects,heritageVersions} from "@/db/schema";
import {buildCanonicalPrimitivePayload,hashPrimitiveContent,buildCanonicalEffectPayload,hashEffectContent,buildCanonicalCapabilityPayload,hashCapabilityContent} from "@/lib/publishing/hash-content";
import {resolveContentVersionId} from "@/lib/versions/content-hash";
import {resolveVirtualVersionId} from "@/lib/engagement/version-helpers";
import icons from "@/lib/icons/game-icons-index.json";
import {expansionPrimitives,expansionEffects,expansionCapabilities,type ExpansionPrimitive} from "./phase4-expansion-data-2026-10";
type Primitive=typeof primitives.$inferSelect;
const prefix="system:v14:research-expansion:";
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export function expansionCandidate(parent:Primitive,idea:ExpansionPrimitive):Primitive {
 const condition=idea.condition ? {kind:"tags" as const,customTags:[`actor:manual:${slug(idea.condition).replaceAll("-","_")}`]}:undefined;
 const hard=idea.magnitude!==undefined ? [{...parent.hardModifiers![0]!,operation:"add" as const,value:idea.magnitude==="PB"?{kind:"derived" as const,which:"pb" as const}:{kind:"number" as const,value:idea.magnitude},condition,metadata:{...parent.hardModifiers![0]!.metadata,recipient:"SELF"}}] : [];
 return {...parent,id:0,name:idea.name,userId:null,isPublic:true,sourceOrigin:`${prefix}primitive:${slug(idea.name)}`,definitionKind:"EXPRESSION",templatePrimitiveId:parent.definitionKind==="TEMPLATE"?parent.id:parent.templatePrimitiveId,bindingSchema:{},bindings:parent.bindings??{},buCost:idea.bu,costTier:`Author price ${idea.bu} BU`,narrativeRule:idea.rule,mechanicalOutputText:idea.rule,mechanicalTemplateText:"",mechanicalRule:idea.magnitude!==undefined?{...parent.mechanicalRule,family:"UNIVERSAL_MODIFIER",operation:"add",value:hard[0]!.value,conditionText:idea.condition,recipient:"SELF"}:{family:"DESCRIPTIVE"},hardModifiers:hard,isMirrorable:idea.magnitude!==undefined,mirrorVector:idea.magnitude!==undefined?"VARIABLE_VECTOR":"STANDARD_ONLY",mirrorBuCredit:idea.magnitude!==undefined?idea.bu:0,mirrorEligibilityNotes:idea.magnitude!==undefined?"Mirroring reverses add/subtract. Context stays authored on this primitive.":"Description-only permission; no numerical operator to mirror.",iconSource:"GAME_ICONS",iconKey:idea.icon,iconUrl:null,iconColor:"#d8ad54",contentHash:null,createdAt:new Date(),updatedAt:new Date()};
}
function role(p:Primitive):"VERB"|"DOMAIN"|"SIZING"|"RANGE"|"DURATION"|"OUTPUT"|"OTHER"{return p.category==="DOMAIN"?"DOMAIN":p.category==="VERB_TIER"?"VERB":p.category==="RANGE"?"RANGE":p.category==="DURATION"?"DURATION":p.category==="INTENSITY_DICE"?"OUTPUT":p.category==="STRUCTURAL"||p.category==="SIZING"?"SIZING":"OTHER";}
async function publish(targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "LINEAGE_TEMPLATE" | "UPBRINGING_TEMPLATE" | "MANIFEST_TEMPLATE", targetId: string, versionId: string, versionNumber: number): Promise<void> {
  const [row] = await db.select().from(publications).where(and(eq(publications.targetType, targetType), eq(publications.targetId, targetId))).limit(1);
  if (row) {
    if (row.visibility !== "PUBLIC" || row.unpublishedAt) throw new Error(`Publication deliberately hidden: ${targetType}:${targetId}`);
    return;
  }
  // The app's create endpoint also uses a virtual publication id; version
  // snapshots remain content-addressed and are written separately.
  await db.insert(publications).values({ targetType, targetId, versionId: resolveVirtualVersionId(targetType, targetId), versionNumber: 1, authorId: null, visibility: "PUBLIC" });
  void versionId; void versionNumber;
}

async function saveVersion(kind: "primitive" | "effect" | "capability" | "template", id: number | string, hash: string, snapshot: Record<string, unknown>): Promise<{ id: string; number: number }> {
  const table = kind === "primitive" ? primitiveVersions : kind === "effect" ? effectVersions : kind === "capability" ? capabilityVersions : heritageVersions;
  const fk = kind === "primitive" ? primitiveVersions.primitiveId : kind === "effect" ? effectVersions.effectId : kind === "capability" ? capabilityVersions.capabilityId : heritageVersions.templateId;
  const prior = await db.select().from(table).where(eq(fk as never, id as never)).orderBy(kind === "primitive" ? primitiveVersions.versionNumber : kind === "effect" ? effectVersions.versionNumber : kind === "capability" ? capabilityVersions.versionNumber : heritageVersions.versionNumber);
  const versionId = resolveContentVersionId(kind, id, hash);
  const found = prior.find(x => x.id === versionId);
  if (found) return { id: found.id, number: found.versionNumber };
  const number = (prior.at(-1)?.versionNumber ?? 0) + 1;
  if (kind === "primitive") {
    await db.update(primitiveVersions).set({ isLatest: false }).where(eq(primitiveVersions.primitiveId, Number(id)));
    await db.insert(primitiveVersions).values({ id: versionId, primitiveId: Number(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else if (kind === "effect") {
    await db.update(effectVersions).set({ isLatest: false }).where(eq(effectVersions.effectId, String(id)));
    await db.insert(effectVersions).values({ id: versionId, effectId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else if (kind === "capability") {
    await db.update(capabilityVersions).set({ isLatest: false }).where(eq(capabilityVersions.capabilityId, String(id)));
    await db.insert(capabilityVersions).values({ id: versionId, capabilityId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  } else {
    await db.update(heritageVersions).set({ isLatest: false }).where(eq(heritageVersions.templateId, String(id)));
    await db.insert(heritageVersions).values({ id: versionId, templateId: String(id), versionNumber: number, isLatest: true, deltaKind: "FULL", snapshot });
  }
  return { id: versionId, number };
}

async function main(){
 const apply=process.argv.includes("--apply");
 const [ps,es,cs,classes]=await Promise.all([db.select().from(primitives),db.select().from(effects),db.select().from(capabilities),db.select().from(primitiveMarketClassifications)]);
 const p=new Map<string,Primitive>(); for(const row of ps.filter(x=>x.isPublic||x.name==="Bounded Practical Permission")) {if(!p.has(row.name)||row.sourceOrigin?.startsWith("system"))p.set(row.name,row);}
 // Canonical IDs resolve legacy duplicate names exactly as the previous verified shelf.
 for(const [name,id] of [["Verb Access Tier I",20]] as const){const row=ps.find(x=>x.id===id);if(!row||row.name!==name)throw Error(`Canonical drift ${name}`);p.set(name,row);}
 const e=new Map(es.filter(x=>x.isPublic).map(x=>[x.name,x])); const c=new Map(cs.filter(x=>x.isPublic).map(x=>[x.name,x]));
 const keys=new Set(icons.icons.map(x=>x.key));
 for(const idea of [...expansionPrimitives,...expansionEffects,...expansionCapabilities])if(!keys.has(idea.icon))throw Error(`Invalid icon ${idea.name}: ${idea.icon}`);
 const plannedP=new Set(expansionPrimitives.map(x=>x.name)); const plannedE=new Set(expansionEffects.map(x=>x.name));
 for(const idea of expansionPrimitives){const parent=p.get(idea.parent);if(!parent)throw Error(`Missing parent ${idea.parent}`);if(idea.magnitude!==undefined&&!parent.hardModifiers?.[0])throw Error(`No numeric parent ${idea.parent}`);const existing=p.get(idea.name);if(existing&&!existing.sourceOrigin?.startsWith(prefix))throw Error(`Primitive collision ${idea.name}`);}
 for(const idea of [...expansionEffects,...expansionCapabilities])for(const name of idea.primitives)if(!p.has(name)&&!plannedP.has(name))throw Error(`Missing ${idea.name} ingredient: ${name}`);
 for(const idea of expansionCapabilities)for(const name of idea.effects)if(!e.has(name)&&!plannedE.has(name))throw Error(`Missing effect ${name}`);
 for(const idea of expansionEffects)if(e.has(idea.name)&&!e.get(idea.name)!.sourceOrigin?.startsWith(prefix))throw Error(`Effect collision ${idea.name}`);
 for(const idea of expansionCapabilities)if(c.has(idea.name)&&!c.get(idea.name)!.sourceOrigin?.startsWith(prefix))throw Error(`Capability collision ${idea.name}`);
 const newCounts={primitives:expansionPrimitives.filter(x=>!p.has(x.name)).length,effects:expansionEffects.filter(x=>!e.has(x.name)).length,capabilities:expansionCapabilities.filter(x=>!c.has(x.name)).length};
 console.log("Validated recipes and icons",JSON.stringify(newCounts));
 const cost=new Map([...p].map(([name,row])=>[name,row.buCost]));for(const idea of expansionPrimitives)cost.set(idea.name,idea.bu);
 const priorLinks=await db.select().from(effectPrimitives);const pId=new Map(ps.map(x=>[x.id,x.name]));
 const effectParts=(name:string)=>expansionEffects.find(x=>x.name===name)?.primitives??priorLinks.filter(x=>x.effectId===e.get(name)?.id).map(x=>pId.get(x.primitiveId)!).filter(Boolean);
 for(const idea of expansionCapabilities){const names=[...new Set([...idea.primitives,...idea.effects.flatMap(effectParts)])];console.log(`${idea.name}: ${names.reduce((a,n)=>a+(cost.get(n)??0),0)} BU (${names.length} unique pieces)`);}
 if(!apply){console.log("DRY RUN: no DB writes. --apply creates only absent research-expansion rows, with full versions and primitive fork edges.");return;}
 const [actor]=await db.select().from(users).where(eq(users.isAdmin,true)).limit(1);if(!actor)throw Error("Missing admin fork actor");
 await withDatabaseTransaction(async()=>{
  for(const idea of expansionPrimitives){if(p.has(idea.name))continue;const parent=p.get(idea.parent)!;const candidate=expansionCandidate(parent,idea);const payload=buildCanonicalPrimitivePayload(candidate);const hash=await hashPrimitiveContent(payload);
   const [row]=await db.insert(primitives).values({...candidate,id:undefined,contentHash:hash}).returning();if(!row)throw Error(`Insert ${idea.name}`);const v=await saveVersion("primitive",row.id,hash,payload as unknown as Record<string,unknown>);
   const [pv]=await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId,parent.id),eq(primitiveVersions.isLatest,true))).limit(1);if(!pv)throw Error(`Missing parent snapshot ${parent.name}`);
   await db.insert(forks).values({forkedByUserId:actor.id,sourceTargetType:"PRIMITIVE",sourceTargetId:String(parent.id),sourceVersionId:pv.id,sourceAuthorId:parent.userId,forkedTargetType:"PRIMITIVE",forkedTargetId:String(row.id),forkedVersionId:v.id,metadata:{curatedPhase:4,researchExpansion:true}});
   const parentClass=classes.find(x=>x.primitiveId===parent.id);await db.insert(primitiveMarketClassifications).values({primitiveId:row.id,familyKey:parentClass?.familyKey??"HERITAGE_AUGMENT",tier:idea.bu<=2?1:idea.bu<=4?2:3,expressionKey:slug(idea.name),canonicalTemplateId:row.templatePrimitiveId,canonicalExpressionId:row.id,source:"INHERITED",status:"CLASSIFIED",evidence:{parentId:parent.id,researchExpansion:true}});
   await publish("PRIMITIVE",String(row.id),v.id,v.number);p.set(idea.name,row);
  }
  for(const idea of expansionEffects){if(e.has(idea.name))continue;const ids=[...new Set(idea.primitives.map(n=>p.get(n)!.id))];const iconFields={iconSource:"GAME_ICONS" as const,iconKey:idea.icon,iconColor:"#d8ad54"};const payload=buildCanonicalEffectPayload({name:idea.name,narrativeDescription:idea.text,tags:["curated","research-expansion"],isPublic:true,primitiveSlots:ids.map(primitiveId=>({primitiveId,quantity:1,notes:"",isMirrored:idea.name==="Salt-Wet Footing"||idea.name==="Fevered Aim"||idea.name==="Cracked Plate"})),...iconFields});const hash=await hashEffectContent(payload);
   const [row]=await db.insert(effects).values({name:idea.name,userId:null,isPublic:true,sourceOrigin:`${prefix}effect:${slug(idea.name)}`,narrativeDescription:idea.text,tags:["curated","research-expansion"],contentHash:hash,...iconFields}).returning();if(!row)throw Error(`Insert ${idea.name}`);
   await db.insert(effectPrimitives).values(ids.map((primitiveId,sortOrder)=>({effectId:row.id,primitiveId,sortOrder,targetWho:idea.target,isMirrored:idea.name==="Salt-Wet Footing"||idea.name==="Fevered Aim"||idea.name==="Cracked Plate"})));
   const v=await saveVersion("effect",row.id,hash,payload as unknown as Record<string,unknown>);await publish("EFFECT",row.id,v.id,v.number);e.set(idea.name,row);
  }
  for(const idea of expansionCapabilities){if(c.has(idea.name))continue;const ids=[...new Set(idea.primitives.map(n=>p.get(n)!.id))];const slots=ids.map(id=>({primitiveId:id,role:role([...p.values()].find(x=>x.id===id)!),quantity:1,notes:"",slotLabel:""}));const effectIds=idea.effects.map(n=>e.get(n)!.id);const all=[...new Set([...idea.primitives,...idea.effects.flatMap(effectParts)])];const totalBu=all.reduce((a,n)=>a+p.get(n)!.buCost,0);const iconFields={iconSource:"GAME_ICONS" as const,iconKey:idea.icon,iconColor:"#d8ad54"};
   const payload=buildCanonicalCapabilityPayload({name:idea.name,type:"ACTIVE",sourceType:idea.source??"PHYSICAL",verboseDescription:idea.text,tags:["curated","research-expansion"],isPublic:true,primitiveSlots:slots,effectIds,...iconFields});const hash=await hashCapabilityContent(payload);const [row]=await db.insert(capabilities).values({name:idea.name,userId:null,isPublic:true,sourceOrigin:`${prefix}capability:${slug(idea.name)}`,type:"ACTIVE",sourceType:idea.source??"PHYSICAL",verboseDescription:idea.text,tags:["curated","research-expansion"],metadata:{totalBu,resolution:"Authored self modifiers use the sheet; targets, scene, action output and motion are resolved manually."},contentHash:hash,...iconFields}).returning();if(!row)throw Error(`Insert ${idea.name}`);
   if(slots.length)await db.insert(capabilityPrimitives).values(slots.map((s,sortOrder)=>({...s,capabilityId:row.id,sortOrder})));if(effectIds.length)await db.insert(capabilityEffects).values(effectIds.map((effectId,sortOrder)=>({capabilityId:row.id,effectId,sortOrder})));
   const v=await saveVersion("capability",row.id,hash,payload as unknown as Record<string,unknown>);await publish("CAPABILITY",row.id,v.id,v.number);c.set(idea.name,row);
  }
 });console.log("Saved",JSON.stringify(newCounts));
}
if(process.argv[1]?.includes("seed-phase4-expansion-2026-10"))main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
