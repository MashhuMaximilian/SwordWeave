"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { QUICK_RULE_FAMILIES, quickRuleOptions, type QuickRuleFamily, type QuickRuleSeed } from "@/lib/character/workspace/discovery/quick-rules";

export function QuickRuleBuilder({ budget, onBuild, onBuildOwn }: { budget: number; onBuild: (seed: QuickRuleSeed) => void; onBuildOwn?: () => void }) {
  const [family, setFamily] = useState<QuickRuleFamily>("DOMAIN_ACCESS");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const options = useMemo(() => quickRuleOptions(family), [family]);
  const matching = options.filter(option => !search.trim() || `${option.name} ${option.mechanicalOutputText} ${option.narrativeRule}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = options.find(option => option.key === choice) ?? matching[0];
  const affordable = matching.filter(option => option.buCost <= Math.max(0, budget));
  return <section className="discovery-quick-rule" aria-label="Build a rule">
    <p>Start with one priced rule, give it your own name, then open the builder to preview or refine it.</p>
    <div className="discovery-kind-options" aria-label="Kind of rule">{QUICK_RULE_FAMILIES.map(item => <button key={item.key} type="button" aria-pressed={family === item.key} onClick={() => { setFamily(item.key); setChoice(""); setSearch(""); }}>{item.label}</button>)}</div>
    <p>{QUICK_RULE_FAMILIES.find(item => item.key === family)?.explanation}</p>
    <label>Find a rule<input value={search} onChange={event => { setSearch(event.target.value); setChoice(""); }} placeholder={family === "DOMAIN_ACCESS" ? "Fire, memory, metal…" : "Search these rules…"} /></label>
    <div className="discovery-rule-choices" role="group" aria-label="Priced rule options">{matching.map(option => <button key={option.key} type="button" aria-pressed={selected?.key === option.key} onClick={() => setChoice(option.key)}><span>{option.name}</span><span>{option.buCost} BU</span></button>)}</div>
    {!matching.length && <p>No priced option matches. Try another word or use the full builder below.</p>}
    {selected && <article className="v12-workspace-suggestion-card discovery-rule-preview">
      <h4>{name.trim() || selected.name}</h4><p data-copy="mechanical">{selected.mechanicalOutputText}</p><p data-copy="narrative">{selected.narrativeRule}</p>
      <p className="discovery-cost">{selected.buCost} BU · {Math.max(0, budget)} BU available</p>
      {selected.buCost > Math.max(0, budget) && <p>This costs more than the current allowance. You can inspect it in the builder before deciding.</p>}
      <label>Your name for this rule <span>(optional)</span><input value={name} onChange={event => setName(event.target.value)} placeholder={selected.name} maxLength={200} /></label>
      <button type="button" className="discovery-shuffle" onClick={() => onBuild({ ...selected, name: name.trim() || selected.name })}>Customize & preview <ArrowRight size={14} /></button>
    </article>}
    <button type="button" disabled={!affordable.length} onClick={() => { const fresh = affordable.filter(option => option.key !== selected?.key); const pool = fresh.length ? fresh : affordable; setChoice(pool[Math.floor(Math.random() * pool.length)]!.key); }}><Shuffle size={14} />Suggest a priced rule</button>
    <p className="discovery-replacement-note">Prices and values come from the canonical Market. Attribute, Vitality, and other modifiers use different rules; this tool never scales them by guessing a BU cost.</p>
    {onBuildOwn && <button type="button" onClick={onBuildOwn}>Open full primitive builder</button>}
  </section>;
}
