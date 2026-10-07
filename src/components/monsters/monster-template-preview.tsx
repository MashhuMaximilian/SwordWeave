"use client";

import { useEffect, useRef, useState, useId, type FormEvent } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { Swords, BookOpen, Layers, ArrowRight } from "lucide-react";
import { BookmarkButton } from "@/components/collections/bookmark-button";
import { Markdown } from "@/components/ui/markdown";
import { portraitFrameStyle } from "@/lib/character/portrait-frame";
import { IconDisplay } from "@/components/icons/icon-display";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { MonsterSlot, resolveMonster } from "@/lib/monsters/resolve";
import { MonsterCompositionView } from "./monster-composition-view";
import { MonsterSheetStats, MonsterPracticeGrid } from "./monster-sheet-stats";
import { monsterArtwork } from "@/lib/monsters/art";
import "./monster-template-preview.css";
import { PreviewActions, type PreviewActionProps } from "@/components/preview/preview-shared";

type PreviewData = {
  monster: { name: string; definition: PinnedDefinition; currentVersion: number; visibility: string };
  sheet: ReturnType<typeof resolveMonster>;
  canEdit: boolean;
  slots: MonsterSlot[];
};
const signed = (value: number) => value >= 0 ? `+${value}` : String(value);

/** A template is read-only here. Playing creates an independent, pinned copy. */
export function MonsterTemplatePreview({ id, compact = false, actions, actionPlacement = "bottom" }: { id: string; compact?: boolean; actions?: PreviewActionProps; actionPlacement?: "top" | "bottom" }) {
  const { userId, isLoaded } = useAuth();
  return <AccountPreview key={`${userId ?? "anonymous"}:${id}`} id={id} compact={compact} {...(actions?{actions}:{})} actionPlacement={actionPlacement} ready={isLoaded} />;
}

function AccountPreview({ id, compact, ready, actions, actionPlacement }: { id: string; compact: boolean; ready: boolean; actions?: PreviewActionProps; actionPlacement: "top" | "bottom" }) {
  const { isSignedIn } = useAuth();
  const { redirectToSignIn } = useClerk();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [pending, setPending] = useState(false);
  const copyController = useRef<AbortController | null>(null);
  useEffect(() => () => copyController.current?.abort(), []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void fetch(`/api/monsters/${id}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "This creature is unavailable.");
        if (!controller.signal.aborted) { setData(body); setCopyName(body.monster.name); }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to open this creature."); });
    return () => controller.abort();
  }, [id, ready]);
  async function createCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!copyName.trim() || pending) return;
    setPending(true); setError("");
    const controller = new AbortController();
    copyController.current = controller;
    try {
      const response = await fetch(`/api/monsters/${id}/copies`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: copyName.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to create a play copy.");
      if (!controller.signal.aborted) location.href = `/monsters/play/${body.id}`;
    } catch (reason) { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Unable to create a play copy."); setPending(false); } }
  }
  async function forkCreature() {
    if (!isSignedIn) { void redirectToSignIn({ redirectUrl: `/monsters/${id}` }); return; }
    if (pending) return;
    setPending(true); setError("");
    const controller = new AbortController(); copyController.current = controller;
    try {
      const response = await fetch(`/api/monsters/${id}`, { method: "POST", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to fork this creature.");
      if (!controller.signal.aborted) location.href = `/monsters/${body.id}?edit=1`;
    } catch (reason) { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Unable to fork this creature."); setPending(false); } }
  }
  if (!data) return <div className="sw-creature-preview" role={error ? "alert" : "status"}>{error || "Opening creature sheet…"}</div>;
  const { monster, sheet } = data;
  const definition = monster.definition;
  const slots = data.slots ?? definition.resolvedSlots ?? [];
  const artwork = monsterArtwork({ name: monster.name, imageUrl: definition.imageUrl, sourceOrigin: definition.sourceOrigin });
  return <section className={`sw-creature-preview ${compact ? "is-compact" : ""}`} aria-label={`${monster.name} mini sheet`}>
    {actions && actionPlacement === "top" && <PreviewActions {...actions}/>}
    <header className="sw-creature-identity">
      <span className="sw-creature-emblem">{artwork ? <img src={artwork} alt={`${monster.name} portrait`} style={portraitFrameStyle(definition.portraitFrame)} /> : <IconDisplay iconSource="GAME_ICONS" iconKey="lorc/monster-grasp" iconColor="#64c7c1" size={44} />}</span>
      <div><p className="v12-kicker">Creature record · {definition.size.toLowerCase()}</p><h2>{monster.name}</h2><p>{sheet.availableBudget} BU · {sheet.mirrorCredit} weakness credit · Rank {sheet.rank.toFixed(2)} · {sheet.itemBu} item BU</p></div>
      <BookmarkButton targetType="MONSTER" targetId={id} />
    </header>
    <MonsterSheetPreview definition={definition} sheet={sheet} slots={slots} compact={compact}/>

    {error && <p role="alert">{error}</p>}
    {actions ? (actionPlacement === "bottom" && <PreviewActions {...actions}/>) : <footer className="sw-creature-preview-actions">
      <button type="button" className="v12-metal-button v12-metal-button--primary" onClick={() => isSignedIn ? setCopyOpen(value => !value) : void redirectToSignIn({ redirectUrl: `/monsters/${id}` })}>Bring to the table <ArrowRight size={16}/></button>
      <Link className="v12-metal-button" href={`/monsters/${id}${data.canEdit ? "?edit=1" : ""}`}>{data.canEdit ? "Edit creature" : "Open source"}</Link>
      <button type="button" className="v12-metal-button" disabled={pending} onClick={() => void forkCreature()}>Fork creature</button>
    </footer>}
    {copyOpen && <form className="sw-creature-copy-form" onSubmit={event => void createCopy(event)}><label>Name for this play copy<input maxLength={200} value={copyName} onChange={event => setCopyName(event.target.value)} /></label><p>Its session is private and independent of this template.</p><button className="v12-metal-button v12-metal-button--primary" disabled={pending || !copyName.trim()}>{pending ? "Creating…" : "Create play copy"}</button></form>}
  </section>;
}

/** Shared read-only sheet sections for Library and the creation review. */
export function MonsterSheetPreview({definition,sheet,slots,compact=false}:{definition:PinnedDefinition;sheet:ReturnType<typeof resolveMonster>;slots:MonsterSlot[];compact?:boolean}) {
 const [tab,setTab]=useState<"practices"|"abilities"|"story">("practices");
 const previewId=useId();
 const artwork=monsterArtwork({name:definition.name,imageUrl:definition.imageUrl,sourceOrigin:definition.sourceOrigin});
 const monster={name:definition.name};
 return <section className={`sw-creature-preview ${compact?"is-compact":""}`} aria-label="Creature review sheet">
    <MonsterSheetStats showPractices={false} sheet={sheet} definition={definition} proficientAttribute={definition.proficientAttribute} baselineVitality={definition.baselineVitality ?? sheet.vitality}/>
    <div className="sw-creature-tabs" role="tablist" aria-label="Creature sheet sections">
      {([{ key: "practices", label: "Practices", icon: Swords }, { key: "abilities", label: "Abilities & items", icon: Layers }, { key: "story", label: "Story", icon: BookOpen }] as const).map(item => <button type="button" role="tab" aria-selected={tab === item.key} aria-controls={`creature-${previewId}-${item.key}`} id={`creature-${previewId}-tab-${item.key}`} key={item.key} onClick={() => setTab(item.key)}><item.icon size={17}/>{item.label}</button>)}
    </div>
    <div className="sw-creature-content" role="tabpanel" id={`creature-${previewId}-${tab}`} aria-labelledby={`creature-${previewId}-tab-${tab}`}>
      {tab === "practices" && <MonsterPracticeGrid sheet={sheet} definition={definition}/>}
      {tab === "abilities" && <MonsterCompositionView definition={definition} slots={slots}/>}
      {tab === "story" && <div className="sw-creature-story">{artwork && <figure className="sw-creature-story-portrait"><img src={artwork} alt={`${monster.name} portrait`} style={portraitFrameStyle(definition.portraitFrame)}/></figure>}<Markdown>{definition.concept || "This creature's story is still unwritten."}</Markdown>{definition.sourceOrigin && <p className="text-muted-foreground">Source: {definition.sourceOrigin}</p>}</div>}
    </div>
 </section>;
}
