"use client";
import {useState, type Ref, type InputHTMLAttributes} from "react";
/** Keep intermediate empty text in the input instead of coercing it to zero/one on each keystroke. */
export function EditableNumberInput({value,onChange,onBlur,...props}:InputHTMLAttributes<HTMLInputElement> & {ref?:Ref<HTMLInputElement>}){
 const external=String(value??"");
 const [draft,setDraft]=useState({external,text:external});
 if(draft.external!==external)setDraft({external,text:external});
 return <input {...props} type="number" value={draft.external===external?draft.text:external} onChange={event=>{
  const text=event.target.value;setDraft({external,text});
  if(typeof value === "string" || (text!=="" && Number.isFinite(Number(text))))onChange?.(event);
 }} onBlur={event=>{
  if(!event.target.value){setDraft({external,text:external});return;}
  onBlur?.(event);
  setDraft({external,text:external});
 }}/>;
}
