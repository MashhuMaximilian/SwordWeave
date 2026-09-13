"use client";
import { useEffect, useState } from "react";
import { EntityPreview } from "@/components/preview/entity-preview";
import { mapPayloadToPreviewItem } from "@/components/library/version-preview-button";
export function ForkVersionInspector({targetType,targetId,versionNumber}:{targetType:string;targetId:string;versionNumber:number}) {
  const [result,setResult] = useState<{payload?:Record<string,unknown>;error?:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    const query=new URLSearchParams({targetType,targetId,version:String(versionNumber)});
    fetch(`/api/versions/list?${query}`,{signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error ?? "Version unavailable.");return data;
    }).then(data=>setResult({payload:data.version.payload})).catch(error=>{if(!controller.signal.aborted)setResult({error:error.message});});
    return()=>controller.abort();
  },[targetType,targetId,versionNumber]);
  if (!result) return <p role="status">Loading v{versionNumber}…</p>;
  if (result.error) return <p role="alert">{result.error}</p>;
  const item=mapPayloadToPreviewItem(targetType,targetId,result.payload!);
  return <section className="v12-version-inspection" aria-label={`Version ${versionNumber} preview`}>
    <p className="v12-kicker">Stored version · v{versionNumber}</p>
    {item ? <EntityPreview item={item}/> : <p>This record’s complete stored fields are available below.</p>}
    <details><summary>Complete stored fields</summary><pre>{JSON.stringify(result.payload,null,2)}</pre></details>
    <a className="v12-metal-button" href={`/library/item/${targetType}:${targetId}/versions#v${versionNumber}`}>Version history ↗</a>
  </section>;
}
