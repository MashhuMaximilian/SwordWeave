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

export const MARKET_TEMPLATES: readonly MarketTemplateDefinition[] = [
  ...[1,2,3,4].map((tier):MarketTemplateDefinition => ({
    key:`domain-access-${tier}`,
    name:`Domain Access Tier ${["","I","II","III","IV"][tier]}`,
    familyKey:"DOMAIN_ACCESS",category:"DOMAIN",tier,buCost:tierCost(tier),
    bindingSchema:{required:["domain"],slots:{domain:{kind:"keyword",open:true}}},
    rule:{family:"DOMAIN_ACCESS",bindings:{domain:null}},
    verboseDescription:`Tier ${tier} domain permission defined by the canonical BU Market.`,
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
  })),
  {key:"attribute-increment",name:"Attribute Increment",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:3,buCost:12,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"ATTRIBUTE_INCREMENT",value:1,bindings:{attribute:null}},verboseDescription:"Permanently expands one core Attribute, subject to tier score limits.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Attribute Increment`,bindings:{attribute:key}}))},
  {key:"defensive-save-upgrade",name:"Defensive Save Upgrade",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"DEFENSIVE_SAVE",bindings:{attribute:null}},verboseDescription:"Adds full Proficiency Bonus to saves of one chosen Attribute.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Saving Throw Proficiency`,bindings:{attribute:key}}))},
  {key:"practice-proficiency",name:"Practice Proficiency",familyKey:"PRACTICE_PROGRESSION",category:"PRACTICE_PROGRESSION_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["practice"],slots:{practice:{kind:"enum",values:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"]}}},rule:{family:"PRACTICE_PROFICIENCY",bindings:{practice:null}},verboseDescription:"Establishes trained competence in one named Practice.",standardBindings:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Proficiency`,bindings:{practice:key}}))},
];

export function familyForCategory(category:string):MarketFamilyDefinition|undefined {
  return MARKET_FAMILIES.find(family=>family.categories.includes(category));
}
