import { monsterArtwork } from "@/lib/monsters/art";
import { sql } from "drizzle-orm";
import { monsters } from "@/db/schema/monsters";
import type { LibraryItem } from "./library-query";
/** Discovery reads metadata and budget without loading the composition snapshot. */
export const monsterLibraryColumns = {
 id:monsters.id,userId:monsters.userId,name:monsters.name,description:monsters.description,
 visibility:monsters.visibility,createdAt:monsters.createdAt,forkedFromId:monsters.forkedFromId,
 version:monsters.version,budget:sql<number>`(${monsters.definition}->>'budget')::integer`,
 size:sql<string>`${monsters.definition}->>'size'`,
 sourceOrigin:sql<string|null>`${monsters.definition}->>'sourceOrigin'`,
 imageUrl:sql<string|null>`${monsters.definition}->>'imageUrl'`,
};
export type MonsterLibraryRow={id:string;userId:string;name:string;description:string;visibility:"PUBLIC"|"FOLLOWERS_ONLY"|"PRIVATE";createdAt:Date;forkedFromId:string|null;version:number;budget:number;size:string;imageUrl?:string|null;sourceOrigin?:string|null};
export function monsterToLibraryItem(row:MonsterLibraryRow):LibraryItem {
 const imageUrl = monsterArtwork(row);
 return {id:`MONSTER:${row.id}`,targetType:"MONSTER",targetId:row.id,name:row.name,description:row.description,
 mechanicalDescription:`${row.size.toLowerCase()} · ${row.budget} BU budget`,category:"Monster / NPC",buCost:row.budget,
 authorId:row.userId,authorUsername:null,authorDisplayName:null,authorAvatarUrl:null,authorIsAdmin:false,
 publishedAt:row.visibility==="PRIVATE"?null:row.createdAt,visibility:row.visibility,versionNumber:row.version,
 likesCount:0,dislikesCount:0,forkCount:0,tags:[],sourceOrigin:row.forkedFromId?`fork:${row.forkedFromId}`:null,
 imageUrl,iconSource:imageUrl?"UPLOAD":"GAME_ICONS",iconKey:imageUrl?null:"lorc/monster-grasp",iconUrl:imageUrl,iconColor:"#ffffff"};
}
