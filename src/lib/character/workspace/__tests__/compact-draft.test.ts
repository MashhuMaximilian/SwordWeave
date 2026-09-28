import {describe,it,expect} from 'vitest';import {compactDraftReplay} from '../compact-draft';import type {DraftOperation} from '../draft-types';import type {WorkspaceGraph} from '../model';
const graph:WorkspaceGraph={characterId:'c',revision:0,nodes:[],edges:[]};
const add:DraftOperation={id:'add',type:'create',payload:{kind:'primitive',existingId:'1',category:'LINEAGE',draft:{}},localBindings:{nodes:[],instances:[{id:'slot',child:'primitive:1',category:'LINEAGE',isMirrored:false}]}};
const remove:DraftOperation={id:'remove',type:'command',payload:{operation:'detach',target:'primitive:1',path:['slot']}};
describe('safe replay compaction',()=>{
 it('omits an add/remove pair without dropping narrative changes',()=>{const edit:DraftOperation={id:'text',type:'character',payload:{name:'New'}};expect(compactDraftReplay([add,edit,remove],graph)).toEqual([edit]);});
 it('never cancels removal of a pre-existing instance',()=>{expect(compactDraftReplay([add,remove],{...graph,edges:[{id:'slot',parent:null,child:'primitive:1',category:'LINEAGE',order:0,isMirrored:false}]})).toHaveLength(2);});
 it('keeps a pair used by an intermediate command',()=>{const op:DraftOperation={id:'use',type:'command',payload:{operation:'add-reference',child:'primitive:1',target:'effect:e'}};expect(compactDraftReplay([add,op,remove],graph)).toHaveLength(3);});
 it('preserves duplicate legacy additions followed by one removal',()=>{const {localBindings,...legacy}=add;expect(compactDraftReplay([legacy,{...legacy,id:'second'},remove],graph)).toHaveLength(3);});
 it('does not cancel a different instance or incomplete pair',()=>{expect(compactDraftReplay([add,{...remove,payload:{...remove.payload,path:['other']}}],graph)).toHaveLength(2);expect(compactDraftReplay([add],graph)).toEqual([add]);});
 it('supports older drafts without bindings only when the primitive was not already supplied',()=>{const {localBindings,...legacy}=add;expect(compactDraftReplay([legacy,remove],graph)).toEqual([]);const owned={...graph,nodes:[{key:'primitive:1' as const,id:'1',kind:'primitive' as const,name:'Owned',bu:1,description:'',data:{},versionId:null,latestVersionId:null,userId:null}],edges:[{id:'original',parent:null,child:'primitive:1' as const,category:'LINEAGE' as const,order:0,isMirrored:false}]};expect(compactDraftReplay([legacy,remove],owned)).toHaveLength(2);});
});
