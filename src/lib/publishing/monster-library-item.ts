import { monsterArtwork } from "@/lib/monsters/art";
import { sql } from "drizzle-orm";
import { monsters } from "@/db/schema/monsters";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import type { MonsterComponentPin } from "@/lib/monsters/composition";
import type { MonsterReference } from "@/lib/monsters/model";
import type { MonsterSlot } from "@/lib/monsters/resolve";
import type { LibraryCompositionPath, LibraryItem } from "./library-query";
/** Discovery includes the pinned primitive paths used by the shared catalogue card. */
export const monsterLibraryColumns = {
 id:monsters.id,userId:monsters.userId,name:monsters.name,description:monsters.description,
 visibility:monsters.visibility,createdAt:monsters.createdAt,forkedFromId:monsters.forkedFromId,
 version:monsters.version,budget:sql<number>`(${monsters.definition}->>'budget')::integer`,
 size:sql<string>`${monsters.definition}->>'size'`,
 sourceOrigin:sql<string|null>`${monsters.definition}->>'sourceOrigin'`,
 compositionReferences:sql<MonsterReference[] | null>`${monsters.definition}->'references'`,
 compositionPins:sql<MonsterComponentPin[] | null>`${monsters.definition}->'componentPins'`,
 compositionSlots:sql<MonsterSlot[] | null>`${monsters.definition}->'resolvedSlots'`,
 imageUrl:sql<string|null>`${monsters.definition}->>'imageUrl'`,
};
export type MonsterLibraryRow={id:string;userId:string;name:string;description:string;visibility:"PUBLIC"|"FOLLOWERS_ONLY"|"PRIVATE";createdAt:Date;forkedFromId:string|null;version:number;budget:number;size:string;compositionReferences?:MonsterReference[]|null;compositionPins?:MonsterComponentPin[]|null;compositionSlots?:MonsterSlot[]|null;imageUrl?:string|null;sourceOrigin?:string|null};
export function monsterToLibraryItem(row:MonsterLibraryRow):LibraryItem {
 const imageUrl = monsterArtwork(row);
 const compositionPaths: LibraryCompositionPath[] = (row.compositionSlots ?? []).flatMap(slot => (slot.supplyKeys ?? [[`primitive:${slot.primitiveId}`]]).map(chain => ({
   primitiveId: slot.primitiveId, primitiveName: slot.name,
   mechanicalDescription: slot.isMirrored ? mirrorConsequence({...slot,id:slot.primitiveId}) : mechanicalDescriptionFromModifiers([...slot.hardModifiers]) || slot.mechanicalDescription || slot.name,
   quantity: slot.quantity, buCost: slot.buCost,
   path: ["Monster", row.name, ...chain.flatMap(key => [key.split(":")[0]!, slot.supplyNames?.[key] ?? slot.name])],
   containers: chain.filter(key => key.startsWith("capability:") || key.startsWith("effect:")).map(key => ({targetType: key.startsWith("capability:") ? "CAPABILITY" as const : "EFFECT" as const, targetId: key.slice(key.indexOf(":") + 1), name: slot.supplyNames?.[key] ?? key})),
 })));

 return {id:`MONSTER:${row.id}`,targetType:"MONSTER",targetId:row.id,name:row.name,description:row.description,
 compositionPaths, mechanicalDescription:`${row.size.toLowerCase()} · ${row.budget} BU budget`,category:"Monster / NPC",buCost:row.budget,
 authorId:row.userId,authorUsername:null,authorDisplayName:null,authorAvatarUrl:null,authorIsAdmin:false,
 publishedAt:row.visibility==="PRIVATE"?null:row.createdAt,visibility:row.visibility,versionNumber:row.version,
 likesCount:0,dislikesCount:0,forkCount:0,tags:[],sourceOrigin:row.forkedFromId?`fork:${row.forkedFromId}`:row.userId.startsWith("system:")?row.userId:null,
 imageUrl,iconSource:imageUrl?"UPLOAD":"GAME_ICONS",iconKey:imageUrl?null:"lorc/gluttonous-smile",iconUrl:imageUrl,iconColor:"#ffffff"};
}

/** Older templates are resolved through the same pinned graph as their preview.
 * Access to root rows must already be checked by the calling catalogue query. */
export async function monsterRowsToLibraryItems(rows:MonsterLibraryRow[], viewerId?:string|null):Promise<LibraryItem[]> {
 return Promise.all(rows.map(async row => {
  if(row.compositionSlots?.length || !row.compositionReferences?.length) return monsterToLibraryItem(row);
  const {resolveMonsterComposition}=await import("@/lib/monsters/composition");
  try {
   const compositionSlots=await resolveMonsterComposition({references:row.compositionReferences,...(row.compositionPins?{componentPins:row.compositionPins}:{})},viewerId,undefined,{trustedPinnedComposition:!!row.compositionPins});
   return monsterToLibraryItem({...row,compositionSlots});
  } catch {
   // A removed or inaccessible component must never break the whole catalogue.
   return monsterToLibraryItem(row);
  }
 }));
}
