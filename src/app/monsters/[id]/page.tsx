import { MonsterWorkbench } from "@/components/monsters/monster-workbench";
export default async function Page({params}:{params:Promise<{id:string}>}){return <MonsterWorkbench id={(await params).id}/>;}
