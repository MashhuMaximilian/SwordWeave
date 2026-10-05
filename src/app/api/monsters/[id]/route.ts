import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { visibleMonster,publishMonster,forkMonster } from "@/lib/monsters/service";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import { resolveMonster } from "@/lib/monsters/resolve";
import type { PinnedDefinition } from "@/lib/monsters/service";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,c:Context){
 const {id}=await c.params;const {userId}=await auth();const row=await visibleMonster(id,userId);
 if(!row)return NextResponse.json({error:"Not found."},{status:404});
 try{const d=row.definition as PinnedDefinition;const slots=await resolveMonsterComposition(d,userId);return NextResponse.json({monster:row,sheet:resolveMonster(d,slots),canEdit:userId===row.userId});}
 catch{return NextResponse.json({error:"This template's components are unavailable. Its owner can update its references or visibility."},{status:409});}
}
export async function PATCH(r:Request,c:Context){const {userId}=await auth();if(!userId)return NextResponse.json({error:"Unauthorized."},{status:401});try{const b=await r.json();return NextResponse.json(await publishMonster((await c.params).id,userId,b.definition,b.isPublic===true,["PUBLIC","PRIVATE","FOLLOWERS_ONLY"].includes(b.visibility)?b.visibility:undefined,b.sourceCollectionId));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid monster."},{status:400});}}
export async function POST(_:Request,c:Context){const {userId}=await auth();if(!userId)return NextResponse.json({error:"Unauthorized."},{status:401});try{const row=await visibleMonster((await c.params).id,userId);if(!row)return NextResponse.json({error:"Not found."},{status:404});return NextResponse.json(await forkMonster(row.id,userId),{status:201});}catch{return NextResponse.json({error:"This template is unavailable for forking. Its owner may need to update its references or visibility."},{status:409});}}
