"use client";
import type {HTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";
import {Markdown} from "@/components/ui/markdown";
import {OriginBadge} from "./origin-badge";
/** Shared player capability anatomy; subject-specific handlers stay with the caller. */
export function CapabilityCardSurface({name,type,source,acquiredAtLevel,originChain,description,versionBadge,active=false,dropOver=false,onOpen,children,...events}: Omit<HTMLAttributes<HTMLDivElement>,"onClick"> & {name:string;type:string;source:string;acquiredAtLevel?:number|undefined;originChain?:Array<{kind:"heritage"|"capability"|"effect";name:string}>|undefined;description?:string|null|undefined;versionBadge?:ReactNode;active?:boolean;dropOver?:boolean;onOpen:()=>void;onClick?:HTMLAttributes<HTMLDivElement>["onClick"]}) {
 return <div {...events} data-component-card="true" className={cn("relative rounded-md border bg-card p-4 transition-all cursor-pointer",active?"border-primary ring-2 ring-primary/30":"border-border hover:border-primary/50",dropOver&&"ring-2 ring-amber-400/60 border-amber-400/60",events.className)}>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="text-left font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm">{name}</button>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
              {type}
            </span>
            {versionBadge}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{source}</span>
          {acquiredAtLevel != null && <span>·</span>}
          {acquiredAtLevel != null && <span>Acquired L{acquiredAtLevel}</span>}
        </div>

        {originChain && originChain.length > 0 ? (
          <div className="mt-1">
            <OriginBadge chain={originChain} />
          </div>
        ) : null}

        {description && (
          <Markdown className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">{description}</Markdown>
        )}
{children}</div>;
}
