"use client";

import { Children, isValidElement, useId, useState, type ReactNode, type ReactElement } from "react";

export function AuthorChapter({ children }: { id: string; title: string; children: ReactNode }) {
  return <>{children}</>;
}

/** Keeps every field mounted: switching chapters never discards a draft. */
export function AuthorChapters({ children, defaultActive, order }: { children: ReactNode; defaultActive?: string; order?: string[] }) {
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
