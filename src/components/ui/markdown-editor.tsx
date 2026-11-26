"use client";

import { useRef, useState, type TextareaHTMLAttributes } from "react";
import { Markdown } from "@/components/ui/markdown";

type Command={label:string;before:string;after?:string;placeholder:string};
const COMMANDS:Command[]=[
  {label:"Title",before:"# ",placeholder:"Title"},{label:"Heading",before:"## ",placeholder:"Heading"},{label:"Subheading",before:"### ",placeholder:"Subheading"},
  {label:"Bold",before:"**",after:"**",placeholder:"bold text"},{label:"Italic",before:"*",after:"*",placeholder:"italic text"},
  {label:"Strike",before:"~~",after:"~~",placeholder:"struck text"},{label:"Underline",before:"++",after:"++",placeholder:"underlined text"},
  {label:"Bullets",before:"- ",placeholder:"list item"},{label:"Numbers",before:"1. ",placeholder:"list item"},
  {label:"Quote",before:"> ",placeholder:"quoted text"},{label:"Table",before:"| Heading | Heading |\n| --- | --- |\n| Cell | Cell |",placeholder:""},
];

interface MarkdownEditorProps extends Pick<TextareaHTMLAttributes<HTMLTextAreaElement>,
  "placeholder" | "rows" | "id" | "maxLength" | "disabled" | "required" | "onFocus" | "onBlur"> {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  textareaClassName?: string;
  ariaLabel?: string;
  describedBy?: string;
}

export function MarkdownEditor({
  value, onChange, placeholder, rows = 4, className = "", textareaClassName,
  ariaLabel, describedBy, id, maxLength, disabled, required, onFocus, onBlur,
}: MarkdownEditorProps) {
  const ref=useRef<HTMLTextAreaElement>(null);const [open,setOpen]=useState(false);const [preview,setPreview]=useState(false);
  const apply=(command:Command)=>{
    const element=ref.current;if(!element)return;const start=element.selectionStart,end=element.selectionEnd;
    const selected=value.slice(start,end)||command.placeholder;const insertion=`${command.before}${selected}${command.after??""}`;
    const next=value.slice(0,start)+insertion+value.slice(end); if(maxLength !== undefined && next.length > maxLength)return; onChange(next);setOpen(false);
    requestAnimationFrame(()=>{element.focus();element.setSelectionRange(start+command.before.length,start+command.before.length+selected.length);});
  };
  const showPreview = preview && (!required || value.length > 0);
  return <div className={`v12-markdown-editor ${className}`}>
    {showPreview ? <div className="v12-markdown-preview"><Markdown>{value || "Nothing to preview yet."}</Markdown></div> : <textarea ref={ref} id={id} className={textareaClassName} rows={rows} value={value} maxLength={maxLength} disabled={disabled} required={required} onFocus={onFocus} onBlur={onBlur} aria-label={ariaLabel} aria-describedby={describedBy} placeholder={placeholder} onChange={event=>{const next=event.target.value;onChange(next);setOpen(next.endsWith("/"));}} />}
    <div className="v12-markdown-toolbar" onMouseDown={event=>event.preventDefault()} role="toolbar" aria-label="Text formatting">
      {COMMANDS.slice(0,10).map(command=><button type="button" key={command.label} title={command.label} aria-label={command.label} disabled={disabled || showPreview} onClick={()=>apply(command)}>{command.label==="Title"?"H1":command.label==="Heading"?"H2":command.label==="Subheading"?"H3":command.label==="Bold"?<b>B</b>:command.label==="Italic"?<i>I</i>:command.label==="Strike"?<s>S</s>:command.label==="Underline"?<u>U</u>:command.label==="Bullets"?"• List":command.label==="Numbers"?"1. List":command.label}</button>)}
      <button type="button" disabled={disabled || showPreview} onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label="More formatting">/</button>
      <button type="button" disabled={disabled || (required && !value.length)} onClick={()=>{setPreview(!showPreview);setOpen(false);}} aria-pressed={showPreview}>{showPreview?"Edit":"Preview"}</button>
    </div>
    {open?<div className="v12-markdown-command-menu">{COMMANDS.map(command=><button type="button" key={command.label} onClick={()=>apply(command)}>{command.label}</button>)}</div>:null}
  </div>;
}
