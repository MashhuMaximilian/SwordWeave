"use client";
import { useState } from 'react';
import type { AccessRestriction } from '@/lib/character/consequences/types';
import { useCharacterSupplyGraph } from '@/lib/hooks/use-character-supply-graph';
import { WorkspaceLibraryPicker } from './workspace/library-picker';
export function ConsequenceRestrictionsEditor({value,onChange,characterId}:{value:readonly AccessRestriction[];onChange:(value:AccessRestriction[])=>void;characterId?:string|undefined}) {
  const graph=useCharacterSupplyGraph(characterId ?? '');
  const [library,setLibrary]=useState(false);
  const add=(kind:'primitive'|'capability',entityId:string,name:string)=>{
    if(!value.some(r=>r.kind===kind&&r.entityId===entityId))onChange([...value,{kind,entityId,reason:`${name} is unavailable until recovery.`}]);
    setLibrary(false);
  };
  return <fieldset className="space-y-2 rounded border border-border p-3"><legend>Access restrictions</legend><p className="text-xs text-muted-foreground">A capability restriction blocks only that supply path. A primitive restriction blocks that primitive everywhere.</p>{value.map((r,i)=><div key={`${r.kind}:${r.entityId}`} className="flex flex-wrap gap-2"><label className="flex-1 text-sm">{graph?.nodes.find(n=>n.kind===r.kind&&n.id===r.entityId)?.name ?? `Restricted ${r.kind}`}<input aria-label={`Restriction reason ${i+1}`} className="mt-1 w-full rounded border border-input bg-background p-2" value={r.reason} onChange={e=>onChange(value.map((v,j)=>j===i?{...v,reason:e.target.value}:v))}/></label><button type="button" onClick={()=>onChange(value.filter((_,j)=>j!==i))}>Remove restriction</button></div>)}{graph&&<select aria-label="Restrict a piece on this character" value="" className="w-full rounded border border-border bg-card p-2" onChange={e=>{const node=graph.nodes.find(n=>n.key===e.target.value);if(node&&(node.kind==='primitive'||node.kind==='capability'))add(node.kind,node.id,node.name);}}><option value="">Choose a piece on this character…</option>{graph.nodes.filter(n=>n.kind==='primitive'||n.kind==='capability').map(n=><option key={n.key} value={n.key}>{n.name} · {n.kind}</option>)}</select>}<button type="button" onClick={()=>setLibrary(!library)}>Choose from Library</button>{library&&<WorkspaceLibraryPicker kinds={['primitive','capability']} category="ALL" onSelect={(key,name)=>{const [kind,id]=key.split(':');add(kind as 'primitive'|'capability',id!,name);}}/>}</fieldset>;
}
