import { Fragment } from "react";

interface MarkdownProps {
  children: string;
  className?: string;
  /** Compact text inside controls. Render formatting without nested links or blocks. */
  inline?: boolean;
  /**
   * Semantic copy role used by dense entity cards.  The attribute is placed
   * on the actual rendered block, rather than only on this component's
   * wrapper, so a broad ancestor selector cannot silently change the visible
   * paragraph's typography.
   */
  copyRole?: "mechanical" | "narrative";
}
type Block =
  | { type:"p"|"ul"|"ol"|"quote"; content:string[] }
  | { type:"heading"; level:number; content:string[] }
  | { type:"code"; content:string[] }
  | { type:"hr"; content:string[] }
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
    if(line.startsWith("```")) {
      flush(); const code:string[]=[]; index++;
      while(index<lines.length && !lines[index]!.trim().startsWith("```")){code.push(lines[index]!);index++;}
      if(index<lines.length)index++;
      blocks.push({type:"code",content:[code.join("\n")]});continue;
    }
    const heading=/^(#{1,6})\s+(.+)$/.exec(line);
    if(heading){flush();blocks.push({type:"heading",level:heading[1]!.length,content:[heading[2]!]});index++;continue;}
    if(/^([-*_])(?:\s*\1){2,}$/.test(line)){flush();blocks.push({type:"hr",content:[]});index++;continue;}
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

type MarkdownSpan = { tag:"text"|"a"|"code"|"strong"|"s"|"u"|"em"; text:string; href?:string };

function parseInline(text:string):MarkdownSpan[] {
  const segments:MarkdownSpan[]=[];let lastIndex=0;
  const pattern=/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\+\+([^+]+)\+\+|(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/g;
  let match:RegExpExecArray|null;
  while((match=pattern.exec(text))!==null){
    if(match.index>lastIndex)segments.push({tag:"text",text:text.slice(lastIndex,match.index)});
    if(match[1]&&match[2])segments.push({tag:"a",text:match[1],href:match[2]});
    else if(match[3])segments.push({tag:"code",text:match[3]});
    else if(match[4])segments.push({tag:"strong",text:match[4]});
    else if(match[5])segments.push({tag:"s",text:match[5]});
    else if(match[6])segments.push({tag:"u",text:match[6]});
    else segments.push({tag:"em",text:match[7]??match[8]??""});
    lastIndex=pattern.lastIndex;
  }
  if(lastIndex<text.length)segments.push({tag:"text",text:text.slice(lastIndex)});
  return segments;
}

/** Content-only Markdown for surfaces that cannot render the React component. */
export function markdownDocument(text:string) {
  // External links remain readable text in the network-free card.
  const cardInline=(value:string)=>parseInline(value).map(span=>({tag:span.tag==="a"?"text":span.tag,text:span.text}));
  return parseBlocks(text).map(block => {
    if(block.type==="table") return {type:block.type,rows:block.content.map(row=>row.map(cardInline))};
    if(block.type==="code") return {type:block.type,text:block.content[0]??""};
    if(block.type==="hr") return {type:block.type};
    const items=block.content.map(cardInline);
    return block.type==="heading"?{type:block.type,level:block.level,items}:{type:block.type,items};
  });
}

function renderInline(text:string,keyPrefix:string,allowLinks=true):React.ReactNode {
  return <>{parseInline(text).map(({tag:Tag,text,href},index)=>{
    const key=`${keyPrefix}-${index}`;
    if(Tag==="a"&&allowLinks)return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{text}</a>;
    if(Tag==="text"||Tag==="a")return <Fragment key={key}>{text}</Fragment>;
    return <Tag key={key}>{text}</Tag>;
  })}</>;
}

export function Markdown({children,className="",copyRole,inline}:MarkdownProps) {
  if(!children)return null;
  const blocks = parseBlocks(children);
  if (inline) {
    return <span className={className} data-copy={copyRole}>{blocks.map((block, index) =>
      <Fragment key={index}>
        {index > 0 && " "}
        {block.type === "code" ? <code>{block.content[0]}</code> :
          renderInline(block.content.flat().join(" "), `excerpt${index}`, false)}
      </Fragment>,
    )}</span>;
  }
  return <div className={`v12-markdown ${className}`}>{blocks.map((block,index)=>{
    if(block.type==="hr")return <hr key={index}/>;
    if(block.type==="code")return <pre key={index}><code>{block.content[0]}</code></pre>;
    if(block.type==="heading"){
      const content=renderInline(block.content[0]??"",`h${index}`);
      if(block.level===1)return <h1 key={index}>{content}</h1>;
      if(block.level===2)return <h2 key={index}>{content}</h2>;
      if(block.level===3)return <h3 key={index}>{content}</h3>;
      if(block.level===4)return <h4 key={index}>{content}</h4>;
      if(block.level===5)return <h5 key={index}>{content}</h5>;
      return <h6 key={index}>{content}</h6>;
    }
    if(block.type==="table")return <div className="v12-markdown-table-wrap" key={index}><table><thead><tr>{block.content[0]!.map((cell,i)=><th key={i}>{renderInline(cell,`t${index}h${i}`)}</th>)}</tr></thead><tbody>{block.content.slice(1).map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c}>{renderInline(cell,`t${index}r${r}c${c}`)}</td>)}</tr>)}</tbody></table></div>;
    if(block.type==="quote")return <blockquote data-copy={copyRole} key={index}>{renderInline(block.content[0]??"",`q${index}`)}</blockquote>;
    if(block.type==="ul"||block.type==="ol"){const Tag=block.type;return <Tag data-copy={copyRole} key={index}>{block.content.map((item,i)=><li data-copy={copyRole} key={i}>{renderInline(item,`l${index}-${i}`)}</li>)}</Tag>;}
    return <p data-copy={copyRole} key={index}>{renderInline(block.content[0]??"",`p${index}`)}</p>;
  })}</div>;
}
