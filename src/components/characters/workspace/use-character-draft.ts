"use client";
import { readJsonResponse } from "@/lib/http/read-json-response";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftOperation, WorkspaceDraft, WorkspaceDraftPreview } from "@/lib/character/workspace/draft-types";
import { popDraftAction } from "@/lib/character/workspace/draft-history";
import { draftReferenceKeys, projectDraftOperation } from "@/lib/character/workspace/local-draft";
import { draftRecoveryKey, parseDraftRecovery, sameDraftRecovery, type DraftRecoveryJournal } from "@/lib/character/workspace/draft-recovery";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";

async function json<T>(response: Response): Promise<T> {
  const value = await readJsonResponse(response);
  if (!response.ok) throw new Error(value.error ?? "Unable to update this draft.");
  return value as T;
}
type DraftRead = { draft: WorkspaceDraft | null; sheet: WorkspaceDraftPreview["sheet"]; graph: WorkspaceGraph; foundation: Record<string,unknown>; baseHash?:string; authorId: string };
type Frame = { draft: WorkspaceDraft|null; preview: WorkspaceDraftPreview };
type LocalCopy = { schema:2; authorId:string; characterId:string; stamp:string; serverId:string|null; serverVersion:number; baseRevision:number; baseHash?:string; frame:Frame; history:Frame[] };
export type DraftPhase = "idle" | "loading" | "saving" | "checking" | "applying" | "discarding" | "undoing";
const copyKey=(author:string,character:string)=>`sw:local-build:v2:${author}:${character}`;

/** Local working copy. Only explicit review syncs/checks a draft; apply commits the live character. */
export function useCharacterDraft(characterId: string) {
  const [draft,setDraft]=useState<WorkspaceDraft|null>(null);
  const [preview,setPreview]=useState<WorkspaceDraftPreview|null>(null);
  const [baseSheet,setBaseSheet]=useState<WorkspaceDraftPreview['sheet']|null>(null);
  const [phase,setPhase]=useState<DraftPhase>('loading');
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [persistenceWarning,setPersistenceWarning]=useState('');
  const [future,setFuture]=useState<Frame[]>([]);
  const [pendingRecovery,setPendingRecovery]=useState<DraftRecoveryJournal|null>(null);
  const [recoveryConflict,setRecoveryConflict]=useState('');
  const [appliedDraft,setAppliedDraft]=useState<WorkspaceDraft|null>(null);
  const frame=useRef<Frame|null>(null), baseline=useRef<Frame|null>(null), history=useRef<Frame[]>([]);
  const server=useRef<WorkspaceDraft|null>(null), author=useRef<string|null>(null), locked=useRef(false), stamp=useRef<string|null>(null);
  const reviewAbort=useRef<AbortController|null>(null);
  const cancelReview=useCallback(()=>{reviewAbort.current?.abort();},[]);
  const baseHash=useRef<string|undefined>(undefined);
  const endpoint=`/api/characters/${characterId}/workspace/draft`;
  const install=useCallback((value:Frame)=>{frame.current=value;setDraft(value.draft);setPreview(value.preview);},[]);
  const persist=useCallback((value:Frame)=>{
    if(!author.current)return;
    const key=copyKey(author.current,characterId);
    try {
      const previous=JSON.parse(localStorage.getItem(key)??'null') as LocalCopy|null;
      if(previous && previous.stamp!==stamp.current) throw new Error('This character has newer edits in another tab. Reload to continue that draft.');
    } catch(cause) { if(cause instanceof Error && cause.message.startsWith('This character'))throw cause; }
    const nextStamp=crypto.randomUUID();
    const copy:LocalCopy={schema:2,authorId:author.current,characterId,stamp:nextStamp,...(baseHash.current?{baseHash:baseHash.current}:{}),serverId:server.current?.id??null,serverVersion:server.current?.version??0,baseRevision:value.draft?.baseRevision??value.preview.graph.revision,frame:value,history:history.current.slice(-3)};
    try{localStorage.setItem(key,JSON.stringify(copy));stamp.current=nextStamp;setPersistenceWarning('');}
    catch{setPersistenceWarning('Browser storage is full or unavailable. Keep this page open and review your draft to save a server copy.');}
  },[characterId]);
  const clearCopy=useCallback(()=>{
    if(!author.current)return;
    const key=copyKey(author.current,characterId);
    try{const copy=JSON.parse(localStorage.getItem(key)??'null');if(copy?.stamp===stamp.current)localStorage.removeItem(key);}catch{/* Preserve other-tab copies. */}
    stamp.current=null;
  },[characterId]);
  const verify=useCallback(async(value:WorkspaceDraft,signal?:AbortSignal)=>json<WorkspaceDraftPreview>(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',draftId:value.id,expectedVersion:value.version}),...(signal?{signal}:{})})),[endpoint]);
  const reload=useCallback(async(signal?:AbortSignal)=>{
    setPhase('loading');setError('');setFuture([]);history.current=[];stamp.current=null;
    try{
      const data=await json<DraftRead>(await fetch(endpoint,{cache:'no-store',...(signal?{signal}:{})}));
      if(signal?.aborted)return;
      author.current=data.authorId;baseHash.current=data.baseHash;server.current=data.draft?.status==='editing'?data.draft:null;setBaseSheet(data.sheet);
      const empty:WorkspaceDraftPreview={graph:data.graph,sheet:data.sheet,beforeSheet:data.sheet,revision:data.graph.revision,buSpent:data.sheet.buLedger.netSpent,results:[],applied:false,local:true,beforeSnapshot:{graph:data.graph,foundation:data.foundation},afterSnapshot:{graph:data.graph,foundation:data.foundation}};
      baseline.current={draft:null,preview:empty};
      let copy:LocalCopy|null=null;
      try{copy=JSON.parse(localStorage.getItem(copyKey(data.authorId,characterId))??'null');}catch{setPersistenceWarning('The browser draft could not be read. The saved account draft is still available.');}
      if(copy?.schema===2&&copy.authorId===data.authorId&&copy.characterId===characterId&&copy.frame?.preview?.graph?.characterId===characterId&&(!copy.frame.draft||Array.isArray(copy.frame.draft.operations))&&Array.isArray(copy.history)) {
        stamp.current=copy.stamp;
        if((!copy.baseHash || copy.baseHash===data.baseHash)&&copy.baseRevision===data.graph.revision&&((copy.serverId===(server.current?.id??null)&&copy.serverVersion===(server.current?.version??0)) || JSON.stringify(copy.frame.draft?.operations)===JSON.stringify(server.current?.operations))) {
          history.current=copy.history;install({...copy.frame,...(server.current?{draft:{...server.current,operations:copy.frame.draft?.operations??[]}}:{}),preview:{...copy.frame.preview,local:true}});return;
        }
        install(copy.frame);
        setRecoveryConflict('The live character or account draft changed after this browser copy was saved. Your local edits are preserved. Discard this local copy to load the current character.');
        setPendingRecovery({schema:1,authorId:data.authorId,characterId,savedAt:new Date().toISOString(),request:{expectedVersion:copy.serverVersion,baseRevision:copy.baseRevision,operations:copy.frame.draft?.operations??[],...(copy.serverId?{draftId:copy.serverId}:{})}});return;
      }
      let legacy:DraftRecoveryJournal|null=null;
      try{legacy=parseDraftRecovery(localStorage.getItem(draftRecoveryKey(data.authorId,characterId)),data.authorId,characterId);}catch{/* Optional recovery. */}
      setPendingRecovery(legacy);setRecoveryConflict('');
      if(server.current){const result=await verify(server.current,signal);if(signal?.aborted)return;install({draft:server.current,preview:result});}
      else install(baseline.current);
    }catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:'Unable to load draft.');}
    finally{if(!signal?.aborted){setPhase('idle');setReady(true);}}
  },[characterId,endpoint,install,verify]);
  useEffect(()=>{const abort=new AbortController();setReady(false);void reload(abort.signal);return()=>abort.abort();},[reload]); // eslint-disable-line react-hooks/set-state-in-effect

  const stageMany=useCallback(async(operations:DraftOperation[],baseRevision:number)=>{
    if(locked.current||!frame.current||!author.current)throw new Error('Wait for the draft to finish loading.');
    if(pendingRecovery)throw new Error('Resolve the recovered draft before editing.');
    if((frame.current.draft?.operations.length??0)+operations.length>100)throw new Error('Review and apply this draft before adding more changes.');
    locked.current=true;setError('');
    const original=frame.current;
    try{
      let next=original.preview;
      const created=new Set(operations.flatMap(op=>op.type==='create'&&!op.payload.existingId ? op.localBindings?.nodes.filter(n=>!n.source).map(n=>n.key)??[] : []));
      const missing=[...new Set(operations.flatMap(draftReferenceKeys))].filter(key=>!created.has(key)&&!next.graph.nodes.some(n=>n.key===key));
      if(missing.length){
        setPhase('loading');
        const query=new URLSearchParams();missing.forEach(key=>query.append('piece',key));
        const loaded=await json<WorkspaceGraph>(await fetch(`/api/characters/${characterId}/workspace?${query}`,{cache:'no-store'}));
        const newKeys=new Set(loaded.nodes.filter(n=>!next.graph.nodes.some(old=>old.key===n.key)).map(n=>n.key));
        next={...next,graph:{...next.graph,nodes:[...next.graph.nodes,...loaded.nodes.filter(n=>newKeys.has(n.key))],edges:[...next.graph.edges,...loaded.edges.filter(e=>e.parent&&newKeys.has(e.parent))]}};
      }
      const groupId=operations.length>1?crypto.randomUUID():undefined;
      const staged:DraftOperation[]=[];
      for(const operation of operations){const result=projectDraftOperation(next,{...operation,...(groupId?{groupId}:{})},author.current);next=result.preview;staged.push(result.operation);}
      const value:WorkspaceDraft={...(original.draft??{id:crypto.randomUUID(),authorId:author.current,baseRevision,version:0,status:'editing' as const}),operations:[...(original.draft?.operations??[]),...staged],updatedAt:new Date().toISOString()};
      const updated={draft:value,preview:next};
      history.current.push(original);
      try{persist(updated);}catch(cause){history.current.pop();throw cause;}
      install(updated);setFuture([]);return next;
    }finally{locked.current=false;setPhase('idle');}
  },[characterId,install,pendingRecovery,persist]);
  const stage=useCallback((operation:DraftOperation,revision:number)=>stageMany([operation],revision),[stageMany]);
  const checkReview=useCallback(async()=>{
    const value=frame.current;
    if(!value?.draft||locked.current)return null;
    if(pendingRecovery)throw new Error('Resolve browser recovery before checking this draft.');
    locked.current=true;setPhase('saving');setError('');
    const abort=new AbortController();reviewAbort.current=abort;
    const timeout=setTimeout(()=>abort.abort(new Error('The server has not finished checking the draft. Your edits are saved; keep editing or retry.')),180000);
    try{
      persist(value);
      const saved=await json<{draft:WorkspaceDraft}>(await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(server.current?{draftId:server.current.id}:{}),expectedVersion:server.current?.version??0,baseRevision:value.draft.baseRevision,baseHash:baseHash.current,operations:value.draft.operations})}));
      server.current=saved.draft;
      const pending={draft:saved.draft,preview:{...value.preview,local:true}};install(pending);persist(pending);
      if(abort.signal.aborted)return null;
      setPhase('checking');const result=await verify(saved.draft,abort.signal);
      if(abort.signal.aborted)return null;
      const checked={draft:saved.draft,preview:result};install(checked);persist(checked);return result;
    }catch(cause){if(abort.signal.aborted && !(abort.signal.reason instanceof Error && abort.signal.reason.name!=='AbortError'))return null;const failure=abort.signal.aborted?abort.signal.reason:cause;setError(failure instanceof Error?failure.message:'Unable to check draft.');throw failure;}
    finally{clearTimeout(timeout);if(reviewAbort.current===abort)reviewAbort.current=null;locked.current=false;setPhase('idle');}
  },[endpoint,install,pendingRecovery,persist,verify]);
  const undo=useCallback(async()=>{
    if(locked.current||!frame.current?.draft)return;
    const previous=history.current.pop();
    if(previous){const current=frame.current;const restored={...previous,preview:{...previous.preview,local:true}};try{persist(restored);}catch(cause){history.current.push(previous);throw cause;}install(restored);setFuture(old=>[...old,current]);setError('');return;}
    const currentFrame=frame.current;
    const {remaining:localRemaining}=popDraftAction(currentFrame.draft!.operations);
    if(baseline.current && localRemaining.every(op=>!!op.localBindings)) {
      locked.current=true;setPhase('loading');
      try {
        let rebuilt=structuredClone(baseline.current.preview);
        const authoredKeys=new Set(currentFrame.draft!.operations.flatMap(op=>op.localBindings?.nodes.map(node=>node.key)??[]));
        const extraKeys=new Set(currentFrame.preview.graph.nodes.filter(node=>!authoredKeys.has(node.key)&&!rebuilt.graph.nodes.some(old=>old.key===node.key)).map(node=>node.key));
        rebuilt.graph.nodes.push(...currentFrame.preview.graph.nodes.filter(node=>extraKeys.has(node.key)));
        rebuilt.graph.edges.push(...currentFrame.preview.graph.edges.filter(edge=>edge.parent&&extraKeys.has(edge.parent)));
        const missing=[...new Set(localRemaining.flatMap(draftReferenceKeys))].filter(key=>!authoredKeys.has(key)&&!rebuilt.graph.nodes.some(node=>node.key===key));
        if(missing.length) {
          const query=new URLSearchParams();missing.forEach(key=>query.append('piece',key));
          const loaded=await json<WorkspaceGraph>(await fetch(`/api/characters/${characterId}/workspace?${query}`,{cache:'no-store'}));
          const extra=new Set(loaded.nodes.filter(node=>!rebuilt.graph.nodes.some(old=>old.key===node.key)).map(node=>node.key));
          rebuilt.graph.nodes.push(...loaded.nodes.filter(node=>extra.has(node.key)));
          rebuilt.graph.edges.push(...loaded.edges.filter(edge=>edge.parent&&extra.has(edge.parent)));
        }
        for(const operation of localRemaining)rebuilt=projectDraftOperation(rebuilt,operation,author.current!).preview;
        const restored={draft:{...currentFrame.draft!,operations:localRemaining},preview:{...rebuilt,local:true}};
        persist(restored);install(restored);setFuture(old=>[...old,currentFrame]);setError('');return;
      } finally {locked.current=false;setPhase('idle');}
    }
    // A draft made before local editing has no browser history. Undo it with the existing validated server path.
    locked.current=true;setPhase('undoing');
    const current=frame.current;const {remaining}=popDraftAction(current.draft!.operations);
    const next={...current,draft:{...current.draft!,operations:remaining},preview:{...current.preview,local:true}};
    install(next);
    try{const saved=await json<{draft:WorkspaceDraft}>(await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({draftId:server.current?.id,expectedVersion:server.current?.version??0,baseRevision:current.draft!.baseRevision,operations:remaining})}));server.current=saved.draft;const result=await verify(saved.draft);const updated={draft:saved.draft,preview:result};persist(updated);install(updated);setFuture(old=>[...old,current]);setError('');}
    catch(cause){install(current);throw cause;}
    finally{locked.current=false;setPhase('idle');}
  },[characterId,endpoint,install,persist,verify]);
  const redo=useCallback(async()=>{const next=future.at(-1);if(!next||locked.current||!frame.current)return;history.current.push(frame.current);const restored={...next,preview:{...next.preview,local:true}};try{persist(restored);}catch(cause){history.current.pop();throw cause;}install(restored);setFuture(old=>old.slice(0,-1));setError('');},[future,install,persist]);
  const canReview=!!draft&&!!preview&&!preview.local&&!error&&!pendingRecovery&&phase==='idle';
  const apply=useCallback(async()=>{
    if(locked.current)throw new Error('The draft is still being checked. Wait for checking to finish.');
    if(frame.current?.preview.local){const checked=await checkReview();if(!checked)throw new Error('Draft checking was cancelled. Your edits are saved.');}
    if(!frame.current?.draft||frame.current.preview.local||!server.current||pendingRecovery)throw new Error('Check this draft before applying it.');
    locked.current=true;setPhase('applying');setError('');
    try{if(frame.current)persist(frame.current);const result=await json<WorkspaceDraftPreview>(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',draftId:server.current.id,expectedVersion:server.current.version})}));setAppliedDraft(server.current);clearCopy();history.current=[];server.current=null;frame.current=null;setDraft(null);setPreview(null);setBaseSheet(result.sheet);setFuture([]);baseline.current={draft:null,preview:result};install(baseline.current);return result;}
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to apply draft.');throw cause;}
    finally{locked.current=false;setPhase('idle');}
  },[checkReview,clearCopy,endpoint,install,pendingRecovery,persist]);
  const discard=useCallback(async()=>{
    if(locked.current)return;
    if(pendingRecovery)throw new Error('Resolve the browser recovery before discarding an account draft.');
    locked.current=true;setPhase('discarding');
    try{if(server.current)await json(await fetch(endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({draftId:server.current.id,expectedVersion:server.current.version})}));clearCopy();setPendingRecovery(null);await reload();}finally{locked.current=false;setPhase('idle');}
  },[clearCopy,endpoint,pendingRecovery,reload]);
  const dismissPending=useCallback(()=>{if(locked.current||!author.current)return;clearCopy();try{const key=draftRecoveryKey(author.current,characterId);const saved=parseDraftRecovery(localStorage.getItem(key),author.current,characterId);if(pendingRecovery && sameDraftRecovery(saved,pendingRecovery))localStorage.removeItem(key);}catch{/* optional */}setPendingRecovery(null);setRecoveryConflict('');setError('');},[characterId,clearCopy,pendingRecovery]);
  const recoverPending=useCallback(async()=>{
    if(!pendingRecovery||recoveryConflict||locked.current)return null;
    locked.current=true;setPhase('saving');
    try{const saved=await json<{draft:WorkspaceDraft}>(await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pendingRecovery.request)}));server.current=saved.draft;const result=await verify(saved.draft);install({draft:saved.draft,preview:result});locked.current=false;dismissPending();return result;}
    finally{locked.current=false;setPhase('idle');}
  },[dismissPending,endpoint,install,pendingRecovery,recoveryConflict,verify]);
  const undoApplied=useCallback(async()=>{if(!appliedDraft||locked.current)return null;locked.current=true;setPhase('undoing');try{const result=await json<WorkspaceDraftPreview>(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'undo',draftId:appliedDraft.id,expectedVersion:appliedDraft.version})}));setAppliedDraft(null);await reload();return result;}finally{locked.current=false;setPhase('idle');}},[appliedDraft,endpoint,reload]);
  return {draft,preview,baseSheet,stageMany,stage,ready,busy:phase!=='idle',phase,error,pendingRecovery,recoveryConflict,persistenceWarning,recoverPending,dismissPending,canReview,checkReview,cancelReview,undo,redo,apply,discard,reload,undoApplied,canUndoApplied:!!appliedDraft,canRedo:future.length>0};
}
