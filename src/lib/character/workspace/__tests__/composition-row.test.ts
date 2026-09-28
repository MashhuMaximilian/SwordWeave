import {describe,it,expect} from 'vitest';
import {compositionRow} from '../composition-row';
import type {EntityKey,WorkspaceGraph,WorkspaceNode} from '../model';
const node=(kind:WorkspaceNode['kind'],id:string):WorkspaceNode=>({key:`${kind}:${id}`,kind,id,name:`${kind} ${id}`,bu:4,data:{},description:'',versionId:null,latestVersionId:null,userId:null});
describe('nested workspace form rows',()=>{
 it.each(['heritage','item'] as const)('preserves %s → capability → effect → primitive instead of flattening',kind=>{
  const nodes=[node(kind,'root'),node('capability','cap'),node('effect','effect'),node('primitive','1')];
  const graph:WorkspaceGraph={characterId:'c',revision:0,nodes,edges:nodes.slice(1).map((n,i)=>({id:String(i),parent:nodes[i]!.key,child:n.key,category:'ALL',order:i,isMirrored:false}))};
  const row=compositionRow(graph,nodes[0]!);
  expect(row['primitiveLinks']).toEqual([]);
  expect(row['capabilityLinks']).toMatchObject([{capabilityId:'cap',capability:{effectLinks:[{effectId:'effect',effect:{primitiveLinks:[{primitiveId:1,primitive:{buCost:4}}]}}]}}]);
 });
 it('preserves independent direct pieces, nesting metadata, and order',()=>{
  const nodes=[node('item','root'),node('capability','cap'),node('effect','effect'),node('primitive','1')];
  const graph:WorkspaceGraph={characterId:'c',revision:0,nodes,edges:nodes.slice(1).map((n,i)=>({id:String(i),parent:'item:root' as EntityKey,child:n.key,category:'ITEM',order:i,isMirrored:false,data:{slotLabel:'selected'}}))};
  const row=compositionRow(graph,nodes[0]!);
  expect(row['capabilityLinks']).toHaveLength(1);expect(row['effectLinks']).toHaveLength(1);expect(row['primitiveLinks']).toHaveLength(1);
  expect(row['effectLinks']).toMatchObject([{slotLabel:'selected'}]);
 });
});
