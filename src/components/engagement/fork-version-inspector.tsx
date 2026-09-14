"use client";
import { useEffect, useState } from "react";
import { EntityPreview } from "@/components/preview/entity-preview";
import { mapPayloadToPreviewItem } from "@/components/library/version-preview-button";
export function ForkVersionInspector({targetType,targetId,versionNumber}:{targetType:string;targetId:string;versionNumber:number}) {
  const [result,setResult] = useState<{payload?:Record<string,unknown>;error?:string}|null>(null);
  const [forking,setForking]=useState(false);
  const [forkError,setForkError]=useState<string|null>(null);
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
    {targetType === "PRIMITIVE" ? <button type="button" className="v12-metal-button v12-metal-button--primary" disabled={forking} onClick={async()=>{
      setForking(true);setForkError(null);
      try {
        const response=await fetch("/api/fork",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetType,targetId,sourceVersionNumber:versionNumber})});
        const data=await response.json() as {forkedTargetId?:string;error?:string};
        if(!response.ok || !data.forkedTargetId) throw new Error(data.error ?? "Could not fork this version.");
        window.location.assign(`/atelier?build=primitive&edit=${data.forkedTargetId}&intent=load`);
      } catch(error) { setForkError(error instanceof Error ? error.message : "Could not fork this version."); setForking(false); }
    }}>{forking ? "Forking…" : `Fork this version (v${versionNumber})`}</button> : null}
    {forkError ? <p role="alert">{forkError}</p> : null}
    <a className="v12-metal-button" href={`/library/item/${targetType}:${targetId}/versions#v${versionNumber}`}>Version history ↗</a>
  </section>;
}
