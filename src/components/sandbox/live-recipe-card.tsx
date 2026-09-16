"use client";

import type { ReactNode } from "react";
import { IconDisplay } from "@/components/icons/icon-display";
import { Markdown } from "@/components/ui/markdown";
import { dispatchOpenPreview } from "@/lib/sandbox/slot-events";

export type LivePrimitive = {
  id: number; name: string; category: string; buCost: number;
  mechanicalOutputText?: string | null; narrativeRule?: string | null;
};
export type LivePrimitiveSlot = {
  primitiveId: number; quantity?: number; isMirrored?: boolean | undefined;
  role?: string; slotLabel?: string | null; notes?: string | undefined;
  primitive: LivePrimitive;
};
export type LiveEffect = {
  id: string; name: string; narrativeDescription?: string | null;
  primitiveLinks?: LivePrimitiveSlot[];
};

export function LiveRecipeCard({ name, kind, icon, badges, description, sourceOrigin, tags, children }: {
  name: string; kind: string;
  icon: { iconSource: string | null; iconKey: string | null; iconUrl: string | null; iconColor: string };
  badges: ReactNode; description?: string; sourceOrigin: string; tags: string;
  children: ReactNode;
}) {
  const fallback = kind === "Item" ? "lorc/battle-gear" : kind === "Effect" ? "lorc/cubes" : kind === "Capability" ? "lorc/cubeforce" : kind === "Lineage" ? "lorc/dna2" : kind === "Upbringing" ? "delapouite/plant-roots" : "caro-asercion/tarot-11-justice";
  return <article className="v12-live-recipe">
    <div className="v12-live-emblem" aria-hidden="true"><IconDisplay iconSource={icon.iconSource === "UPLOAD" ? "UPLOAD" : "GAME_ICONS"} iconKey={icon.iconSource ? icon.iconKey : fallback} iconUrl={icon.iconUrl} iconColor={icon.iconSource ? icon.iconColor : "#64c7c1"} size={48} alt="" /></div>
    <header className="v12-live-identity"><p className="v12-kicker">{kind} · live draft</p><h2>{name || `Untitled ${kind.toLowerCase()}`}</h2><div className="v12-live-badges">{badges}</div></header>
    {description ? <div className="v12-live-description"><Markdown>{description}</Markdown></div> : null}
    {children}
    {sourceOrigin || tags ? <footer className="v12-live-provenance">{sourceOrigin ? <p><span className="v12-kicker">Source</span>{sourceOrigin}</p> : null}{tags ? <div className="v12-live-badges" aria-label="Tags">{[...new Set(tags.split(",").map(tag => tag.trim()).filter(Boolean))].map(tag => <span key={tag}>{tag}</span>)}</div> : null}</footer> : null}
  </article>;
}

export function LivePrimitiveRules({ slots }: { slots: LivePrimitiveSlot[] }) {
  return <div className="v12-live-rules">{slots.map((slot, index) => <article
    className="v12-live-rule"
    key={`${slot.primitiveId}:${index}`}
    role="button"
    tabIndex={0}
    onClick={() => dispatchOpenPreview({targetType:"PRIMITIVE", targetId:String(slot.primitiveId), label:slot.primitive.name})}
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); dispatchOpenPreview({targetType:"PRIMITIVE", targetId:String(slot.primitiveId), label:slot.primitive.name}); } }}
  >
    <div className="v12-live-rule-head"><strong>{slot.primitive.name}</strong><span>{Math.abs(slot.primitive.buCost * (slot.quantity ?? 1))} BU <span aria-hidden="true">↗</span></span></div>
    {slot.primitive.mechanicalOutputText || slot.primitive.narrativeRule ? <div data-readable-rule><Markdown>{slot.primitive.mechanicalOutputText || slot.primitive.narrativeRule || ""}</Markdown></div> : null}
    <div className="v12-live-rule-meta">{slot.role ? <span>{slot.role.replaceAll("_", " ").toLowerCase()}</span> : null}{slot.quantity !== undefined ? <span>×{slot.quantity}</span> : null}{slot.isMirrored ? <span>Mirrored</span> : null}{slot.slotLabel && slot.slotLabel !== slot.primitive.name ? <span>{slot.slotLabel}</span> : null}</div>
    {slot.notes ? <p className="v12-live-note">{slot.notes}</p> : null}
  </article>)}</div>;
}

export function LiveEffectRules({ effects }: { effects: LiveEffect[] }) {
  return <div className="v12-live-effects">{effects.map((effect, index) => {
    const effectBu = (effect.primitiveLinks ?? []).reduce((sum, slot) => sum + Math.abs(slot.primitive.buCost * (slot.quantity ?? 1)), 0);
    return <article className="v12-live-effect" key={`${effect.id}:${index}`}><button type="button" className="v12-live-effect-open" onClick={() => dispatchOpenPreview({targetType:"EFFECT",targetId:effect.id,label:effect.name})}><span className="v12-kicker">Nested effect</span><strong>{effect.name}</strong>{effect.primitiveLinks ? <small>{effectBu} BU · {effect.primitiveLinks.length} primitive {effect.primitiveLinks.length === 1 ? "rule" : "rules"}</small> : null}<span aria-hidden="true">↗</span></button>
    {effect.primitiveLinks ? <LivePrimitiveRules slots={effect.primitiveLinks} /> : null}
  </article>;})}</div>;
}

export function LiveMechanicalSummary({slots}:{slots:LivePrimitiveSlot[]}) {
  const rules = slots.map(slot => slot.primitive.mechanicalOutputText || slot.primitive.narrativeRule).filter((rule): rule is string => Boolean(rule));
  return rules.length ? <section className="v12-live-mechanics" aria-label="Mechanical summary">{rules.map((rule,index)=><div data-readable-rule key={index}><Markdown>{rule}</Markdown></div>)}</section> : null;
}
