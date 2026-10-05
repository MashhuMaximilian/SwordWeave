import { queryLibrary } from "@/lib/publishing/library-query";
import { prepareMonster } from "./service";
import { shuffleMonsterAllocation,monsterDefinitionSchema } from "./model";
/** Keep the concept and chosen budget while drawing a compact legal mechanical sketch. */
export async function shuffleMonster(value:unknown,userId:string,locks:readonly string[]){
 const original=monsterDefinitionSchema.parse(value);
 const references=original.references.filter((_,i)=>locks.includes(`reference:${i}`));
 const {attributes,practiceSlices}=shuffleMonsterAllocation(original,locks);
 const locked=await prepareMonster({...original,attributes,practiceSlices,references},userId);
 let remaining=original.budget-locked.sheet.spent;
 const library=await queryLibrary({targetType:"PRIMITIVE",viewerClerkId:userId,minBu:1,maxBu:remaining,limit:100,sort:"ALPHABETICAL"});
 const pool=library.items.filter(p=>p.buCost!==null&&p.buCost>0&&p.buCost<=remaining);
 for(let i=0;i<3;i++){const eligible=pool.filter(p=>p.buCost!==null&&p.buCost<=remaining&&!references.some(r=>r.kind==="PRIMITIVE"&&r.id===p.targetId));const choice=eligible[Math.floor(Math.random()*eligible.length)];if(!choice)break;references.push({kind:"PRIMITIVE",id:choice.targetId,quantity:1,isMirrored:false,versionId:null});remaining-=choice.buCost??0;}
 return prepareMonster({...original,attributes,practiceSlices,references},userId);
}
