import { withDependencyPins } from "@/lib/versions/capture-dependency-pins";
import { readDependencyPins } from "@/lib/versions/dependency-pins";
import type { MonsterDefinition } from "./model";
/** Publishing freezes direct references; each component version freezes its own children. */
export async function pinMonsterReferences(definition:MonsterDefinition):Promise<MonsterDefinition>{
 const snapshot:Record<string,unknown>={};
 for(const reference of definition.references){const kind=reference.kind.toLowerCase();const field=`${kind}Slots`;const slots=(snapshot[field]??[]) as unknown[];slots.push({[`${kind}Id`]:reference.id,versionId:reference.versionId,quantity:reference.quantity,isMirrored:reference.isMirrored});snapshot[field]=slots;}
 const pins=readDependencyPins(await withDependencyPins(snapshot))??[];
 return {...definition,references:definition.references.map(ref=>({...ref,versionId:ref.versionId??pins.find(p=>p.kind===ref.kind.toLowerCase()&&String(p.id)===ref.id)?.versionId??null}))};
}
