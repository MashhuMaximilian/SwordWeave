"use client";

import { Children, isValidElement, useId, useState, type ReactNode, type ReactElement } from "react";

export type AuthoringGuideKind = "primitive" | "effect" | "capability" | "lineage" | "upbringing" | "manifest" | "item";

const AUTHORING_GUIDES: Record<AuthoringGuideKind, { title: string; body: string; rule: string }> = {
  primitive: {
    title: "Primitive: a purchased building block",
    body: "A primitive is one atomic rule permanently unlocked with BU: a Verb, Domain, output, range, geometry, defense, or other modifier. Once owned, it can be reused and recombined across any number of recipes. In simple terms, primitives are the individual words and tools in your mechanical vocabulary. Buy the useful part once, then bring it into every fitting spell, maneuver, item, or feature.",
    rule: "BU buys the ingredient. Building another recipe with an ingredient you already own does not buy it again.",
  },
  effect: {
    title: "Effect: a reusable result",
    body: "An effect packages primitives that describe what an action leaves behind or resolves: damage, healing, a condition, movement, protection, or another payload. Capabilities may deliver effects, and the same effect can support several recipes. Think of it as the result portion of an action: burn, heal, push, shield, frighten, or transform. It becomes especially useful when several capabilities should produce the same reusable outcome.",
    rule: "Describe the result here; put the complete intent, delivery, and table declaration in a capability.",
  },
  capability: {
    title: "Capability: a ready-to-use recipe",
    body: "A capability is a prepared spell, technique, maneuver, or feature assembled from owned primitives and optional effects. It is a shortcut on the character sheet, not a boundary on what those components can improvise at the table. In simple terms, it is a favorite recipe you can declare quickly during play. Its pieces remain available for other recipes and improvised actions.",
    rule: "Preset recipes cost 0 additional BU. A maintained capability counts as one atomic upkeep entity even when its recipe has many pieces.",
  },
  lineage: {
    title: "Lineage: inherited nature",
    body: "Lineage records biological, ancestral, or created-body traits: innate senses, movement, resilience, passive adaptations, and natural access to a Domain. It explains what the character begins life able to be or perceive. In simple terms, this is the character's body and inherited nature rather than their job or education. A constructed person, transformed creature, or unusual ancestry can all express that foundation here.",
    rule: "Bundle only the inherited components and capabilities; learned history belongs in Upbringing.",
  },
  upbringing: {
    title: "Upbringing: formative history",
    body: "Upbringing records the environment, community, work, education, and training that shaped the character before play. It is the place for learned Practices, proficiencies, social permissions, and techniques earned through lived experience. In simple terms, it answers where the character came from and what ordinary life taught them. Two people with the same Lineage can have completely different Upbringings.",
    rule: "Describe who the character was and what they learned before their present path began.",
  },
  manifest: {
    title: "Manifest: the path taking form",
    body: "Manifest establishes the character's active role, magical focus, or tactical discipline: the identity often called a class. It bundles the Domains, output, delivery, and signature capabilities that express what the character is becoming now. In simple terms, it is the adventuring path the character actively practices today. It can evolve as their goals, methods, and signature techniques change.",
    rule: "Treat it as a customizable convenience pack, not a restriction on future growth or improvisation.",
  },
  item: {
    title: "Item: a capability carrier",
    body: "An item can be a 0 BU narrative tool, a vessel that grants a complete capability while equipped, or an augment that changes the geometry, delivery, or intensity of components the character already owns. In simple terms, an item either helps in the fiction, carries a ready-made power, or improves something its wielder can already do. Its recipe explains the power; Load and equipment slots explain the burden of carrying and using it.",
    rule: "Record its carried Load separately from its BU recipe; active capability and augment items also use Universal Equipment Slots.",
  },
};

function AuthoringGuide({ kind }: { kind: AuthoringGuideKind }) {
  const guide = AUTHORING_GUIDES[kind];
  return <details className="v12-authoring-guide">
    <summary><span>{guide.title}</span><small>Rules guide</small></summary>
    <p>{guide.body}</p>
    <p className="v12-authoring-guide-rule">{guide.rule}</p>
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
