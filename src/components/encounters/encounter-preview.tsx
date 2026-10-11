"use client";
import { TargetEngagement } from "@/components/engagement/target-engagement";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Swords, ArrowUpRight, Eye, BookOpen, Scale, History, AlertTriangle, Check, Heart } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { MonsterPortrait } from "@/components/monsters/monster-portrait";
import { Markdown } from "@/components/ui/markdown";
import { encounterBriefing } from "@/lib/encounters/briefing";
import { EncounterActions, encounterVisibilityLabel } from "./encounter-card";
import type { EncounterDefinition, CreatureSummary, appraiseEncounter } from "@/lib/encounters/model";
import "./encounters.css";
import "./encounter-preview.css";
export type EncounterPreviewData = {
  id: string; revision: number; isOwner: boolean; definition: EncounterDefinition;
  creatures: CreatureSummary[]; runs: { id: string; name: string; createdAt: string }[];
  appraisal: ReturnType<typeof appraiseEncounter>;
};
export function EncounterPreview({ id, initial }: { id: string; initial?: EncounterPreviewData }) {
  const { userId, isLoaded } = useAuth();
  const [initialViewer] = useState(userId);
  if (!isLoaded) return <PreviewLoading/>;
  return <AccountEncounterPreview key={`${userId ?? "anonymous"}:${id}`} id={id} {...(initial && initialViewer === userId ? { initial } : {})}/>;
}
function PreviewLoading() {
  return <div className="sw-encounter-dossier is-loading" aria-busy="true"><p role="status">Loading encounter…</p><div className="sw-dossier-skeleton" aria-hidden="true"><span/><span/><span/></div></div>;
}
function AccountEncounterPreview({ id, initial }: { id: string; initial?: EncounterPreviewData }) {
  const [data, setData] = useState(initial ?? null), [error, setError] = useState("");
  const [view, setView] = useState<'scene'|'creatures'|'budgets'|'runs'>('scene');
  const [retry, setRetry] = useState(0);
  const prefix = useId();
  const stack = useModalStack();
  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    fetch(`/api/encounters/${id}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Encounter unavailable."); if (!controller.signal.aborted) { setData(result); setError(""); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [id, initial, retry]);
  if (error) return <div className="sw-encounter-dossier"><p role="alert">{error}</p><button type="button" className="sw-metal-button" onClick={()=>{setError("");setRetry(v=>v+1);}}>Try again</button></div>;
  if (!data) return <PreviewLoading/>;
  const { definition: d, appraisal: a } = data;
  const briefing = encounterBriefing(d.note);
  const scale = Math.max(a.enemyTotal, a.partyTotal ?? 0, 1);
  const available = data.creatures.filter(c=>!c.unavailable);
  const environments = [...new Set(available.map(c=>c.environment).filter(Boolean))];
  function previewCreature(c: CreatureSummary) {
    if (stack.canPush) stack.push({key:`encounter-monster:${c.templateId}:${c.version}`,label:c.name,category:"MONSTER",content:<MonsterTemplatePreview id={c.templateId} version={c.version} compact/>});
  }
  const ready = a.count > 0 && !a.missing;
  return <article className="sw-encounter-dossier">
    <header className="sw-dossier-heading">
      <div className="sw-dossier-meta"><span>{encounterVisibilityLabel(d.visibility)}</span>{environments.map(e=><span key={e}>{e}</span>)}<span className={ready?'is-ready':'is-incomplete'}>{ready?<Check size={12}/>:<AlertTriangle size={12}/>} {ready?'Ready to run':a.missing?'References need attention':'No creatures yet'}</span></div>
      <h2>{d.name}</h2>
      <div className="sw-dossier-cast-strip" aria-label="Encounter cast">{available.slice(0,5).map(c=><span key={`${c.templateId}:${c.version}`} title={c.name}><MonsterPortrait imageUrl={c.imageUrl} name={c.name} size={42}/></span>)}<p><strong>{a.count}</strong> {a.count===1?'creature':'creatures'}<span>{d.partySize?`Prepared for ${d.partySize} characters`:'Party size not specified'}{a.missing?' · Incomplete budget':` · ${a.enemyBu} creature BU + ${a.enemyItemBu} Item BU`}</span></p></div>
      <div className="sw-dossier-social"><TargetEngagement targetType="ENCOUNTER" targetId={id} compact/><Link href={`/encounters/${id}`} target="_blank" rel="noopener noreferrer">Open preparation <ArrowUpRight size={13}/></Link></div>
    </header>
    <nav className="sw-dossier-tabs" aria-label="Encounter preview sections">{([['scene','Briefing',BookOpen],['creatures',`Creatures · ${a.count}`,Swords],['budgets','Budgets',Scale],['runs',`Your runs · ${data.runs.length}`,History]] as const).map(([key,label,Icon])=><button type="button" key={key} aria-pressed={view===key} aria-controls={`${prefix}-panel`} onClick={()=>setView(key)}><Icon size={14}/>{label}</button>)}</nav>
    <div id={`${prefix}-panel`} className="sw-dossier-body">
      {view==='scene' && <section aria-label="Scene briefing" className="sw-dossier-briefing">
        {briefing.length ? briefing.map((part,index)=><section key={index} className={part.title==='objective'?'sw-dossier-objective':undefined}><h3>{part.title}</h3><Markdown copyRole="narrative">{part.text}</Markdown></section>) : <div className="sw-dossier-empty"><BookOpen size={22}/><h3>A cast ready for your scene</h3><p>No scene notes were added. Review the creatures and budgets, then choose the goal, terrain and opening at your table.</p><button type="button" className="sw-metal-button" onClick={()=>setView('creatures')}>Explore the creatures <ArrowUpRight size={14}/></button></div>}
        <div className="sw-dossier-rhythm"><h3>Shared round</h3><ol>{['Council','Fast','Measured','Heavy'].map(p=><li key={p}>{p}</li>)}</ol><p>Coordinate intent at Council. Advancing a phase does not apply damage or expire effects.</p></div>
      </section>}
      {view==='creatures' && <section className="sw-dossier-roster" aria-label="Creature roster"><p className="sw-dossier-caption">Inspect each creature’s pinned rules before play. Repeated creatures receive independent sheets when you start.</p>{!d.entries.length && <p>No creatures have been chosen.</p>}{d.entries.map(entry=>{
        const c=data.creatures.find(c=>c.templateId===entry.templateId&&c.version===entry.version);
        const accessible=!!c&&!c.unavailable;
        return <section className="sw-dossier-creature" key={`${entry.templateId}:${entry.version}`}>
          <div className="sw-dossier-creature-title"><MonsterPortrait imageUrl={accessible?c.imageUrl:null} name={accessible?c.name:undefined} size={44}/><div><h3>{accessible?c.name:'Unavailable creature'}</h3><p>{accessible?[c.environment,c.role,`Pinned v${entry.version}`].filter(Boolean).join(' · '):'Template no longer accessible'}</p></div><span className="sw-dossier-quantity">×{entry.quantity}</span></div>
          {accessible ? <><dl className="sw-dossier-creature-stats"><div><dt>Creature BU</dt><dd>{c.budget} <small>each</small></dd></div><div><dt>Item BU</dt><dd>{c.itemBu} <small>each</small></dd></div><div><dt><Heart size={11}/> Vitality</dt><dd>{c.maximum} <small>maximum</small></dd></div></dl>{entry.quantity>1 && <p className="sw-dossier-caption">This group: {c.budget*entry.quantity} creature BU + {c.itemBu*entry.quantity} Item BU</p>}{c.tactics&&<details><summary>Tactics</summary><Markdown copyRole="narrative">{c.tactics}</Markdown></details>}<button type="button" className="sw-metal-button" onClick={()=>previewCreature(c)} disabled={!stack.canPush}><Eye size={14}/> Rules & abilities</button></> : <p className="sw-dossier-warning">Its private details are hidden. Update the preparation before starting a new run.</p>}
        </section>;
      })}</section>}
      {view==='budgets' && <section className="sw-dossier-budgets" aria-label="Budget comparison"><h3>Compare the ledgers</h3><p>Creature budgets and equipment are counted separately. Every creature quantity is included.</p><div className="sw-dossier-budget-chart">{[['Opposition',a.missing?null:a.enemyTotal,a.enemyBu,a.enemyItemBu],['Party',a.partyTotal,d.partyBu,d.partyItemBu]].map(([label,total,base,items])=><div key={String(label)}><div><strong>{label}</strong><span>{total===null?'Not fully specified':`${total} combined BU`}</span></div><div className="sw-dossier-budget-track" aria-hidden="true"><span style={{width:`${typeof total==='number'&&typeof base==='number'?base/scale*100:0}%`}}/><i style={{width:`${typeof total==='number'&&typeof items==='number'?items/scale*100:0}%`}}/></div></div>)}</div><div className="sw-dossier-chart-key"><span>Creature / progression BU</span><span>Item BU</span></div><div className="sw-dossier-ledger-wrap"><table><thead><tr><th scope="col">Ledger</th><th scope="col">Opposition</th><th scope="col">Party</th></tr></thead><tbody>{[['Creature / progression BU',a.missing?null:a.enemyBu,d.partyBu],['Item BU',a.missing?null:a.enemyItemBu,d.partyItemBu],['Combined',a.missing?null:a.enemyTotal,a.partyTotal]].map(([label,enemy,party])=><tr key={String(label)}><th scope="row">{label}</th><td>{enemy??'—'}</td><td>{party??'—'}</td></tr>)}</tbody></table></div><dl className="sw-dossier-comparison"><div><dt>Enemy / party</dt><dd>{a.missing||a.ratio===null?'—':`${a.ratio.toFixed(2)}×`}</dd></div><div><dt>Difference</dt><dd>{a.missing||a.difference===null?'—':`${a.difference>0?'+':''}${a.difference} BU`}</dd></div><div><dt>Head count</dt><dd>{a.count} / {d.partySize??'—'}</dd></div></dl>{!a.missing&&a.enemyBu>0&&<p>One creature accounts for up to {Math.round(a.largestShare*100)}% of the opposition’s creature budget.</p>}<p className="sw-dossier-caption">{d.budgetSource==='characters'?'Party totals were calculated from linked characters. Refresh them in preparation when needed.':d.budgetSource==='override'?'Party totals are a manual override.':'Party totals are manually entered.'} {d.characterIds.length>0?`${d.characterIds.length} character references are linked.`:''}</p><p className="sw-dossier-warning">Comparable BU totals do not guarantee comparable difficulty. Control, support, terrain, objectives and concentrated power all matter.</p>{a.missing&&<p role="status">An inaccessible reference makes the opposition total incomplete.</p>}</section>}
      {view==='runs' && <section className="sw-dossier-runs" aria-label="Your saved runs"><h3>Your table, your runs</h3><p>Starting creates fresh private creature sheets. Earlier runs and their gameplay state are preserved.</p>{data.runs.length?data.runs.map(run=><Link key={run.id} href={`/encounters/runs/${run.id}`}><span><strong>{run.name}</strong><small>{new Date(run.createdAt).toLocaleDateString()}</small></span><span>Resume <ArrowUpRight size={14}/></span></Link>):<p className="sw-dossier-empty">You have no saved runs of this encounter yet. Start when your table is ready.</p>}</section>}
    </div>
    <footer className="sw-dossier-actions"><EncounterActions row={{id,revision:data.revision,isOwner:data.isOwner,creatureCount:a.count,unavailable:a.missing,latestRunId:data.runs[0]?.id??null}}/><p>Runs save to your account; the shared preparation stays intact.</p></footer>
  </article>;
}
