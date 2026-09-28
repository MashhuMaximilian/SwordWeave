import type {DraftOperation} from './draft-types';
import {supplyPaths, type EntityKey, type WorkspaceGraph} from './model';

/** Skip isolated browser add/remove pairs during replay, retaining the saved audit journal. */
export function compactDraftReplay(operations:DraftOperation[],base:WorkspaceGraph):DraftOperation[]{
 const removed=new Set<number>();
 for(let i=0;i<operations.length;i++){
  const add=operations[i]!;
  if(add.type!=='create'||!['primitive','capability'].includes(add.payload.kind)||!add.payload.existingId||add.payload.target)continue;
  const key=`${add.payload.kind}:${add.payload.existingId}`;
  if(operations.slice(0,i).some((prior,index)=>!removed.has(index)&&prior.type==='create'&&prior.payload.kind===add.payload.kind&&prior.payload.existingId===add.payload.existingId))continue;
  const instance=add.localBindings?.instances.find(edge=>edge.child===key);
  if(instance ? base.edges.some(edge=>edge.id===instance.id||edge.instanceId===instance.id) : supplyPaths(base,key as EntityKey).length>0)continue;
  for(let j=i+1;j<operations.length;j++){
   if(removed.has(j))continue;
   const next=operations[j]!;
   if(next.type==='character')continue;
   if(next.type==='command'&&next.payload['operation']==='detach'&&next.payload['target']===key){
    const path=next.payload['path'];
    if(Array.isArray(path)&&path.length===1&&(instance ? path[0]===instance.id : !base.edges.some(edge=>edge.id===path[0]||edge.instanceId===path[0]))){removed.add(i);removed.add(j);}break;
   }
   if(add.payload.kind!=='primitive')break;
   // Only independent root-primitive changes may be crossed. Container edits,
   // moves, and any use of this primitive require the full validated replay.
   if(next.type==='create'&&next.payload.kind==='primitive'&&next.payload.existingId&&`primitive:${next.payload.existingId}`!==key&&!next.payload.target)continue;
   if(next.type==='command'&&next.payload['operation']==='detach'&&String(next.payload['target']).startsWith('primitive:')&&next.payload['target']!==key&&Array.isArray(next.payload['path'])&&next.payload['path'].length===1)continue;
   break;
  }
 }
 const compacted=operations.filter((_,index)=>!removed.has(index));
 return removed.size ? compactDraftReplay(compacted,base) : compacted;
}
