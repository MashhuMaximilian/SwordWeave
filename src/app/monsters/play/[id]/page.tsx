import { MonsterPlaySheet } from "@/components/monsters/monster-play-sheet";
export default async function Page({params}:{params:Promise<{id:string}>}){return <MonsterPlaySheet id={(await params).id}/>;}
