"use client";
import { useState } from "react";
import { Markdown } from "@/components/ui/markdown";
import type { LibraryCompositionPath } from "@/lib/publishing/library-query";
export function CompositionMechanics({
  paths,
  compact = false,
  onPrimitive,
  onContainer,
}: {
  paths: LibraryCompositionPath[];
  compact?: boolean;
  onPrimitive?: (path: LibraryCompositionPath) => void;
  onContainer?: (container: LibraryCompositionPath["containers"][number]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paths : paths.slice(0, compact ? 3 : paths.length);
  const containersFor = (path: LibraryCompositionPath) => path.path.slice(2, -2);
  const nestingLabel = (path: LibraryCompositionPath) => containersFor(path).length ? "Nested" : "Direct";
  const groupLabel = (path: LibraryCompositionPath) => path.containers.length
    ? `Inside ${path.containers.map(container=>`${container.targetType === "CAPABILITY" ? "Capability" : "Effect"} · ${container.name}`).join(" → ")}`
    : "Direct primitives";
  const groups = visible.reduce<Array<{label:string;containers:LibraryCompositionPath["containers"];items:Array<{path:LibraryCompositionPath;index:number}>}>>((all,path,index) => {
    const label=groupLabel(path); const found=all.find(group=>group.label===label);
    if(found) found.items.push({path,index}); else all.push({label,containers:path.containers,items:[{path,index}]}); return all;
  },[]);
  return (
    <div className={compact ? "v12-composition-list is-compact" : "v12-composition-list"}>
      {groups.map((group) => <section className="v12-composition-group" key={group.label}>
        {!compact ? <h4>{group.containers.length ? <>{"Inside "}{group.containers.map((container,index)=><span key={`${container.targetType}:${container.targetId}`}><button type="button" className="v12-composition-container-link" onClick={(event)=>{event.stopPropagation();onContainer?.(container);}}>{container.targetType === "CAPABILITY" ? "Capability" : "Effect"} · {container.name}</button>{index < group.containers.length-1 ? " → " : ""}</span>)}</> : group.label}</h4> : null}
        {group.items.map(({path,index}) => <button
          type="button"
          key={`${path.primitiveId}:${path.path.join(":")}:${index}`}
          onClick={(event) => { event.stopPropagation(); onPrimitive?.(path); }}
          className="v12-composition-mechanic"
          aria-label={`Inspect ${path.primitiveName}`}
        >
          {compact ? <span className="v12-composition-path">{nestingLabel(path)}</span> : null}
          {!compact ? <strong>{path.primitiveName}</strong> : null}
          <Markdown className="v12-composition-copy">{path.mechanicalDescription}</Markdown>
        </button>)}
      </section>)}
      {compact && paths.length > 3 ? (
        <button type="button" className="v12-show-mechanics" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}>
          {expanded ? "Show less" : `Show all ${paths.length} mechanics`}
        </button>
      ) : null}
    </div>
  );
}


