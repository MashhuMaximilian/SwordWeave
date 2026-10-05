"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {getEffectivePlayState,queuePlayChanges} from "@/lib/play-state/client-sync";
import {usePlaySession} from "@/lib/hooks/use-play-session";
import {PlaySessionPanel} from "@/components/characters/play-session-panel";
import {evaluateCondition} from "@/lib/engine/condition-evaluator";
import {rollDice} from "@/lib/engine/runtime-resolver";
import {resolveMonsterPlay,customMonsterConsequence} from "@/lib/monsters/play";
import type {PinnedDefinition} from "@/lib/monsters/service";
import type {ConsequenceOccurrence,ConsequenceBehavior} from "@/lib/character/consequences/types";
import type {HardModifier} from "@/types/swordweave";
import type {MonsterSlot} from "@/lib/monsters/resolve";
import {mechanicalDescriptionFromModifiers} from "@/lib/primitives/mechanical-rule";
import {Markdown} from "@/components/ui/markdown";
import {IdentityCell} from "@/components/characters/identity-cell";
import {CompactCompositeCard,CompactHierarchyBranch,CompactPrimitiveCard} from "@/components/characters/compact-hierarchy";
import {DetailModal} from "@/components/ui/detail-modal";
import type {MonsterComponentPin} from "@/lib/monsters/composition";
import {MonsterSheetStats} from "./monster-sheet-stats";
import {Swords, Package, BookOpen, Activity, Heart, ChevronDown} from "lucide-react";
import "./monster-ui.css";
import "./monster-sheet.css";
export function MonsterPlaySheet({id}:{id:string}){
 const [identityOpen,setIdentityOpen]=useState(false);
 const [previewSource,setPreviewSource]=useState<{id:string;kind:string}|null>(null);
 const [previewPin,setPreviewPin]=useState<MonsterComponentPin|null>(null);
 const previewSourceType=previewPin?.kind!=="heritage"?previewPin?.kind.toUpperCase():previewSource?.id===previewPin.id?previewSource.kind:null;
 useEffect(()=>{if(previewPin?.kind!=="heritage")return;const controller=new AbortController();void fetch(`/api/heritage/${previewPin.id}`,{signal:controller.signal}).then(async response=>response.ok?response.json():null).then(body=>{if(body?.template?.kind&&!controller.signal.aborted)setPreviewSource({id:previewPin.id,kind:`${body.template.kind}_TEMPLATE`});}).catch(()=>undefined);return()=>controller.abort();},[previewPin]);
 const [tab,setTab]=useState<"capabilities"|"items"|"story"|"consequences"|"session">("capabilities");
 const [statsOpen,setStatsOpen]=useState(false);
 const [vitalityAmount,setVitalityAmount]=useState(1);
 const [packages,setPackages]=useState<{key:string;name:string;hash:string;vitalityDelta:number;pieces:{id:number;title:string;description:string;versionId:string|null;modifiers:HardModifier[];behavior:ConsequenceBehavior}[]}[]>([]);
 const [copyData,setCopyData]=useState<{accountId:string;copy:{templateId:string;name:string;templateVersion:number;currentVitality:number;definition:PinnedDefinition}}|null>(null),[error,setError]=useState(""),[roll,setRoll]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[consequenceTarget,setConsequenceTarget]=useState("attack_bonus"),[consequenceAmount,setConsequenceAmount]=useState(0),[deleteConfirmOpen,setDeleteConfirmOpen]=useState(false),[deleteConfirmAccount,setDeleteConfirmAccount]=useState<string|null>(null),[deletePending,setDeletePending]=useState(false);const deleteController=useRef<AbortController|null>(null);const endpoint=`/api/monsters/copies/${id}`;
 const syncEndpoint=`${endpoint}?session=1`;
 const {session,accountId}=usePlaySession("MONSTER_PLAY_COPY",id,syncEndpoint,undefined,{method:"PATCH"});
 useEffect(()=>{deleteController.current?.abort();deleteController.current=null;},[accountId,id]);
 useEffect(()=>{if(!accountId)return;let active=true;const abort=new AbortController();fetch(endpoint,{signal:abort.signal,cache:"no-store"}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);if(active){setCopyData({accountId,copy:b.copy});setPackages(b.packages??[]);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;abort.abort();};},[accountId,id,endpoint]);
 const copy=copyData?.accountId===accountId?copyData.copy:null;
 if(!copy||!session.ready)return <main className="p-6">{error||"Loading play copy…"}<PlaySessionPanel subjectKind="MONSTER_PLAY_COPY" subjectId={id} endpoint={syncEndpoint} method="PATCH"/></main>;
 const overrides=getEffectivePlayState("MONSTER_PLAY_COPY",id).overrides;const slots:MonsterSlot[]=copy.definition.resolvedSlots??[];const {sheet,occurrences,context}=resolveMonsterPlay(copy.definition,slots,overrides,copy.currentVitality);
 function change(field:string,value:unknown){queuePlayChanges("MONSTER_PLAY_COPY",id,[{field,value}]);}
 function check(label:string,bonus:number){const result=rollDice("1d20");setRoll(`${label}: ${result.rolls.join(" + ")} + ${bonus} = ${result.total+bonus}`);}
 async function deleteCopy(){if(deletePending||!accountId)return;setDeletePending(true);setError("");const controller=new AbortController();deleteController.current=controller;try{const response=await fetch(endpoint,{method:"DELETE",signal:controller.signal});if(controller.signal.aborted)return;const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error??"Unable to delete finished play copy.");location.href="/monsters";}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Unable to delete finished play copy.");}finally{if(deleteController.current===controller)deleteController.current=null;setDeletePending(false);}}
 const toggles=[...new Set(slots.flatMap(s=>(s.supplyKeys??[]).flat().filter(k=>k.startsWith("capability:")||k.startsWith("effect:"))))];

 function applyPackage(p:typeof packages[number]){const applicationId=crypto.randomUUID();const changes=p.pieces.map(piece=>{const occurrence:ConsequenceOccurrence={...customMonsterConsequence(piece.title,piece.description),id:crypto.randomUUID(),applicationId,sourceEntityId:String(piece.id),sourceEntityType:"primitive",sourceVersionId:piece.versionId,modifiers:piece.modifiers,restrictions:piece.behavior.restrictions,recovery:piece.behavior.recovery,applicationSnapshot:{vitalityDelta:piece.behavior.vitalityDelta,modifiers:piece.modifiers,restrictions:piece.behavior.restrictions}};return {field:`consequence:${occurrence.id}`,value:occurrence as unknown};});changes.push({field:"currentVitality",value:Math.max(0,Math.min(sheet.maximum,sheet.currentVitality+p.vitalityDelta))});queuePlayChanges("MONSTER_PLAY_COPY",id,changes);}
 function compositionActions(pin:MonsterComponentPin){const key=`${pin.kind}:${pin.id}`,field=key.replace("capability:","cap:").replace("effect:","eff:");const p=packages.find(p=>p.key===key);return <div className="flex items-center gap-2">{toggles.includes(key)&&<label className="inline-flex gap-1 items-center text-[10px]"><input type="checkbox" checked={overrides[field]!==true} onChange={e=>change(field,e.target.checked?null:true)}/>Active</label>}{p&&<button className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary text-xs" disabled={overrides[field]===true} onClick={()=>applyPackage(p)}>Use</button>}</div>;}
 return <NarrativeRequestScope key={`${accountId}:${id}`}><main className="sw-monster-page monster-character-sheet" data-character-surface>
 <header className="creature-identity v12-sheet-identity v12-instrument sticky">
  <Link href="/monsters" className="creature-back">← Monsters &amp; NPCs</Link>
  <div className="creature-identity-row v12-sheet-identity-summary"><div className="creature-identity-glyph"><Swords aria-hidden="true"/></div><div><p className="creature-eyebrow">Private play copy · Version {copy.templateVersion}</p><h1>{copy.name}</h1><p className="creature-identity-meta">{copy.definition.size.toLowerCase()} · Rank {Number(sheet.rank.toFixed(2))} · {copy.definition.budget} BU</p></div><button className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary ml-auto" onClick={()=>setIdentityOpen(!identityOpen)} aria-expanded={identityOpen} aria-controls="creature-identity-deck"><span className="font-mono">{sheet.spent}/{copy.definition.budget} BU</span><ChevronDown size={14}/></button></div>
 {identityOpen&&<div className="v12-sheet-identity-deck creature-identity-deck" id="creature-identity-deck"><div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border border-border rounded overflow-hidden"><IdentityCell label="Budget" value={`${sheet.spent} / ${copy.definition.budget} BU`}/><IdentityCell label="Remaining" value={`${Math.max(0,copy.definition.budget-sheet.spent)} BU`}/><IdentityCell label="Item BU" value={`${sheet.itemBu} BU`} note="Separate item pool"/><IdentityCell label="Rank" value={Number(sheet.rank.toFixed(2)).toString()} note={`Proficient in ${copy.definition.proficientAttribute}`}/></div><div className="v12-identity-meter mt-3"><div className="flex justify-between text-[10px] uppercase tracking-wider"><span>Budget usage</span><span>{sheet.spent} / {copy.definition.budget} BU</span></div><div className="h-1.5 mt-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{width:`${Math.min(100,sheet.spent/copy.definition.budget*100)}%`}}/></div></div><div className="v12-identity-actions mt-3 flex gap-2"><Link className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary" href={`/monsters/${copy.templateId}`}>Open template / Edit</Link><Link className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary" href={`/library/item/MONSTER:${copy.templateId}`}>View source</Link></div><p className="mt-2 text-xs text-muted-foreground">This private copy keeps version {copy.templateVersion}. Template edits are used by new copies.</p> <section className="creature-session"><h2>Saved session</h2><p className="creature-section-intro">Manage synchronization, conflicts, offline changes, and backups for this private copy.</p><PlaySessionPanel subjectKind="MONSTER_PLAY_COPY" subjectId={id} endpoint={syncEndpoint} method="PATCH"/>
 {deleteConfirmOpen&&deleteConfirmAccount===accountId?<section className="monster-panel monster-delete-confirm" aria-labelledby="monster-delete-heading"><h2 id="monster-delete-heading">Delete {copy.name}?</h2><p>This permanently deletes this private play copy and its saved session.</p><div className="monster-actions"><button type="button" disabled={deletePending} onClick={()=>setDeleteConfirmOpen(false)}>Keep this copy</button><button className="monster-delete-copy" type="button" disabled={deletePending} onClick={()=>void deleteCopy()}>{deletePending?"Deleting…":"Delete finished copy"}</button></div>{deletePending&&<p role="status">Deleting private play copy…</p>}</section>:<button className="monster-delete-copy" type="button" onClick={()=>{setDeleteConfirmAccount(accountId);setDeleteConfirmOpen(true);}}>Delete finished copy</button>}</section></div>}
 </header>
 {error&&<p className="creature-error" role="alert">{error}</p>}
 <nav className="creature-tabs" aria-label="Play sheet sections">{([{key:"capabilities",label:"Capabilities",icon:Swords},{key:"items",label:"Items",icon:Package},{key:"story",label:"Story",icon:BookOpen},{key:"consequences",label:"Consequences",icon:Activity}] as const).map(({key,label,icon:Icon})=><button key={key} type="button" aria-current={tab===key?"page":undefined} onClick={()=>setTab(key)}><Icon size={15}/>{label}{key==="consequences"&&occurrences.filter(c=>c.status!=="resolved").length>0&&<span>{occurrences.filter(c=>c.status!=="resolved").length}</span>}</button>)}</nav>
 <div className="creature-sheet-layout"><aside className="creature-stat-column v12-bottom-drawer v12-instrument fixed" id="creature-stats" data-open={statsOpen}><button className="v12-bottom-drawer-toggle flex w-full items-center justify-between p-3 text-xs" onClick={()=>setStatsOpen(!statsOpen)} aria-expanded={statsOpen}><span className="flex items-center gap-2"><Heart size={14}/>Vitality <strong>{sheet.currentVitality} / {sheet.maximum}</strong></span><span className="creature-dock-numbers">{([{label:"PHY",value:sheet.attributes.physical},{label:"MEN",value:sheet.attributes.mental},{label:"MAG",value:sheet.attributes.magical},{label:"PB",value:sheet.resolved.totals["proficiency_bonus"]??sheet.pb},{label:"DC",value:sheet.resolved.totals["save_dc"]??0},{label:"ATK",value:sheet.resolved.totals["attack_bonus"]??0}] as const).map(stat=><span key={stat.label}><small>{stat.label}</small><strong>{stat.label!=="DC"&&stat.value>=0?"+":""}{stat.value}</strong></span>)}</span><ChevronDown size={14}/></button><div className="v12-bottom-drawer-body creature-stat-body" hidden={!statsOpen}>
 <MonsterSheetStats sheet={sheet} definition={copy.definition} baselineVitality={typeof overrides["baselineVitality"]==="number"?overrides["baselineVitality"]:copy.definition.baselineVitality??sheet.vitality} proficientAttribute={copy.definition.proficientAttribute} onRoll={check}/>
 <section className="creature-vitality-controls"><h2>Track Vitality</h2><div className="creature-damage-row"><label>Amount<input type="number" min="1" value={vitalityAmount} onChange={e=>setVitalityAmount(Number(e.target.value))}/></label><button disabled={!Number.isSafeInteger(vitalityAmount)||vitalityAmount<1} onClick={()=>change("currentVitality",Math.max(0,sheet.currentVitality-vitalityAmount))}>Damage</button><button disabled={!Number.isSafeInteger(vitalityAmount)||vitalityAmount<1} onClick={()=>change("currentVitality",Math.min(sheet.maximum,sheet.currentVitality+vitalityAmount))}>Heal</button></div><label className="monster-field">Current Vitality<input type="number" min="0" max={sheet.maximum} value={sheet.currentVitality} onChange={e=>{const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>=0&&n<=sheet.maximum)change("currentVitality",n);}}/></label><details className="creature-baseline"><summary>Baseline Vitality override</summary><p>Changes the maximum. Current Vitality is only reduced when it exceeds the new maximum.</p><label className="monster-field">Manual baseline<input type="number" min="1" value={typeof overrides["baselineVitality"]==="number"?overrides["baselineVitality"]:copy.definition.baselineVitality??""} onChange={e=>{const n=Number(e.target.value);if(!e.target.value)change("baselineVitality",null);else if(Number.isSafeInteger(n)&&n>0)change("baselineVitality",n);}}/></label></details></section>
 </div></aside><div className="creature-content">
 {roll&&<output className="creature-roll-result" aria-live="polite">{roll}</output>}
 {tab==="story"&&<section className="creature-story"><p className="creature-eyebrow">Creature &amp; character</p><h2>{copy.name}</h2>{copy.definition.concept?<Markdown>{copy.definition.concept}</Markdown>:<p className="creature-empty">No story has been added to this template.</p>}{copy.definition.sourceOrigin&&<p className="creature-source">Origin: {copy.definition.sourceOrigin}</p>}<p className="creature-snapshot-note">This copy uses the saved template at version {copy.templateVersion}. Its play state is independent of the template and other copies.</p></section>}
 {tab==="items"&&<section className="v12-sheet-items"><h2>Items</h2>{!(copy.definition.componentPins??[]).some(p=>p.kind==="item")&&<p className="creature-empty">This creature carries no items.</p>}{(copy.definition.componentPins??[]).filter(p=>p.kind==="item").map(pin=><article className="v12-loadout-item rounded border border-border bg-card p-3 mb-3" key={pin.key}><button className="font-semibold text-sm" onClick={()=>setPreviewPin(pin)}>{pin.name}</button><p className="text-xs text-muted-foreground mt-1">×{copy.definition.references.find(r=>r.kind==="ITEM"&&r.id===pin.id)?.quantity??1} · Pinned item</p><MonsterComposition pin={pin} pins={copy.definition.componentPins??[]} slots={slots} onOpen={setPreviewPin} renderActions={compositionActions}/></article>)}</section>}

 <section className="monster-panel monster-abilities-panel" hidden={tab!=="capabilities"}><h2 className="text-xl">Capabilities &amp; effects</h2><p className="creature-section-intro">Use an ability to apply its consequences. Disable a capability or effect to remove its contribution from this copy.</p>{copy.definition.references.filter(r=>r.kind!=="ITEM").map(ref=>{const pin=(copy.definition.componentPins??[]).find(p=>p.kind===ref.kind.toLowerCase()&&p.id===ref.id&&(ref.versionId===null||p.versionId===ref.versionId));return pin?<MonsterComposition key={`${ref.kind}:${ref.id}`} pin={pin} pins={copy.definition.componentPins??[]} slots={slots} onOpen={setPreviewPin} renderActions={compositionActions}/>:null;})}</section>
 <section className="monster-panel monster-consequences-panel" hidden={tab!=="consequences"}>
  <h2>Consequences</h2>
  {occurrences.length===0&&<p className="creature-empty">No consequences yet. Applied abilities and custom consequences appear here.</p>}
  {occurrences.map(c=><article className="monster-consequence" key={c.id}>
   <div><strong>{c.title}</strong><span className="creature-status">{c.status==="resolved"?"Resolved":c.source==="sheet-auto"?"Automatic":"Ongoing"}</span>{c.description&&<p>{c.description}</p>}</div>
   <div className="monster-actions"><label className="monster-check"><input type="checkbox" checked={c.status!=="resolved"&&(c.manualOverride??(c.source==="sheet-auto"?evaluateCondition(c.modifiers[0]?.condition as never,context):c.active))} onChange={e=>change(`consequence:${c.id}`,{...c,manualOverride:e.target.checked})}/>Active</label>
    <button onClick={()=>change(`consequence:${c.id}`,{...c,status:"resolved",active:false,manualOverride:false,resolvedAt:Date.now()})}>Resolve</button>
    {c.source==="custom"&&<button onClick={()=>change(`consequence:${c.id}`,null)}>Delete</button>}
   </div>
  </article>)}
  <h3>Add a consequence</h3>
  <div className="monster-settings-grid">
   <label className="monster-field">Title<input aria-label="Consequence title" placeholder="Consequence" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="monster-field">Description<textarea aria-label="Consequence description" value={description} onChange={e=>setDescription(e.target.value)}/></label>
  </div>
  <label className="monster-field">Optional modifier<div className="monster-modifier-row"><select aria-label="Modifier target" value={consequenceTarget} onChange={e=>setConsequenceTarget(e.target.value)}>{["attack_bonus","save_dc","max_vitality","speed","physical_saving_throw","mental_saving_throw","magical_saving_throw","attribute.physical","attribute.mental","attribute.magical",...sheet.practices.map(p=>`skill_practice_check.${p.practice}`)].map(k=><option key={k}>{k}</option>)}</select><input aria-label="Modifier amount" type="number" value={consequenceAmount} onChange={e=>setConsequenceAmount(Number(e.target.value))}/></div></label>
  <button disabled={!title.trim()} onClick={()=>{const c=customMonsterConsequence(title.trim(),description);if(Number.isSafeInteger(consequenceAmount)&&consequenceAmount!==0)c.modifiers=[{kind:"modify",target:consequenceTarget,operation:"add",value:consequenceAmount,stacking:"stack"}];change(`consequence:${c.id}`,c);setTitle("");setDescription("");}}>Add consequence</button>
 </section>
 <DetailModal isOpen={!!previewPin} onClose={()=>setPreviewPin(null)} title={previewPin?.name??"Composition"} subtitle="Pinned play composition">{previewPin&&<><MonsterComposition pin={previewPin} pins={copy.definition.componentPins??[]} slots={slots}/>{previewSourceType&&<div className="mt-4 flex gap-2"><Link className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary" href={`/library/item/${previewSourceType}:${previewPin.id}`}>View source</Link><Link className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary" href={`/library/item/${previewSourceType}:${previewPin.id}/versions`}>Version history</Link></div>}</>}</DetailModal></div></div></main></NarrativeRequestScope>;
}

/** The same composition pieces used by player item/capability cards, fed from this copy's pins. */
function MonsterComposition({pin,pins,slots,onOpen,renderActions,ancestors=[]}:{pin:MonsterComponentPin;pins:MonsterComponentPin[];slots:MonsterSlot[];onOpen?:((pin:MonsterComponentPin)=>void)|undefined;renderActions?:((pin:MonsterComponentPin)=>React.ReactNode)|undefined;ancestors?:string[]}) {
 const requests=useContext(NarrativeRequests);
 const [payload,setPayload]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{
  if(!pin.versionId||!requests)return;
  let active=true;
  const key=`${pin.kind}:${pin.id}:${pin.versionId}`;
  let pending=requests.get(key);
  if(!pending){pending=loadPinnedNarrative({kind:pin.kind,id:pin.id,versionId:pin.versionId}).catch(()=>null);requests.set(key,pending);}
  void pending.then(value=>{if(active)setPayload(value);});
  // A consumer leaving the tree must not cancel another card's shared lookup.
  return()=>{active=false;};
 },[pin.id,pin.kind,pin.versionId,requests]);
 const row=payload??pin.fallback??{};
 const prose=[row["verboseDescription"],row["description"],row["narrativeRule"],row["narrativeDescription"]].find(value=>typeof value==="string"&&value.trim()) as string|undefined;
 if(ancestors.includes(pin.key))return null;
 if(pin.kind==="primitive"){
  const slot=slots.find(s=>s.primitiveId===Number(pin.id)&&s.dependencyVersions?.includes(`${pin.kind}:${pin.id}:${pin.versionId??"unpublished"}`))??slots.find(s=>s.primitiveId===Number(pin.id));
  return <div><CompactPrimitiveCard name={pin.name} version={null} mechanicalText={mechanicalDescriptionFromModifiers(slot?.hardModifiers)} narrativeText={prose} mirrored={slot?.isMirrored??false} onOpen={onOpen?()=>onOpen(pin):undefined}/>{renderActions?.(pin)}</div>;
 }
 const childPins=pin.links.map(link=>{const version="versionId" in link?link.versionId:link.data["versionId"];return pins.find(p=>p.kind===link.kind&&p.id===String(link.id)&&(!version||p.versionId===version));}).filter((p):p is MonsterComponentPin=>!!p);
 const contents=<>{(["capability","effect","primitive"] as const).map(kind=>{const children=childPins.filter(p=>p.kind===kind);return children.length>0?<CompactHierarchyBranch key={kind} label={kind==="primitive"?"Rules":kind==="effect"?"Effects":"Capabilities"} tone={kind==="primitive"?"teal":kind==="effect"?"copper":"gold"} count={children.length}>{children.map(child=><MonsterComposition key={child.key} pin={child} pins={pins} slots={slots} onOpen={onOpen} renderActions={renderActions} ancestors={[...ancestors,pin.key]}/>)}</CompactHierarchyBranch>:null;})}</>;
 if(pin.kind==="heritage")return <CompactHierarchyBranch label={pin.name} tone="gold" count={childPins.length}>{onOpen&&<button className="creature-sheet-button inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary text-xs" onClick={()=>onOpen(pin)}>Preview heritage</button>}{prose&&<Markdown className="v12-expression-description" copyRole="narrative">{prose}</Markdown>}{contents}</CompactHierarchyBranch>;
 if(pin.kind==="item")return <div className="mt-3">{prose&&<Markdown className="v12-expression-description" copyRole="narrative">{prose}</Markdown>}{contents}</div>;
 return <CompactCompositeCard kind={pin.kind==="effect"?"effect":"capability"} name={pin.name} version={null} description={prose} onOpen={onOpen?()=>onOpen(pin):undefined} actions={renderActions?.(pin)} collapsible defaultExpanded>{contents}</CompactCompositeCard>;
}


type NarrativePayload=Record<string,unknown>|null;
const NarrativeRequests=createContext<Map<string,Promise<NarrativePayload>>|null>(null);
/** A new mounted scope for each account and copy; no narrative data crosses those boundaries. */
function NarrativeRequestScope({children}:{children:React.ReactNode}){
 const [requests]=useState(()=>new Map<string,Promise<NarrativePayload>>());
 return <NarrativeRequests.Provider value={requests}>{children}</NarrativeRequests.Provider>;
}
async function loadPinnedNarrative(pin:Pick<MonsterComponentPin,"kind"|"id"|"versionId">):Promise<NarrativePayload>{
 let targetType=pin.kind.toUpperCase();
 if(pin.kind==="heritage"){
  const source=await fetch(`/api/heritage/${pin.id}`);if(!source.ok)return null;
  const body=await source.json();if(!body?.template?.kind)return null;
  targetType=`${body.template.kind}_TEMPLATE`;
 }
 let before:number|undefined;
 for(let page=0;page<10;page++){
  const query=new URLSearchParams({targetType,targetId:pin.id,...(before?{before:String(before)}:{})});
  const response=await fetch(`/api/versions/list?${query}`);if(!response.ok)return null;
  const result=await response.json() as {versions:{id:string;versionNumber:number}[];nextBefore:number|null};
  const selected=result.versions.find(v=>v.id===pin.versionId);
  if(selected){
   query.delete("before");query.set("version",String(selected.versionNumber));
   const detail=await fetch(`/api/versions/list?${query}`);if(!detail.ok)return null;
   const body=await detail.json();return body.version.payload as Record<string,unknown>;
  }
  if(!result.nextBefore)return null;before=result.nextBefore;
 }
 return null;
}
