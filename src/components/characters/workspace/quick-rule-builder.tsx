"use client";
import { readJsonResponse } from "@/lib/http/read-json-response";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { CONDITION_PRESETS, type ConditionPresetKey } from "@/types/condition";
import type { DiscoveryCandidate } from "@/lib/character/workspace/discovery/matching";
import { drawQuickRule, withQuickRuleCondition, quickRuleMatchesFamily, QUICK_RULE_FAMILIES, quickRuleOptions, type QuickRuleFamily, type QuickRuleSeed } from "@/lib/character/workspace/discovery/quick-rules";

const SITUATIONS = CONDITION_PRESETS.filter(preset => ["scene-dim", "scene-has-obstacles", "scene-hazardous", "actor-below-half-hp", "actor-damaged-last-round", "target-has-cover"].includes(preset.key));

export function QuickRuleBuilder({ characterId, budget, onBuild, onBuildOwn, onExplore }: { characterId: string; onExplore?: () => void; budget: number; onBuild: (seed: QuickRuleSeed) => void; onBuildOwn?: () => void }) {
  const [family, setFamily] = useState<QuickRuleFamily | "all">("PRACTICES");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState<QuickRuleSeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condition, setCondition] = useState<ConditionPresetKey | "">("");
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/characters/${characterId}/workspace/suggestions`, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogOnly: true, budget: 0, kinds: ["primitive"] }) })
      .then(async response => { const data = await readJsonResponse(response); if (!response.ok) throw new Error(data.error || "Library suggestions unavailable."); return data.catalog as DiscoveryCandidate[]; })
      .then(catalog => { if (!controller.signal.aborted) setLibrary(catalog.flatMap(item => item.ruleSeed ? [item.ruleSeed] : [])); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Library suggestions unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [characterId]);
  const options = useMemo(() => {
    const canonical = family === "all" ? QUICK_RULE_FAMILIES.flatMap(item => quickRuleOptions(item.key)) : quickRuleOptions(family);
    const copied = library.filter(option => family === "all" || quickRuleMatchesFamily(option, family));
    return [...new Map([...canonical, ...copied].map(option => [option.key, option])).values()];
  }, [family, library]);
  const matching = options.filter(option => !search.trim() || `${option.name} ${option.mechanicalOutputText} ${option.narrativeRule}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = options.find(option => option.key === choice) ?? matching[0];
  const canCondition = !!selected?.hardModifiers.length && !selected.hardModifiers.some(modifier => modifier["condition"]);
  const prepared = selected ? withQuickRuleCondition(selected, canCondition ? condition : "") : undefined;
  const affordable = matching.filter(option => option.buCost <= Math.max(0, budget));
  return <section className="discovery-quick-rule" aria-label="Build a rule">
    <p>Choose what you want to improve. Start from a priced rule, optionally give it a situation and a name, then refine it in the builder.</p>
    <div className="discovery-kind-options" aria-label="Kind of rule"><button type="button" aria-pressed={family === "all"} onClick={() => { setFamily("all"); setChoice(""); setSearch(""); setSeen([]); setCondition(""); }}>Surprise me · all rules</button>{QUICK_RULE_FAMILIES.map(item => <button key={item.key} type="button" aria-pressed={family === item.key} onClick={() => { setFamily(item.key); setChoice(""); setSearch(""); setSeen([]); setCondition(""); }}>{item.label}</button>)}</div>
    {loading && <p role="status">Loading more priced rules from System and Community…</p>}
    {error && <p role="alert">{error} Canonical starting rules are still available.</p>}
    <p>{QUICK_RULE_FAMILIES.find(item => item.key === family)?.explanation ?? "Shuffle across every available rule family, with small families given a fair chance."}</p>
    <label>Find a rule<input value={search} onChange={event => { setSearch(event.target.value); setChoice(""); }} placeholder={family === "DOMAIN_ACCESS" ? "Fire, memory, metal…" : "Search these rules…"} /></label>
    <div className="discovery-rule-choices" role="group" aria-label="Priced rule options">{matching.map(option => <button key={option.key} type="button" aria-pressed={selected?.key === option.key} onClick={() => { setChoice(option.key); setCondition(""); }}><span>{option.name}{option.source === "library" ? " · Library" : ""}</span><span>{option.buCost} BU</span></button>)}</div>
    {!matching.length && <p>No priced option matches. Try another word or use the full builder below.</p>}
    {selected && prepared && <article className="v12-workspace-suggestion-card discovery-rule-preview">
      <h4>{name.trim() || selected.name}</h4><p data-copy="mechanical">{prepared.mechanicalOutputText}</p><p data-copy="narrative">{prepared.narrativeRule}</p>
      <p className="discovery-cost">{selected.buCost} BU · {Math.max(0, budget)} BU available</p>
      {selected.buCost > Math.max(0, budget) && <p>This costs more than the current allowance. You can inspect it in the builder before deciding.</p>}
      {canCondition && <fieldset className="discovery-condition-options"><legend>Only in this situation <span>(optional)</span></legend><div className="discovery-kind-options"><button type="button" aria-pressed={!condition} onClick={() => setCondition("")}>Always</button>{SITUATIONS.map(preset => <button key={preset.key} type="button" title={preset.hint} aria-pressed={condition === preset.key} onClick={() => setCondition(preset.key)}>{preset.label.replace("Actor", "You").replace("HP", "Vitality")}</button>)}<button type="button" onClick={() => { const alternatives = SITUATIONS.filter(preset => preset.key !== condition); const next = alternatives[Math.floor(Math.random() * alternatives.length)]; if (next) setCondition(next.key); }}><Shuffle size={14} />Shuffle situation</button></div><small>Conditions limit when a rule applies. They do not automatically reduce its price. Edit or combine situations in the full builder.</small></fieldset>}
      {!canCondition && selected.hardModifiers.some(modifier => modifier["condition"]) && <p>This rule already has a condition. The builder preserves it so you can inspect or edit it.</p>}
      <label>Your name for this rule <span>(optional)</span><input value={name} onChange={event => setName(event.target.value)} placeholder={selected.name} maxLength={200} /></label>
      <button type="button" className="discovery-shuffle" onClick={() => onBuild({ ...prepared, name: name.trim() || selected.name })}>Customize & preview <ArrowRight size={14} /></button>
    </article>}
    <button type="button" disabled={!affordable.length} onClick={() => { const next = drawQuickRule(affordable, seen, selected?.key); if (next) { setChoice(next.key); setSeen(keys => [...keys, next.key]); setCondition(""); } }}><Shuffle size={14} />Suggest a priced rule</button>
    <p className="discovery-replacement-note">Values and prices come from the canonical Market or an existing System or Community rule. A point of an attribute is not priced like a point of Vitality. Nothing is added until you finish the builder.</p>
    {onExplore && <button type="button" onClick={onExplore}>Explore complete effects, capabilities & heritage bundles</button>}
    {onBuildOwn && <button type="button" onClick={onBuildOwn}>Open full primitive builder</button>}
  </section>;
}
