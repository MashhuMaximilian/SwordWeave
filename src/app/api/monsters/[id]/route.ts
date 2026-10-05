import { privateJson } from "@/lib/http/private-json";
import {readBoundedJson,RequestSizeError} from "@/lib/http/read-bounded-json";
import { auth } from "@clerk/nextjs/server";
import { visibleMonster,publishMonster,forkMonster } from "@/lib/monsters/service";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import { resolveMonster } from "@/lib/monsters/resolve";
import type { PinnedDefinition } from "@/lib/monsters/service";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,c:Context){
 const {id}=await c.params;const {userId}=await auth();const row=await visibleMonster(id,userId);
 if(!row)return privateJson({error:"Not found."},{status:404});
 try{const d=row.definition as PinnedDefinition;const slots=await resolveMonsterComposition(d,userId);return privateJson({monster:row,sheet:resolveMonster(d,slots),canEdit:userId===row.userId});}
 catch{return privateJson({error:"This template's components are unavailable. Its owner can update its references or visibility."},{status:409});}
}
export async function PATCH(r:Request,c:Context){const {userId}=await auth();if(!userId)return privateJson({error:"Unauthorized."},{status:401});try{const b=await readBoundedJson(r,1_048_576) as {definition:unknown;isPublic?:boolean;sourceCollectionId?:string|null;visibility?:"PUBLIC"|"PRIVATE"|"FOLLOWERS_ONLY"};return privateJson(await publishMonster((await c.params).id,userId,b.definition,b.isPublic===true,typeof b.visibility==="string"&&["PUBLIC","PRIVATE","FOLLOWERS_ONLY"].includes(b.visibility)?b.visibility:undefined,b.sourceCollectionId));}catch(e){return privateJson({error:e instanceof Error?e.message:"Invalid monster."},{status:e instanceof RequestSizeError?413:400});}}
export async function POST(_:Request,c:Context){const {userId}=await auth();if(!userId)return privateJson({error:"Unauthorized."},{status:401});try{const row=await visibleMonster((await c.params).id,userId);if(!row)return privateJson({error:"Not found."},{status:404});return privateJson(await forkMonster(row.id,userId),{status:201});}catch{return privateJson({error:"This template is unavailable for forking. Its owner may need to update its references or visibility."},{status:409});}}
