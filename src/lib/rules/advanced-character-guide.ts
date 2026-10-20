import type { GuideTopic } from './play-guide';
import type { HardModifier } from '@/types/swordweave';
import { cumulativeBuForLevel } from '@/lib/engine/bu';
import { proficiencyBonus } from '@/lib/engine/practices';
import { computeMaxVitality } from '@/lib/engine/vitality';

export const ADVANCED_CHARACTER_INTRO = {
  title: 'Create a character from scratch',
  summary: 'Start with someone you want to play. Write their unusual traits, give the important numbers a precise rule, and turn the same ingredients into several useful actions.',
};

/** Original teaching proposal, not a saved Library entry or a report of a playtest. */
export const TRACKER_ACQUISITIONS = [
  { key: 'verb-i', name: 'Verb Access I', bu: 4, basis: 'PHB suggested access anchor', rule: 'Direct physical or perceptual interaction within the acquired permissions.' },
  { key: 'metal-i', name: 'Metal Domain I', bu: 4, basis: 'PHB suggested access anchor', rule: 'A named grounded metal subject for the contact construction below.' },
  { key: 'scent', name: 'Heightened scent', bu: 4, basis: 'Illustrative table-agreed price', rule: 'Notice and distinguish an exposed, sampled scent under its written sensory conditions.' },
  { key: 'teeth', name: 'Copper-biting teeth', bu: 6, basis: 'Illustrative table-agreed price', rule: 'Cut the specified small, exposed soft-copper sample by biting it at contact.' },
  { key: 'focus', name: 'Quarry focus: Awareness +1', bu: 2, basis: 'Illustrative table-agreed price', rule: 'Add +1 to Awareness checks noticing the trace of the one named sampled quarry during the declared task.' },
  { key: 'touch', name: 'Touch baseline', bu: 0, basis: 'PHB baseline', rule: 'Self, contact or ordinary melee reach where appropriate.' },
  { key: 'd4', name: '1d4 output baseline', bu: 0, basis: 'PHB baseline', rule: 'Available die type for a separately supported damage or healing construction.' },
];

const level = 1;
const attributes = { physical: 4, mental: 4, magical: 2 };
const pb = proficiencyBonus(level);
const budgetBu = cumulativeBuForLevel(level);
const spentBu = TRACKER_ACQUISITIONS.reduce((sum, row) => sum + row.bu, 0);

export const TRACKER_EXAMPLE = {
  name: 'The copper-toothed tracker',
  concept: 'A search-and-rescue pathfinder who follows familiar scents and can bite through a small exposed piece of soft copper.',
  level, attributes, proficientAttribute: 'MENTAL' as const, pb,
  budgetBu, spentBu, remainingBu: budgetBu - spentBu,
  maxVitality: computeMaxVitality(level), dc: 5 + pb + attributes.mental,
  awareness: attributes.mental + pb, focusedAwareness: attributes.mental + pb + 1,
  fieldcraft: attributes.physical,
  scentReachFt: 30, scentSampleAgeMinutes: 10, traceAgeMinutes: 10,
  copperMaximumThicknessMm: 1, copperMaximumWidthMm: 10,
  copperBitingTimeSeconds: 60,
};

export const TRACKER_SCENT_RULE = 'You can notice and distinguish the exposed scent of one creature or ordinary substance whose scent you have deliberately sampled within the last 10 minutes. A fresh trace laid within the last 10 minutes can be followed while it is within 30 ft of you in reasonably still air. You learn whether that known scent is present and the local direction in which its trace continues. Strong masking odors, a sealed barrier or a washed-away trace prevent this sense from reading that trace. Reacquire it through a new exposed sample. A trace identifies the sampled scent; it does not by itself give the creature’s present location, identity, thoughts or history.';

export const TRACKER_TEETH_RULE = 'Your teeth can bite through one exposed strip of nonmagical soft copper at contact: at most 1 mm thick and 10 mm wide. It must be a loose object or a loose fastening on an unmoving, safely supported bundle, away from any creature’s body and without dangerous tension or resistance. Hold it safely and work for up to one quiet minute. The resulting cut is a physical change and remains until someone repairs or replaces the strip. This permission supplies the unusual bodily method; agree a different material, thickness, a moving or resisted target, or a combat attack as a new proposal before using it that way.';

export const TRACKER_FOCUS_SITUATION = 'Following the named sampled quarry: only Awareness checks to notice or distinguish its fresh scent trace. End when the task ends, the quarry changes, or the trace no longer qualifies.';
export const TRACKER_FOCUS_FLAG = 'manual:following_the_named_sampled_quarry';

/** In-memory example of the rule the editor can express; no record is created. */
export const TRACKER_FOCUS_MODIFIER: HardModifier = {
  kind: 'modify', target: 'skill_practice_check', operation: 'add',
  value: { kind: 'number', value: 1 },
  metadata: { recipient: 'SELF', targetScope: { layer: 'PRACTICE', values: ['AWARENESS'] } },
  stacking: 'unique-by-primitive',
  condition: { kind: 'tags', customTags: [`actor:${TRACKER_FOCUS_FLAG}`] },
};

/** Several readable preparations reference the same owned acquisitions. */
export const TRACKER_RECIPES = [
  { name: 'Follow the named scent', ingredients: ['scent', 'focus'], purpose: 'Locate the next local trace of the sampled quarry; resolve uncertainty with the agreed sensory Awareness check.' },
  { name: 'Check the marked pouch', ingredients: ['scent'], purpose: 'Distinguish the sampled ordinary substance in an open pouch within the sense’s conditions.' },
  { name: 'Cut a copper fastening', ingredients: ['verb-i', 'metal-i', 'teeth', 'touch'], purpose: 'Cut the agreed exposed sample at contact, with safe handling and time.' },
  { name: 'Release a copper-tied bundle', ingredients: ['verb-i', 'metal-i', 'teeth', 'touch'], purpose: 'Use the same small-copper permission on an eligible fastening after supporting the bundle.' },
];

export const TRACKER_SCENE = {
  dc: 12, d20: 6, bonus: TRACKER_EXAMPLE.focusedAwareness,
  total: 6 + TRACKER_EXAMPLE.focusedAwareness,
  vitalityBefore: 12, vitalityAfter: 12, buBefore: 5, buAfter: 5,
};

const phb = { title: 'Read or download the Player’s Handbook', url: '/books/players-handbook' };
const primitiveTutorial = { title: 'Follow the complete primitive editor tutorial', url: '/tutorials/create-a-primitive' };

export const ADVANCED_CHARACTER_GUIDE: GuideTopic[] = [
  {
    id: 'your-person', title: 'Begin with the person',
    summary: 'Describe what excites you before choosing a package or filling a ledger.',
    keywords: 'concept inspiration favorite fiction analogue original custom heritage character from scratch person purpose party',
    blocks: [{
      title: 'Begin with the person',
      paragraphs: [
        'You can bring a very particular idea to SwordWeave. Start with the traits you want to express, whether they come from an imagined person, a familiar kind of story or a favorite fictional ability. Describe what those traits actually let your version do. You can author the ingredients yourself; an existing heritage is an optional starting aid.',
        'Our original worked proposal is a copper-toothed tracker: a patient search-and-rescue pathfinder with a heightened sense of smell and teeth that can cut a small copper fastening. They want to find a missing courier and help the party cross a disused route. Their everyday experience, unusual body and useful actions can all appear on the same character.',
      ],
      ordered: [
        'Write a person and a reason to join the others: “I find people who have become lost, and I promised to bring this courier home.”',
        'Choose the traits that make the idea yours: a familiar-scent sense, a precise tracking bonus and copper-biting teeth.',
        'Write one desired scene for each trait. Following a fresh trail, recognizing a sample and cutting a small fastening give us concrete tests for the rules.',
        'Decide together what belongs in the starting version and what can develop later. Keep the first session’s promises small enough to understand and use.',
      ],
      details: [{ title: 'Using an inspiration thoughtfully', body: 'To recreate a favorite character closely, list the abilities and defining moments you want to bring into play. Decide together which parts the starting build expresses and which can develop later. “Heightened smell” still needs an answer to what information it supplies; the same process works for a very specific fictional power. A table may choose a more powerful starting budget for a larger concept.' }, { title: 'How to read this example', body: 'This guide authors a complete paper proposal. Its custom definitions, prices and scene agreements are teaching examples for the group to accept or revise. It is not a saved character or a claim that this build has been independently playtested.' }],
    }],
    sources: [phb],
  },
  {
    id: 'choose-the-rule', title: 'Decide what needs a rule',
    summary: 'Separate ordinary attempts, new fictional permission and a change to a number.',
    keywords: 'ordinary extraordinary permissions numerical nonnumerical narrative tracking Awareness Fieldcraft training ability access',
    blocks: [{
      title: 'Decide what needs a rule',
      body: 'Ask what the character can already attempt as a person, what requires unusual access, and which number should actually change. This keeps a memorable trait readable instead of turning every detail of their life into a purchase.',
      table: {
        caption: 'Turn the concept into the right kind of ingredient',
        headers: ['Desired trait or action', 'Decision', 'What to record'],
        rows: [
          ['Ask a witness, examine footprints, carry a rope', 'Ordinary attempts; the approach and circumstances matter.', 'Use ordinary conversation or the relevant uncertain check. Add training only if this build acquires it.'],
          ['Distinguish a familiar scent beyond ordinary ability', 'An unusual sensory permission.', 'A narrative primitive defining samples, information, reach, obstacles and loss of the trace.'],
          ['Get +1 when noticing the quarry’s scent', 'An explicit numerical modifier.', 'Awareness +1, Self, only during the defined declared situation, with a stated stacking rule.'],
          ['Bite through a copper fastening', 'An unusual physical permission.', 'The precise material sample, contact, handling, time and resulting change.'],
          ['Have a ready “Follow the named scent” action', 'A convenient expression of the owned ingredients.', 'A capability or an ordinary note linking the sense and its conditional bonus.'],
        ],
      },
      paragraphs: ['For the sensory step we choose Awareness: the character is noticing and distinguishing a trace. A survival or navigation approach might instead call for Fieldcraft. Explain the approach first, then agree the practice; “tracking” names the situation rather than an extra practice.'],
      details: [{ title: 'A name does not fill in a rule', body: 'A “tracker,” “monster,” “blind” or “metal eater” label does not carry an unstated package. Define the actual change. Likewise, the character may make ordinary attempts without practice proficiency; training adds its contribution when the actual check qualifies.' }, { title: 'The foundation and individual traits', body: 'The Complete character creator asks for an actual named Domain access primitive and a Verb access primitive. A custom sensory description remains a valid player-facing permission, but it is not a substitute for those foundation bindings. We choose the foundation separately in the next chapter.' }],
    }],
  },
  {
    id: 'foundation', title: 'Choose a starting foundation',
    summary: 'Give the person strengths, training and a budget before pricing the unusual traits.',
    keywords: 'level one starting 25 BU Physical Mental Magical proficient attribute PB Vitality DC Metal Domain Verb access Touch d4 foundation',
    blocks: [{
      title: 'Choose a starting foundation',
      paragraphs: [
        'For this example the group chooses level 1 with the default 25-BU allowance. Set Physical 4, Mental 4 and Magical 2: ten base attribute points. Choose Mental as the proficient attribute because careful observation and reasoning are central to this tracker. Their physical strengths still contribute their full value.',
        'Choose Verb Access I for direct physical or perceptual interaction, and bind Domain I to Metal for the contact metal construction. The custom teeth primitive supplies the particular bodily method and small-copper limit. The heightened sense has its own sensory definition. Keep those written definitions beside the family labels.',
      ],
      table: {
        caption: 'The example’s foundation, before temporary conditions',
        headers: ['Number', 'Recipe', 'Result'],
        rows: [
          ['Base attributes', 'Physical 4 + Mental 4 + Magical 2', '10 total'],
          ['PB at level 1', '2 + floor((1 − 1) / 4)', '2'],
          ['Ordinary Awareness', 'Mental 4 + applicable PB 2', '+6'],
          ['Fieldcraft, without a separate grant', 'Physical 4', '+4'],
          ['Selected Mental DC', '5 + PB 2 + Mental 4', '11'],
          ['Maximum Vitality', '(10 + PB 2) × level 1', '12'],
        ],
      },
      details: [{ title: 'Training and baselines', paragraphs: ['Mental proficiency provides the applicable training for its practices and its own save. Our +1 scent rule is an additional scoped modifier, not a second grant of the same training. A displayed combined bonus already includes its components; add it to the die once.', 'Touch reach and a 1d4 output die are the baselines when no other range or die category is acquired. Neither of this guide’s worked tasks deals damage or heals, so no output roll is needed for them.'] }, { title: 'Choose the subject, not every domain', body: 'The PHB’s suggested Tier-I anchor is 4 BU for each access family. Metal Domain I is one named grounded subject; Verb I is a separate family. Broader changes, other subjects or different delivery can call for other permissions. The table prices the actual construction and can revise an overlapping or unusually narrow proposal.' }],
    }],
    sources: [phb, { title: 'Character foundations in Rules', url: '/rules#first-character' }],
  },
  {
    id: 'write-a-sense', title: 'Write the heightened sense',
    summary: 'Make a vivid nonnumerical trait usable by saying what information it supplies.',
    keywords: 'smell scent sensory primitive nonnumeric nonnumerical narrative sample reach obstacles information location permission',
    blocks: [{
      title: 'Write the heightened sense',
      body: 'First write the whole player-facing permission in ordinary language. This can be the complete rule: it grants unusual information without adding a number to the sheet.',
      example: `Heightened scent — ${TRACKER_SCENT_RULE}`,
      ordered: [
        'Name the subject: a scent deliberately sampled from one creature or ordinary substance.',
        'Define the information: presence and the local direction of the continuing trace.',
        'Give the useful boundaries: a ten-minute sample, a ten-minute trace, 30 ft and reasonably still air.',
        'Test an obstacle: decide what masks, seals or removes the trace, and how a new exposed sample restores the opportunity.',
      ],
      table: {
        caption: 'Ask what the sense actually tells you',
        headers: ['Situation', 'Apply the written permission'],
        rows: [
          ['The courier left a fresh scarf sample and a recent trail', 'You can read the matching local trace if it is exposed and within the sensory conditions.'],
          ['The courier is far away; an old trace remains here', 'Only the qualifying trace supplies information. To locate the creature now, establish a relevant present-location method.'],
          ['A sealed box contains the sample', 'Open it or find an exposed sample before using this sense to distinguish its contents.'],
        ],
      },
      details: [{ title: 'Put a narrative permission in the editor', ordered: ['Create a Primitive and enter its name, Exact BU and Verbose Narrative Rule.', 'For this sensory proposal, keep No mechanical rule. If a starter has already inserted one, Clear rule removes that output.', 'Keep the draft private while you agree the definition. Review the complete narrative before saving.'], body: 'The 30-ft boundary is part of this authored sensory channel. It describes the information this sense can receive; a projected action still needs its own actual reach and delivery. The editor does not simulate wind, scent age or the contents of a sealed box.' }],
      links: [primitiveTutorial],
    }],
  },
  {
    id: 'write-the-teeth', title: 'Give the teeth a concrete test',
    summary: 'Agree what the extraordinary body can change, then test it on an actual object.',
    keywords: 'teeth bite copper metal fictional permission body sample material thickness time contact nonnumerical creation',
    blocks: [{
      title: 'Give the teeth a concrete test',
      body: '“Bites metal” becomes useful when everyone can picture the same test. This starting version cuts a small soft-copper fastening; later growth can expand its materials or uses.',
      example: `Copper-biting teeth — ${TRACKER_TEETH_RULE}`,
      table: {
        caption: 'Make the rule’s result and limits observable',
        headers: ['Question', 'This proposal’s answer'],
        rows: [
          ['What changes?', 'One eligible strip is cut; the cut persists as an ordinary physical change.'],
          ['Who and how?', 'This character bites it at contact, with safe handling and up to one quiet minute.'],
          ['What is an eligible sample?', 'An exposed nonmagical soft-copper strip no thicker than 1 mm and no wider than 10 mm: loose, or a loose fastening on an unmoving supported bundle, away from a creature’s body and free of dangerous tension or resistance.'],
          ['What happens to an iron chain or armor?', 'Describe a new desired use and agree its access, material test, resistance and resolution.'],
          ['What about attacking someone?', 'Author the actual attack’s target, delivery, check or save, output and stakes before putting it in play.'],
        ],
      },
      paragraphs: ['A loose copper tie, a copper-tied bundle and a small copper tag can offer different useful situations with the same owned permission. Support the bundle before cutting its fastening. Ordinary positioning and help can matter as much as another primitive.'],
      details: [{ title: 'Why this can stay narrative', body: 'This permission changes what an ordinary body can accomplish. Its detailed narrative is sufficient for the sample task; no fixed-number modifier or output die is needed. The table can later author a separate mechanical attack if that would make the character more enjoyable. Broader fictional permission comes from the new agreement, rather than from raising an execution payment alone.' }],
    }],
  },
  {
    id: 'write-the-bonus', title: 'Make the +1 mean one thing',
    summary: 'Use a named practice and a declared situation to connect a number to the fiction.',
    keywords: 'Quarry focus Awareness +1 mechanical rule Result Operation Value Recipient Trigger condition stacking declared at table Fieldcraft',
    blocks: [{
      title: 'Make the +1 mean one thing',
      body: 'The tracker is especially good at noticing a quarry’s sampled scent. Write the exact rule: “Add +1 to my Awareness check when I am noticing or distinguishing the fresh scent trace of the one quarry named for this task. The trace must qualify for Heightened scent. This ends when the task ends, the quarry changes, or the trace no longer qualifies.”',
      ordered: [
        'Create the Quarry focus primitive. Enter the same readable rule and its agreed 2-BU example price.',
        'In Mechanical rule choose Change a number. On a phone, open Rule format first.',
        'For Result choose Rolls & checks, then Skill / Practice Check, then Awareness. Keep the practice itself named Awareness; put the narrow scent situation in its condition.',
        'Set Operation to Add. In Value choose Fixed number and set 1; confirm Use number if entering a typed value.',
        'Set Recipient to Self. For Trigger choose Declared at table and name the sampled-quarry situation and its ending terms.',
        'Choose Once per primitive under How they combine. Check the preview reads a +1 Awareness contribution for Self with the intended declared condition.',
        'During play, turn the declared situation on only while it qualifies and turn it off when it ends. Compare the ordinary and eligible combined bonuses.',
      ],
      table: {
        caption: 'A precise bonus changes the intended check',
        headers: ['Check', 'Ordinary', 'During the qualifying scent task'],
        rows: [
          ['Awareness: noticing this sampled trace', '+6', '+7 = Mental 4 + PB 2 + focus 1'],
          ['Awareness: looking for a tripwire', '+6', '+6; the scent condition does not cover this check'],
          ['Fieldcraft: navigating a dangerous slope', '+4', '+4; the authored rule targets Awareness'],
        ],
      },
      details: [{ title: 'The flag and the judgment', body: 'Declared at table creates a runtime situation flag. A player or GM supplies the judgment the sheet cannot infer. While it is active, this primitive contributes to its named practice: switch it off before an unrelated Awareness check, and back on only if the same qualifying task still applies. The full narrative remains the authoritative scope. Once per primitive stops repeated applications of this same primitive from contributing several times; other rules retain their own stacking terms.' }, { title: 'Choose another approach deliberately', body: 'If your group wants the trait to improve practical wilderness tracking instead, author a Fieldcraft-scoped rule and use Physical with its actual training. A bonus to one named practice is smaller and clearer than silently adding +1 to every skill, attack, save and attribute.' }],
      links: [primitiveTutorial],
    }],
  },
  {
    id: 'arrange-and-reuse', title: 'Arrange the same ingredients again',
    summary: 'Create useful expressions without paying for the same acquisition each time.',
    keywords: 'effects capabilities heritages lineage upbringing manifest reuse owned once ingredients nesting body nature role condition',
    blocks: [{
      title: 'Arrange the same ingredients again',
      paragraphs: [
        'You can act directly from these owned permissions. If a recurring action needs a memorable name or preparation note, make it a capability. If a useful group of primitive rules appears in several capabilities, an effect can keep that group readable.',
        'For example, an effect called Read a familiar trace can reference Heightened scent and Quarry focus. A Follow the named scent capability can reference that effect and state its subject, task, check and ending. You could instead place those same primitives directly in the capability. Both arrangements express the same purchases.',
      ],
      table: {
        caption: 'Four uses, one acquisition ledger',
        headers: ['Ready intent', 'References', 'What the use adds'],
        rows: TRACKER_RECIPES.map(recipe => [recipe.name, recipe.ingredients.map(key => TRACKER_ACQUISITIONS.find(row => row.key === key)!.name).join('; '), recipe.purpose]),
      },
      details: [{ title: 'Optional roots for your story', paragraphs: ['You may organize the unusual body under a personal Lineage, search-and-rescue experience under an Upbringing, and a developing trail-reader role under a Manifest. These are your story containers: you can author them, choose more than one where appropriate, or keep direct acquisitions. No existing heritage selection is needed to begin the Complete route.', 'In the current sheet, a heritage can reference primitives or capabilities; an effect contains primitives; a capability can reference primitives or effects. So put Read a familiar trace in a capability before grouping that capability in a heritage, if you choose that organization.'] }, { title: 'Ownership and use are separate', body: 'Use the same saved primitive reference when you mean the same acquisition. A second recipe is a second arrangement, not a second purchase. A genuinely different rule, version or separately acquired instance needs its own review. Reusing a rule does not grant its outcome again when its actual conditions do not apply.' }],
    }],
  },
  {
    id: 'ledger-and-gear', title: 'Keep the purchase ledger readable',
    summary: 'Price the acquired rules once and keep equipment and execution in their own records.',
    keywords: 'ledger BU 25 20 5 price pricing Item BU cost load slots equipment mirror debt budget unique acquisitions',
    blocks: [{
      title: 'Keep the purchase ledger readable',
      body: 'The group accepts this starting proposal at 20 BU. Here is every acquisition, including the two zero-price baselines. Refer back to these entries from recipes instead of charging for each appearance.',
      table: {
        caption: 'Authored example agreement: 25 BU available, 20 allocated, 5 unspent',
        headers: ['Acquisition', 'BU', 'Price basis'],
        rows: TRACKER_ACQUISITIONS.map(row => [row.name, String(row.bu), row.basis]),
      },
      paragraphs: ['Arithmetic: 4 + 4 + 4 + 6 + 2 + 0 + 0 = 20 BU. The 25-BU level-1 allowance leaves 5 BU. Follow the named scent, Check the marked pouch and the two copper uses reference this ledger; their repeated ingredients add 0 new BU.'],
      details: [{ title: 'Agree a price with a useful comparison', paragraphs: ['The PHB gives 4-BU Tier-I access anchors. For the three custom traits, this example group agrees 4 BU for the bounded sense, 6 for the specific physical permission and 2 for the conditional +1. Those are proposed prices for these definitions. There is no universal smell price or price for biting every metal.', 'To discuss your version, compare its information, reliability, recipients, material, reach and ending with an understood rule. Read an ordinary use and an awkward edge case aloud. Revise the definition or price together, then record both. This example uses no drawback credit or mirrored purchase.'] }],
    }, {
      title: 'Equipment and use have different costs',
      table: {
        caption: 'Five quantities to keep separate',
        headers: ['Quantity', 'This example'],
        rows: [
          ['Character BU', '20 purchased once; 5 remain for later acquisitions.'],
          ['Item BU', '0 in the ordinary field kit proposed below. A magical or enhanced item would have its own ingredient ledger.'],
          ['Load', 'The group records the filled ordinary field kit as Small: 1 Load carried. Its actual contents must be available.'],
          ['Equipped slots', 'The kit is carried unequipped: 0 slots. Equipping an ordinary one-slot item uses one of the default six.'],
          ['Execution Cost', 'Agree the actual use’s time, resources, risk or other consequence before committing. The worked safe tests use time with no Vitality payment.'],
        ],
      },
      paragraphs: ['The example’s ordinary field kit contains one clean cloth, one measured wash of water and a small sample container. The group agrees its availability, ordinary purchase or crafting requirements and its filled size. Item BU 0 describes the absence of acquired item mechanics; it is not a promise of free or unlimited physical supplies.'],
    }],
  },
  {
    id: 'try-the-character', title: 'Resolve a scene from beginning to end',
    summary: 'Follow one sampled trail, then use the teeth on a checked fastening.',
    keywords: 'worked scene example d20 6 7 13 DC12 check scent quarry courier copper trace roll outcome consequence preparation',
    blocks: [{
      title: 'Follow the courier’s fresh trail',
      paragraphs: ['The group establishes that the missing courier left a scarf here five minutes ago. The tracker samples it now. A recent exposed trace lies within 30 ft in reasonably still air. There are several other fresh smells near a fork, so deciding which local trace matches is uncertain and matters.', 'The player says, “I want to distinguish this scarf’s scent and find which side of the fork its trace follows.” The table chooses Awareness for the sensory discrimination, an illustrative DC 12 and the stakes: success identifies the matching local direction; failure spends the search time without finding it, leaving another approach available. They agree this quiet attempt needs time but no Vitality payment.'],
      ordered: [
        'Name this courier as the quarry. Check that the sample and trace meet Heightened scent’s terms.',
        'Declare the qualifying Quarry focus situation. The relevant combined Awareness bonus is +7.',
        'Roll the illustrative d20 result 6. Add +7 once: 6 + 7 = 13. It meets DC 12.',
        'Reveal the matching trace toward the left-hand culvert. Record that local information; the courier’s current position remains to be discovered.',
        'Continue from the changed situation. End the declared task flag if the search stops or the trace ceases to qualify.',
      ],
      table: {
        caption: 'Changes after this agreed sensory attempt',
        headers: ['Record', 'Before', 'After'],
        rows: [
          ['Local trail information', 'Two possible directions', 'Matching exposed scent leads left'],
          ['Tracker current / maximum Vitality', '12 / 12', '12 / 12'],
          ['Character BU remaining', '5', '5'],
          ['Quarry focus situation', 'Off', 'On only while the qualifying task continues'],
        ],
      },
    }, {
      title: 'Cut a fastening with the same owned rules',
      paragraphs: ['At the culvert the party finds a loose copper tie holding a bundle of abandoned route markers. A companion supports the bundle. The group checks the tie: exposed nonmagical soft copper, 1 mm thick and 8 mm wide, safely reachable at contact.', 'The tracker references Verb I, Metal I, Copper-biting teeth and Touch. With the sample inside the agreed definition and no meaningful opposition, the group lets one quiet minute of work cut the tie. Record “tie cut; bundle supported; markers accessible.” No damage or output roll is required. The sense and teeth remain the same owned traits; there is no additional BU purchase.'],
      details: [{ title: 'Change the problem, then choose again', body: 'An iron tie, an occupied collar or a fastening under dangerous tension changes a relevant fact. Choose another ordinary tool, reduce the risk, ask a companion, or author the additional permission your intended use needs. Extra dice, more targets or a longer duration may be appraisal dials for an eligible use; an unsupported new behavior needs an actual access agreement.' }],
    }],
  },
  {
    id: 'conditions-and-ends', title: 'Make conditions change something',
    summary: 'Say what starts a consequence, what it does, and what the player can do to end it.',
    keywords: 'conditions effects consequence ends duration timing recovery upkeep scent obscured washing restrictions resources state',
    blocks: [{
      title: 'Make conditions change something',
      body: 'Suppose the next route passes through clinging smoke. Before entering, the table agrees the sensory consequence and an alternative: take a slower clear-air path, or risk losing the scent. The party chooses the smoky shortcut. Record the whole condition, not only its dramatic name.',
      table: {
        caption: 'Authored scene consequence: Scent-obscured',
        headers: ['Term', 'Exact agreement for this scene'],
        rows: [
          ['Recipient and start', 'The tracker, immediately on entering the smoke-filled passage.'],
          ['Actual change', 'Clinging masking odor prevents Heightened scent from reading the quarry’s trace. Turn Quarry focus off because its qualifying trace cannot be read. Ordinary sight and other available approaches remain available.'],
          ['Duration and ending', 'Persists until the tracker is in clear air and completes the recovery below. A new round alone does not end it.'],
          ['Recovery', 'Spend ten uninterrupted minutes in clear air washing the face and exposed scent-catching surfaces with the kit’s one clean cloth and one measured wash of water. Mark that water used.'],
          ['After recovery', 'Remove Scent-obscured. Obtain a fresh exposed sample and trace that meet the sense’s terms before declaring the task again.'],
        ],
      },
      paragraphs: ['This consequence is a concrete temporary restriction with an achievable recovery. It leaves the purchased sense on the character’s ledger and current Vitality at 12. Restore the sensory opportunity through the agreed recovery; then reassess the sample and trace as they exist now.'],
      details: [{ title: 'Separate a condition, an effect and a maintained action', paragraphs: ['A condition describes an actual state and its changes. An effect is a convenient group of primitive rules in a construction. Either may refer to timing or duration, but the labels do not establish those terms by themselves.', 'Our trace search ends when its declared task ends. Completing the minute of copper work leaves a lasting physical cut. Scent-obscured is a temporary scene consequence with a recovery task. None requires a recurring Vitality payment. A different maintained working should state its actual upkeep, payment point and what interruption does.'] }, { title: 'A bonus can cancel a number without curing the cause', body: 'If an authored condition instead subtracts 1 from Awareness, an applicable +1 might cancel that numerical contribution while both rules remain active. That arithmetic does not remove the condition, restore blocked sensory permission or satisfy its recovery. Keep numerical modifiers and actual ending conditions readable.' }],
    }],
    sources: [{ title: 'Vitality and consequences in Rules', url: '/rules#vitality' }, phb],
  },
  {
    id: 'build-in-the-tools', title: 'Bring the proposal into the tools',
    summary: 'Use Complete character for a personal foundation, then compose from the saved sheet.',
    keywords: 'Create Complete character Make your own set recommended starting access Atelier primitive account save draft review apply workshop build own',
    blocks: [{
      title: 'Bring the proposal into the tools',
      body: 'You can read this guide and keep the complete record on paper without signing in. To save your own character and Library entries, use an account. Keep the table’s agreed definitions and ledger alongside the editor while you build.',
      ordered: [
        'Open New character and choose Complete character. This route begins with your concept and foundation rather than an existing heritage selection.',
        'Enter a name and concept, choose the group’s agreed level and size, set the ten base attribute points and choose the proficient attribute. For the worked proposal use level 1, Medium, Physical 4 / Mental 4 / Magical 2 and Mental proficiency.',
        'At Starting access inspect the recommended set, then use Make your own set to select the actual Verb I and named Metal Domain I access. Review any entries already selected by the recommendation. For this example, begin with the 8-BU verb/domain pair and the Touch / 1d4 baselines; the three custom traits come next.',
        'Review the name, concept, ten points, required access and budget. Create character opens the character’s Build workspace. The initial 8-BU foundation leaves 17 BU for your own additions.',
        'Choose Lineage as the destination for the unusual body, then Build your own (New piece on a phone) → Rule or trait. Author Heightened scent and Copper-biting teeth with their complete narratives. Choose Upbringing or Manifest for Quarry focus and author its precise +1 Awareness rule. These are placement sections for your own work, not selections of supplied heritage templates.',
        'Compare the three additions with the agreed prices: 4 + 6 + 2 = 12 more BU. The complete proposal now allocates 20 of 25 BU and leaves 5. Check these draft numbers before applying the changes.',
        'If you want a ready capability or effect, compose it from the saved sheet after the ingredients are available. Choose the appropriate story section as a destination, then Build your own (New piece on a phone). Choose Reusable effect to group primitive references, or Capability to give an intent its readable name and procedure.',
        'In Find something, choose On character, then Use this entry for an owned ingredient. Its preview offers Add to active effect or capability when the destination accepts it. Read the resulting composition and budget change. Save the work into the draft, then open Review changes (Review on a phone).',
        'Check the draft’s complete numbers and placements. If offered, use Check draft & numbers. When the review matches your agreement, use Save & return to play to apply it.',
      ],
      details: [{ title: 'Author the two foundation bindings', ordered: ['For Verb Access I, select the Verb access rule format, Operation Grant, Tier I and Recipient Self. Write the actual permission and agree its price.', 'For Metal Domain I, select Domain access, Operation Grant, Tier I and Recipient Self. Enter Metal in the Domain field, then write the actual subject and scope in the narrative.'], body: 'Use existing correct foundation primitives when they fit, or author these bindings before selecting them. Those formats store the access bindings the Complete creator checks. The category or name alone does not establish them. The narrative-only sense and teeth permissions can keep No mechanical rule.' }, { title: 'An additional phone creation route', body: 'On a phone, Complete character also offers Create in Atelier ↗. It saves that account’s creation draft on this device and opens the primitive editor in another tab. Save the entry, return and confirm the primitive is selected. This return accepts Primitive entries; effects, capabilities and optional heritages belong in the saved Build workspace. The main steps above use the saved workspace for the custom traits on either device.' }, { title: 'Phone labels and saving', body: 'On the primitive editor’s phone layout, open Rule format to choose a mechanical output. The sheet’s chooser calls a primitive Rule or trait and a heritage Heritage bundle. A stand-alone Atelier primitive uses Save Primitive; an editor opened inside a character workspace uses Add to draft or Update draft. Draft saving and Save & return to play are separate steps. Confirm the final budget and applied build before relying on the new rule in play.' }],
      links: [{ title: 'Start your own character', url: '/characters/new' }, { title: 'Open the Atelier', url: '/atelier' }, primitiveTutorial],
    }],
  },
  {
    id: 'make-it-yours', title: 'Test your version and make it yours',
    summary: 'Change a defining trait, read an edge case together, and leave with a character the group understands.',
    keywords: 'checklist review custom variation concept scope price test playtest starting character strengths fiction personal original',
    blocks: [{
      title: 'Test your version and make it yours',
      paragraphs: ['The tracker was one way to turn an idea into a small, usable beginning. Your person might read heat instead of scent, dissolve a specific fastening instead of biting it, or gain confidence from a named oath rather than a quarry. Change the actual information, permission or numerical scope first; then revisit the price and the examples.', 'You can keep the parts that work, add an ingredient for a new behavior, or arrange the existing set into another use. Start with the scene you want to make possible, then explain it clearly enough that the other people at your table can take part.'],
      rules: [
        'Person: I can explain who they are, why they join the others and what makes them interesting to play.',
        'Permission: each unusual trait says what it grants, its subject, reach or delivery, useful limits and what information or change it produces.',
        'Numbers: every modifier names its result, operation, value, recipient, condition and stacking. The displayed combined bonus is used once.',
        'Ownership: the ledger lists each acquisition once. Recipes reference those actual owned entries; gear has a separate Item-BU record.',
        'Use: I can walk through one ordinary success, one uncertain attempt and one case requiring a different approach or permission.',
        'Consequences: the table knows what changes, when it starts, what ends it and what recovery requires.',
        'Save and play: the applied sheet agrees with the reviewed rules, budget, supplies and current state. I can share feedback about the first session without treating a paper example as a prior playtest.',
      ],
      links: [{ title: 'Read Neris’s saved construction walkthrough', url: '/character#build-example' }, { title: 'Prepare your first session', url: '/rules#first-session-preparation' }, { title: 'Explore reusable creations', url: '/creating' }],
    }],
  },
];
