"use client";
import {useEffect,useState} from "react";
import type {LibraryItem} from "@/lib/publishing/library-query";
import {LibraryCatalogueCard} from "@/components/library/library-catalogue-card";
import {MonsterTemplatePreview} from "@/components/monsters/monster-template-preview";
import {DetailModal} from "@/components/ui/detail-modal";

/** The creature corpus uses the same catalogue and preview as the public Library. */
export function AtelierMonsterLibrary({onLoad,currentUserInternalId}:{onLoad:(id:string)=>void;currentUserInternalId:string|null}){
 const [search,setSearch]=useState(""),[items,setItems]=useState<LibraryItem[]>([]),[selected,setSelected]=useState<LibraryItem|null>(null),[error,setError]=useState(""),[offset,setOffset]=useState(0),[total,setTotal]=useState(0);
 useEffect(()=>{const abort=new AbortController();const timer=setTimeout(()=>{void fetch(`/api/library?targetType=MONSTER&limit=24&offset=${offset}&q=${encodeURIComponent(search)}`,{signal:abort.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error??"Unable to load creatures.");if(!abort.signal.aborted){setItems(body.items??[]);setTotal(body.total??0);setError("");}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});},200);return()=>{clearTimeout(timer);abort.abort();};},[search,offset]);
 return <section className="v12-monster-source-library"><label className="monster-field">Find a creature<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}} placeholder="Search names and stories…"/></label>{error&&<p role="alert">{error}</p>}<div className="v12-monster-source-results">{items.map(item=><div key={item.id}><LibraryCatalogueCard item={item} currentUserInternalId={currentUserInternalId} onSelect={setSelected}/><button type="button" className="v12-metal-button" onClick={()=>onLoad(item.targetId)}>Load in Build</button></div>)}</div>{!items.length&&!error&&<p>No matching creatures.</p>}<nav className="monster-actions" aria-label="Creature pages"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-24))}>Previous</button><button disabled={offset+24>=total} onClick={()=>setOffset(offset+24)}>Next</button></nav><DetailModal isOpen={!!selected} onClose={()=>setSelected(null)} title={selected?.name??"Creature"} size="xl">{selected&&<><button type="button" className="v12-metal-button mb-3" onClick={()=>{onLoad(selected.targetId);setSelected(null);}}>Load in Build</button><MonsterTemplatePreview id={selected.targetId}/></>}</DetailModal></section>;
}
