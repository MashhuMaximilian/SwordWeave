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
  standardBindings?: Array<{ key: string; name: string; bindings: Record<string, string>; verboseDescription?: string }>;
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
const DOMAIN_MEANINGS:Record<string,string> = {
  fire:"flame, combustion, ignition, and the transfer of heat through burning material",
  water:"liquid water, its flow, pressure, shape, and changes between liquid, ice, and vapor",
  air:"air and other ordinary gases, including currents, gusts, pockets, and breathable atmosphere",
  earth:"soil, clay, sand, and natural ground, including their movement, compaction, and stability",
  metal:"metals and alloys, including their location, shape, temperature, joining, separation, and movement",
  stone:"natural and worked stone, including its shape, fractures, density, and movement",
  wood:"living or worked wood, including grain, growth, moisture, shape, and structural integrity",
  ice:"frozen water, including its formation, melting, shape, brittleness, and movement",
  lightning:"electrical discharge, charge separation, conductive paths, and lightning-like arcs",
  light:"visible light, brightness, color, reflection, refraction, and ordinary optical concealment",
  darkness:"the absence or suppression of visible light, including shadows and obscured sight",
  "gravity-local":"gravity within a bounded area, including weight, falling direction, attraction, and local orientation",
  motion:"the speed, direction, momentum, and rest state of directly observed creatures and objects",
  force:"pushes, pulls, impacts, tension, compression, and other directly applied physical forces",
  sound:"audible vibration, including volume, pitch, direction, resonance, and the transmission of speech or noise",
  heat:"temperature and thermal transfer apart from combustion, including warming, cooling, and heat gradients",
  cold:"the removal of heat and the effects of low temperature, including chilling and freezing",
  pressure:"pressure in gases and liquids, including compression, decompression, currents, shock fronts, and pressure differences",
  friction:"resistance between contacting surfaces, including grip, traction, drag, and sliding",
  vibration:"repeating mechanical motion through objects or media, including tremors, oscillation, and resonance",
  smell:"airborne scent and odor, including its presence, intensity, masking, and trail",
  taste:"flavor and taste-bearing substances, including detection, alteration, and masking",
  touch:"tactile qualities such as texture, contact, temperature, pressure, and surface sensation",
  "weather-basic":"ordinary local weather such as wind, rain, fog, humidity, temperature, and cloud cover",
  terrain:"the traversable shape and condition of local ground, including slopes, footing, obstacles, and cover",
  "biological-tissue":"simple living tissue such as skin, muscle, blood, bone, and plant matter, without controlling a whole organism",
  "ecosystems-simple":"small local ecosystems and their immediate relationships among organisms, nutrients, habitat, and environmental balance",
  life:"living processes across a whole organism, including vitality, healing, metabolism, and biological activity",
  decay:"decomposition, corrosion, rot, and the progressive breakdown of organic or constructed material",
  growth:"development and increase in living or organized structures, including maturation, repair, and expansion",
  memory:"stored personal recollection, recall, forgetting, and the association of experiences",
  emotion:"emotional states and their intensity, expression, suppression, and transition",
  "time-local":"the rate, sequence, and duration of events inside a bounded local area",
  "space-local":"distance, position, adjacency, and geometry inside a bounded local area",
  disease:"pathological biological processes, infection, symptoms, transmission, and recovery",
  evolution:"heritable biological adaptation and the directed development of traits across generations",
  "energy-systems":"generation, storage, transfer, conversion, and loss within bounded energy systems",
  magnetism:"magnetic fields, poles, attraction, repulsion, and their effects on susceptible material",
  entropy:"the tendency of a bounded system toward disorder, dissipation, degradation, and irreversible change",
  "chaos-local":"unpredictable variation and unstable outcomes inside a bounded system without rewriting global reality",
  order:"organization, regularity, pattern, and the stabilization of a bounded system",
  perception:"the processes by which a creature receives and interprets sensory information",
  language:"spoken, written, signed, or symbolic language, including comprehension, expression, and translation",
  "motion-systems":"coordinated movement across mechanisms, groups, or linked bodies rather than one object alone",
  adaptation:"a living or organized system changing its behavior or structure in response to conditions",
  transformation:"a bounded entity changing form, state, composition, or function while remaining meaningfully continuous",
  networks:"connected nodes and the paths, traffic, dependencies, and signals that pass between them",
  resonance:"systems reinforcing or cancelling one another through matched patterns, frequencies, or states",
  balance:"dynamic equilibrium among competing forces, resources, states, or participants",
  instability:"a bounded system becoming sensitive, volatile, or prone to cascading change",
  consciousness:"awareness and subjective experience, including wakefulness, attention, and conscious perception",
  identity:"the properties by which a person or thing recognizes and remains itself",
  will:"deliberate resolve, resistance, self-direction, and the capacity to persist in a chosen course",
  intent:"a creature's immediate purpose or planned direction of action, distinct from its private memories",
  thought:"ideas, attention, reasoning, and bounded mental information within a conscious mind",
  belief:"convictions a mind accepts as true, including their strength, conflict, and influence on interpretation",
  information:"encoded facts, signals, records, and their availability, transmission, concealment, or corruption",
  "probability-local":"the likelihood of outcomes within a bounded event or scene, without determining global fate",
  fate:"limited destined outcomes, omens, and the paths by which a subject approaches an appointed result",
  "causality-bounded":"cause-and-effect links within a defined chain of events, including interruption, redirection, and substitution",
  "narrative-structure":"roles, beats, themes, and relationships that organize a bounded story or situation",
  "collective-memory":"memories preserved across a community, culture, institution, or shared psychic field",
  archetypes:"recurring symbolic roles and patterns such as hero, guardian, trickster, sacrifice, or rebirth",
  "emotional-ecosystems":"the interacting moods, pressures, attachments, and feedback loops within a group",
  "societal-structures":"institutions, customs, roles, resources, and relationships that organize a society",
  conflict:"opposition among goals, forces, or groups, including escalation, stalemate, leverage, and resolution",
  law:"formal or metaphysical rules of obligation, permission, prohibition, judgment, and enforcement",
  hierarchy:"rank, authority, dependency, and command relationships within an organized system",
  corruption:"the progressive distortion of a system away from its intended form, purpose, or integrity",
  purity:"the preservation or restoration of a defined essence free from contamination or incompatible influence",
  synchronization:"separate processes aligning their timing, phase, decisions, or state changes",
  divergence:"linked paths, copies, or systems separating into distinct states or outcomes",
  coherence:"parts of a system remaining mutually consistent, intelligible, and stable as a whole",
  "entropy-systems":"entropy across interacting systems, including cascading disorder, dissipation, and systemic collapse",
  "dimensional-interfaces":"boundaries and connections between spaces, planes, dimensions, or incompatible geometries",
  "symbolic-systems":"runes, codes, rituals, signs, and other rule-bearing symbols whose arrangement carries meaning",
  existence:"whether an entity or property exists at all and the conditions that sustain its presence",
  "non-existence":"absence, erasure, and states in which an entity or property no longer participates in reality",
  reality:"the underlying state of what is real, including direct alteration of facts beyond ordinary transformation",
  "causality-global":"cause and effect across unbounded chains, allowing foundational events and consequences to be rewritten",
  "time-absolute":"time as a fundamental order, including its global flow, sequence, beginning, suspension, and end",
  "space-global":"space as a fundamental framework, including global distance, topology, adjacency, and extent",
  "identity-existential":"the fundamental identity that makes an entity itself across forms, histories, copies, and realities",
  "probability-fields":"broad probability structures that govern classes of outcomes rather than one local event",
  "narrative-authority":"authority over which events, roles, and resolutions reality accepts as part of its governing story",
  "rule-logic":"the rules and logical constraints by which systems and reality permit, forbid, and resolve actions",
  paradox:"self-contradictory states and causal loops that ordinary rules cannot resolve consistently",
  "void-structures":"organized absence outside normal matter and space, including gaps, null regions, and boundaries of nothingness",
  infinity:"unbounded quantity, extent, recursion, or continuation beyond finite system limits",
  "origin-states":"the foundational initial conditions from which an entity, system, timeline, or rule begins",
  "termination-states":"the final conditions under which an entity, process, timeline, or rule definitively ends",
  "reality-layers":"overlapping levels or versions of reality and the boundaries, precedence, and interaction between them",
  "ontological-hierarchy":"the ordering of kinds of existence, including which realities, entities, or rules take precedence",
  "system-authorship":"the power to define, revise, or replace the systems that govern other rules and entities",
  "fundamental-laws":"the deepest principles that constrain reality, such as conservation, identity, causation, and possibility",
};
const domainDescription=(key:string,tier:number) => `This Tier ${["","I","II","III","IV"][tier]} domain covers ${DOMAIN_MEANINGS[key] ?? title(key).toLowerCase()}. It grants vocabulary for building capabilities about this subject; the chosen verb tier, range, structure, targeting, duration, and other primitives determine the specific action and limits.`;
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
    standardBindings:DOMAIN_TIERS[tier]!.map(key=>({key,name:`Domain of ${title(key)}`,bindings:{domain:key},verboseDescription:domainDescription(key,tier)})),
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
  {key:"attribute-increment",name:"Attribute Increment",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:3,buCost:12,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"ATTRIBUTE_INCREMENT",value:1,bindings:{attribute:null}},verboseDescription:"Permanently expands one core Attribute, subject to tier score limits.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Attribute Increment`,bindings:{attribute:key},verboseDescription:`Permanently increase ${title(key)} by 1. This raises the attribute itself, so every check, defense, capacity, or derived value based on ${title(key)} uses the new score, subject to tier score limits.`}))},
  {key:"defensive-save-upgrade",name:"Defensive Save Upgrade",familyKey:"PRACTICE_PROGRESSION",category:"SHEET_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["attribute"],slots:{attribute:{kind:"enum",values:["PHYSICAL","MENTAL","MAGICAL"]}}},rule:{family:"DEFENSIVE_SAVE",bindings:{attribute:null}},verboseDescription:"Adds full Proficiency Bonus to saves of one chosen Attribute.",standardBindings:["PHYSICAL","MENTAL","MAGICAL"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Saving Throw Proficiency`,bindings:{attribute:key},verboseDescription:`Gain proficiency on ${title(key)} saving throws. When resisting an effect with a ${title(key)} save, add your full Proficiency Bonus if another rule is not already providing a stronger proficiency benefit.`}))},
  {key:"practice-proficiency",name:"Practice Proficiency",familyKey:"PRACTICE_PROGRESSION",category:"PRACTICE_PROGRESSION_AUGMENT",tier:1,buCost:4,bindingSchema:{required:["practice"],slots:{practice:{kind:"enum",values:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"]}}},rule:{family:"PRACTICE_PROFICIENCY",bindings:{practice:null}},verboseDescription:"Establishes trained competence in one named Practice.",standardBindings:["PROWESS","FINESSE","FIELDCRAFT","AWARENESS","REASON","KNOWLEDGE","INFLUENCE","MYSTICISM","COMMUNION","INTUITION"].map(key=>({key:key.toLowerCase(),name:`${title(key)} Proficiency`,bindings:{practice:key},verboseDescription:`Gain proficiency in ${title(key)}. Add your Proficiency Bonus to ${title(key)} checks when a more specific rule does not already grant expertise or another stronger benefit.`}))},
];

/** Finite rules that are useful as exact entries and do not need specialization. */
export const CANONICAL_EXPRESSIONS:readonly CanonicalExpressionDefinition[] = [
  ...[1,2,3,4].map((tier):CanonicalExpressionDefinition=>({
    key:`verb-access-${tier}`,name:`Verb Access Tier ${["","I","II","III","IV"][tier]}`,familyKey:"VERB_ACCESS",category:"VERB_TIER",tier,buCost:tierCost(tier),
    mechanicalText:"",
    verboseDescription:VERB_DESCRIPTIONS[tier-1]!,
  })),
  {key:"range-touch",name:"Touch Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:0,buCost:0,mechanicalText:"Set maximum range to Touch.",verboseDescription:"The capability can affect the user, something they physically contact, or a target within ordinary melee reach. It cannot cross open distance without a higher range primitive."},
  {key:"range-near",name:"Near Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:2,buCost:4,mechanicalText:"Set maximum range to Near (30 ft).",verboseDescription:"The capability can reach a target up to 30 feet away, covering close combat, a small room, or the nearby part of a battlefield."},
  {key:"range-far",name:"Far Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:3,buCost:8,mechanicalText:"Set maximum range to Far (60 ft).",verboseDescription:"The capability can reach a target up to 60 feet away, allowing action across a large room, street, or ordinary tactical encounter."},
  {key:"range-very-far",name:"Very Far Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:4,buCost:12,mechanicalText:"Set maximum range to Very Far (120 ft).",verboseDescription:"The capability can reach a target up to 120 feet away, spanning most battlefields and other long but directly observable distances."},
  {key:"range-extreme",name:"Extreme Range",familyKey:"RANGE_SCALING",category:"RANGE",tier:5,buCost:24,mechanicalText:"Set maximum range to Extreme (240 ft–3 miles).",verboseDescription:"The capability can operate from 240 feet out to roughly 3 miles when its targeting method can still identify the target. This supports scene-wide and near-remote influence."},
  {key:"die-d6",name:"Standard Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:1,buCost:2,mechanicalText:"Unlock 1d6 damage or healing output.",verboseDescription:"Use a d6 when the capability deals damage or restores Vitality at a reliable but modest intensity. The parent capability still determines the action, target, damage or healing type, and timing."},
  {key:"die-d8",name:"Heavy Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:2,buCost:4,mechanicalText:"Unlock 1d8 damage or healing output.",verboseDescription:"Use a d8 for a stronger damage or healing package comparable to a heavy weapon strike or focused restorative effect. The parent capability supplies its source, target, and delivery rules."},
  {key:"die-d10",name:"Impact Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:3,buCost:8,mechanicalText:"Unlock 1d10 damage or healing output.",verboseDescription:"Use a d10 for concentrated high-impact damage or healing. This die sets the output intensity while the capability defines what produces it and who receives it."},
  {key:"die-d12",name:"Calamity Die Block",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:4,buCost:16,mechanicalText:"Unlock 1d12 damage or healing output.",verboseDescription:"Use a d12 for exceptional damage or healing capable of deciding a major exchange. It represents severe destructive force or equally powerful restoration within the capability's normal delivery limits."},
  {key:"die-d20",name:"Existential Tear",familyKey:"INTENSITY_DICE",category:"INTENSITY_DICE",tier:5,buCost:32,mechanicalText:"Unlock 1d20 damage or healing output.",verboseDescription:"Use a d20 for mythic damage or healing that can define an encounter. The die supplies reality-breaking intensity; range, targeting, duration, and the parent capability still constrain its application."},
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
