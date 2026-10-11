"use client";

import { useState } from "react";
import { ArrowUpRight, Heart, ChevronRight } from "lucide-react";
import { MonsterPortrait } from "@/components/monsters/monster-portrait";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { Markdown } from "@/components/ui/markdown";
import type { EncounterDefinition, CreatureSummary } from "@/lib/encounters/model";

const keyOf = (entry: EncounterDefinition["entries"][number]) => `${entry.templateId}:${entry.version}`;

export function EncounterCreatureRoster({ entries, creatures, onPreview, canPreview }: {
  entries: EncounterDefinition["entries"]; creatures: CreatureSummary[];
  onPreview: (creature: CreatureSummary) => void; canPreview: boolean;
}) {
  const [chosen, setChosen] = useState(entries[0] ? keyOf(entries[0]) : "");
  const entry = entries.find(e => keyOf(e) === chosen) ?? entries[0];
  const c = entry && creatures.find(c => c.templateId === entry.templateId && c.version === entry.version);
  const accessible = !!c && !c.unavailable;
  if (!entry) return <div className="sw-dossier-empty">No creatures have been chosen. Add a creature in preparation to build the cast.</div>;
  return <section className="sw-cast-browser" aria-label="Encounter creatures">
    <nav className="sw-cast-directory" aria-label="Choose a creature to inspect">
      {entries.map(e => {
        const creature = creatures.find(c => c.templateId === e.templateId && c.version === e.version);
        const allowed = creature && !creature.unavailable;
        return <button key={keyOf(e)} type="button" aria-pressed={keyOf(e) === keyOf(entry)} onClick={() => setChosen(keyOf(e))}>
          <MonsterPortrait imageUrl={allowed ? creature.imageUrl : null} name={allowed ? creature.name : undefined} size={36}/>
          <span><strong>{allowed ? creature.name : "Unavailable creature"}</strong><small>{allowed ? `${creature.role || "Creature"} · ${creature.budget} BU each` : "Access changed"}</small></span>
          <b>×{e.quantity}</b><ChevronRight size={12}/>
        </button>;
      })}
    </nav>
    <article className="sw-cast-inspection" aria-label={accessible ? `${c.name} encounter details` : "Unavailable creature"}>
      {accessible ? <>
        <header className="sw-cast-identity">
          <MonsterPortrait imageUrl={c.imageUrl} name={c.name} size={80}/>
          <div><p>{[c.environment, c.role].filter(Boolean).join(" · ") || "Encounter creature"}</p><h3>{c.name}</h3><span>{entry.quantity === 1 ? "One creature" : `${entry.quantity} independent creatures`} · pinned v{entry.version}</span></div>
        </header>
        <dl className="sw-cast-stats"><div><dt><Heart size={11}/> Vitality</dt><dd>{c.maximum}<small>each</small></dd></div><div><dt>Creature BU</dt><dd>{c.budget}<small>each</small></dd></div><div><dt>Item BU</dt><dd>{c.itemBu}<small>each</small></dd></div></dl>
        {entry.quantity > 1 && <p className="sw-cast-group-total">Group budget <strong>{c.budget * entry.quantity} BU</strong> + <strong>{c.itemBu * entry.quantity} Item BU</strong></p>}
        {c.tactics && <section className="sw-cast-tactics"><h4>At the table</h4><Markdown copyRole="narrative">{c.tactics}</Markdown></section>}
        <div className="sw-cast-sheet" key={keyOf(entry)}><MonsterTemplatePreview id={entry.templateId} version={entry.version} compact hideActions showIdentity={false} initialSection="abilities"/></div>
        <button className="sw-cast-full-preview" type="button" disabled={!canPreview} onClick={() => onPreview(c)}>Open full creature preview <ArrowUpRight size={12}/></button>
      </> : <div className="sw-dossier-warning"><h3>Creature no longer accessible</h3><p>Its private details are hidden. Update the preparation before starting a new run.</p></div>}
    </article>
  </section>;
}
