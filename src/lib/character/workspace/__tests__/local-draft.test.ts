import { describe,it,expect } from 'vitest';
import { projectDraftOperation } from '../local-draft';
import { mapDraftIdentities,registerLocalBindings } from '../draft-aliases';
import { draftReviewChangeCount } from '@/components/characters/workspace/draft-change-review-model';
import { supplyPaths,type WorkspaceNode,type WorkspaceGraph } from '../model';
import type { DraftOperation,WorkspaceDraftPreview } from '../draft-types';
const node=(key:WorkspaceNode['key'],bu=4):WorkspaceNode=>({key,id:key.split(':')[1]!,kind:key.split(':')[0] as WorkspaceNode['kind'],name:key,bu,description:'rule',userId:'owner',versionId:null,latestVersionId:null,data:{buCost:bu,name:key,isMirrorable:true,mirrorBuCredit:bu}});
const edge=(id:string,child:WorkspaceNode['key'],parent:WorkspaceNode['key']|null=null)=>({id,child,parent,category:'MANIFEST' as const,order:0,isMirrored:false});
function preview(graph:WorkspaceGraph):WorkspaceDraftPreview {const sheet={buBalance:{progressionPool:25,progressionSpent:0,progressionRemaining:25,level:1,dmBonusBu:0,itemBuSpent:0},buLedger:{positiveSpent:0,netSpent:0,remaining:25},volatility:{rating:0,ceiling:4,exceeded:false}} as WorkspaceDraftPreview['sheet'];const foundation={level:1,startingBu:25,attrPhysical:4,attrMental:3,attrMagical:3};return {graph,sheet,beforeSheet:sheet,buSpent:0,revision:0,results:[],applied:false,beforeSnapshot:{foundation,graph},afterSnapshot:{foundation,graph}};}
const empty=()=>preview({characterId:'ch',revision:0,nodes:[],edges:[]});
const create=(name='New'):DraftOperation=>({id:crypto.randomUUID(),type:'create',payload:{kind:'primitive',category:'MANIFEST',draft:{name,buCost:4,mechanicalOutputText:'Add +1',isMirrorable:true,mirrorBuCredit:4}}});

describe('local working copy',()=>{
 it('adds/removes locally, cancels net review and does not mutate the baseline',()=>{
  const base=empty();const added=projectDraftOperation(base,create(),'owner');const root=added.preview.graph.edges[0]!;
  expect(added.preview.local).toBe(true);expect(base.graph.nodes).toEqual([]);expect(added.preview.sheet.buLedger.netSpent).toBe(4);expect(draftReviewChangeCount(added.preview)).toBe(1);
  const removed=projectDraftOperation(added.preview,{id:crypto.randomUUID(),type:'command',payload:{operation:'detach',target:root.child,path:[root.id]}},'owner');
  expect(removed.preview.sheet.buLedger.netSpent).toBe(0);expect(draftReviewChangeCount(removed.preview)).toBe(0);
 });
 it('isolates an existing shared branch, then edits the authored branch without another fork',()=>{
  const graph:WorkspaceGraph={characterId:'ch',revision:0,nodes:[node('capability:a'),node('capability:b'),node('effect:x'),node('primitive:1')],edges:[edge('a','capability:a'),edge('b','capability:b'),edge('ax','effect:x','capability:a'),edge('bx','effect:x','capability:b'),edge('x1','primitive:1','effect:x')]};
  const edited=projectDraftOperation(preview(graph),{id:crypto.randomUUID(),type:'command',payload:{operation:'edit',target:'primitive:1',path:['a','ax','x1'],draft:{name:'Changed',buCost:6}}},'owner');
  const key=edited.preview.results.at(-1)!.result['savedKey'] as WorkspaceNode['key'];
  expect(supplyPaths(edited.preview.graph,'primitive:1')).toHaveLength(1);expect(supplyPaths(edited.preview.graph,key)).toHaveLength(1);
  expect(graph.nodes.at(-1)!.name).toBe('primitive:1');
  const path=supplyPaths(edited.preview.graph,key)[0]!.edges.map(e=>e.id);
  const twice=projectDraftOperation(edited.preview,{id:crypto.randomUUID(),type:'command',payload:{operation:'edit',target:key,path,draft:{name:'Changed again'}}},'owner');
  expect(twice.preview.results.at(-1)!.result['savedKey']).toBe(key);expect(twice.operation.localBindings?.nodes).toEqual([]);
 });
 it('does not treat a referenced Library entry as a newly authored rule',()=>{
  const base=empty();base.graph.nodes.push(node('primitive:1'));
  const add=projectDraftOperation(base,{id:crypto.randomUUID(),type:'create',payload:{kind:'primitive',category:'MANIFEST',draft:{},existingId:'1'}},'owner');const root=add.preview.graph.edges[0]!;
  const edit=projectDraftOperation(add.preview,{id:crypto.randomUUID(),type:'command',payload:{operation:'edit',target:root.child,path:[root.id],draft:{name:'Fork'}}},'owner');
  expect(edit.operation.localBindings!.nodes[0]!.source).toBe('primitive:1');
 });
 it('groups a private fork with the existing piece for review',()=>{
  const graph:WorkspaceGraph={characterId:'ch',revision:0,nodes:[node('primitive:1')],edges:[edge('root','primitive:1')]};
  const changed=projectDraftOperation(preview(graph),{id:crypto.randomUUID(),type:'command',payload:{operation:'edit',target:'primitive:1',path:['root'],draft:{name:'New name'}}},'owner');
  expect(draftReviewChangeCount(changed.preview)).toBe(1);
 });
 it('updates level budget/debt locally and marks the sheet unverified',()=>{
  const changed=projectDraftOperation(empty(),{id:crypto.randomUUID(),type:'character',payload:{level:10}},'owner');
  expect(changed.preview.sheet.buBalance.progressionPool).toBe(127);expect(changed.preview.sheet.volatility.ceiling).toBe(12);expect(changed.preview.local).toBe(true);
 });
 it('keeps proposed identities for generated capability pieces until one grouped save',()=>{
  const op=create();op.localBindings={nodes:[{key:'primitive:-500'}],instances:[{id:'878d32b4-900a-44cf-a711-bcba0bfc0661',child:'primitive:-500',category:'MANIFEST',isMirrored:false}]};
  const added=projectDraftOperation(empty(),op,'owner');
  expect(added.preview.graph.nodes[0]!.key).toBe('primitive:-500');expect(added.preview.graph.edges[0]!.id).toBe(op.localBindings.instances[0]!.id);
 });
 it('binds placeholders only to actual validated result nodes and memberships',()=>{
  const op=create();const local=projectDraftOperation(empty(),op,'owner');const after:WorkspaceGraph={characterId:'ch',revision:1,nodes:[node('primitive:80')],edges:[{...edge('actual','primitive:80'),instanceId:'actual'}]};
  const aliases=new Map<string,string>();registerLocalBindings(local.operation.localBindings,empty().graph,after,{savedKey:'primitive:80'},aliases);
  const localNode=local.preview.graph.nodes[0]!;const localEdge=local.preview.graph.edges[0]!;
  expect(mapDraftIdentities({target:localNode.key,path:[localEdge.id],draft:{primitiveIds:[Number(localNode.id)]}},aliases)).toEqual({target:'primitive:80',path:['actual'],draft:{primitiveIds:[80]}});
  expect(()=>registerLocalBindings({nodes:[{key:'primitive:80'}],instances:[]},after,after,{savedKey:'primitive:999'},aliases)).toThrow('reconcile');
 });
});

describe('bundling local authored pieces',()=>{
 it.each(['capability','effect','heritage'] as const)('keeps the one purchase when moving a generated rule into a %s',(kind)=>{
  const added=projectDraftOperation(empty(),create(),'owner');const primitive=added.preview.graph.nodes[0]!,root=added.preview.graph.edges[0]!;
  const bundled=projectDraftOperation(added.preview,{id:crypto.randomUUID(),type:'create',payload:{kind,category:'MANIFEST',draft:{name:'Talent',kind:'MANIFEST',type:'PASSIVE',primitiveSlots:[{primitiveId:Number(primitive.id),role:'AUGMENT',quantity:1}]}}},'owner');
  expect(bundled.preview.sheet.buLedger.netSpent).toBe(4);
  const placed=projectDraftOperation(bundled.preview,{id:crypto.randomUUID(),type:'command',payload:{operation:'detach',target:primitive.key,path:[root.id]}},'owner');
  expect(placed.preview.sheet.buLedger.netSpent).toBe(4);expect(supplyPaths(placed.preview.graph,primitive.key)[0]!.nodes).toHaveLength(2);
 });
 it('adding then removing a rule from an existing container leaves no net change',()=>{
  const graph:WorkspaceGraph={characterId:'ch',revision:0,nodes:[node('effect:a',0),node('primitive:1')],edges:[edge('root','effect:a')]};
  const base=preview(graph);
  const add=projectDraftOperation(base,{id:crypto.randomUUID(),type:'create',payload:{kind:'primitive',existingId:'1',category:'MANIFEST',draft:{},target:'effect:a',path:['root']}},'owner');
  const parent=add.preview.graph.edges.find(e=>!e.parent)!,child=add.preview.graph.edges.find(e=>e.parent===parent.child)!;
  expect(child.id).toContain(':OTHER');
  const remove=projectDraftOperation(add.preview,{id:crypto.randomUUID(),type:'command',payload:{operation:'remove-reference',target:parent.child,path:[parent.id],edgeId:child.id}},'owner');
  expect(draftReviewChangeCount(remove.preview)).toBe(0);expect(remove.preview.sheet.buLedger.netSpent).toBe(0);
 });
});
