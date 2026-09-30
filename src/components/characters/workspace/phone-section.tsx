"use client";
import type { ReactNode } from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
/** Optional information stays available without filling the phone's task screen. */
export function PhoneSection({title,summary,children,className,as:Tag="section"}:{title:string;summary?:string;children:ReactNode;className?:string;as?:"section"|"article"}) {
 const phone=useIsMobile();
 return phone ? <details className={`sheet-phone-section ${className ?? ""}`}><summary><strong>{title}</strong>{summary && <small>{summary}</small>}</summary><div>{children}</div></details> : <Tag className={className}>{children}</Tag>;
}
