import {assertMonsterAudience} from "./visibility";
import type {EntityKey} from "@/lib/character/workspace/model";
import { recordForkAttribution } from "@/lib/publishing/fork-attribution";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { forks } from "@/db/schema/engagement";
import { and, eq, desc, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { monsters, monsterVersions, monsterCopies } from "@/db/schema/monsters";
import { setSourceCollection } from "@/lib/collections/service";
import { pinMonsterReferences } from "./pins";
import { monsterDefinitionSchema, pinMonsterSnapshot, sameMonsterSnapshot } from "./model";
import { resolveMonsterComposition, type MonsterComponentPin } from "./composition";
import { resolveMonster, type MonsterSlot } from "./resolve";
const monsterVisibility=(viewer:string|null)=>sql`(${monsters.visibility}='PUBLIC' OR ${monsters.userId}=${viewer} OR (${monsters.visibility}='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=${monsters.userId} AND v.clerk_user_id=${viewer})))`;
export async function visibleMonster(id: string, userId: string | null) { const [row] = await db.select().from(monsters).where(and(eq(monsters.id,id), monsterVisibility(userId))); return row; }
export async function listMonsters(userId: string | null,offset=0) { return db.select({id:monsters.id,name:monsters.name,description:monsters.description,imageUrl:sql<string|null>`${monsters.definition}->>'imageUrl'`,budget:sql<number>`(${monsters.definition}->>'budget')::double precision`,size:sql<string>`${monsters.definition}->>'size'`,attributes:sql<{physical:number;mental:number;magical:number}>`${monsters.definition}->'attributes'`,baselineVitality:sql<number|null>`(${monsters.definition}->>'baselineVitality')::double precision`,userId:monsters.userId,visibility:monsters.visibility,isPublic:monsters.isPublic,version:monsters.version,sourceCollectionId:monsters.sourceCollectionId,forkedFromId:monsters.forkedFromId,updatedAt:monsters.updatedAt,createdAt:monsters.createdAt}).from(monsters).where(monsterVisibility(userId)).orderBy(desc(monsters.updatedAt)).limit(100).offset(offset); }
export async function prepareMonster(value: unknown, userId?: string | null) { const definition = await pinMonsterReferences(monsterDefinitionSchema.parse(value)); let componentPins:MonsterComponentPin[]=[];const slots = await resolveMonsterComposition(definition,userId,pins=>{componentPins=pins;}); const sheet = resolveMonster(definition,slots); if (sheet.spent > sheet.availableBudget) throw new Error("Composition exceeds the chosen BU budget. Weakness credit extends the spending budget; items use their separate pool."); const pinned={...definition,componentPins};if(new TextEncoder().encode(JSON.stringify(pinned)).byteLength>524288)throw new Error("Monster snapshot exceeds 512KB. Publish unversioned components before adding them, or split the composition.");return { definition:pinned, slots, sheet }; }
export type PinnedDefinition = ReturnType<typeof monsterDefinitionSchema.parse> & { resolvedSlots?: MonsterSlot[]; componentPins?:MonsterComponentPin[] };
export async function createMonster(userId: string, value: unknown, isPublic = false, forkedFromId?: string, sourceCollectionId?: string|null, visibility?: "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE") { const prepared = await prepareMonster(value,userId); const pinned = prepared.definition; await assertMonsterAudience(pinned.componentPins.map(p=>`${p.kind}:${p.id}` as EntityKey),userId,visibility??(isPublic?"PUBLIC":"PRIVATE")); return withDatabaseTransaction(async () => { const tx = db; const [row] = await tx.insert(monsters).values({ userId, name:pinned.name, description:pinned.concept, definition:pinned, isPublic:visibility?visibility!=="PRIVATE":isPublic, visibility:visibility??(isPublic?"PUBLIC":"PRIVATE"),forkedFromId,sourceCollectionId }).returning(); if (!row) throw new Error("Could not save monster."); await tx.insert(monsterVersions).values({ monsterId:row.id,version:1,definition:pinned }); await setSourceCollection(userId,"MONSTER",row.id,sourceCollectionId); return row; }); }
export async function publishMonster(id:string,userId:string,value:unknown,isPublic:boolean,visibility?:"PUBLIC"|"FOLLOWERS_ONLY"|"PRIVATE",sourceCollectionId?:string|null){
 const prepared=await prepareMonster(value,userId);
 return withDatabaseTransaction(async()=>{
  const [prior]=await db.select().from(monsters).where(and(eq(monsters.id,id),eq(monsters.userId,userId))).for("update");if(!prior)throw new Error("Monster not found.");
  const definition=prepared.definition,unchanged=sameMonsterSnapshot(prior.definition,definition),nextVisibility=visibility??(isPublic?"PUBLIC":"PRIVATE");
  await assertMonsterAudience(definition.componentPins.map(p=>`${p.kind}:${p.id}` as EntityKey),userId,nextVisibility);
  const sourceChanged=sourceCollectionId!==undefined&&sourceCollectionId!==prior.sourceCollectionId;
  if(unchanged&&nextVisibility===prior.visibility&&!sourceChanged)return prior;
  const [row]=await db.update(monsters).set({visibility:nextVisibility,isPublic:nextVisibility!=="PRIVATE",...(sourceChanged?{sourceCollectionId}:{}),...(!unchanged?{definition,name:definition.name,description:definition.concept,version:prior.version+1}:{}),updatedAt:new Date()}).where(eq(monsters.id,id)).returning();if(!row)throw new Error("Could not publish monster.");
  if(!unchanged){const [pin]=await db.insert(monsterVersions).values({monsterId:id,version:row.version,definition}).returning();if(pin)await db.update(forks).set({forkedVersionId:pin.id}).where(and(eq(forks.forkedTargetType,"MONSTER"),eq(forks.forkedTargetId,id)));}
  if(sourceChanged)await setSourceCollection(userId,"MONSTER",id,sourceCollectionId);
  return row;
 });
}
export async function createMonsterCopy(id: string,userId: string,name: string,version?: number) { const template = await visibleMonster(id,userId); if (!template) throw new Error("Monster not found."); const [pin] = await db.select().from(monsterVersions).where(and(eq(monsterVersions.monsterId,id),eq(monsterVersions.version,version ?? template.version))); if (!pin) throw new Error("Template version not found."); const definition = pinMonsterSnapshot(pin.definition as PinnedDefinition); const slots = await resolveMonsterComposition(definition,userId); const sheet = resolveMonster(definition,slots); const [copy] = await db.insert(monsterCopies).values({ userId,name:name.trim() || definition.name,templateId:id,templateVersion:pin.version,templateVersionId:pin.id,definition:null,currentVitality:sheet.maximum }).returning(); return copy; }

export async function forkMonster(id:string,userId:string) {
 const template=await visibleMonster(id,userId);if(!template)throw new Error("Monster not found.");
 return withDatabaseTransaction(async()=>{
  const actor=await resolveUserIdByClerkId(userId);if(!actor)throw new Error("Your account profile is not available yet. Refresh after signing in.");
  const [sourcePin]=await db.select().from(monsterVersions).where(and(eq(monsterVersions.monsterId,id),eq(monsterVersions.version,template.version)));if(!sourcePin)throw new Error("Source template version is unavailable.");
  await resolveMonsterComposition(sourcePin.definition as PinnedDefinition,userId);
  const [row]=await db.insert(monsters).values({userId,name:template.name,description:template.description,definition:pinMonsterSnapshot(sourcePin.definition),isPublic:false,visibility:"PRIVATE",forkedFromId:id}).returning();if(!row)throw new Error("Could not fork monster.");
  const [forkPin]=await db.insert(monsterVersions).values({monsterId:row.id,version:1,definition:row.definition}).returning();if(!forkPin)throw new Error("Could not save fork version.");
  await recordForkAttribution({forkerInternalId:actor,forkerClerkId:userId,sourceClerkUserId:template.userId,sourceTargetType:"MONSTER",sourceTargetId:id,sourceVersionId:sourcePin.id,forkedTargetType:"MONSTER",forkedTargetId:row.id,forkedVersionId:forkPin.id,metadata:{name:row.name}});
  return row;
 });
}
