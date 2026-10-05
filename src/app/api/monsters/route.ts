import {shuffleMonster} from "@/lib/monsters/shuffle";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { monsterCopies } from "@/db/schema/monsters";
import { eq } from "drizzle-orm";
import { createMonster,listMonsters,prepareMonster } from "@/lib/monsters/service";
export async function GET(request:Request) { const {userId}=await auth(); return NextResponse.json({ monsters:await listMonsters(userId,Math.max(0,Math.min(1000000,Math.floor(Number(new URL(request.url).searchParams.get("offset"))||0)))), copies:userId ? await db.select().from(monsterCopies).where(eq(monsterCopies.userId,userId)).limit(100) : [] }); }
export async function POST(request:Request) { const {userId}=await auth(); if(!userId)return NextResponse.json({error:"Sign in to create monsters."},{status:401}); try { const body=await request.json(); if(body.shuffle)return NextResponse.json(await shuffleMonster(body.definition,userId,Array.isArray(body.locks)?body.locks.filter((l:unknown)=>typeof l==="string"):[])); if(body.preview)return NextResponse.json(await prepareMonster(body.definition,userId)); return NextResponse.json(await createMonster(userId,body.definition,body.isPublic===true,undefined,body.sourceCollectionId,["PUBLIC","PRIVATE","FOLLOWERS_ONLY"].includes(body.visibility)?body.visibility:undefined),{status:201}); }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid monster."},{status:400});} }
