import type { DraftOperation, WorkspaceDraftPreview } from './draft-types';
import { bundleBu, supplyPaths, validateReference, type EntityKey, type WorkspaceEdge, type WorkspaceGraph, type WorkspaceNode } from './model';
import { membershipCostChange } from './cost-preview';
import { computeBUBalance } from '@/lib/engine/bu-balance';
import { getVolatilityCeiling } from '@/lib/engine/bu';

/** Bind browser identities to server results, never to client supplied database IDs. */
export interface LocalBindings {
  nodes: { key: EntityKey; source?: EntityKey }[];
  instances: { id: string; child: EntityKey; category: string; isMirrored: boolean }[];
}
function localKey(kind: WorkspaceNode['kind']): EntityKey {
  const uuid = crypto.randomUUID();
  return `${kind}:${kind === 'primitive' ? -parseInt(uuid.replaceAll('-', '').slice(0, 12), 16) : uuid}`;
}
function edgeId(edge: WorkspaceEdge) { return edge.instanceId ?? `${edge.parent ?? edge.category}:${edge.child}${edge.data?.['role'] ? `:${edge.data['role']}` : ''}`; }
export function draftReferenceKeys(operation: DraftOperation): EntityKey[] {
  if (operation.type !== 'create' && operation.type !== 'command') return [];
  const p = operation.payload as Record<string, unknown>;
  const keys = new Set<EntityKey>();
  if (operation.type === 'create' && operation.payload.existingId) keys.add(`${operation.payload.kind}:${operation.payload.existingId}`);
  if (typeof p['child'] === 'string') keys.add(p['child'] as EntityKey);
  const draft = (p['draft'] ?? {}) as Record<string, unknown>;
  for (const [kind, ids, slots, idField] of [['primitive','primitiveIds','primitiveSlots','primitiveId'],['effect','effectIds','effectSlots','effectId'],['capability','capabilityIds','capabilitySlots','capabilityId']] as const) {
    for (const id of (draft[ids] ?? []) as (string|number)[]) keys.add(`${kind}:${id}`);
    for (const slot of (draft[slots] ?? []) as Record<string,unknown>[]) keys.add(`${kind}:${slot[idField]}`);
  }
  return [...keys];
}

/** Browser-only projection. Server review still validates prices, permissions, versions and debt. */
export function projectDraftOperation(previous: WorkspaceDraftPreview, operation: DraftOperation, authorId: string): { preview: WorkspaceDraftPreview; operation: DraftOperation } {
  const graph = structuredClone(previous.graph);
  const bindings: LocalBindings = { nodes: [], instances: [] };
  const replacements: Record<string, EntityKey> = {};
  const foundation = { ...previous.afterSnapshot?.foundation };
  const get = (key: string) => { const n = graph.nodes.find(n => n.key === key); if (!n) throw new Error('This piece is unavailable. Reopen it from the Library.'); return n; };
  const findPath = (path: string[]) => {
    const edges = path.map(id => graph.edges.find(e => e.id === id));
    if (edges.some(e => !e) || edges.some((e,i) => i === 0 ? e!.parent !== null : e!.parent !== edges[i-1]!.child)) throw new Error('This location changed. Open the piece again.');
    return edges as WorkspaceEdge[];
  };
  const authored = new Set(previous.results.flatMap(entry => (entry.result['localAuthoredKeys']??[]) as string[]).filter((key):key is EntityKey=>typeof key==='string'));
  function forkPath(path: string[]): WorkspaceNode {
    const edges = findPath(path);
    if (!edges.length) throw new Error('Choose a piece to edit.');
    let replacement: WorkspaceNode|undefined, target: WorkspaceNode|undefined;
    for (let i=edges.length-1;i>=0;i--) {
      const edge=edges[i]!, original=get(edge.child);
      const mustFork=!authored.has(original.key);
      let copy=original;
      if(mustFork) {
        const key=operation.localBindings?.nodes.find(ref=>ref.source===original.key)?.key??localKey(original.kind),id=key.slice(key.indexOf(':')+1);
        copy={...structuredClone(original),key,id,userId:authorId,versionId:null,latestVersionId:null,data:{...structuredClone(original.data),id:original.kind==='primitive'?Number(id):id,userId:authorId,isPublic:false,visibility:'PRIVATE',contentHash:null}};
        graph.nodes.push(copy);bindings.nodes.push({key,source:original.key});replacements[original.key]=key;authored.add(key);
        graph.edges.push(...graph.edges.filter(e=>e.parent===original.key).map(e=>{const clone={...structuredClone(e),parent:key};clone.id=edgeId(clone);return clone;}));
      }
      if(replacement) {
        const childEdge=edges[i+1]!;
        const cloned=graph.edges.find(e=>e.parent===copy.key&&e.child===childEdge.child&&(e.data?.['role']??null)===(childEdge.data?.['role']??null))!;
        cloned.child=replacement.key;cloned.id=edgeId(cloned);
      }
      if(!target)target=copy;
      if(!mustFork)break;
      if(i===0){edge.id=edge.instanceId??edge.id.replace(original.key,copy.key);edge.child=copy.key;}
      replacement=copy;
    }
    return target!;
  }
  function attach(child: EntityKey, parent: EntityKey|null, category: WorkspaceEdge['category'], mirrored = false, data: Record<string,unknown> = {}) {
    const node = get(child);
    if(parent && node.kind==='primitive') data={role:'OTHER',quantity:1,...data};
    if(!parent && node.kind==='primitive') {
      if(graph.edges.some(e=>!e.parent&&e.child===child&&e.isMirrored===mirrored))return;
      if(supplyPaths(graph,child).some(p=>p.nodes.length>1&&p.edges.some(e=>e.isMirrored)===mirrored))data={...data,directSource:category};
    }
    if (!parent && node.kind==='heritage' && node.data['kind']!==category) throw new Error('Choose the category that matches this heritage.');
    if (!parent && node.kind!=='primitive') {
      const existing=graph.edges.find(e=>!e.parent&&e.child===child);
      if(existing){existing.category=category;existing.id=node.kind==='heritage'?`ALL:${child}`:edgeId(existing);return;}
    }
    if (parent) { const issue = validateReference(graph,parent,child); if(issue) throw new Error(issue); }
    if (mirrored && (node.kind !== 'primitive' || !node.data['isMirrorable'])) throw new Error('This rule cannot be mirrored.');
    if (graph.edges.some(e => e.parent === parent && e.child === child && (parent || e.category === category) && e.isMirrored === mirrored)) return;
    const instanceId = !parent && node.kind === 'primitive' ? operation.localBindings?.instances.find(e=>e.child===child)?.id ?? crypto.randomUUID() : undefined;
    const edge: WorkspaceEdge = { id:'',parent,child,category,order:graph.edges.filter(e=>e.parent===parent).length,isMirrored:mirrored,data,...(instanceId?{instanceId}:{}) };
    edge.id=!parent && node.kind === "heritage" ? `ALL:${child}` : edgeId(edge); graph.edges.push(edge);
    if(instanceId) bindings.instances.push({id:instanceId,child,category,isMirrored:mirrored});
  }
  function setContents(node: WorkspaceNode, draft: Record<string,unknown>) {
    for(const [kind,ids,slots,idField] of [['primitive','primitiveIds','primitiveSlots','primitiveId'],['effect','effectIds','effectSlots','effectId'],['capability','capabilityIds','capabilitySlots','capabilityId']] as const) {
      if (!(ids in draft) && !(slots in draft)) continue;
      graph.edges=graph.edges.filter(e=>e.parent!==node.key || !e.child.startsWith(`${kind}:`));
      const entries = Array.isArray(draft[slots]) ? draft[slots] as Record<string,unknown>[] : ((draft[ids]??[]) as (string|number)[]).map(id=>({[idField]:id}));
      for(const entry of entries) attach(`${kind}:${entry[idField]}`,node.key,'ALL',Boolean(entry['isMirrored']),entry);
    }
  }
  let saved: WorkspaceNode|undefined;
  if(operation.type==='character') Object.assign(foundation,operation.payload);
  else if(operation.type==='create') {
    const p=operation.payload;
    if(p.existingId) saved=get(`${p.kind}:${p.existingId}`);
    else {
      const key=operation.localBindings?.nodes.find(n=>!n.source)?.key ?? localKey(p.kind),id=key.slice(key.indexOf(':')+1);
      const data={...structuredClone(p.draft),id:p.kind==='primitive'?Number(id):id,userId:authorId,isPublic:false,visibility:'PRIVATE',contentHash:null};
      saved={key,kind:p.kind,id,name:String(p.draft['name']??'Untitled'),bu:Number(p.draft['buCost']??0),description:String(p.draft['narrativeRule']??p.draft['verboseDescription']??p.draft['narrativeDescription']??p.draft['description']??''),versionId:null,latestVersionId:null,userId:authorId,data};
      graph.nodes.push(saved); bindings.nodes.push({key}); setContents(saved,p.draft);
    }
    const parent=p.target?forkPath(p.path??[]):null;
    attach(saved.key,parent?.key??null,p.category,Boolean(p.mirrored));
  } else if(operation.type==='move-root') {
    const edge=findPath(operation.path)[0]!; edge.category=operation.category; edge.id=edgeId(edge);
  } else if(operation.type==='relocate') {
    const source=structuredClone(findPath(operation.path).at(-1)!);
    if(operation.destinationPath?.includes(source.id)) throw new Error('A piece cannot be moved inside itself.');
    if(source.parent) {
      const parent=forkPath(operation.path.slice(0,-1));
      graph.edges=graph.edges.filter(e=>!(e.parent===parent.key&&e.child===source.child&&(e.data?.['role']??null)===(source.data?.['role']??null)));
    } else graph.edges=graph.edges.filter(e=>e.id!==source.id);
    const destinationPath=operation.destinationPath?.map(id=>Object.entries(replacements).reduce((value,[old,next])=>value.replaceAll(old,next),id));
    const parent=destinationPath?.length?forkPath(destinationPath):null;
    attach(source.child,parent?.key??null,operation.category,source.isMirrored,source.data);
  } else {
    const p=operation.payload, command=String(p['operation']);
    const path=(p['path']??[]) as string[];
    if(command==='detach') { const edge=findPath(path).at(-1)!; graph.edges=graph.edges.filter(e=>e.id!==edge.id); }
    else if(command==='mirror-instance') { const edge=findPath(path).at(-1)!; if(!get(edge.child).data['isMirrorable']) throw new Error('This rule cannot be mirrored.'); edge.isMirrored=!edge.isMirrored; }
    else {
      const originalEdge=graph.edges.find(e=>e.id===p['edgeId']);
      const target=forkPath(path); saved=target;
      if(command==='edit') {
        const draft=p['draft'] as Record<string,unknown>;
        target.data={...target.data,...structuredClone(draft),id:target.kind==='primitive'?Number(target.id):target.id,contentHash:null};
        target.name=String(draft['name']??target.name);target.description=String(draft['narrativeRule']??draft['verboseDescription']??draft['narrativeDescription']??draft['description']??target.description);target.bu=Number(draft['buCost']??target.bu);setContents(target,draft);
      } else if(command==='add-reference') attach(p['child'] as EntityKey,target.key,'ALL',Boolean((p['membership'] as Record<string,unknown>)?.['isMirrored']),p['membership'] as Record<string,unknown>);
      else if(command==='remove-reference'||command==='mirror-reference') {
        const edge=graph.edges.find(e=>e.parent===target.key&&e.child===originalEdge?.child&&(e.data?.['role']??null)===(originalEdge?.data?.['role']??null));
        if(!edge) throw new Error('This reference moved. Open it again.');
        if(command==='remove-reference') graph.edges=graph.edges.filter(e=>e!==edge); else {if(!get(edge.child).data['isMirrorable']) throw new Error('This rule cannot be mirrored.');edge.isMirrored=!edge.isMirrored;}
      } else if(command==='reorder') { const order=(p['order']??[]) as string[];const old=previous.graph.edges.filter(e=>e.parent===p['target']);for(const edge of graph.edges.filter(e=>e.parent===target.key)){const original=old.find(e=>e.child===edge.child);edge.order=order.indexOf(original?.id??edge.id);} } else throw new Error('This operation is not supported by the browser draft yet.');
    }
  }
  for(const node of graph.nodes) if(node.kind!=='primitive' && node.kind!=='item') node.bu=bundleBu(graph,node.key);
  const cost=membershipCostChange(previous.graph,graph);
  // Materialization adopts one unmirrored direct instance when a bundle first supplies it.
  // Preserve that identity for subsequent local removals and cost estimates.
  for(const node of graph.nodes.filter(n=>n.kind==='primitive')) {
    const paths=supplyPaths(graph,node.key);
    if(paths.some(p=>!p.item&&p.nodes.length>1&&!p.edges.some(e=>e.isMirrored))&&!supplyPaths(previous.graph,node.key).some(p=>!p.item&&p.nodes.length>1&&!p.edges.some(e=>e.isMirrored))) {
      const direct=graph.edges.find(e=>!e.parent&&e.child===node.key&&!e.isMirrored);
      if(direct)direct.data={...direct.data,directSource:direct.category};
    }
  }
  const oldSheet=structuredClone(previous.sheet);
  const positiveSpent=oldSheet.buLedger.positiveSpent+cost.characterBuDelta;
  const netSpent=oldSheet.buLedger.netSpent+cost.characterBuDelta-cost.mirrorCreditDelta;
  const rating=oldSheet.volatility.rating+cost.mirrorCreditDelta;
  const level=Number(foundation['level']??oldSheet.buBalance.level);
  const buBalance=computeBUBalance({startingBu:Number(foundation['startingBu']??25),level,dmBonusBu:Number(foundation['dmBonusBu']??oldSheet.buBalance.dmBonusBu),buSpent:netSpent,itemBuSpent:oldSheet.buBalance.itemBuSpent});
  const sheet={...oldSheet,buBalance,buLedger:{...oldSheet.buLedger,positiveSpent,netSpent,remaining:buBalance.progressionPool-netSpent},volatility:{...oldSheet.volatility,rating,ceiling:getVolatilityCeiling(level).maxNegativeBu,exceeded:rating>getVolatilityCeiling(level).maxNegativeBu}};
  // Preserve the last authoritative runtime figures; UI labels them until review.
  const result: Record<string,unknown>={replacements,localAuthoredKeys:bindings.nodes.map(n=>n.key),...(saved?{savedKey:saved.key,id:saved.id,entityResponse:{[saved.kind==='heritage'?'template':saved.kind]:saved.data}}:{})};
  return {operation:{...operation,localBindings:bindings},preview:{...previous,graph,sheet,buSpent:sheet.buLedger.netSpent,local:true,applied:false,afterSnapshot:{foundation,graph},results:[...previous.results,{operationId:operation.id,result}]}};
}
