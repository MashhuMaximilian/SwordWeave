import {writeRollResolution, type RollResolution} from "@/lib/capabilities/roll-resolution";
import { DEFAULT_TABLE, writeTableGuidance } from "@/lib/capabilities/table-guidance";
import type { DiscoveryCandidate } from "./matching";
import { supplyPaths } from "../model";
import { quickRuleOptions, quickRuleFromLibrary, withQuickRuleCondition, withAuthoredRuleCondition, type QuickRuleSeed } from "./quick-rules";
import { mechanicalDescriptionFromModifiers, parseAuthorableCompositionRule } from "@/lib/primitives/mechanical-rule";
import type { HardModifier } from "@/types/swordweave";
import type { ConditionPresetKey, ModifierCondition } from "@/types/condition";
import type { WorkspaceGraph, EntityKey } from "../model";

export const GENERATOR_FAMILIES = [
  { key: "any", label: "Surprise me" }, { key: "practice", label: "Skills & training" },
  { key: "advantage", label: "Roll advantages" }, { key: "vitality", label: "Vitality" },
  { key: "defense", label: "Damage defenses" }, { key: "attribute", label: "Core attributes" },
  { key: "access", label: "Subjects & actions" }, { key: "equipment", label: "Carry & equipment" },
] as const;
export type GeneratorFamily = typeof GENERATOR_FAMILIES[number]["key"];
export interface GeneratedPiece { seed: QuickRuleSeed; ownedKey?: EntityKey }
export interface GeneratedProposal {
  key: string; kind: "primitive" | "capability" | "effect" | "heritage" | "item"; name: string; description: string;
  /** Complete definition cost, including any references already on the sheet. */
  buCost: number;
  /** Estimate of additional purchased pieces; final draft review remains authoritative. */
  newBuCost: number;
  pieces: GeneratedPiece[];
  libraryPieces?: DiscoveryCandidate[];
  capabilityType?: "ACTIVE" | "PASSIVE";
  sourceType?: "PHYSICAL" | "MAGICAL";
}
export interface GeneratorOptions {
  catalog?: DiscoveryCandidate[];
  includeEffects?: boolean; includeCapabilities?: boolean; includePrimitives?: boolean;
  kind: GeneratedProposal["kind"]; family: GeneratorFamily; budget: number;
  authoredCondition?: ModifierCondition | null;
  resolution?: RollResolution;
  randomResolution?: boolean;
  minBudget?: number; maxPieces?: number; minPieces?: number;
  domainMode?: "none"|"flavor"|"mechanical"; verbMode?: "none"|"flavor"|"mechanical";
  includeRange?: boolean; includeOutput?: boolean; includeTable?: boolean;
  theme?: string; shape?: string; sourceType?: "PHYSICAL"|"MAGICAL";
  capabilityMode?: "mixed"|"ACTIVE"|"PASSIVE";
  condition?: ConditionPresetKey | ""; reuseOwned?: boolean; graph?: WorkspaceGraph;
  /** Prior proposal keys to avoid repeating the same recipe combination. */
  exclude?: readonly string[];
}
const pretty = (text: string) => text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, value => value.toUpperCase());
const pick = <T,>(pool: readonly T[], random: () => number): T | undefined => pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
const stable = (input: unknown): string => JSON.stringify(input, (_key, value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);

function modifierSeed(key: string, name: string, category: string, familyKey: string, price: number, tier: number, modifier: HardModifier, narrativeRule: string): QuickRuleSeed {
  return { key, name, category, familyKey, buCost: price, costTier: `Tier ${tier}`, hardModifiers: [modifier as unknown as Record<string, unknown>], mechanicalOutputText: mechanicalDescriptionFromModifiers([modifier]), narrativeRule };
}
/** Finite Market recipes. Prices/amounts are the authored rows in scripts/seed-bu-market.ts,
 * not a guessed universal numeric formula. Each recipe binds the seed's required scope. */
export function proceduralRules(family: GeneratorFamily): QuickRuleSeed[] {
  const practices = quickRuleOptions("PRACTICES");
  const families: Record<Exclude<GeneratorFamily, "any">, QuickRuleSeed[]> = {
    practice: [...practices, ...quickRuleOptions("SAVING_THROWS")],
    advantage: practices.map(practice => {
      const scope = String(practice.mechanicalRule?.bindings?.["practice"]);
      return modifierSeed(`practice-advantage:${scope}`, `${pretty(scope.toLowerCase())} Instinct`, "PROBABILITY_BIAS", "PROBABILITY_BIAS", 6, 2,
        { kind: "modify", target: "skill_practice_check", operation: "grant", value: { kind: "keyword", text: "advantage" }, stacking: "unique-by-target", metadata: { recipient: "SELF", targetScope: { layer: "PRACTICE", values: [scope] } } },
        `Roll twice and keep the higher result on ${pretty(scope.toLowerCase())} checks. Binds Positive Bias II — Named Practice (6 BU) to this practice.`);
    }),
    vitality: ([{ amount: 5, cost: 4 }, { amount: 12, cost: 8 }, { amount: 20, cost: 12 }] as const).map(({ amount, cost }, index) => modifierSeed(`vitality:${amount}`, ["Steady Heart", "Enduring Heart", "Unyielding Heart"][index]!, "SHEET_AUGMENT", "VITALITY", cost, index + 1,
      { kind: "modify", target: "max_vitality", operation: "add", value: { kind: "number", value: amount }, stacking: "stack", metadata: { recipient: "SELF" } }, "A permanent increase to Max Vitality. Uses the exact amount and cost of the corresponding Vitality Core Augment.")),
    defense: ["fire", "cold", "lightning", "gravity"].flatMap(damage => ([{ multiplier: 0.5, cost: 8, title: "Ward", tier: 2 }, { multiplier: 0, cost: 20, title: "Immunity", tier: 4 }] as const).map(recipe => modifierSeed(`defense:${damage}:${recipe.multiplier}`, `${pretty(damage)} ${recipe.title}`, "DEFENSIVE", "STRUCTURAL_DEFENSES", recipe.cost, recipe.tier,
      { kind: "modify", target: "damage_modifier", operation: "multiply", value: { kind: "number", value: recipe.multiplier }, stacking: "unique-by-target", metadata: { recipient: "SELF", scopeName: damage, targetScope: { layer: null, values: [] } } },
      `Applies to ${damage} damage only. Binds ${recipe.multiplier === 0 ? "Absolute Insulation (20 BU)" : "Structural Hardening (8 BU)"} to one damage domain; it does not grant access to manipulate that domain.`))),
    attribute: quickRuleOptions("PRACTICE_PROGRESSION"),
    access: [...quickRuleOptions("DOMAIN_ACCESS"), ...quickRuleOptions("VERB_ACCESS"), ...quickRuleOptions("RANGE_SCALING"), ...quickRuleOptions("INTENSITY_DICE")],
    equipment: quickRuleOptions("SHEET_AUGMENT"),
  };
  return family === "any" ? Object.values(families).flat() : families[family];
}
function ownedEquivalent(seed: QuickRuleSeed, graph?: WorkspaceGraph): EntityKey | undefined {
  if (!graph) return undefined;
  return graph.nodes.find(node => {
    if (node.kind !== "primitive" || !supplyPaths(graph,node.key).some(path=>!path.item && !path.edges.some(edge=>edge.isMirrored))) return false;
    const row = node.data;
    const candidate = quickRuleFromLibrary({ id: Number(node.id), name: node.name, category: String(row["category"] ?? ""), familyKey: null, buCost: node.bu, costTier: String(row["costTier"] ?? ""), mechanicalOutputText: String(row["mechanicalOutputText"] ?? ""), narrativeRule: "", mechanicalRule: row["mechanicalRule"], hardModifiers: row["hardModifiers"] });
    if (!candidate || candidate.category !== seed.category) return false;
    // Composition permissions compare their whole rule; numeric rules compare complete typed modifiers,
    // including scope, recipient, stacking and conditions. A similar title is never enough.
    return seed.hardModifiers.length ? stable(candidate.hardModifiers) === stable(seed.hardModifiers) : !!seed.mechanicalRule && !(row["mechanicalRule"] as { conditionText?: string } | undefined)?.conditionText && stable(candidate.mechanicalRule) === stable(parseAuthorableCompositionRule(seed.mechanicalRule));
  })?.key;
}
function proposalFromPieces(kind: GeneratedProposal["kind"], seeds: QuickRuleSeed[], options: GeneratorOptions, name: string, description: string): GeneratedProposal {
  const pieces = seeds.map(seed => {
    const ownedKey = kind !== "primitive" && options.reuseOwned ? ownedEquivalent(seed, options.graph) : undefined;
    return { seed, ...(ownedKey ? { ownedKey } : {}) };
  });
  return { kind, key: `${kind}:${seeds.map(seed => seed.key).join("|")}`, name, description, pieces,
    buCost: pieces.reduce((sum, piece) => sum + piece.seed.buCost, 0),
    newBuCost: pieces.reduce((sum, piece) => sum + (piece.ownedKey ? 0 : piece.seed.buCost), 0),
    ...(kind === "capability" ? { capabilityType: "ACTIVE", sourceType: "MAGICAL" } as const : {}) };
}
/** Count each primitive definition once, including leaves inside nested entities. */
export function proposalBudget(pieces: GeneratedPiece[], library: DiscoveryCandidate[], options: GeneratorOptions, ownedKeys?: ReadonlySet<string>) {
 const leaves=new Map<string,{cost:number;owned:boolean}>();
 const owned=ownedKeys??new Set(options.reuseOwned && options.kind!=="primitive" && options.kind!=="item" ? options.graph?.nodes.filter(n=>n.kind==="primitive" && supplyPaths(options.graph!,n.key).some(p=>!p.item && !p.edges.some(e=>e.isMirrored))).map(n=>n.key) : []);
 for(const piece of pieces){const key=piece.ownedKey??piece.seed.key;leaves.set(key,{cost:piece.seed.buCost,owned:!!piece.ownedKey && options.kind!=="item"});}
 for(const entry of library) for(const leaf of entry.primitiveCosts?.length ? entry.primitiveCosts : [{key:entry.key,cost:entry.cost}]){
  const previous=leaves.get(leaf.key);leaves.set(leaf.key,{cost:leaf.cost,owned:owned.has(leaf.key)||!!previous?.owned});
 }
 return {buCost:[...leaves.values()].reduce((n,l)=>n+l.cost,0),newBuCost:[...leaves.values()].reduce((n,l)=>n+(l.owned?0:l.cost),0)};
}
/** A repeatable roll for sharing an inspiration setup, without an AI service. */
export function seededRandom(seed:string):()=>number {
 let state=2166136261;for(const char of seed)state=Math.imul(state^char.charCodeAt(0),16777619);
 return ()=>{state+=0x6D2B79F5;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}
/** Every piece comes from a priced canonical recipe; never extrapolate arbitrary bonuses. */
export function generateProposals(options: GeneratorOptions, random = Math.random, count = 3): GeneratedProposal[] {
 const budget=Number.isFinite(options.budget)?Math.max(0,options.budget):0;
 const minimum=Math.max(0,options.minBudget??0);
 if(minimum>budget || count<=0)return [];
 const ownedKeys=new Set(options.reuseOwned && options.kind!=="primitive" && options.kind!=="item" ? options.graph?.nodes.filter(n=>n.kind==="primitive" && supplyPaths(options.graph!,n.key).some(p=>!p.item && !p.edges.some(e=>e.isMirrored))).map(n=>n.key) : []);
 const results:GeneratedProposal[]=[];const seen=new Set(options.exclude??[]);
 const cache=new Map<string,EntityKey|undefined>();
 const cost=(seed:QuickRuleSeed)=>{if(options.reuseOwned && !cache.has(seed.key))cache.set(seed.key,ownedEquivalent(seed,options.graph));return options.kind!=="primitive" && options.kind!=="item" && cache.get(seed.key)?0:seed.buCost;};
 const conditioned=(seed:QuickRuleSeed)=>options.authoredCondition ? withAuthoredRuleCondition(seed,options.authoredCondition) : withQuickRuleCondition(seed,options.condition??"");
 const ruleGroups=(options.family==="any" ? GENERATOR_FAMILIES.filter(f=>f.key!=="any").map(f=>proceduralRules(f.key)):[proceduralRules(options.family)]).map(group=>group.map(conditioned));
 const domain=quickRuleOptions("DOMAIN_ACCESS"), verbs=quickRuleOptions("VERB_ACCESS"), ranges=quickRuleOptions("RANGE_SCALING"), outputs=quickRuleOptions("INTENSITY_DICE");
 for(let attempt=0;attempt<1200 && results.length<240;attempt++){
  const active=options.kind==="capability" && (options.capabilityMode==="ACTIVE" || (options.capabilityMode!=="PASSIVE" && (options.family==="access" || (options.family==="any" && attempt%2===0))));
  const seeds:QuickRuleSeed[]=[];let spent=0;
  const add=(pool:QuickRuleSeed[])=>{const eligible=pool.filter(seed=>!seeds.some(existing=>existing.key===seed.key) && spent+cost(seed)<=budget); const price=pick([...new Set(eligible.map(cost))],random); const chosen=pick(eligible.filter(seed=>cost(seed)===price),random);if(chosen){seeds.push(chosen);spent+=cost(chosen);}return !!chosen;};
  if(options.kind==="capability"){
   const required:QuickRuleSeed[][]=[];
   if((options.domainMode??"flavor")==="mechanical")required.push(domain);
   if((options.verbMode??"flavor")==="mechanical")required.push(verbs);
   if(options.includeRange===true || (active && options.includeRange!==false))required.push(ranges);
   if(options.includeOutput===true || (active && options.includeOutput!==false))required.push(outputs);
   let failed=false;
   for(let i=0;i<required.length;i++){const reserve=required.slice(i+1).reduce((sum,pool)=>sum+Math.min(...pool.map(cost)),0);if(!add(required[i]!.filter(seed=>spent+cost(seed)+reserve<=budget))){failed=true;break;}}
   if(failed)continue;
  }
  const minParts=options.kind==="primitive"?1:Math.max(options.kind==="capability"?0:1,Math.min(8,options.minPieces??1));
  const maxParts=options.kind==="primitive"?1:Math.max(minParts,Math.min(8,options.maxPieces??(options.kind==="heritage"?4:3)));
  const referenceCount=seeds.length;
  const target=referenceCount+minParts+Math.floor(random()*(maxParts-minParts+1));
  const libraryPieces:DiscoveryCandidate[]=[];
  if(options.catalog && options.kind!=="primitive") {
   const allowed=options.catalog.filter(entry=>
    (entry.kind==="primitive" && options.includePrimitives!==false && (options.kind!=="capability" || !["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"].includes(entry.ruleSeed?.familyKey??entry.family))) ||
    (entry.kind==="effect" && options.includeEffects && ["capability","item"].includes(options.kind)) ||
    (entry.kind==="capability" && options.includeCapabilities && ["heritage","item"].includes(options.kind)));
   // The reuse switch selects the character as the source of additional primitives.
   const ownedEntries=options.reuseOwned && options.graph ? options.graph.nodes.filter(node=>node.kind==="primitive" && (ownedKeys.has(node.key) || (options.kind==="item" && supplyPaths(options.graph!,node.key).some(p=>!p.item && !p.edges.some(e=>e.isMirrored))))).map(node=>({key:node.key,kind:node.kind,name:node.name,description:node.description??"",mechanicalDescription:String(node.data["mechanicalOutputText"]??""),tags:[],family:String(node.data["familyKey"]??""),structuredRules:"",origin:"community" as const,cost:node.bu,versionNumber:null,primitiveCosts:[{key:node.key,cost:node.bu}]})) : [];
   const primitives=options.reuseOwned ? ownedEntries.filter(e=>options.kind!=="capability" || !["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"].includes(options.catalog?.find(c=>c.key===e.key)?.ruleSeed?.familyKey??String(options.graph?.nodes.find(n=>n.key===e.key)?.data["familyKey"]??""))) : allowed.filter(e=>e.kind==="primitive");
   const pool=[...allowed.filter(e=>e.kind!=="primitive"),...(options.includePrimitives!==false?primitives:[])].filter(e=>Number.isFinite(e.cost));
   for(let n=referenceCount;n<target;n++) {
    const base=proposalFromPieces(options.kind,seeds,options,"","");
    const eligible=pool.filter(e=>!libraryPieces.some(p=>p.key===e.key) && !base.pieces.some(p=>p.ownedKey===e.key) && proposalBudget(base.pieces,[...libraryPieces,e],options,ownedKeys).newBuCost<=budget);
    const chosen=pick(eligible,random);
    if(!chosen)break;libraryPieces.push(chosen);
   }
   if(libraryPieces.length!==target-referenceCount)continue;
  } else {
   for(let n=seeds.length;n<target;n++){const pool=ruleGroups.flat().filter(seed=>options.kind!=="capability" || (!["DOMAIN_ACCESS","VERB_ACCESS","RANGE_SCALING","INTENSITY_DICE"].includes(seed.familyKey)));if(!add(pool))break;}
   if(seeds.length!==target)continue;
  }
  if(!seeds.length && !libraryPieces.length)continue;
  const theme=options.theme?.trim() || pick(["Ember","Winter","Echo","Moon","Storm","Glass","Thorn","Tide","Copper","Dawn"],random)!;
  const core=seeds[0];
  const suffix=options.kind==="item"?pick(["Relic","Tool","Charm"],random):options.kind==="heritage"?pick(["Legacy","Tradition","Path"],random):options.kind==="effect"?pick(["Resonance","Mark","Imprint"],random):active?pick(["Pulse","Arc","Star","Bloom"],random):pick(["Discipline","Instinct","Gift"],random);
  const name=options.kind==="primitive" ? core!.name : `${theme} ${suffix}`;
  let description=options.kind==="primitive" ? core!.narrativeRule : `${name} combines the rules below. ${options.kind==="item" ? "An item assembled from these pieces; choose its type and equipment details in the builder." : options.kind==="heritage" ? "Describe the inherited nature, learned tradition, or chosen path that connects these traits." : options.kind==="effect" ? "A reusable mechanical effect; describe how its pieces work together when included in a capability." : active ? "Declare the intended action, then resolve the relevant purchased rules." : "A passive talent expressed through these rules."}`;
  if(options.kind==="capability" && (options.domainMode??"flavor")==="flavor")description+=`\n\nFlavor domain: ${theme}. Its appearance is flavor; it grants no domain access.`;
  if(options.kind==="capability" && (options.verbMode??"flavor")==="flavor")description+=`\n\nFlavor verb: ${pick(["Strike","Reveal","Protect","Transform","Mend","Move"],random)}. Narrative verbs grant no purchased action tier.`;
  const resolution=options.randomResolution ? pick<RollResolution>([{mode:"action",check:"Attack roll",dc:"Target’s defense",outcome:""},{mode:"save",check:pick(["Physical save","Mental save","Magical save"],random)!,dc:"My corresponding DC",outcome:""},{mode:"practice",check:pick(["Awareness","Fieldcraft"],random)!,dc:"An agreed DC",outcome:""},{mode:"automatic",check:"",dc:"",outcome:"Resolves as described."}],random) : options.resolution;
  if(resolution && (options.kind==="capability" || options.kind==="effect")) description=writeRollResolution(description,resolution);
  if(options.includeTable && options.kind==="capability") description=writeTableGuidance(description,{...DEFAULT_TABLE,shape:options.shape?.trim() || pick(["Cone","Sphere","Star","Crescent","Branching arc","Ring"],random)!,target:pick(["Single","Multiple","Area"],random)!,placement:pick(["Self","Target","Point"],random)!,duration:pick(["Instant","Short","Scene"],random)!,casting:pick(["Action","Reaction"],random)!});
  const proposal=proposalFromPieces(options.kind,seeds,options,name,description);
  proposal.libraryPieces=libraryPieces;
  Object.assign(proposal,proposalBudget(proposal.pieces,libraryPieces,options,ownedKeys));
  proposal.key += libraryPieces.map(p=>p.key).join("|");
  proposal.key += `:${stable({theme:options.theme??"",table:options.includeTable??false,shape:options.shape??"",resolution,domain:options.domainMode,verb:options.verbMode,active})}`;
  if(options.kind==="capability"){proposal.capabilityType=active?"ACTIVE":"PASSIVE";proposal.sourceType=options.sourceType??(active?"MAGICAL":"PHYSICAL");}
  if(proposal.newBuCost<minimum || proposal.newBuCost>budget || seen.has(proposal.key))continue;
  seen.add(proposal.key);results.push(proposal);
 }
 // Sample the attainable price span, not the first valid (usually cheap) candidates.
 const selected:GeneratedProposal[]=[];
 const remaining=[...results];const wanted=Math.max(0,Math.min(8,count));
 const costs=results.map(item=>item.newBuCost);const low=Math.min(...costs),high=Math.max(...costs);
 for(let index=0;index<wanted && remaining.length;index++){
  const target=low+(high-low)*(index+random())/wanted;
  const distance=Math.min(...remaining.map(item=>Math.abs(item.newBuCost-target)));
  const proposal=pick(remaining.filter(item=>Math.abs(item.newBuCost-target)===distance),random)!;
  selected.push(proposal);remaining.splice(remaining.indexOf(proposal),1);
 }
 return selected;
}
