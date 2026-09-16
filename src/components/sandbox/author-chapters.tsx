"use client";

import { Children, isValidElement, useId, useState, type ReactNode, type ReactElement } from "react";

export type AuthoringGuideKind = "primitive" | "effect" | "capability" | "heritage" | "item";

const AUTHORING_GUIDES: Record<AuthoringGuideKind, { title: string; body: string }> = {
  primitive: { title: "What a primitive is", body: "Primitives are the atomic rules bought with BU. They can stand alone or become pieces of effects, capabilities, heritages, and items." },
  effect: { title: "What an effect is", body: "Effects package primitives into a reusable result. A capability can deliver one or more effects; an effect describes the result rather than the whole action." },
  capability: { title: "What a capability is", body: "Capabilities are a character's toolkit: spells, techniques, and features assembled from purchased primitives and optional effects." },
  heritage: { title: "What a heritage is", body: "Heritages compile primitives and capabilities into character history. Lineage describes species or ancestry, Upbringing describes background and training before play, and Manifest describes class or what the character is becoming." },
  item: { title: "What an item is", body: "Items bundle direct primitives, effects, and capabilities into equipment a character can carry or equip." },
};

function AuthoringGuide({ kind }: { kind: AuthoringGuideKind }) {
  const guide = AUTHORING_GUIDES[kind];
  return <details className="v12-authoring-guide">
    <summary><span>{guide.title}</span><small>Rules guide</small></summary>
    <p>{guide.body}</p>
  </details>;
}

export function AuthorChapter({ children }: { id: string; title: string; children: ReactNode }) {
  return <>{children}</>;
}

/** Keeps every field mounted: switching chapters never discards a draft. */
export function AuthorChapters({ children, defaultActive, order, guideKind }: { children: ReactNode; defaultActive?: string; order?: string[]; guideKind?: AuthoringGuideKind }) {
  const prefix = useId();
  const chapters = Children.toArray(children).filter(isValidElement) as ReactElement<{
    id: string;
    title: string;
    children: ReactNode;
  }>[];
  chapters
    .sort((left, right) => {
      if (!order) return 0;
      const leftIndex = order.indexOf(left.props.id);
      const rightIndex = order.indexOf(right.props.id);
      return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex);
    });
  const [active, setActive] = useState(defaultActive ?? chapters[0]?.props.id ?? "identity");
  const [validationMessage, setValidationMessage] = useState("");
  return <div className="v12-author-chapters" onInput={() => setValidationMessage("")} onInvalidCapture={event => {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    setValidationMessage(field.validationMessage || "Complete the required fields before saving.");
    const chapter = field.closest<HTMLElement>("[data-author-chapter]");
    if (chapter?.dataset["authorChapter"]) {
      setActive(chapter.dataset["authorChapter"]);
      requestAnimationFrame(() => field.focus());
    }
  }}>
    {guideKind ? <AuthoringGuide kind={guideKind} /> : null}
    <div className="v12-author-tabs" role="tablist" aria-label="Author sections">
      {chapters.map(({ props }, index) => <button key={props.id} type="button" role="tab" id={`${prefix}-${props.id}-tab`} aria-controls={`${prefix}-${props.id}`} aria-selected={active === props.id} tabIndex={active === props.id ? 0 : -1} className={active === props.id ? "is-active" : ""} onClick={() => setActive(props.id)} onKeyDown={event => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const next = chapters[(index + (event.key === "ArrowRight" ? 1 : chapters.length - 1)) % chapters.length]!;
        setActive(next.props.id);
        document.getElementById(`${prefix}-${next.props.id}-tab`)?.focus();
      }}>{props.title}</button>)}
    </div>
    {validationMessage ? <p role="alert">{validationMessage}</p> : null}
    {chapters.map(({ props }) => <section key={props.id} role="tabpanel" id={`${prefix}-${props.id}`} aria-labelledby={`${prefix}-${props.id}-tab`} data-author-chapter={props.id} hidden={active !== props.id} className="v12-author-chapter"><div className="v12-form-chapter"><p className="v12-kicker">{props.title}</p></div>{props.children}</section>)}
  </div>;
}
