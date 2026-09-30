"use client";
import { PhoneTypeChoices } from "@/components/library/phone-type-choices";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
export type PhonePieceOption = {id:string|number;kind:"primitive"|"effect"|"capability";name:string;description?:string|null|undefined;buCost?:number|null};
/** Local picker owns no recipe state; selection updates only its parent form. */
export function PhonePiecePicker({entries,onChoose}:{entries:PhonePieceOption[];onChoose:(entry:PhonePieceOption)=>void}) {
 const phone=useIsMobile();const[open,setOpen]=useState(false);const[search,setSearch]=useState("");const[kind,setKind]=useState("all");
 if(!phone)return null;
 const kinds=[...new Set(entries.map(entry=>entry.kind))];
 const filtered=entries.filter(entry=>(kind==="all"||entry.kind===kind)&&`${entry.name} ${entry.description??""}`.toLowerCase().includes(search.toLowerCase()));
 return <><button type="button" className="phone-add-piece v12-metal-button" onClick={event=>{if(event.currentTarget.closest(".phone-atelier-editor") && !event.currentTarget.closest("[role=dialog]")){window.dispatchEvent(new Event("sw-phone-focus-browse"));return;}setSearch("");setKind("all");setOpen(true);}}><Plus size={16}/> Add a piece</button><DetailModal isOpen={open} onClose={()=>setOpen(false)} title="Add a piece"><div className="phone-piece-picker">
 <label className="phone-picker-search"><Search size={16}/><input autoFocus aria-label="Search pieces" placeholder="Search rules, effects, capabilities…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
 {kinds.length>1?<PhoneTypeChoices label="Piece type" value={kind} options={[{value:"all",label:"All"},...kinds.map(type=>({value:type,label:type.charAt(0).toUpperCase()+type.slice(1)}))]} onChange={setKind}/>:null}
 <p className="phone-picker-count">{filtered.length} available</p>
 <div className="phone-picker-results">{filtered.map(entry=><button type="button" key={`${entry.kind}:${entry.id}`} onClick={()=>{onChoose(entry);setOpen(false);}}><span><strong>{entry.name}</strong><small>{entry.kind}{entry.buCost!=null?` · ${entry.buCost} BU`:""}</small>{entry.description?<p>{entry.description}</p>:null}</span><Plus size={18} aria-label="Add"/></button>)}{!filtered.length?<p>No matching pieces. Try another search.</p>:null}</div>
 </div></DetailModal></>;
}
