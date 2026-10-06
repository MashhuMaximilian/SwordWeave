import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Shared section from the player creation forge. */
export function QuickbuildSection({ title, number, reading, subtitle, className = "", id, children }: { title: string; number: string; reading: ReactNode; subtitle?: string; className?: string; id?: string; children: ReactNode }) {
  return <details id={id} open className={`sw-forge-panel sw-forge-panel--brass sw-quickbuild__section ${className}`}>
    <summary><span><b>{number} · {title}</b><small>{reading}</small></span><ChevronDown aria-hidden /></summary>
    <div className="sw-quickbuild__section-body">{subtitle ? <p className="sw-quickbuild__section-intro">{subtitle}</p> : null}{children}</div>
  </details>;
}


/** The player creation workbench: header, content surface, and persistent footer. */
export function ForgeWorkbench({ header, footer, children }: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  return <div className="sw-character-forge__workbench">{header}<div className="sw-character-forge__content">{children}</div>{footer}</div>;
}

export function ForgeProgressRail({ label, children }: { label: string; children: ReactNode }) {
  return <aside className="sw-character-forge__rail" aria-label={label}>{children}</aside>;
}
