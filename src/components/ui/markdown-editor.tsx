"use client";

import { useRef, useState } from "react";

type Command={label:string;before:string;after?:string;placeholder:string};
const COMMANDS:Command[]=[
  {label:"Title",before:"# ",placeholder:"Title"},{label:"Heading",before:"## ",placeholder:"Heading"},{label:"Subheading",before:"### ",placeholder:"Subheading"},
  {label:"Bold",before:"**",after:"**",placeholder:"bold text"},{label:"Italic",before:"*",after:"*",placeholder:"italic text"},
  {label:"Strike",before:"~~",after:"~~",placeholder:"struck text"},{label:"Underline",before:"++",after:"++",placeholder:"underlined text"},
  {label:"Bullets",before:"- ",placeholder:"list item"},{label:"Numbers",before:"1. ",placeholder:"list item"},
  {label:"Quote",before:"> ",placeholder:"quoted text"},{label:"Table",before:"| Heading | Heading |\n| --- | --- |\n| Cell | Cell |",placeholder:""},
];

export function MarkdownEditor({value,onChange,placeholder,rows=4,className="",ariaLabel}:{value:string;onChange:(value:string)=>void;placeholder?:string;rows?:number;className?:string;ariaLabel?:string}) {
  const ref=useRef<HTMLTextAreaElement>(null);const [open,setOpen]=useState(false);
  const apply=(command:Command)=>{
    const element=ref.current;if(!element)return;const start=element.selectionStart,end=element.selectionEnd;
    const selected=value.slice(start,end)||command.placeholder;const insertion=`${command.before}${selected}${command.after??""}`;
    onChange(value.slice(0,start)+insertion+value.slice(end));setOpen(false);
    requestAnimationFrame(()=>{element.focus();element.setSelectionRange(start+command.before.length,start+command.before.length+selected.length);});
  };
  return <div className={`v12-markdown-editor ${className}`}>
    <div className="v12-markdown-toolbar" aria-label="Text formatting">
      {COMMANDS.slice(0,10).map(command=><button type="button" key={command.label} title={command.label} aria-label={command.label} onClick={()=>apply(command)}>{command.label==="Title"?"H1":command.label==="Heading"?"H2":command.label==="Subheading"?"H3":command.label==="Bold"?<b>B</b>:command.label==="Italic"?<i>I</i>:command.label==="Strike"?<s>S</s>:command.label==="Underline"?<u>U</u>:command.label==="Bullets"?"• List":command.label==="Numbers"?"1. List":command.label}</button>)}
      <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>/</button>
    </div>
    {open?<div className="v12-markdown-command-menu">{COMMANDS.map(command=><button type="button" key={command.label} onClick={()=>apply(command)}>{command.label}</button>)}</div>:null}
    <textarea ref={ref} rows={rows} value={value} aria-label={ariaLabel} placeholder={placeholder} onChange={event=>{const next=event.target.value;onChange(next);setOpen(next.endsWith("/"));}} />
  </div>;
}
