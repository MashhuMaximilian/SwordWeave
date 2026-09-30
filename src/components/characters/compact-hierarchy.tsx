"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

const phoneQuery = "(max-width: 767px)";
const subscribePhone = (callback: () => void) => { const query = window.matchMedia(phoneQuery); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
export function usePhoneCharacterSurface() { return useSyncExternalStore(subscribePhone, () => window.matchMedia(phoneQuery).matches, () => false); }
type PhoneComposition = { name: string; kind: string; description?: string | null | undefined; children?: ReactNode; actions?: ReactNode; onOpen?: (() => void) | undefined; };
function PhoneCompositeRow(props: PhoneComposition & { cost?: number | null | undefined; state?: string | null | undefined }) {
  return <><article className="v12-phone-composition-row" data-entity-kind={props.kind}>
    {props.onOpen ? <button type="button" className="v12-phone-composition-open" onClick={props.onOpen}><span><small>{props.kind}{props.state ? ` · ${props.state}` : ""}</small><strong>{props.name}</strong></span><ChevronRight aria-hidden="true"/></button> : <strong>{props.name}</strong>}
    <div className="v12-phone-composition-meta">{props.cost != null && <span>{props.cost} BU</span>}{props.actions}</div>
    {props.description && <p className="v12-phone-composition-description">{props.description.replace(/[*#_]/g, "").split(/\s+/).slice(0,28).join(" ")}{props.description.split(/\s+/).length > 28 ? "…" : ""}</p>}
    </article>
    {props.children && <details className="v12-phone-composition-contents"><summary>Included pieces</summary>{props.children}</details>}
  </>;
}

/**
 * Canonical character-sheet composition pieces.
 *
 * These deliberately expose only play-facing information. Version UUIDs,
 * pin/source state, categories, and provenance belong in the preview modal.
 * Item, heritage, and capability compositions all use these same pieces.
 */
export function CompactPrimitiveCard({
  name,
  version = 1,
  mechanicalText,
  narrativeText,
  mirrored = false,
  onOpen,
}: {
  name: string;
  version?: number | null;
  mechanicalText?: string | null | undefined;
  narrativeText?: string | null | undefined;
  mirrored?: boolean;
  onOpen?: (() => void) | undefined;
}) {
  return (
    <article
      className={cn("v12-expression-rule v12-canonical-primitive", mirrored && "is-mirrored")}
      data-expression-kind="primitive"
    >
      <div className="v12-canonical-primitive-heading">
        {version != null && <span className="v12-canonical-version">v{version}</span>}
        {onOpen ? (
          <button type="button" onClick={onOpen}>{name}</button>
        ) : (
          <strong>{name}</strong>
        )}
      </div>
      {mechanicalText && (
        <Markdown copyRole="mechanical" className="v12-rule-text v12-rule-output">
          {mechanicalText}
        </Markdown>
      )}
      {narrativeText && narrativeText !== mechanicalText && (
        <Markdown copyRole="narrative" className="v12-rule-text v12-rule-description">
          {narrativeText}
        </Markdown>
      )}
    </article>
  );
}

export function CompactHierarchyBranch({
  label,
  count,
  tone = "teal",
  className,
  children,
}: {
  label: string;
  count: number;
  tone?: "gold" | "copper" | "teal";
  className?: string;
  children: ReactNode;
}) {
  const phone = usePhoneCharacterSurface();
  if (phone && tone === "teal") return <details className="v12-phone-primitive-disclosure"><summary>{label}<span>{count}</span></summary><div className="v12-canonical-branch-list" data-primitive-rail>{children}</div></details>;
  return (
    <section className={cn("v12-canonical-branch", className)} data-hierarchy-tone={tone}>
      <header className="v12-canonical-branch-heading">
        <span>{label}</span>
        <b>{count}</b>
      </header>
      <div
        className="v12-canonical-branch-list"
        {...(tone === "teal" ? { "data-primitive-rail": true } : {})}
      >
        {children}
      </div>
    </section>
  );
}

export function CompactCompositeCard({
  kind,
  name,
  version = 1,
  cost,
  state,
  description,
  actions,
  onOpen,
  collapsible = false,
  defaultExpanded = true,
  children,
}: {
  kind: "capability" | "effect";
  name: string;
  version?: number | null;
  cost?: number | null;
  state?: string | null;
  description?: string | null | undefined;
  actions?: ReactNode;
  onOpen?: (() => void) | undefined;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
}) {
  const phone = usePhoneCharacterSurface();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const generatedId = useId();
  const contentId = `compact-composite-${kind}-${generatedId.replaceAll(":", "")}`;
  if (phone) return <PhoneCompositeRow name={name} kind={kind} description={description} cost={cost} state={state} actions={actions} onOpen={onOpen}>{children}</PhoneCompositeRow>;
  return (
    <article
      className={cn("v12-expression-piece v12-canonical-composite", collapsible && "is-collapsible", expanded && "is-expanded")}
      data-expression-kind={kind}
    >
      <header className="v12-canonical-composite-heading">
        <div className="v12-canonical-composite-title">
          {collapsible && children ? (
            <button
              type="button"
              className="v12-canonical-collapse"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
          {version != null && <span className="v12-canonical-version">v{version}</span>}
          {onOpen ? <button type="button" onClick={onOpen}>{name}</button> : <strong>{name}</strong>}
        </div>
        <div className="v12-canonical-composite-meta">
          {actions}
        </div>
      </header>
      {(cost != null || state) && kind !== "effect" && (!collapsible || expanded) ? (
        <div className="v12-canonical-composite-facts">
          {state && <em>{state}</em>}
          {cost != null && <b>{cost} BU</b>}
        </div>
      ) : null}
      {kind === "effect" && (cost != null || description) && (!collapsible || expanded) ? (
        <div className="v12-canonical-effect-summary">
          {cost != null ? <b>{cost} BU</b> : null}
          {description ? (
            <Markdown copyRole="narrative" className="v12-expression-description">
              {description}
            </Markdown>
          ) : null}
        </div>
      ) : null}
      {kind !== "effect" && description && (!collapsible || expanded) && (
        <Markdown copyRole="narrative" className="v12-expression-description">
          {description}
        </Markdown>
      )}
      {children && collapsible && expanded ? <div id={contentId} className="v12-canonical-composite-body">{children}</div> : null}
      {children && !collapsible ? children : null}
    </article>
  );
}
