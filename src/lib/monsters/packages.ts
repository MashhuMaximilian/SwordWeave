import { consequencePackage } from "@/lib/character/consequences/package";
import type { WorkspaceGraph,EntityKey,EntityKind } from "@/lib/character/workspace/model";
import type { MonsterSlot } from "./resolve";
/** Reuse the player's authored consequence package walker. */
export function monsterPackages(slots:readonly MonsterSlot[]){
 const graph:WorkspaceGraph={characterId:"monster",revision:0,nodes:[],edges:[]};const seen=new Set<string>();
 for(const slot of slots){const key=`primitive:${slot.primitiveId}` as EntityKey;if(!graph.nodes.some(n=>n.key===key))graph.nodes.push({key,kind:"primitive",id:String(slot.primitiveId),name:slot.name,bu:slot.buCost,versionId:null,latestVersionId:null,userId:null,description:slot.name,data:{hardModifiers:slot.hardModifiers,consequenceBehavior:slot.consequenceBehavior}});
  for(const chain of slot.supplyKeys??[[key]])for(let i=0;i<chain.length;i++){const nodeKey=chain[i] as EntityKey;if(!graph.nodes.some(n=>n.key===nodeKey)){const split=nodeKey.indexOf(":");graph.nodes.push({key:nodeKey,kind:nodeKey.slice(0,split) as EntityKind,id:nodeKey.slice(split+1),name:slot.supplyNames?.[nodeKey]??nodeKey,bu:0,versionId:null,latestVersionId:null,userId:null,description:"",data:{}});}const parent=(i?chain[i-1]:null) as EntityKey|null;const edgeId=`${parent}:${nodeKey}`;if(!seen.has(edgeId)){seen.add(edgeId);graph.edges.push({id:edgeId,parent,child:nodeKey,category:slot.item?"ITEM":"ALL",order:i,isMirrored:slot.isMirrored});}}
 }
 return graph.nodes.filter(n=>n.kind!=="item"&&n.kind!=="heritage").map(n=>consequencePackage(graph,n.key)).filter(p=>p.pieces.length);
}
