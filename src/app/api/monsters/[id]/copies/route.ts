import { privateJson } from "@/lib/http/private-json";
import {auth} from "@clerk/nextjs/server";
import {NextResponse} from "next/server";
import {createMonsterCopy} from "@/lib/monsters/service";
export async function POST(r:Request,c:{params:Promise<{id:string}>}){const {userId}=await auth();if(!userId)return privateJson({error:"Unauthorized."},{status:401});try{const b=await r.json();return privateJson(await createMonsterCopy((await c.params).id,userId,String(b.name??""),b.version),{status:201});}catch{return privateJson({error:"This template is unavailable for a new play copy. Its owner may need to update its references or visibility."},{status:409});}}
