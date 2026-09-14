import { Fragment } from "react";

interface MarkdownProps { children: string; className?: string }
type Block =
  | { type:"p"|"ul"|"ol"|"quote"; content:string[] }
  | { type:"table"; content:string[][] };

function tableCells(line:string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(cell=>cell.trim());
}

function parseBlocks(src:string):Block[] {
  const blocks:Block[]=[];
  const lines=src.replace(/\r\n/g,"\n").split("\n");
  let paragraph:string[]=[];
  const flush=()=>{ if(paragraph.length){blocks.push({type:"p",content:[paragraph.join(" ")]});paragraph=[];} };
  for(let index=0;index<lines.length;) {
    const line=lines[index]!.trim();
    if(!line){flush();index++;continue;}
    if(line.includes("|") && index+1<lines.length && /^\|?\s*:?-{3,}/.test(lines[index+1]!.trim())) {
      flush(); const rows=[tableCells(line)]; index+=2;
      while(index<lines.length && lines[index]!.includes("|")){rows.push(tableCells(lines[index]!));index++;}
      blocks.push({type:"table",content:rows});continue;
    }
    const list=/^[-*]\s+(.+)$/.exec(line); const ordered=/^\d+[.)]\s+(.+)$/.exec(line);
    if(list||ordered) {
      flush(); const type=list?"ul":"ol"; const items:string[]=[];
      while(index<lines.length) {
        const match=(type==="ul"?/^[-*]\s+(.+)$/:/^\d+[.)]\s+(.+)$/).exec(lines[index]!.trim());
        if(!match)break;items.push(match[1]!);index++;
      }
      blocks.push({type,content:items});continue;
    }
    if(line.startsWith(">")) {
      flush();const quoted:string[]=[];
      while(index<lines.length&&lines[index]!.trim().startsWith(">")){quoted.push(lines[index]!.trim().slice(1).trim());index++;}
      blocks.push({type:"quote",content:[quoted.join(" ")]});continue;
    }
    paragraph.push(line);index++;
  }
  flush();return blocks;
}

function renderInline(text:string,keyPrefix:string):React.ReactNode {
  const segments:React.ReactNode[]=[];let counter=0,lastIndex=0;
  const pattern=/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|~~([^~]+)~~|\+\+([^+]+)\+\+|(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/g;
  let match:RegExpExecArray|null;
  const push=(node:React.ReactNode)=>segments.push(<Fragment key={`${keyPrefix}-${counter++}`}>{node}</Fragment>);
  while((match=pattern.exec(text))!==null){
    if(match.index>lastIndex)push(text.slice(lastIndex,match.index));
    if(match[1]&&match[2])push(<a href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>);
    else if(match[3])push(<strong>{match[3]}</strong>);
    else if(match[4])push(<s>{match[4]}</s>);
    else if(match[5])push(<u>{match[5]}</u>);
    else push(<em>{match[6]??match[7]}</em>);
    lastIndex=pattern.lastIndex;
  }
  if(lastIndex<text.length)push(text.slice(lastIndex));
  return <>{segments}</>;
}

export function Markdown({children,className=""}:MarkdownProps) {
  if(!children)return null;
  return <div className={`v12-markdown ${className}`}>{parseBlocks(children).map((block,index)=>{
    if(block.type==="table")return <div className="v12-markdown-table-wrap" key={index}><table><thead><tr>{block.content[0]!.map((cell,i)=><th key={i}>{renderInline(cell,`t${index}h${i}`)}</th>)}</tr></thead><tbody>{block.content.slice(1).map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c}>{renderInline(cell,`t${index}r${r}c${c}`)}</td>)}</tr>)}</tbody></table></div>;
    if(block.type==="quote")return <blockquote key={index}>{renderInline(block.content[0]??"",`q${index}`)}</blockquote>;
    if(block.type==="ul"||block.type==="ol"){const Tag=block.type;return <Tag key={index}>{block.content.map((item,i)=><li key={i}>{renderInline(item,`l${index}-${i}`)}</li>)}</Tag>;}
    return <p key={index}>{renderInline(block.content[0]??"",`p${index}`)}</p>;
  })}</div>;
}
