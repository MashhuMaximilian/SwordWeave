export type GuideBlock = {
  title: string;
  body?: string;
  rules?: string[];
  example?: string;
};
export type GuideTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string;
  blocks: GuideBlock[];
  sources?: { title: string; url: string }[];
};
const notion = (title: string, id: string) => ({ title, url: `https://app.notion.com/p/${id}` });

/** Player-facing rules. Human rulings in the project conversation supersede legacy Notion examples. */
export const PLAY_GUIDE: GuideTopic[] = [
  {
    id: 'start', title: 'Start playing', summary: 'Describe an intent. Agree the stakes. Resolve it together.', keywords: 'beginner quick reference play loop dm gm cost strain',
    blocks: [
      { title: 'Begin with the fiction', body: 'Say what your character wants to accomplish. The GM considers scale (how much), impact (how strong), complexity (how many interacting parts), and the circumstances. Ordinary attempts do not require you to author a capability first.', example: '“I want to freeze the broken pipe so we can cross safely.” Check the available verbs and domains, then agree the reach, duration, difficulty, and consequences.' },
      { title: 'Agree the stakes before committing', body: 'The GM evaluates Strain and chooses a Cost appropriate to this attempt. Cost may be Vitality, resources, a complication, a change to the environment, or another consequence. An obvious, uncontested action may simply happen; uncertainty or opposition calls for resolution.' },
      { title: 'Resolve and carry the result forward', body: 'Use the relevant check, attack, save, or contest. Apply the agreed outcome, update Vitality and consequences, and describe the changed situation. Your next intent begins from there.' },
      { title: 'The table has the final word', body: 'SwordWeave is a framework for collaborative play. Tell each other what a ruling means, keep consequences consistent, and adapt the guidance to your world. The library supplies usable starting points; it does not replace the conversation.' },
    ], sources: [notion('Player Loop', '37fed8479ccd811b9b1cc3a97723dc6e')],
  },
  {
    id: 'building-blocks', title: 'Primitives, capabilities & effects', summary: 'Understand the pieces you own and the ways you assemble them.', keywords: 'primitive family fork tier domain verb permission effect capability active passive augment reuse',
    blocks: [
      { title: 'Primitives: the pieces', body: 'A primitive is a reusable piece of your character’s rules or permissions. It may change a number, grant something, or describe a specific fictional ability. Families explain their tier and broad or narrow scope; forks specialize the value, subject, or circumstances.', rules: ['An authored numerical rule names its result, operation, value, recipient, condition, and stacking behavior.'], example: 'Attribute Increment is a family. +1 Physical, +3 Physical, and +PB Physical while a stated condition holds are different authored variants. Alloyed teeth that can bite through plate armor may instead be a descriptive permission.' },
      { title: 'Capabilities: an assembled intent', body: 'A capability organizes primitives and effects into something you can do: a maneuver, a gift, an active technique, a passive feature, or an augment. Its description establishes how it works, what it targets, and how it resolves.', example: 'A heat lance could combine a verb, Fire domain access, range, output dice, and an effect that leaves the struck object glowing. Agree its scale and execution cost for the current scene.' },
      { title: 'Effects: what happens or persists', body: 'An effect describes an outcome or an applied state. It can carry primitives of its own, be included in a capability, and have a duration or conditions for ending. It may change numbers or describe consequences that need interpretation at the table.', example: 'Two effects can both be called Poisoned: one represents contaminated food; another represents a shaman’s overwhelming psychedelic. Their consequences can differ. Read the effect and agree what it means here.' },
      { title: 'Scope, conditions, and stacking', body: 'Read exactly what a primitive affects. A narrow rule applies only within its authored context; a broad rule covers the stated category. Conditions determine when the rule applies. Stacking determines how contributions to the same result combine: some keep every contribution, while others retain only the highest, lowest, or another specified result.', example: 'A +1 Awareness fork while tracking is different from +1 Awareness everywhere. If a rule sets a minimum or maximum, it constrains the result rather than acting as another ordinary bonus.' },
      { title: 'Read the two kinds of description', body: 'Mechanical rules appear in orange. Narrative and descriptive text remains in the normal text color. Read both: the numbers tell you what changes, while the description explains what the character actually does.' },
      { title: 'Reuse what you own', body: 'You purchase primitives. Capabilities, effects, and heritages organize them. Reusing an already owned primitive in another composition does not buy it again. A shared primitive should appear once in the mechanical summary; distinct numerical forks remain distinct rules.', example: 'If you own primitive X worth 10 BU, adding a 40 BU capability containing that same X costs 30 additional BU, provided the remaining ingredients are new purchases.' },
    ], sources: [notion('Capability Composition Map', '37fed8479ccd810dbd98e4c942a98553')],
  },
  {
    id: 'heritages', title: 'Heritages & your build', summary: 'Lineage, upbringing, and manifest give your concept a foundation.', keywords: 'heritage lineage species race upbringing background manifest class size quickbuild package character creation',
    blocks: [
      { title: 'Lineage', body: 'Your species or ancestry: the body, senses, and inherited qualities that shape your character. A lineage has a starting size. Quickbuild uses that size; size primitives can change it later.' },
      { title: 'Upbringing', body: 'Your background: where and how you grew up, learned, worked, or survived. It can supply training, knowledge, contacts, and practical abilities.' },
      { title: 'Manifest', body: 'Your main build or expression: the role and capabilities around which you currently shape the character. It is a foundation you can develop, not a fixed progression track.' },
      { title: 'Keep placement flexible', body: 'Place purchased pieces wherever they make sense for your concept. Wings might be part of one character’s lineage and another’s manifest or capability. You can develop the character during play, including purchasing a primitive mid-combat when the table permits it.' },
      { title: 'Create, then develop', body: 'Complete creation gives you room for a detailed concept. Quickbuild helps you choose ready heritages, strengths, and a short backstory; packages, drawbacks, and items are optional additions. Both create a sheet you can keep editing.', rules: ['Creation requires a verb tier and a domain through your character build or package. Items do not satisfy that requirement.', 'When the corresponding category is absent, the zero-BU Touch range and 1d4 baseline are granted.'], example: 'Choose a small lineage, a caravan upbringing, and a protective manifest. Later, add a new sense or technique without replacing that original concept.' },
    ],
  },
  {
    id: 'budget', title: 'BU, mirrors & progression', summary: 'Purchase reusable primitives; track items and drawback credit separately.', keywords: 'budget bu debt overflow dm bonus progression level mirror weakness drawback cost ownership',
    blocks: [
      { title: 'BU is your build budget', body: 'BU prices purchases and compares designs. Published prices are authored choices guided by tiers, not universal laws. Your starting creation allocation is 25 BU at any level; progression and any agreed bonus determine the additional budget available to the character.' },
      { title: 'Mirror a primitive for a drawback', body: 'Weaknesses are mirrored uses of compatible primitives, not a separate catalog. Mirroring reverses supported operations, such as add/subtract, minimum/maximum, or multiply/divide. A mirrored purchase is free and grants budget credit; its use inside a composition can be positive or negative as authored.', example: 'Mirror +10 Vitality into −10 Vitality as a drawback purchase. Its credit expands the budget. The composition still specifies the actual direction in which that primitive is used.' },
      { title: 'Read the budget ledger', body: 'Creation separates purchases, drawback credit, and overflow. It fills the normal budget first, then uses drawback credit, then records any remaining overflow. Going over the normal allowance needs the DM’s agreement; creation cannot exceed the next-level ceiling or the permitted drawback debt.', example: 'With 60 BU available, 10 BU drawback credit, and 76 BU purchased, the ledger uses 60 normal BU + 10 credit + 6 overflow. Ask the DM about that overflow before finishing.' },
      { title: 'Items have a separate budget', body: 'Item BU does not consume the normal character build budget. Your DM may set a separate item allowance. Their primitives are still usable in play through the item, including in combinations, while the item’s availability and rules apply.' },
      { title: 'Versions preserve your build', body: 'A saved character may pin an older published version. A later library revision does not silently rewrite that character. Review an update before adopting it.' },
    ],
  },
  {
    id: 'rolls', title: 'Attributes, practices, attacks & saves', summary: 'One DC, three saving throws, and proficiency only where it applies.', keywords: 'roll d20 dc physical mental magical practice skill proficiency pb expertise attack saving throw round up',
    blocks: [
      { title: 'Three attributes', body: 'Physical, Mental, and Magical describe the approach. The GM identifies which applies to an ordinary attempt. Source type helps determine the relevant attribute for a capability: Physical, Psychic (Mental), or Magical.' },
      { title: 'Checks and practices', body: 'Practices describe reliable competence, not a list of things you are allowed to try. Anyone can attempt an ordinary action; training improves the roll.', rules: ['Check = d20 + relevant attribute + PB if trained + applicable modifiers.'], example: 'For tracking enemies, Fieldcraft may apply. If you are trained, add PB; add a narrow tracking bonus only when its authored condition is satisfied.' },
      { title: 'The ten practices', body: 'Physical: Prowess, Finesse, Fieldcraft. Mental: Awareness, Reason, Knowledge, Influence. Magical: Mysticism, Communion, Intuition. The sheet’s practice details explain their uses and current totals.' },
      { title: 'Proficiency and expertise', body: 'Base PB starts at +2 at level 1 and increases by 1 every four levels: +3 at level 5, +4 at level 9, and so on. Active PB primitives can modify the value. Proficiency adds PB to the relevant trained check; expertise uses twice PB where the grant applies and requires the corresponding proficiency.' },
      { title: 'Roll bias', body: 'Baseline advantage rolls two resolution dice and keeps the higher; disadvantage keeps the lower. These change the roll behavior, not its static bonus. Read the authored scope and the sheet’s bias counters when several rules apply; do not assume each icon is another numerical +1.' },
      { title: 'One DC', body: 'The character has one DC for attacks and effects to resolve against. There are no separate Physical, Mental, or Magical DCs. The info modal lets you choose the eligible proficient attribute used to scale it.', rules: ['DC = 5 + PB + chosen attribute including active modifiers + direct DC modifiers.'], example: 'With PB 3 and Physical chosen at +2, DC is 10 before other modifiers. An active +3 Physical primitive makes Physical +5 and DC 13. A direct +1 DC makes it 14.' },
      { title: 'Three saving throws', body: 'Saving throws are separate from DC. Each attribute has its own save bonus. Use the relevant one to resist the incoming effect, including proficiency and scoped modifiers where applicable.', rules: ['Save = d20 + relevant attribute + PB if proficient + applicable save modifiers.'], example: 'An effect can ask for a Mental save against its creator’s single DC. That does not create a separate Mental DC.' },
      { title: 'Rounding and displayed totals', rules: ['Round results up whenever rounding is needed.'], body: 'Use the current totals shown in the sheet. Its info modals identify contributing primitives, active conditions, proficiency, and any constraints. Do not add the same displayed bonus again to your roll.' },
    ], sources: [notion('Practice System', '38eed8479ccd803b9544f1d0ce3d97cf')],
  },
  {
    id: 'combat', title: 'Combat rhythm', summary: 'Council → Fast → Measured → Heavy, with reactions as the scene changes.', keywords: 'combat rhythm initiative round council complexity fast measured heavy main intent movement',
    blocks: [
      { title: '1. Council: declare together', body: 'At the start of the round, each player declares one Main Intent in plain language. Coordinate briefly. The GM describes the opposition’s visible focus. Movement belongs to the intent; agree how it fits the action.' },
      { title: '2. Assign a complexity track', rules: ['Fast: Complexity 0–1. Immediate or simple actions resolve first.', 'Measured: Complexity 2–3. Deliberate, connected actions resolve next.', 'Heavy: Complexity 4+. Extended or complex actions resolve last.'], body: 'The GM assigns the track from the attempted action. Complexity measures what must happen before the action manifests; it is not a damage or power ranking.' },
      { title: '3. Resolve the changing scene', body: 'Resolve Fast, then Measured, then Heavy. Allies in the same track choose an order that supports their plan; the GM orders adversaries. There is no default initiative roll. Resolve a clash or contest only when opposing intents actually collide.' },
      { title: '4. Carry consequences into the next round', body: 'Finish triggered reactions, apply outcomes and ongoing effects, and review duration and maintenance. Begin a new Council Phase. Reaction Slots reset, and everyone declares intent for the changed situation.' },
      { title: 'A bridge encounter', example: 'The guard reaches for an alarm. You rush to stop him: a simple strike may be Fast. An ally constructs an escape barrier: the GM may assign Measured. A third character begins a complex spatial fold: Heavy. If you and the guard collide in Fast, resolve who acts first. If the bridge breaks before the barrier resolves, its creator can reconsider the intent.' },
    ], sources: [notion('The Combat Rhythm', '392ed8479ccd80f5b55ffe9863ab815d')],
  },
  {
    id: 'reactions', title: 'Clashes, contests & reactions', summary: 'Resolve timing, struggle, or a sudden response with the right rule.', keywords: 'reaction clash active contest pivot interruption timing initiative reaction slot',
    blocks: [
      { title: 'Reaction Clash: who acts first?', body: 'Use a clash when opposing intents collide within the same track and timing determines the outcome. The higher roll acts first. On a tie, the GM resolves simultaneously or follows the stronger fictional position.', rules: ['Reaction Clash = d20 + relevant attribute + PB if trained.'], example: 'You reach for the alarm lever while the guard tries to pull it. Timing decides which intent arrives first.' },
      { title: 'Active Contest: whose effort wins?', body: 'Use a contest for a direct physical, mental, or magical struggle. Both sides use the relevant approach, training, and modifiers; the higher result wins the immediate struggle.', rules: ['Active Contest = d20 + relevant attribute + applicable proficiency and modifiers.'], example: 'You hold a door shut while a creature pushes from the other side. This is a struggle, not a race.' },
      { title: 'Pivot when the situation changes', body: 'Losing a clash does not automatically erase your Main Intent. If the original action no longer works, adjust it before resolution: redirect, reduce the scale, accept another cost, or make a sensible defensive response.' },
      { title: 'One independent Reaction Slot', rules: ['Baseline: one Reaction Slot per combat round, reset at Council.', 'Baseline reaction: immediate, Complexity 0–1, and self/touch or a single target.'], body: 'A reaction needs a clear event and a response you can perceive and perform. It can occur before or after your Main Intent. Pause the triggering event, resolve the response, and continue. A reaction does not automatically cancel the trigger.', example: 'When a nearby ally falls, use your reaction to catch them if your position allows it. A larger rescue needs a specific permission or an explicit ruling and consequences.' },
    ], sources: [notion('The Combat Rhythm', '392ed8479ccd80f5b55ffe9863ab815d')],
  },
  {
    id: 'strain', title: 'Strain, Cost & scaling', summary: 'Build ownership and the cost of an attempt answer different questions.', keywords: 'strain cv cost complexity scaling quickening vitality execution resource heuristic time',
    blocks: [
      { title: 'Strain measures pressure now', body: 'The GM assigns Strain on a 0–6 scale according to scale, impact, complexity, environment, and time pressure. Rushing or compressing an action can increase that pressure. The same owned capability can have different Strain in different scenes.' },
      { title: 'Cost is the consequence', body: 'Agree how that pressure manifests: Vitality loss, resource use, exposure, environmental change, a narrative complication, or another consequence. Strain does not automatically translate into a fixed Vitality bill.', example: 'Lighting a campfire with Fire access and forcing a blaze through a rainstorm use related building blocks. Their scale and resistance from the scene make them different attempts.' },
      { title: 'CV is a design reference', body: 'Complexity Value helps compare constructions and expanded designs. It is not added to a roll. Use it as a reference when discussing the build; the GM still evaluates the actual attempt.' },
      { title: 'Scaling is an agreement', body: 'Check your owned tier, range, dice type, permissions, and the capability’s stated scope. Expanding targets, intensity, area, duration, or speed may raise execution pressure. Range gates and dice type are purchased permissions; do not assume every runtime increase requires buying a new primitive.' },
    ], sources: [notion('Evaluation Layer', '37eed8479ccd81a4bd1ae21e1a0e1354'), notion('Player Loop', '37fed8479ccd811b9b1cc3a97723dc6e')],
  },
  {
    id: 'upkeep', title: 'Duration, upkeep & interruption', summary: 'When it resolves, how long it lasts, and what sustains it are separate.', keywords: 'upkeep maintain concentration interruption casting duration payment damage pressure sustained',
    blocks: [
      { title: 'Three separate properties', body: 'Track determines when the capability resolves. Duration determines how long its resulting effect lasts. Upkeep determines whether you must actively sustain it. A fixed duration does not automatically require upkeep.', example: 'A flame can flash and end; remain for two rounds without maintenance; or last while you sustain it. Those are different constructions.' },
      { title: 'Pay to keep it active', body: 'Upkeep exists when the capability specifies maintenance. The GM sets the actual upkeep cost for the current situation. Pay at the start of your turn to continue; if you do not pay, the maintained effect ends. Keep this payment point explicit within your table’s shared round.', example: 'Maintaining invisibility among distracted commoners may be easier than sustaining it in a court watched by trained mages.' },
      { title: 'One capability, one upkeep track', body: 'Multiple effects inside one capability remain one execution with one upkeep track and one Strain evaluation. You can maintain several capabilities; their costs accumulate. There is no default single-concentration limit.' },
      { title: 'Damage creates maintenance pressure', rules: ['If total damage taken during the turn reaches or exceeds the applicable upkeep cost, immediately re-pay that upkeep to maintain the capability.'], body: 'This is a resource payment, not a concentration save. If you cannot pay, the maintained effect ends. Track the damage during the turn and clarify the payment when several capabilities are maintained.', example: 'Upkeep is 4. You take 2 damage, then another 3 in the same turn: total 5 reaches the threshold. Re-pay the upkeep or let the maintained capability end.' },
      { title: 'Interrupt before resolution', body: 'A capability with an execution window can be interrupted before it resolves. The GM decides whether it fails, partially resolves, and incurs none, part, or all of its cost. Instant execution has no casting window to interrupt. Expired duration and explicit disruption can also end an effect.' },
      { title: 'Conditions and maintenance', body: 'Check the effect’s interruption rules and agree with the GM how an imposed consequence affects your ability to maintain or finish the capability. Discuss this when applying the condition so everyone understands what remains possible.' },
    ], sources: [notion('Capability Upkeep & Interruption', '37fed8479ccd81aa9467d9779c45f40a'), notion('Player Loop clarifications', '37fed8479ccd811b9b1cc3a97723dc6e')],
  },
  {
    id: 'damage', title: 'Damage, resistance & vulnerability', summary: 'Identify source and domain, apply the matching defenses, then lose Vitality.', keywords: 'damage healing resistance vulnerability immunity source physical psychic magical domain fire rounding',
    blocks: [
      { title: 'Source is how; domain is what', body: 'Physical, Magical, and Psychic describe execution origin. Fire, Ice, Gravity, Emotion, and other domains describe identity. Physical fire and magical fire share a domain but have different sources. Read which source or domain each defense covers.' },
      { title: 'Resolve each damage instance', rules: ['Resistance: half the damage, rounded up.', 'Vulnerability: double the damage.', 'Immunity: zero damage within its stated scope.', 'Multiple resistances do not stack by default; use the strongest applicable single resistance.', 'Applicable resistance and vulnerability on the same instance cancel: take full damage.'], example: '9 magical fire damage becomes 5 with matching resistance, 18 with matching vulnerability, or 9 if both resistance and vulnerability apply. Immunity to that damage makes it 0. Damage immunity does not automatically grant immunity to every associated condition: check the permission’s scope.' },
      { title: 'Mixed output needs an explicit breakdown', body: 'Read whether multiple domains split one output or produce separate instances. For mixed execution sources, separate the output by source before applying defenses. The capability or the GM defines the intended breakdown.', example: 'A hybrid blast deals 6 Physical Fire and 8 Magical Fire. Magical resistance reduces only the Magical portion to 4: total loss is 10. Fire resistance covering both portions would instead apply to both.' },
      { title: 'Apply the final result', body: 'All damage is Vitality loss. Healing restores Vitality within the character’s current maximum. Resolve output and typed defenses at the table, then use the sheet’s manual Vitality controls to apply the final amount. Entering raw damage there does not automatically apply typed resistance or vulnerability.' },
    ], sources: [notion('Damage & Resistance', '380ed8479ccd81f69dcbf3888f5e384b')],
  },
  {
    id: 'vitality', title: 'Vitality, collapse & consequences', summary: 'Your health and exertion share one resource; consequences record the fiction.', keywords: 'vitality health hp healing collapse death unconscious stabilize cost consequence condition poisoned burning slowed',
    blocks: [
      { title: 'One resource for survival and exertion', rules: ['Base maximum Vitality = (10 + PB) × level; apply active maximum-Vitality modifiers.'], body: 'Vitality covers health, stamina, and exertion. There is no universal separate mana or spell-slot pool. Use the sheet’s derived maximum and current value; active primitives can change the maximum.' },
      { title: 'Conditions get meaning from context', body: 'A name such as Poisoned, Burning, or Slowed does not impose one universal numerical package. Describe what caused it, what it does, when it applies, and how it ends. Record the agreed effect or consequence on the sheet.', example: 'Smoke inhalation, poisoned food, and a psychedelic ordeal can create very different consequences. “Slowed” need not always mean −10 ft movement.' },
      { title: 'At 0 Vitality', body: 'The character collapses, unconscious and incapacitated. The GM sets a contextual rescue clock: roughly a minute is guidance, not a guaranteed ten safe rounds. Severe wounds and hostile environments can shorten it. Allies can attempt Fieldcraft stabilization or a creative use of their available primitives.' },
      { title: 'Massive damage', rules: ['A single execution dealing at least twice maximum Vitality, or taking current Vitality to −maximum Vitality, can cause immediate death under the massive-damage rule.'], body: 'Discuss lethal stakes before resolution. The rescue clock applies to collapse, not to a character whose framework is destroyed outright.' },
      { title: 'Record what happened', body: 'Consequences make injuries, restrictions, and narrative costs visible. Their description and any attached rules determine how they affect the character. Review them when the situation changes instead of assuming a label explains every interaction.' },
    ], sources: [notion('Vitality System', '37eed8479ccd81d693dbf6ca9b4ac4c4'), notion('Tactical Subsystems & Collapse', '390ed8479ccd80118106cd4b8f28a9bf')],
  },
  {
    id: 'equipment', title: 'Items, Load, slots & cover', summary: 'Carry capacity and equipped slots measure different things.', keywords: 'equipment item load carry capacity slot pouch two handed size movement cover vector manifestation',
    blocks: [
      { title: 'Carried Load', rules: ['Carry capacity = size base + 5 × Physical modifier + applicable capacity bonuses.'], body: 'Size bases are Tiny 10, Small 20, Medium 40, Large 80, Huge 160, and Gargantuan 320. Carried items contribute Load even when unequipped. Exceeding capacity makes you encumbered; the GM determines the relevant penalties and complications.' },
      { title: 'Equipped slots', rules: ['Base equipment capacity: 6 universal slots.', 'A two-handed item uses at least 2 slots; its authored slot cost can be higher.'], body: 'Equipped slots describe what you have in use. Load describes what you carry. Equipping something does not remove its Load, and storing it does not necessarily remove it from your inventory.' },
      { title: 'Tiny objects and pouches', rules: ['One pouch holds up to 1,000 tiny items and contributes 1 Load.'], body: 'A mundane backpack organizes items; it does not automatically change capacity. Special storage must state its rule.' },
      { title: 'Cover depends on execution', body: 'Projected vectors travel through space: arrows, beams, and thrown blasts respect cover. Direct manifestations appear at the target and ignore intervening cover penalties, but still require line of sight or a valid sensory lock.', rules: ['Projected vectors: minor obstruction −2 accuracy; standard half cover −4; total cover blocks the trajectory.'], example: 'A firebolt must travel around the wall. A gaze that ignites a visible target can manifest directly. A fully hidden target still needs a legitimate way to locate and affect it.' },
    ], sources: [notion('Encumbrance System', '380ed8479ccd8114afb0c77a0dd0b3ed'), notion('Cover & Manifestation', '390ed8479ccd80118106cd4b8f28a9bf')],
  },
  {
    id: 'sheet', title: 'Use the character sheet', summary: 'Read live totals, inspect the rules, and record the table’s outcomes.', keywords: 'app sheet drawer modal active inactive conditional trigger manual automatic override edit atelier library preview save version',
    blocks: [
      { title: 'Inspect a number', body: 'Open the bottom drawer and the info modal for a stat, attack bonus, DC, save, or practice. Check the base, contributions, active conditions, and chosen scaling attribute. These details explain the displayed total.' },
      { title: 'Active and conditional rules', body: 'An inactive rule does not contribute. A condition belongs to the primitive itself: tracked numerical conditions can evaluate automatically, while contextual conditions need a manual state. Overrides let you reflect the table’s ruling.', example: '“Self Vitality below 50%” can read the tracked Vitality. “When tracking enemies” needs the appropriate manual state; it is still an authored condition, not an extra condition invented each time you use the primitive.' },
      { title: 'Recipients matter', body: 'A rule targeting Self affects your sheet when active and triggered. A rule targeting someone else belongs in that recipient’s resolution. Your own sheet should not gain every bonus or lose every damage amount your capability can produce.' },
      { title: 'Apply table outcomes', body: 'Damage, healing, contextual conditions, upkeep payments, and consequences may need manual application. Resolve them with the GM, then adjust current Vitality or record the effect. A saved output expression describes what to resolve; saving it does not automatically roll or hit a target.' },
      { title: 'Develop the build', body: 'Use the Library to inspect compositions and the Atelier/edit workflow to adapt them. Review the purchase total and change summary before saving. Existing owned primitives can be reused; item availability and version pins remain meaningful.' },
      { title: 'Find help in context or here', body: 'The existing local help modals remain available next to the field or number they explain. This guide gathers the general rules into one place. Open Rules from the sheet’s FAB to keep the sheet underneath, or use the standalone Rules page.' },
    ],
  },
];

export function searchGuide(query: string): GuideTopic[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return PLAY_GUIDE.filter(topic => {
    const haystack = [topic.title, topic.summary, topic.keywords, ...topic.blocks.flatMap(b => [b.title, b.body ?? '', ...(b.rules ?? []), b.example ?? ''])].join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
