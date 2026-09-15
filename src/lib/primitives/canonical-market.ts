import type { CanonicalMechanicalRule } from "./mechanical-rule";

export interface MarketFamilyDefinition {
  key: string;
  label: string;
  chapter: string;
  chapterOrder: number;
  familyOrder: number;
  categories: string[];
  aliases?: string[];
}

export interface MarketTemplateDefinition {
  key: string;
  name: string;
  familyKey: string;
  category: string;
  tier: number | null;
  buCost: number;
  bindingSchema: Record<string, unknown>;
  rule: CanonicalMechanicalRule;
  verboseDescription: string;
  standardBindings?: Array<{ key: string; name: string; bindings: Record<string, string> }>;
}

export interface CanonicalExpressionDefinition {
  key:string;
  name:string;
  familyKey:string;
  category:string;
  tier:number|null;
  buCost:number;
  mechanicalText:string;
  verboseDescription:string;
  modifier?:Record<string,unknown>;
}

export const MARKET_FAMILIES: readonly MarketFamilyDefinition[] = [
  { key:"VERB_ACCESS",label:"Verb Access",chapter:"Construction language",chapterOrder:1,familyOrder:1,categories:["VERB_TIER"] },
  { key:"DOMAIN_ACCESS",label:"Domain Access",chapter:"Construction language",chapterOrder:1,familyOrder:2,categories:["DOMAIN"] },
  { key:"STRUCTURE",label:"Structure",chapter:"Construction language",chapterOrder:1,familyOrder:3,categories:["STRUCTURAL"] },
  { key:"RANGE_SCALING",label:"Range Scaling",chapter:"Resolution and expression",chapterOrder:2,familyOrder:1,categories:["RANGE"] },
  { key:"SPEED_QUICKENING",label:"Speed and Quickening",chapter:"Resolution and expression",chapterOrder:2,familyOrder:2,categories:["SPEED_QUICKENING"] },
  { key:"DURATION_PERSISTENCE",label:"Duration and Persistence",chapter:"Resolution and expression",chapterOrder:2,familyOrder:3,categories:["DURATION"] },
  { key:"SEMANTIC_STATE",label:"Semantic State Tags",chapter:"Resolution and expression",chapterOrder:2,familyOrder:4,categories:["CONDITION"] },
  { key:"TARGETING_AOE",label:"Targeting Arrays and Dimensional Sizing",chapter:"Resolution and expression",chapterOrder:2,familyOrder:5,categories:["TARGETING","TARGETING_AOE"] },
  { key:"INTENSITY_DICE",label:"Intensity and Damage Dice",chapter:"Resolution and expression",chapterOrder:2,familyOrder:6,categories:["INTENSITY_DICE","OUTPUT"] },
  { key:"VITALITY",label:"Vitality Extension",chapter:"Character foundation",chapterOrder:3,familyOrder:1,categories:["VITALITY"] },
  { key:"PRACTICE_PROGRESSION",label:"Practice and Character Core Progression",chapter:"Character foundation",chapterOrder:3,familyOrder:2,categories:["PRACTICE_PROGRESSION_AUGMENT"] },
  { key:"UNIVERSAL_MODIFIERS",label:"Universal Mathematical Modifiers",chapter:"Character foundation",chapterOrder:3,familyOrder:3,categories:["SHEET_AUGMENT"] },
  { key:"PROBABILITY_BIAS",label:"Advantage and Probability Bias",chapter:"Character foundation",chapterOrder:3,familyOrder:4,categories:["PROBABILITY_BIAS"] },
  { key:"PERCEPTION",label:"Perception and Detection Qualifiers",chapter:"Character foundation",chapterOrder:3,familyOrder:5,categories:["PERCEPTION_QUALIFIER"] },
  { key:"SENSORY_ARRAY",label:"Sensory Arrays and Informational Horizons",chapter:"Character foundation",chapterOrder:3,familyOrder:6,categories:["SENSORY_ARRAY"] },
  { key:"MOBILITY",label:"Spatial Mobility and Kinematic Locomotion",chapter:"Character foundation",chapterOrder:3,familyOrder:7,categories:["MOBILITY_LOCOMOTION"] },
  { key:"DEFENSES",label:"Structural Defenses and Passive Mitigations",chapter:"Character foundation",chapterOrder:3,familyOrder:8,categories:["DEFENSE","DEFENSIVE"] },
  { key:"TRIGGER_HOOKS",label:"Runtime Trigger Hooks",chapter:"System and reality",chapterOrder:4,familyOrder:1,categories:["TRIGGER_HOOK"] },
  { key:"KINETIC_CONTROL",label:"Kinetic and Spatial Control",chapter:"System and reality",chapterOrder:4,familyOrder:2,categories:["KINETIC_CONTROL"] },
  { key:"AGENCY_INFORMATION",label:"Agency and Information Overrides",chapter:"System and reality",chapterOrder:4,familyOrder:3,categories:["AGENCY_OVERRIDE"] },
  { key:"METAMORPHOSIS",label:"Structural Metamorphosis",chapter:"System and reality",chapterOrder:4,familyOrder:4,categories:["METAMORPHOSIS"] },
  { key:"ACTION_ECONOMY",label:"Action Economy Alterations",chapter:"System and reality",chapterOrder:4,familyOrder:5,categories:["ACTION_ECONOMY"] },
  { key:"EVALUATION_STRAIN",label:"Capability Evaluation, Resource Strain, and Dial Management",chapter:"System and reality",chapterOrder:4,familyOrder:6,categories:["EVALUATION_STRAIN"] },
  { key:"TEMPORAL",label:"Temporal Ordering, Durations, and Stasis",chapter:"System and reality",chapterOrder:4,familyOrder:7,categories:["TEMPORAL_CHRONOLOGICAL"] },
  { key:"BOSS_ECONOMY",label:"Boss Action Economy and Encounter Rhythms",chapter:"System and reality",chapterOrder:4,familyOrder:8,categories:["BOSS_ECONOMY","TACTICAL"] },
  { key:"SIZE_SCALE",label:"Size Tier and Scale",chapter:"Additional families",chapterOrder:5,familyOrder:1,categories:["SIZING"] },
  { key:"SHEET_AUGMENT",label:"Sheet Augment",chapter:"Additional families",chapterOrder:5,familyOrder:2,categories:["SHEET_AUGMENT","CHARACTER_SHEET_AUGMENT"],aliases:["Character Sheet Augment"] },
  { key:"HERITAGE_AUGMENT",label:"Heritage Augment",chapter:"Additional families",chapterOrder:5,familyOrder:3,categories:["HERITAGE_AUGMENT"] },
  { key:"ITEM_AUGMENT",label:"Item Augment",chapter:"Additional families",chapterOrder:5,familyOrder:4,categories:["ITEM_AUGMENT"] },
] as const;

const DOMAIN_TIERS: Record<number, string[]> = {
  1:["fire","water","air","earth","metal","stone","wood","ice","lightning","light","darkness","gravity-local","motion","force","sound","heat","cold","pressure","friction","vibration","smell","taste","touch","weather-basic","terrain","biological-tissue","ecosystems-simple"],
  2:["life","decay","growth","memory","emotion","time-local","space-local","disease","evolution","energy-systems","magnetism","entropy","chaos-local","order","perception","language","motion-systems","adaptation","transformation","networks","resonance","balance","instability"],
  3:["consciousness","identity","will","intent","thought","belief","information","probability-local","fate","causality-bounded","narrative-structure","collective-memory","archetypes","emotional-ecosystems","societal-structures","conflict","law","hierarchy","corruption","purity","synchronization","divergence","coherence","entropy-systems","dimensional-interfaces","symbolic-systems"],
  4:["existence","non-existence","reality","causality-global","time-absolute","space-global","identity-existential","probability-fields","narrative-authority","rule-logic","paradox","void-structures","infinity","origin-states","termination-states","reality-layers","ontological-hierarchy","system-authorship","fundamental-laws"],
};

const title = (key:string) => key.toLowerCase().replaceAll("-"," ").replace(/\b\w/g, c=>c.toUpperCase());
const tierCost = (tier:number) => tier * 4;
const DOMAIN_DESCRIPTIONS = [
  "Grounded, directly observable domains: fire, water, air, earth, metal, stone, wood, ice, lightning, light, darkness, local gravity, motion, force, sound, heat, cold, pressure, friction, vibration, basic weather, terrain, simple tissue, and simple ecosystems.",
  "Hybrid physical and conceptual systems: life, decay, growth, memory, emotion, local time and space, disease, evolution, energy, magnetism, entropy, localized chaos, order, perception, language, adaptation, transformation, networks, resonance, balance, and instability.",
  "Abstract and systemic domains: consciousness, identity, will, intent, thought, belief, information, local probability, limited fate, bounded causality, narrative structure, collective memory, archetypes, societies, conflict, law, hierarchy, synchronization, and symbolic systems.",
  "Fundamental and reality-defining domains: existence, non-existence, reality, global causality, absolute time, global space, existential identity, probability fields, narrative authority, rule logic, paradox, void structures, origin and termination states, reality layers, and fundamental laws.",
] as const;
const VERB_DESCRIPTIONS = [
  "Ground-level interaction with reality. Includes move, strike, push, pull, lift, drop, interact, sense, observe, touch, grab, throw, break, hold, release, dodge, crawl, run, simple creation or destruction, and simple force application.",
  "Manipulation of existing states and properties. Includes alter, combine, separate, enhance, weaken, suppress, extend, compress, reshape, redirect, convert, stabilize, amplify, reduce, transfer, infuse, extract, bind, disrupt, channel, and change material state or energy flow.",
  "Control over the internal structure of systems and entities. Includes restructure, reconfigure, invert, synchronize, entangle, merge or split systems, override local rules, impose constraints, unlock latent states, collapse subsystems, and redirect bounded causal chains.",
  "Interaction with governing logic and abstract systems. Includes override or suspend rules, redefine interaction logic, enforce outcomes, rewrite constraints, negate conditions, alter causality, define exceptions, modify probability structures, reshape narrative causality, and redefine identity or existence within scope.",
] as const;

export const MARKET_TEMPLATES: readonly MarketTemplateDefinition[] = [
  ...[1,2,3,4].map((tier):MarketTemplateDefinition => ({
    key:`domain-access-${tier}`,
    name:`Domain Access Tier ${["","I","II","III","IV"][tier]}`,
    familyKey:"DOMAIN_ACCESS",category:"DOMAIN",tier,buCost:tierCost(tier),
    bindingSchema:{required:["domain"],slots:{domain:{kind:"keyword",open:true}}},
    rule:{family:"DOMAIN_ACCESS",bindings:{domain:null}},
    verboseDescription:DOMAIN_DESCRIPTIONS[tier-1]!,
    standardBindings:DOMAIN_TIERS[tier]!.map(key=>({key,name:`Domain of ${title(key)}`,bindings:{domain:key}})),
  })),
  ...[1,2,3,4].map((tier):MarketTemplateDefinition => ({
    key:`structure-${tier}`,
    name:`Structure Tier ${["","I","II","III","IV"][tier]}`,
    familyKey:"STRUCTURE",category:"STRUCTURAL",tier,buCost:tierCost(tier),
    bindingSchema:{required:["structure"],slots:{structure:{kind:"keyword",open:true}}},
    rule:{family:"DOCUMENTED",text:[
      "Apply through a [single-point structure]",
      "Apply through a [multi-target or basic spatial structure]",
      "Apply through a [complex adaptive spatial structure]",
      "Apply through a [systemic rule-driven structure]",
    ][tier-1]!},
    verboseDescription:[
      "Single-target, self, touch, line-of-sight, fixed-object, or direct point application.",
      "Small multi-target groups, chains, cones, radii, shaped areas, directional spreads, and fields.",
      "Expanding zones, moving fields, branching chains, conditional targets, layered regions, and reactive patterns.",
      "Global, scene-wide, priority, inclusion/exclusion, state-triggered, recursive, or changing target rules.",
    ][tier-1]!,
    standardBindings:[{
      key:["single-point","multi-target","adaptive-spatial","systemic-rule"][tier-1]!,
      name:["Single-point Structure","Multi-target Structure","Adaptive Spatial Structure","Systemic Rule Structure"][tier-1]!,
      bindings:{structure:["single-point","multi-target","adaptive-spatial","systemic-rule"][tier-1]!},
    }],
  })),
  {key:"attribute-increment",name:"Attribute Increment",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:3,buCost:12,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"ATTRIBUTE_INCREMENT",value:1,bindings:{attribute:null}},verboseDescription:"Permanently expands one core Attribute, subject to tier score limits.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Attribute Increment`,bindings:{attribute:key}}))},
  {key:"defensive-save-upgrade",name:"Defensive Save Upgrade",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"DEFENSIVE_SAVE",bindings:{attribute:null}},verboseDescription:"Adds full Proficiency Bonus to saves of one chosen Attribute.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Saving Throw Proficiency`,bindings:{attribute:key}}))},
  {key:"practice-proficiency",name:"Practice Proficiency",familyKey:"PRACTICE_PROGRESSION",category:"PRACTICE_PROGRESSION_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["practice"],slots:{practice:{kind:"enum",values:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"]}}},rule:{family:"PRACTICE_PROFICIENCY",bindings:{practice:null}},verboseDescription:"Establishes trained competence in one named Practice.",standardBindings:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Proficiency`,bindings:{practice:key}}))},
];

/** Finite rules that are useful as exact entries and do not need specialization. */
export const CANONICAL_EXPRESSIONS:readonly CanonicalExpressionDefinition[] = [
  ...[1,2,3,4].map((tier):CanonicalExpressionDefinition=>({
    key:`verb-access-${tier}`,name:`Verb Access Tier ${["","I","II","III","IV"][tier]}`,familyKey:"VERB_ACCESS",category:"VERB_TIER",tier,buCost:tierCost(tier),
    mechanicalText:"",
    verboseDescription:VERB_DESCRIPTIONS[tier-1]!,
  })),
  {key:"range-touch",name:"Touch Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:0,buCost:0,mechanicalText:"Set maximum range to Touch.",verboseDescription:"Immediate contact, self, or melee reach."},
  {key:"range-near",name:"Near Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:2,buCost:4,mechanicalText:"Set maximum range to Near (30 ft).",verboseDescription:"Standard combat range."},
  {key:"range-far",name:"Far Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:3,buCost:8,mechanicalText:"Set maximum range to Far (60 ft).",verboseDescription:"Extended tactical range."},
  {key:"range-very-far",name:"Very Far Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:4,buCost:12,mechanicalText:"Set maximum range to Very Far (120 ft).",verboseDescription:"Cross-battlefield influence."},
  {key:"range-extreme",name:"Extreme Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:5,buCost:24,mechanicalText:"Set maximum range to Extreme (240 ft–3 miles).",verboseDescription:"Scene-wide or near-remote presence."},
  {key:"die-d6",name:"Standard Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:1,buCost:2,mechanicalText:"Unlock 1d6 damage or healing output.",verboseDescription:"Fundamental output die; inherits the capability's execution source."},
  {key:"die-d8",name:"Heavy Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:2,buCost:4,mechanicalText:"Unlock 1d8 damage or healing output.",verboseDescription:"Standard martial or capability output cutoff."},
  {key:"die-d10",name:"Impact Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:3,buCost:8,mechanicalText:"Unlock 1d10 damage or healing output.",verboseDescription:"High-tier concentrated output."},
  {key:"die-d12",name:"Calamity Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:4,buCost:16,mechanicalText:"Unlock 1d12 damage or healing output.",verboseDescription:"Heavy Strain threat output."},
  {key:"die-d20",name:"Existential Tear",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:5,buCost:32,mechanicalText:"Unlock 1d20 damage or healing output.",verboseDescription:"Mythic, reality-breaking output."},
  ...(["TINY","SMALL","MEDIUM","LARGE","HUGE","GARGANTUAN"] as const).map((size,index)=>({
    key:`size-${size.toLowerCase()}`,name:`${title(size)} Size`,familyKey:"SIZE_SCALE",category:"SIZING",tier:index,buCost:0,
    mechanicalText:`Set Size to ${title(size)}.`,verboseDescription:`Sets character Size to ${title(size)}; Size determines base carry capacity and base movement.`,
    modifier:{kind:"modify",target:"size",operation:"set",value:{kind:"keyword",text:size},stacking:"highest-only",metadata:{recipient:"SELF"}},
  })),
  {key:"carry-capacity-10",name:"Carry Capacity Augment",familyKey:"SHEET_AUGMENT",category:"SHEET_AUGMENT",tier:1,buCost:2,mechanicalText:"Add +10 to Carry Capacity.",verboseDescription:"Increases how much Load the character can carry.",modifier:{kind:"modify",target:"carry_capacity",operation:"add",value:{kind:"number",value:10},stacking:"stack",metadata:{recipient:"SELF"}}},
  {key:"equip-slot-1",name:"Equipment Slot Augment",familyKey:"SHEET_AUGMENT",category:"SHEET_AUGMENT",tier:1,buCost:4,mechanicalText:"Add +1 to Equipment Slots.",verboseDescription:"Adds one slot to the default six equipped slots.",modifier:{kind:"modify",target:"equip_slot",operation:"add",value:{kind:"number",value:1},stacking:"stack",metadata:{recipient:"SELF"}}},
  {key:"item-load-1",name:"Item Load 1",familyKey:"ITEM_AUGMENT",category:"ITEM_AUGMENT",tier:0,buCost:0,mechanicalText:"Set Item Load to 1.",verboseDescription:"The item occupies one unit of the carrier's capacity.",modifier:{kind:"modify",target:"load",operation:"set",value:{kind:"number",value:1},stacking:"highest-only",metadata:{recipient:"SELF"}}},
];

export function familyForCategory(category:string):MarketFamilyDefinition|undefined {
  return MARKET_FAMILIES.find(family=>family.categories.includes(category));
}
