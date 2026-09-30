"use client";
import type { ReactNode } from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
/** Phone recipes reveal one level at a time; desktop keeps its complete composition. */
export function PhonePieceDetails({children}:{children:ReactNode}) {
 const phone=useIsMobile();
 return phone ? <details className="phone-piece-details"><summary>View nested rules</summary>{children}</details> : <>{children}</>;
}
