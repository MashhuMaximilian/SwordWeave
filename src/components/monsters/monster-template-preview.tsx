"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { Heart, Swords, BookOpen, Layers, ArrowRight } from "lucide-react";
import { BookmarkButton } from "@/components/collections/bookmark-button";
import { Markdown } from "@/components/ui/markdown";
import { IconDisplay } from "@/components/icons/icon-display";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { MonsterSlot, resolveMonster } from "@/lib/monsters/resolve";
import "./monster-template-preview.css";

type PreviewData = {
  monster: { name: string; definition: PinnedDefinition; currentVersion: number; visibility: string };
  sheet: ReturnType<typeof resolveMonster>;
  canEdit: boolean;
  slots: MonsterSlot[];
};
const signed = (value: number) => value >= 0 ? `+${value}` : String(value);

/** A template is read-only here. Playing creates an independent, pinned copy. */
export function MonsterTemplatePreview({ id, compact = false }: { id: string; compact?: boolean }) {
  const { userId, isLoaded } = useAuth();
  return <AccountPreview key={`${userId ?? "anonymous"}:${id}`} id={id} compact={compact} ready={isLoaded} />;
}

function AccountPreview({ id, compact, ready }: { id: string; compact: boolean; ready: boolean }) {
  const { isSignedIn } = useAuth();
  const { redirectToSignIn } = useClerk();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"practices" | "abilities" | "story">("practices");
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
  const totals = sheet.resolved.totals;
  const definition = monster.definition;
  const slots = data.slots ?? definition.resolvedSlots ?? [];
  const groups = ["physical", "mental", "magical"] as const;
  return <section className={`sw-creature-preview ${compact ? "is-compact" : ""}`} aria-label={`${monster.name} mini sheet`}>
    <header className="sw-creature-identity">
      <span className="sw-creature-emblem"><IconDisplay iconSource="GAME_ICONS" iconKey="lorc/monster-grasp" iconColor="#64c7c1" size={44} /></span>
      <div><p className="v12-kicker">Creature record · {definition.size.toLowerCase()}</p><h2>{monster.name}</h2><p>{definition.budget} BU · Rank {sheet.rank.toFixed(2)} · {sheet.itemBu} item BU</p></div>
      <BookmarkButton targetType="MONSTER" targetId={id} />
    </header>
    <div className="sw-creature-stat-deck" aria-label="Creature statistics">
      <div className="sw-creature-vitality"><Heart size={22}/><strong>{sheet.maximum}</strong><span>Vitality</span></div>
      {groups.map(attribute => <div key={attribute}><span>{attribute === "magical" ? "MAG" : attribute === "physical" ? "PHY" : "MEN"}</span><strong>{signed(sheet.attributes[attribute])}</strong><small>Save {signed(totals[`${attribute}_saving_throw`] ?? 0)}</small></div>)}
      <div><span>PB</span><strong>{signed(totals["proficiency_bonus"] ?? sheet.pb)}</strong></div>
      <div><span>DC</span><strong>{totals["save_dc"] ?? 0}</strong></div>
      <div><span>ATK</span><strong>{signed(totals["attack_bonus"] ?? 0)}</strong></div>
    </div>
    <div className="sw-creature-movement"><span>Speed <strong>{totals["speed"] ?? 0} ft</strong></span><span>Load capacity <strong>{totals["carry_capacity"] ?? 0}</strong></span><span>Build <strong>{sheet.spent} / {definition.budget} BU</strong></span></div>
    <div className="sw-creature-tabs" role="tablist" aria-label="Creature sheet sections">
      {([{ key: "practices", label: "Practices", icon: Swords }, { key: "abilities", label: "Abilities & items", icon: Layers }, { key: "story", label: "Story", icon: BookOpen }] as const).map(item => <button type="button" role="tab" aria-selected={tab === item.key} aria-controls={`creature-${id}-${item.key}`} id={`creature-${id}-tab-${item.key}`} key={item.key} onClick={() => setTab(item.key)}><item.icon size={17}/>{item.label}</button>)}
    </div>
    <div className="sw-creature-content" role="tabpanel" id={`creature-${id}-${tab}`} aria-labelledby={`creature-${id}-tab-${tab}`}>
      {tab === "practices" && groups.map(attribute => <section className="sw-creature-practice-group" key={attribute}><h3>{attribute === "magical" ? "Magic" : attribute}</h3><div>{sheet.practices.filter(practice => practice.attribute.toLowerCase() === attribute).map(practice => <p key={practice.practice}><span>{practice.practice}</span><strong>{signed(practice.total)}</strong></p>)}</div></section>)}
      {tab === "abilities" && (slots.length ? slots.map(slot => <details className="sw-creature-piece" key={slot.dependencyKey}><summary><span>{slot.name}</span><small>×{slot.quantity}{slot.isMirrored ? " · Mirrored" : ""}{slot.item ? " · Item" : ""}</small></summary><div>{slot.hardModifiers.map((modifier, index) => <p key={index}>{modifier.target.replaceAll("_", " ")} · {modifier.operation} {typeof modifier.value === "object" ? JSON.stringify(modifier.value) : String(modifier.value)}</p>)}</div></details>) : <p>No components added yet.</p>)}
      {tab === "story" && <div className="sw-creature-story"><Markdown>{definition.concept || "This creature's story is still unwritten."}</Markdown>{definition.sourceOrigin && <p className="text-muted-foreground">Source: {definition.sourceOrigin}</p>}</div>}
    </div>
    {error && <p role="alert">{error}</p>}
    <footer className="sw-creature-preview-actions">
      <button type="button" className="v12-metal-button v12-metal-button--primary" onClick={() => isSignedIn ? setCopyOpen(value => !value) : void redirectToSignIn({ redirectUrl: `/monsters/${id}` })}>Bring to the table <ArrowRight size={16}/></button>
      <Link className="v12-metal-button" href={`/monsters/${id}${data.canEdit ? "?edit=1" : ""}`}>{data.canEdit ? "Edit creature" : "Open source"}</Link>
      <button type="button" className="v12-metal-button" disabled={pending} onClick={() => void forkCreature()}>Fork creature</button>
    </footer>
    {copyOpen && <form className="sw-creature-copy-form" onSubmit={event => void createCopy(event)}><label>Name for this play copy<input maxLength={200} value={copyName} onChange={event => setCopyName(event.target.value)} /></label><p>Its session is private and independent of this template.</p><button className="v12-metal-button v12-metal-button--primary" disabled={pending || !copyName.trim()}>{pending ? "Creating…" : "Create play copy"}</button></form>}
  </section>;
}
