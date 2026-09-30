"use client";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { DiscoveryCandidate } from "@/lib/character/workspace/discovery/matching";
import { RollResolutionEditor } from "@/components/sandbox/roll-resolution-editor";
import { EMPTY_RESOLUTION, type RollResolution } from "@/lib/capabilities/roll-resolution";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { ConditionPicker } from "@/components/sandbox/condition-picker";
import { buildCondition, conditionToAuthoring } from "@/lib/primitives/condition";
import { useEffect, useState } from "react";
import { ArrowRight, Shuffle, Sparkles, Bookmark, Lock, Unlock } from "lucide-react";
import { CONDITION_PRESETS, type ConditionPresetKey } from "@/types/condition";
import { GENERATOR_FAMILIES, generateProposals, seededRandom, type GeneratedProposal, type GeneratorFamily, type GeneratorOptions } from "@/lib/character/workspace/discovery/procedural-generator";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
import { GeneratedIdeaPreview, generatedPieceSummary } from "./generated-idea-preview";
import "@/app/character-randomizer.css";
export type RandomizerHeritage = "LINEAGE" | "UPBRINGING" | "MANIFEST";
const SITUATIONS=CONDITION_PRESETS;
const situationLabels:Record<string,string>={"scene-dim":"In dim light","scene-has-obstacles":"Among obstacles","scene-hazardous":"In hazardous surroundings","actor-below-half-hp":"Below half Vitality","actor-damaged-last-round":"After taking damage last round"};
export function ProceduralRandomizer({graph,budget,category,onChoose}:{graph:WorkspaceGraph;budget:number;category:RandomizerHeritage;onChoose:(proposal:GeneratedProposal,category:RandomizerHeritage,target?:"middle"|"modal")=>void}){
 const phone = useIsMobile();
 const [catalog,setCatalog]=useState<DiscoveryCandidate[]|null>(null),[catalogError,setCatalogError]=useState("");
 const [includeEffects,setIncludeEffects]=useState(false),[includeCapabilities,setIncludeCapabilities]=useState(false),[includePrimitives,setIncludePrimitives]=useState(true);
 useEffect(()=>{let active=true;fetch(`/api/characters/${graph.characterId}/workspace/suggestions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({catalogOnly:true,budget:0,kinds:["primitive","effect","capability"]})}).then(async response=>{if(!response.ok)throw new Error("Library could not be loaded. Reopen Randomizer to retry.");return response.json();}).then(data=>{if(active)setCatalog(data.catalog);}).catch(error=>{if(active)setCatalogError(error.message);});return()=>{active=false;};},[graph.characterId]);
 const [kind,setKind]=useState<GeneratedProposal["kind"]>("primitive");
 const [family,setFamily]=useState<GeneratorFamily>("any");
 const [minimum,setMinimum]=useState("0"),[maximum,setMaximum]=useState(String(Math.min(25,Math.max(0,budget))));
 const [respectBudget,setRespectBudget]=useState(true),[reuseOwned,setReuseOwned]=useState(true);
 const [destination,setDestination]=useState(category),[condition,setCondition]=useState<ConditionPresetKey|""|"random"|"custom">("");
 const [authoredCondition,setAuthoredCondition]=useState(()=>conditionToAuthoring(null));
 const [mode,setMode]=useState<"mixed"|"ACTIVE"|"PASSIVE">("mixed");
 const [domain,setDomain]=useState<"none"|"flavor"|"mechanical">("flavor"),[verb,setVerb]=useState<"none"|"flavor"|"mechanical">("flavor");
 const [resolutionMode,setResolutionMode]=useState<"none"|"custom"|"random">("none");
 const [resolution,setResolution]=useState<RollResolution>({...EMPTY_RESOLUTION});
 const [range,setRange]=useState(true),[output,setOutput]=useState(true),[table,setTable]=useState(false);
 const [theme,setTheme]=useState(""),[shape,setShape]=useState(""),[source,setSource]=useState<"PHYSICAL"|"MAGICAL">("MAGICAL");
 const [minPieces,setMinPieces]=useState(1),[maxPieces,setMaxPieces]=useState(4),[count,setCount]=useState(3);
 const [seed,setSeed]=useState(""),[lastSeed,setLastSeed]=useState("");
 const [results,setResults]=useState<GeneratedProposal[]>([]),[history,setHistory]=useState<GeneratedProposal[]>([]),[saved,setSaved]=useState<GeneratedProposal[]>([]),[locks,setLocks]=useState<string[]>([]);
 const [view,setView]=useState<"results"|"saved"|"history">("results"),[seen,setSeen]=useState<string[]>([]),[notice,setNotice]=useState("");
 const min=Math.max(0,Number(minimum)||0),max=Math.max(0,Number(maximum)||0),allowance=respectBudget?Math.min(max,Math.max(0,budget)):max;
 const invalid=minimum.trim()==="" || maximum.trim()==="" || min>allowance;
 function generate(only?:string){
  if(invalid)return;
  const roll=seed.trim()||String(Date.now());setLastSeed(roll);const random=seededRandom(roll);
  const selectedCondition=condition==="random" ? SITUATIONS[Math.floor(random()*SITUATIONS.length)]?.key??"" : condition==="custom" ? "" : condition;
  const options:GeneratorOptions={...(catalog?{catalog}:{}),includeEffects,includeCapabilities,includePrimitives,kind,family,budget:allowance,minBudget:min,minPieces,maxPieces,reuseOwned,graph,condition:selectedCondition,authoredCondition:condition==="custom" ? buildCondition(authoredCondition) : null,domainMode:domain,verbMode:verb,includeRange:range,includeOutput:output,includeTable:table,...(resolutionMode==="custom"?{resolution}:{}),randomResolution:resolutionMode==="random",theme,shape,sourceType:source,capabilityMode:mode};
  const kept=only ? results.filter(item=>item.key!==only) : results.filter(item=>locks.includes(item.key));
  const slots=only?1:Math.max(0,count-kept.length);
  let next=generateProposals({...options,exclude:seed.trim()?kept.map(item=>item.key):seen},random,slots);
  if(!next.length && slots>0 && !seed.trim())next=generateProposals({...options,exclude:kept.map(item=>item.key)},random,slots);
  setResults([...kept,...next]);setHistory(current=>[...next,...current].filter((item,index,all)=>all.findIndex(other=>other.key===item.key)===index).slice(0,40));setSeen(current=>[...current,...next.map(item=>item.key)].slice(-500));setView("results");
  setNotice(next.length?`${next.length} new ${next.length===1?"idea":"ideas"} · ${Math.min(...next.map(item=>item.newBuCost))}–${Math.max(...next.map(item=>item.newBuCost))} new BU in this roll. ${selectedCondition?`Situation: ${situationLabels[selectedCondition] ?? selectedCondition}.`:""}`:kept.length===count?"Unlock an idea to replace it.":"No combination fits these constraints. Widen the budget, lower the piece count, or allow reuse. No prices have been guessed.");
 }
 const items=view==="saved"?saved:view==="history"?history:results;
 const toggleSaved=(proposal:GeneratedProposal)=>setSaved(current=>current.some(item=>item.key===proposal.key)?current.filter(item=>item.key!==proposal.key):[proposal,...current]);
 const check=(label:string,value:boolean,update:(value:boolean)=>void)=><label className="procedural-reuse"><input type="checkbox" checked={value} onChange={event=>update(event.target.checked)}/><span>{label}</span></label>;
 return <section className="procedural-randomizer" aria-label="Randomizer">
  <header><span className="v12-kicker">Inspiration · rules & compositions</span><h2>Find a possibility. Make it yours.</h2><p>Generate priced rules, combine them into effects and capabilities, or assemble a heritage or item. Open any result to name it, refine its mechanics, and choose its place in your character.</p></header>
  <div className="procedural-randomizer-controls">
   <fieldset><legend>What would you like to make?</legend><div className="discovery-kind-options">{(["primitive","effect","capability","heritage","item"] as const).map(value=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>{setKind(value);setLocks([]);}}>{value}</button>)}</div></fieldset>
   {!phone && <>   <label>Explore<select value={family} onChange={event=>setFamily(event.target.value as GeneratorFamily)}>{GENERATOR_FAMILIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
   <label>Destination / heritage type<select value={destination} onChange={event=>setDestination(event.target.value as RandomizerHeritage)}><option value="LINEAGE">Lineage · inherited nature</option><option value="UPBRINGING">Upbringing · learned tradition</option><option value="MANIFEST">Manifest · chosen path</option></select></label>
</>}
   <label>Minimum new BU<input aria-label="Minimum new BU" inputMode="numeric" value={minimum} onChange={event=>/^\d*$/.test(event.target.value)&&setMinimum(event.target.value)}/></label>
   <label>Maximum new BU<input aria-label="Maximum new BU" inputMode="numeric" value={maximum} onChange={event=>/^\d*$/.test(event.target.value)&&setMaximum(event.target.value)}/><small>{Math.max(0,budget)} BU available · generation limit {allowance}</small></label>
   {check("Stay within my available BU",respectBudget,setRespectBudget)}
   {kind!=="primitive" && check("Reuse exact matching rules already on my character",reuseOwned,setReuseOwned)}
  </div>
  <details className="procedural-options"><summary>Shape the inspiration <small>Theme, mechanics, situations, and optional play examples</small></summary><div className="procedural-randomizer-controls">
   {phone && <>   <label>Explore<select value={family} onChange={event=>setFamily(event.target.value as GeneratorFamily)}>{GENERATOR_FAMILIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
   <label>Destination / heritage type<select value={destination} onChange={event=>setDestination(event.target.value as RandomizerHeritage)}><option value="LINEAGE">Lineage · inherited nature</option><option value="UPBRINGING">Upbringing · learned tradition</option><option value="MANIFEST">Manifest · chosen path</option></select></label>
</>}
   <label>Theme or motif<input value={theme} maxLength={80} onChange={event=>setTheme(event.target.value)} placeholder="Fire, ice, mirrors, clockwork…"/><small>Flavor changes the story, never the rules or price.</small></label>
   <label>Situation<select value={condition} onChange={event=>setCondition(event.target.value as typeof condition)}><option value="">Always</option><option value="random">Random situation</option><option value="custom">Build my own condition…</option>{SITUATIONS.map(item=><option key={item.key} value={item.key}>{situationLabels[item.key] ?? item.label}</option>)}</select><small>Applies to newly generated numeric rules. Library pieces retain their own conditions; edit them in the builder. No automatic discount.</small></label>
   {condition==="custom" && <fieldset><legend>Applies when</legend><ConditionPicker value={authoredCondition} onChange={setAuthoredCondition}/><small>Use Self, Target, or Scene clauses, combine them with AND/OR, or write your own condition. Conditions do not automatically change prices.</small></fieldset>}
   {kind!=="primitive" && <fieldset><legend>Additional pieces from the Library</legend>{check("Include primitives",includePrimitives,setIncludePrimitives)}{["capability","item"].includes(kind) && check("Include nested effects",includeEffects,setIncludeEffects)}{["heritage","item"].includes(kind) && check("Include nested capabilities",includeCapabilities,setIncludeCapabilities)}<small>With reuse enabled, additional primitives come from your character; otherwise they come from the full Library. Nested effects and capabilities come from the Library. Each direct child counts as one additional piece. Nested primitive costs count once across the entire result. Owned rules are excluded from new BU for effects, capabilities, and heritages.</small></fieldset>}
   {kind!=="primitive" && <><label>Minimum additional pieces<EditableNumberInput type="number" min={kind==="capability"?0:1} max={8} value={minPieces} onChange={event=>{const n=Math.min(8,Math.max(kind==="capability"?0:1,Number(event.target.value)));setMinPieces(n);setMaxPieces(current=>Math.max(current,n));}}/></label><label>Maximum additional pieces<EditableNumberInput type="number" min={minPieces} max={8} value={maxPieces} onChange={event=>setMaxPieces(Math.min(8,Math.max(minPieces,Number(event.target.value))))}/></label></>}
   {kind==="capability" && <><label>Capability style<select value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="mixed">Active or passive</option><option value="ACTIVE">Active</option><option value="PASSIVE">Passive</option></select></label><label>Source<select value={source} onChange={event=>setSource(event.target.value as typeof source)}><option value="PHYSICAL">Physical</option><option value="MAGICAL">Magical</option></select></label>{([["Domain",domain,setDomain],["Verb",verb,setVerb]] as const).map(([label,value,update])=><label key={label}>{label}<select value={value} onChange={event=>update(event.target.value as typeof value)}><option value="none">Without {label.toLowerCase()}</option><option value="flavor">Flavor only</option><option value="mechanical">Include purchased access</option></select></label>)}{check("Include a range primitive",range,setRange)}{check("Include an output-die primitive",output,setOutput)}<p>Turning a piece off grants no range, die, domain, or action access. Existing access can be reused when the exact rule matches. The four reference slots do not count toward the additional-piece limits. Their costs still count toward the BU budget.</p></>}
   {kind==="capability" && <>{check("Add scaling options",table,setTable)}{table && <label>Suggested shape<input value={shape} maxLength={120} onChange={event=>setShape(event.target.value)} placeholder="Random, or specify star / spiral / crescent…"/><small>Targets, size, placement, duration, and timing are declarations. Greater intent may raise Strain.</small></label>}</>}
   <label>Ideas per roll<select value={count} onChange={event=>setCount(Number(event.target.value))}>{[1,3,5,8].map(value=><option key={value}>{value}</option>)}</select></label>
   {(kind==="capability" || kind==="effect") && <><label>Who rolls?<select value={resolutionMode} onChange={e=>setResolutionMode(e.target.value as typeof resolutionMode)}><option value="none">Do not include resolution</option><option value="random">Random resolution</option><option value="custom">Choose resolution</option></select></label>{resolutionMode==="custom" && <RollResolutionEditor value={resolution} onChange={setResolution}/>}</>}
   <label>Repeatable seed<input value={seed} maxLength={120} onChange={event=>setSeed(event.target.value)} placeholder="Leave blank for a fresh roll"/><small>Same setup, seed, and owned rules reproduce the roll.</small></label>
  </div></details>
  {invalid && <p role="alert">Enter a complete BU range with the minimum at or below {allowance}. Disable the available-BU limit to explore a future build.</p>}
  <button className="v12-metal-button procedural-generate" type="button" disabled={invalid || (kind!=="primitive" && !catalog)} onClick={()=>generate()}><Shuffle size={18}/>Generate ideas</button>
  {!catalog && <p role="status">{catalogError || "Loading the complete Library…"}</p>}
  <p role="status">{notice}</p>{lastSeed && <small>Last seed: {lastSeed} <button type="button" onClick={()=>setSeed(lastSeed)}>Use this seed</button></small>}
  <nav className="discovery-kind-options" aria-label="Generated ideas">{(["results","saved","history"] as const).map(tab=><button type="button" key={tab} aria-pressed={view===tab} onClick={()=>setView(tab)}>{tab} ({(tab==="results"?results:tab==="saved"?saved:history).length})</button>)}</nav>
  {view!=="results" && <small>Saved ideas and recent rolls stay here while this Randomizer is open. Open one in the builder to keep it in your recoverable editing draft.</small>}
  <div className="procedural-results">{items.map(proposal=><article key={proposal.key} className="v12-workspace-suggestion-card"><div className="procedural-result-heading"><Sparkles size={18}/><h3>{proposal.name}</h3><strong>{proposal.newBuCost} BU<small>budget used</small></strong></div><small>{proposal.kind} · {generatedPieceSummary(proposal)} · {proposal.buCost} BU definition{proposal.buCost>proposal.newBuCost ? ` · ${proposal.buCost-proposal.newBuCost} BU already owned` : ""}</small>{phone ? <details className="sheet-phone-section procedural-phone-details"><summary><strong>Pieces & resolution</strong><small>Inspect the rules in this result</small></summary><div><GeneratedIdeaPreview proposal={proposal}/></div></details> : <GeneratedIdeaPreview proposal={proposal}/>}<div className="procedural-card-actions"><button type="button" aria-pressed={saved.some(item=>item.key===proposal.key)} onClick={()=>toggleSaved(proposal)}><Bookmark size={16}/>{saved.some(item=>item.key===proposal.key)?"Saved":"Save idea"}</button>{view==="results" && <><button type="button" aria-pressed={locks.includes(proposal.key)} onClick={()=>setLocks(current=>current.includes(proposal.key)?current.filter(key=>key!==proposal.key):[...current,proposal.key])}>{locks.includes(proposal.key)?<Lock size={16}/>:<Unlock size={16}/>}Keep this roll</button><button type="button" disabled={invalid || locks.includes(proposal.key)} onClick={()=>generate(proposal.key)}><Shuffle size={16}/>Reroll this idea</button></>}</div><div className="procedural-edit-actions"><button type="button" className="v12-metal-button" onClick={()=>onChoose(proposal,destination,"middle")}>{phone ? "Main editor" : "Edit in middle"} <ArrowRight size={16}/></button><button type="button" className="v12-metal-button" onClick={()=>onChoose(proposal,destination,"modal")}>Edit in modal <ArrowRight size={16}/></button></div></article>)}</div>
  <p className="procedural-footnote">Prices come from authored Market recipes. No arbitrary bonus pricing and no AI. Preview and edit before adding; final review validates your character’s complete build.</p>
 </section>;
}
