import type { GuideTopic } from './play-guide';
import type { HardModifier } from '@/types/swordweave';
import { cumulativeBuForLevel } from '@/lib/engine/bu';
import { proficiencyBonus } from '@/lib/engine/practices';
import { computeMaxVitality } from '@/lib/engine/vitality';

/** Public saved-example source checked 20 October 2026; not a recommended starting-level recipe. */
export const NERIS_SOURCE_CHECKED = '2026-10-20';
export const NERIS_SHEET_URL = '/characters/1662962b-14c5-4433-994e-6273b3f7ca57?view=public';
export const ORREN_SHEET_URL = '/characters/1da4e351-da76-4822-bf1f-632d2e657145?view=public';
export const NERIS_CONCEPT = 'A field medic with smoke filtration, trained triage and reusable treatment recipes.';

export type NerisAcquisition = { id: number; name: string; bu: number; version: number; versionId: string };
/** Unique saved character acquisitions, not item ingredients or the sum of every appearance in a bundle. */
export const NERIS_ACQUISITIONS: NerisAcquisition[] = [
  {
    "id": 23340,
    "name": "Careful Body Preparation",
    "bu": 2,
    "version": 2,
    "versionId": "03b71fb7-78cf-5dca-8d31-a1228ad3ed6a"
  },
  {
    "id": 23175,
    "name": "Carry Capacity Augment +20",
    "bu": 4,
    "version": 2,
    "versionId": "c35f2835-9c18-5092-9ef7-5a2173a6a8fd"
  },
  {
    "id": 23176,
    "name": "Carry Capacity Augment +50",
    "bu": 8,
    "version": 2,
    "versionId": "d0c56233-c7cb-56f9-8613-3469d58d2a26"
  },
  {
    "id": 23406,
    "name": "Consent-Based Prepared Remedy",
    "bu": 4,
    "version": 1,
    "versionId": "0782299d-0387-54cb-93cb-8e76a832c600"
  },
  {
    "id": 23183,
    "name": "Finesse Check +2",
    "bu": 4,
    "version": 2,
    "versionId": "9529af98-4418-53b0-9434-c38ddc5e5a59"
  },
  {
    "id": 23184,
    "name": "Finesse Check +3",
    "bu": 6,
    "version": 2,
    "versionId": "b4556edd-1264-5c2a-86d3-8cdf5af31072"
  },
  {
    "id": 22499,
    "name": "Finesse Proficiency",
    "bu": 4,
    "version": 5,
    "versionId": "eb409a29-3803-55b5-befd-48c78d61ed1a"
  },
  {
    "id": 23277,
    "name": "Fire Resistance",
    "bu": 8,
    "version": 1,
    "versionId": "7741dc3d-792e-5b69-8a7a-db18bebf815a"
  },
  {
    "id": 390,
    "name": "Heavy Die Block (1d8)",
    "bu": 4,
    "version": 6,
    "versionId": "c8effaf1-df14-4078-a40f-6b51bde2109e"
  },
  {
    "id": 23199,
    "name": "Knowledge Check +2",
    "bu": 4,
    "version": 2,
    "versionId": "11146d37-bdbd-5fca-bb3d-6985fa95b55b"
  },
  {
    "id": 23262,
    "name": "Knowledge Check +PB",
    "bu": 12,
    "version": 2,
    "versionId": "96256051-e125-5b69-afd6-7896ddb59e0c"
  },
  {
    "id": 22503,
    "name": "Knowledge Proficiency",
    "bu": 4,
    "version": 5,
    "versionId": "b95cd7ce-a28e-5546-9684-2e674279521b"
  },
  {
    "id": 23223,
    "name": "Mental Saving Throw +2",
    "bu": 6,
    "version": 2,
    "versionId": "20eb7be1-7a6b-5235-8a5d-eb2625739c2b"
  },
  {
    "id": 19,
    "name": "Minor Die Block",
    "bu": 0,
    "version": 4,
    "versionId": "1bdf8380-abc0-4ee8-a3c3-b75c0cb727b4"
  },
  {
    "id": 23312,
    "name": "Ordinary Smoke Filtration",
    "bu": 4,
    "version": 2,
    "versionId": "9a468634-7e2d-5bfd-9fda-2bb3e4dcfcdc"
  },
  {
    "id": 23394,
    "name": "Patient Reassurance Influence +2",
    "bu": 4,
    "version": 1,
    "versionId": "83b5e8e8-9b76-5282-a7f1-c9ea5febd555"
  },
  {
    "id": 23327,
    "name": "Temporary Material Patch",
    "bu": 4,
    "version": 2,
    "versionId": "2db76db9-89b5-5d6f-9378-a9feb3fabd31"
  },
  {
    "id": 32,
    "name": "Touch Range",
    "bu": 0,
    "version": 7,
    "versionId": "8f38a8b4-bfcf-4225-8ef1-b0ec58f72f89"
  },
  {
    "id": 20,
    "name": "Verb Access Tier I",
    "bu": 4,
    "version": 7,
    "versionId": "176c6dba-db6d-4f20-baf3-cc5a76c6dbc3"
  }
];

export const NERIS_ITEMS = [
  { name: 'Boundary Marker Satchel', itemBu: 2, equipped: true, load: 1, slots: 1 },
  { name: 'Patchplate Vest', itemBu: 8, equipped: true, load: 1, slots: 1 },
  { name: 'Patchsmith Roll', itemBu: 4, equipped: false, load: 1, slots: 0 },
];

const level = 8;
const attributes = { physical: 3, mental: 5, magical: 2 };
const pb = proficiencyBonus(level);
const progressionBu = cumulativeBuForLevel(level);
const spentBu = NERIS_ACQUISITIONS.reduce((sum, row) => sum + row.bu, 0);
const budgetBu = progressionBu + 1;

export const NERIS_EXAMPLE = {
  name: 'Neris Cinderthread', id: '1662962b-14c5-4433-994e-6273b3f7ca57',
  url: NERIS_SHEET_URL, checkedAt: NERIS_SOURCE_CHECKED,
  concept: NERIS_CONCEPT, level, attributes, proficientAttribute: 'MENTAL' as const,
  pb, progressionBu, dmBonusBu: 1, budgetBu, spentBu, remainingBu: budgetBu - spentBu,
  uniqueCharacterAcquisitions: NERIS_ACQUISITIONS.length,
  itemBu: NERIS_ITEMS.reduce((sum, item) => sum + item.itemBu, 0),
  maxVitality: computeMaxVitality(level), currentVitality: 104,
  dc: 5 + pb + attributes.mental, attackBonus: pb + attributes.mental,
  ordinaryInfluence: attributes.mental + pb, treatmentInfluence: attributes.mental + pb + 2,
  knowledge: attributes.mental + pb + 2 + pb,
  finesse: attributes.physical + pb + 2 + 3,
};

/** Exact authored scoped modifier from the character's pinned primitive 23394 v1. */
export const NERIS_REASSURANCE_MODIFIER: HardModifier = {
  "kind": "modify",
  "value": {
    "kind": "number",
    "value": 2
  },
  "target": "skill_practice_check",
  "metadata": {
    "recipient": "SELF",
    "targetScope": {
      "layer": "PRACTICE",
      "values": [
        "INFLUENCE"
      ]
    }
  },
  "stacking": "stack",
  "condition": {
    "kind": "tags",
    "customTags": [
      "actor:manual:speaking_with_a_willing_patient_during_the_named_treatment_ends_on_treatment_completion_or_withdrawal_of_consent"
    ]
  },
  "operation": "add"
};

export const NERIS_TREATMENT = {
  capability: 'Gentle Treatment', capabilityId: '47cbb11e-0502-411d-8157-c3f9aad96bf4',
  effect: 'Mended Vitality', effectId: 'c46cbcdc-f79d-4b3e-8a61-f41369fc7c44',
  reassurancePrimitiveId: 23394, outputPrimitiveId: 19,
  difficulty: 12, d20: 7, checkBonus: NERIS_EXAMPLE.treatmentInfluence,
  checkTotal: 7 + NERIS_EXAMPLE.treatmentInfluence,
  outputDie: '1d4', rolledHealing: 3,
  patientBefore: 6, patientMaximum: 12, patientAfter: 9,
  dressingBefore: 1, dressingAfter: 0,
  nerisBefore: NERIS_EXAMPLE.currentVitality, nerisAfter: NERIS_EXAMPLE.currentVitality,
  scope: 'Illustrative agreed treatment: one willing, reachable patient, appropriate supplies and enough time outside immediate danger.',
} as const;

const stages = [
  { name: 'Ashlung', ids: [23312, 23277], reason: 'Light-smoke work and the separately stated Fire Resistance.' },
  { name: 'Field Surgeon Apprentice', ids: [23199, 23183, 23340, 23176, 19], reason: 'Practical training, carrying capacity and the Splint and Rally recipe.' },
  { name: 'Thread Surgeon', ids: [23184, 23199, 22499, 22503, 23176, 23327, 19], reason: 'Further fine-work training, patching and already-referenced treatment ingredients.' },
  { name: 'Dose and Release', ids: [23406, 19], reason: 'One prepared-remedy permission and the already-owned d4 ingredient.' },
  { name: 'Gentle Treatment', ids: [23394, 19], reason: 'Scoped patient reassurance and the already-owned d4 ingredient.' },
  { name: 'Direct additions', ids: [20, 32, 390, 23262, 23223, 23175], reason: 'Verb I, Touch, d8, extra Knowledge PB, Mental save +2 and extra carrying capacity.' },
];
const seen = new Set<number>();
let runningBu = 0;
/** A teaching order for reading the saved graph; not a record of the author's historical clicks. */
export const NERIS_LEDGER_STAGES = stages.map(stage => {
  const newIds = stage.ids.filter(id => !seen.has(id));
  const reusedIds = stage.ids.filter(id => seen.has(id));
  const addedBu = newIds.reduce((sum, id) => sum + NERIS_ACQUISITIONS.find(row => row.id === id)!.bu, 0);
  stage.ids.forEach(id => seen.add(id));
  runningBu += addedBu;
  return { ...stage, newIds, reusedIds, addedBu, runningBu };
});

const acquisitionNames = (ids: number[]) => ids.map(id => NERIS_ACQUISITIONS.find(row => row.id === id)!.name).join('; ');
const characterSource = { title: 'Inspect Neris’s public sheet', url: NERIS_SHEET_URL };

/** Complete teaching source for the website, Markdown and a compact build companion. */
export const NERIS_GUIDE: GuideTopic[] = [
  {
    id: 'neris-concept', title: 'Start with the person and the job',
    summary: 'Read a finished field medic backward into understandable choices, then resolve one treatment.',
    keywords: 'Neris concept medic beginner demonstration level eight',
    blocks: [{
      title: 'A field medic, rather than a fixed class',
      body: NERIS_CONCEPT,
      paragraphs: [
        'The useful questions are practical: can Neris work in light smoke, understand an injury, handle careful work and help a willing patient? The saved ingredients answer different parts of those questions. A heritage or capability title is a convenient way to find them, rather than an additional rule.',
        'This walkthrough reads the existing level-8 alpha example. It explains how its choices support that concept; it is not a reconstruction of the author’s historical clicks. Your GM and group choose a starting level and budget. Neris is one developed example you can inspect, not a compulsory starting build or an independently playtested balance recommendation.',
      ],
      table: {
        caption: 'From the medic concept to an actual rule',
        headers: ['What the concept needs', 'Where the build supplies it', 'What remains a table decision'],
        rows: [
          ['Work in light smoke', 'Ashlung: Ordinary Smoke Filtration', 'Dense smoke, toxic gases and heat remain their own hazards.'],
          ['Understand and carry out practical care', 'Mental emphasis, training and the Field Surgeon Apprentice / Thread Surgeon ingredients', 'The injury, available tools and proposed procedure still matter.'],
          ['Resolve a modest treatment', 'Gentle Treatment with its scoped reassurance bonus and Mended Vitality effect', 'A willing reachable patient, supplies, stakes and the actual resolution.'],
        ],
      },
      links: [characterSource],
    }],
  },
  {
    id: 'neris-foundation', title: 'Give the concept a numerical foundation',
    summary: 'The saved spread is Physical 3, Mental 5, Magical 2, with Mental proficiency.',
    keywords: 'attributes specialty proficiency PB influence DC attack vitality mental physical magical',
    blocks: [{
      title: 'Read each attribute as its actual number',
      body: 'Neris’s three base attributes add to 10. Their values are the contributions used in checks; do not convert 5 into a different score modifier.',
      table: {
        caption: 'Actual saved foundation', headers: ['Choice', 'Value', 'How it supports this example'],
        rows: [
          ['Physical', '3', 'The full +3 supports Physical practices; separate Finesse training improves fine work.'],
          ['Mental', '5', 'The full +5 supports Awareness, Reason, Knowledge and Influence.'],
          ['Magical', '2', 'A +2 foundation for Magical practices; it is not the bonus used by Gentle Treatment’s Influence check.'],
          ['Specialty / proficient attribute', 'Mental', `At level ${level}, PB ${pb} applies to Mental practices and the Mental save.`],
        ],
      },
      paragraphs: [
        `Ordinary Influence starts at Mental ${attributes.mental} + PB ${pb} = +${NERIS_EXAMPLE.ordinaryInfluence}. During the specific patient-reassurance situation, an authored +2 changes that check to +${NERIS_EXAMPLE.treatmentInfluence}. You will use that total once in the treatment example.`,
        'A high Knowledge result helps a relevant knowledge check; it does not itself grant healing. Read the capability that supplies the treatment behavior.',
      ],
      details: [{
        title: 'Other checked numbers on this saved build',
        table: {
          caption: 'Keep the different numbers separate', headers: ['Number', 'Calculation', 'Result'],
          rows: [
            ['Single DC', `5 + PB ${pb} + chosen Mental ${attributes.mental}`, `${NERIS_EXAMPLE.dc}`],
            ['Attack bonus with Mental selected', `PB ${pb} + Mental ${attributes.mental}`, `+${NERIS_EXAMPLE.attackBonus}`],
            ['Maximum Vitality', `(10 + PB ${pb}) × level ${level}`, `${NERIS_EXAMPLE.maxVitality}`],
            ['Knowledge', `Mental 5 + training 3 + Knowledge Check +2 + the extra Knowledge Check +PB (3)`, `+${NERIS_EXAMPLE.knowledge}`],
            ['Finesse', 'Physical 3 + Finesse training 3 + Finesse Check +2 + Finesse Check +3', `+${NERIS_EXAMPLE.finesse}`],
          ],
        },
        paragraphs: ['Knowledge Proficiency does not add another training PB on top of the Mental attribute’s training. Knowledge Check +PB is a different, explicitly additive primitive. The two distinct Finesse bonus acquisitions also differ from repeatedly referencing the same acquisition.'],
      }],
    }],
    sources: [characterSource, { title: 'Rules: practices, training and resolution', url: '/rules#rolls' }],
  },
  {
    id: 'neris-origins', title: 'Read why the three origins fit',
    summary: 'Origins organize actual ingredients. Read what each contributes before treating its name as shorthand.',
    keywords: 'Ashlung lineage Field Surgeon Apprentice upbringing Thread Surgeon manifest origins choice',
    blocks: [
      {
        title: 'Ashlung: the working conditions',
        body: 'Ordinary Smoke Filtration permits breathing and seeing sufficiently for ordinary tasks in light nonmagical smoke or ash. Fire Resistance is a separate rule: halve the stated fire damage and round the final amount up. Neither title means immunity to every dangerous atmosphere.',
        paragraphs: ['This lineage supports the smoke-working part of the medic concept. It supplies these two actual acquisitions; it does not supply the treatment check or free medical supplies.'],
      },
      {
        title: 'Field Surgeon Apprentice: practical preparation',
        body: 'This upbringing references Knowledge Check +2, Finesse Check +2, Careful Body Preparation and Carry Capacity Augment +50, together with Splint and Rally. Those pieces support learned care, fine work and carrying equipment.',
        paragraphs: ['Splint and Rally describes a specific treatment with suitable supplies and 1d4 output on success. Careful Body Preparation instead concerns respectful preparation and preservation of a body with ordinary supplies and time. Its similar medical theme does not make it healing or resurrection.'],
      },
      {
        title: 'Thread Surgeon: further training and useful recipes',
        body: 'This manifest references Finesse Check +3, Knowledge Check +2, Finesse Proficiency, Knowledge Proficiency and Carry Capacity Augment +50. Patch the Seam and Splint and Rally provide saved recipes for ordinary material patching and the defined treatment.',
        paragraphs: ['Knowledge Check +2, Carry Capacity Augment +50 and the treatment’s Minor Die Block already appear through the earlier package. Keep those shared references without buying them again. Finesse Check +2 and Finesse Check +3 are different acquired primitives, so both remain in the ledger.'],
      },
    ],
    sources: [characterSource, { title: 'Rules: heritages and their ingredients', url: '/rules#heritages' }],
  },
  {
    id: 'neris-ledger', title: 'Count purchases once, then organize them',
    summary: `${NERIS_EXAMPLE.uniqueCharacterAcquisitions} unique character acquisitions cost ${spentBu} BU. The ${budgetBu}-BU pool leaves ${NERIS_EXAMPLE.remainingBu} unspent; items use a separate ledger.`,
    keywords: 'budget ledger BU unique purchases reuse deduplication item cost unspent',
    blocks: [{
      title: 'A readable pass through the saved acquisition ledger',
      body: `Level ${level} supplies ${progressionBu} progression BU. This particular demo has a +${NERIS_EXAMPLE.dmBonusBu} DM adjustment, making ${budgetBu}. That adjustment is part of this example, not an automatic level-${level} award.`,
      table: {
        caption: 'What each stage adds to the one character ledger',
        headers: ['Read this part', 'New character BU', 'Running total'],
        rows: NERIS_LEDGER_STAGES.map(stage => [stage.name, `${stage.addedBu}`, `${stage.runningBu}`]),
      },
      paragraphs: [
        'Read the packages in the order below. Add only character acquisition IDs not already counted. This is a teaching order over the saved build, rather than a prescribed creation sequence. The names of an effect, capability or heritage do not create another purchase.',
        `The total is ${spentBu} spent from ${budgetBu}, leaving ${NERIS_EXAMPLE.remainingBu} BU for later choices. No mirrored credit is used in this saved example.`,
        `Neris also carries a Boundary Marker Satchel (2 Item BU, equipped), Patchplate Vest (8 Item BU, equipped) and Patchsmith Roll (4 Item BU, carried). Their ${NERIS_EXAMPLE.itemBu} Item BU is separate from the ${spentBu} character BU. Those item names do not guarantee a medical dressing is available.`,
      ],
      details: [
        {
          title: 'Which references were new, and which were already counted?',
          table: {
            caption: 'The same saved primitive ID is counted once across these bundles',
            headers: ['Part', 'New acquisitions in this reading order', 'Already counted'],
            rows: NERIS_LEDGER_STAGES.map(stage => [stage.name, acquisitionNames(stage.newIds), stage.reusedIds.length ? acquisitionNames(stage.reusedIds) : 'None']),
          },
        },
        {
          title: 'Complete saved character acquisition list',
          table: {
            caption: 'Nineteen saved character acquisitions; current checked authored prices',
            headers: ['Primitive', 'Character BU'],
            rows: NERIS_ACQUISITIONS.map(row => [row.name, `${row.bu}`]),
          },
          paragraphs: ['Minor Die Block and Touch Range are explicit 0-BU entries here. Reuse means the same acquisition stays one purchase. It does not mean two independently acquired, intentionally distinct rules always collapse merely because their names or themes resemble one another.'],
        },
        {
          title: 'Separate carrying and equipment checks',
          body: 'The saved inventory uses 3 of 125 Load and 2 of 6 equipped slots. The ordinary Medium capacity with Physical 3 is 55; the two distinct capacity increments add 50 and 20. Carry Capacity Augment +50 is shared by two origins, not added twice.',
        },
      ],
    }],
    sources: [characterSource, { title: 'Rules: budgets and acquisition', url: '/rules#budget' }],
  },
  {
    id: 'neris-treatment', title: 'Open one saved capability and find its ingredients',
    summary: 'Gentle Treatment combines a scoped reassurance bonus with one reusable treatment effect.',
    keywords: 'Gentle Treatment Mended Vitality effect capability Minor Die Block 1d4 reassurance permission',
    blocks: [{
      title: 'Gentle Treatment is an instruction, not an automatic heal',
      body: 'The capability says to reassure a willing patient during the stated treatment, resolve its scoped Influence check, roll the authored 1d4 output and update the target’s Vitality manually. It is an authored physical treatment, rather than unrestricted magical healing.',
      table: {
        caption: 'Follow the actual recipe to its underlying rules',
        headers: ['Piece', 'What it contributes', 'Where it sits'],
        rows: [
          ['Patient Reassurance Influence +2', 'Add 2 only while speaking with a willing patient during the named treatment; end on completion or withdrawal of consent.', 'A primitive directly inside Gentle Treatment.'],
          ['Mended Vitality', 'The specific treatment may restore 1d4 when its capability resolves; roll and apply it manually.', 'An effect included by Gentle Treatment.'],
          ['Minor Die Block', 'The baseline 1d4 output ingredient; the parent recipe still defines behavior, target and delivery.', 'Inside Mended Vitality; already referenced by other treatment recipes.'],
        ],
      },
      paragraphs: [
        'The direct primitive and the effect coexist in one capability. You do not have to insert an extra effect between every primitive and capability. Mended Vitality is useful here because the same treatment output also appears in other recipes.',
        'Neris’s separate d8 permission remains in the character ledger. Gentle Treatment is currently written as 1d4; owning d8 does not silently rewrite that saved recipe. Propose and agree a changed construction before treating it as one.',
      ],
      links: [
        { title: 'Read Gentle Treatment’s public definition', url: `/library/item/CAPABILITY:${NERIS_TREATMENT.capabilityId}` },
        { title: 'Read Mended Vitality’s public definition', url: `/library/item/EFFECT:${NERIS_TREATMENT.effectId}` },
      ],
      details: [{
        title: 'A second recipe uses the same output differently',
        body: 'Dose and Release uses Stored Remedy. Prepare one identified mundane dose with available ingredients, record its shelf life, and expend it once during normal treatment. It also uses the owned Minor Die Block. It neither replenishes itself nor grants an endless supply of doses.',
      }],
    }],
  },
  {
    id: 'neris-at-table', title: 'Resolve one treatment from intent to changed state',
    summary: 'Use the actual +10 scoped Influence check, then an illustrative roll of 3 on the recipe’s 1d4.',
    keywords: 'worked example check DC roll threshold condition patient healing Vitality manual dressing cost',
    blocks: [
      {
        title: 'Agree this particular treatment before rolling',
        body: NERIS_TREATMENT.scope,
        paragraphs: [
          'For this illustration, the patient has 6 of 12 Vitality and agrees to treatment. The group establishes that one clean medical dressing is actually available. The table chooses DC 12 for the scoped reassurance/procedure check; success permits this recipe’s 1d4 restoration. Failure would spend the dressing and time without restoring Vitality. No additional Neris Vitality payment is agreed for this ordinary treatment.',
          'Those numbers, supply use and failure stakes are this example’s rulings. The capability does not impose a universal DC, a compulsory dressing cost or automatic consent. A nervous, willing patient can accept reassurance; an Influence result does not force an unwilling patient to consent.',
        ],
      },
      {
        title: 'Apply the relevant bonus once',
        ordered: [
          `Confirm the authored reassurance condition holds. Ordinary Influence is Mental 5 + PB 3 = +${NERIS_EXAMPLE.ordinaryInfluence}; this specific condition contributes +2, making +${NERIS_TREATMENT.checkBonus}. It ends on completion or withdrawal of consent.`,
          'Check the displayed contributions. If the sheet already shows +10 for this scoped check, use +10 once. If it still shows the ordinary +8, account for the legal +2 once at the table. The application does not infer this social situation from a patient’s name.',
          `The illustrative d20 result is ${NERIS_TREATMENT.d20}: ${NERIS_TREATMENT.d20} + ${NERIS_TREATMENT.checkBonus} = ${NERIS_TREATMENT.checkTotal}. That meets the agreed DC ${NERIS_TREATMENT.difficulty}. Do not add Mental, PB or the scoped +2 again.`,
          `Resolve the recipe’s ${NERIS_TREATMENT.outputDie}. This example rolls ${NERIS_TREATMENT.rolledHealing}; it is an output amount, not another Influence bonus. The patient’s current Vitality becomes ${NERIS_TREATMENT.patientBefore} + ${NERIS_TREATMENT.rolledHealing} = ${NERIS_TREATMENT.patientAfter}, below the maximum ${NERIS_TREATMENT.patientMaximum}.`,
        ],
      },
      {
        title: 'Record the outcome where it belongs',
        table: {
          caption: 'Exact changes in this illustrative treatment',
          headers: ['Record', 'Before', 'After'],
          rows: [
            ['Patient current / maximum Vitality', '6 / 12', '9 / 12'],
            ['Available medical dressing', '1', '0'],
            ['Neris current / maximum Vitality', '104 / 104', '104 / 104'],
            ['Scoped reassurance contribution', '+2 during the treatment', 'Off when treatment ends'],
            ['Character acquisitions / BU remaining', '19 / 14', '19 / 14'],
          ],
        },
        paragraphs: [
          'On the patient’s editable sheet, open the Vitality controls, choose Heal (Apply healing), enter Amount 3 and confirm Heal. Verify 9 / 12 afterward. The patient’s owner or another permitted editor makes that change; Neris’s own Heal button changes Neris, not the patient. On paper, record the same result directly.',
          'Record the dressing as spent in the group’s supply record and end the reassurance condition. Only end other effects when their own terms say to do so. No BU is spent again for using the existing ingredients. If the treatment had failed, follow the agreed failure outcome instead.',
        ],
      },
    ],
    sources: [characterSource, { title: 'Rules: apply table outcomes on a sheet', url: '/rules#sheet' }],
  },
  {
    id: 'neris-your-build', title: 'Fork the example or build a different person',
    summary: 'Use the checked trail to make a deliberate variation, then review the real foundation and budget.',
    keywords: 'fork create character build handoff review foundation domain verb alpha Orren advanced',
    blocks: [{
      title: 'Keep the example and your own work separate',
      ordered: [
        'Inspect the public Neris sheet and the definitions behind the recipe. Public reading is available without creating an account.',
        'To adapt that character, sign in and use Fork. Work on your own copy; the public example remains read-only. Check the copied level, attributes, acquisitions, equipment and version information before playing.',
        'To begin a different concept, use Build your character and the existing Quickbuild or Complete character flow. Agree a starting budget with your GM and choose the actual permissions it needs.',
        'Review required domain/verb access, remaining character BU, item accounting and the proposed changes before applying the build. Referencing a recipe is not proof that every new foundation requirement has been satisfied.',
        'Try one bounded action, explain its ingredients in ordinary language and record the result. Keep the acquired permissions available for other suitable expressions, rather than treating saved capability cards as the complete list of possible actions.',
      ],
      links: [
        { title: 'Inspect and fork Neris', url: NERIS_SHEET_URL },
        { title: 'Build your character', url: '/characters/new' },
        { title: 'Use one set of primitives in several ways', url: '/creating' },
        { title: 'Print or fill the Build with Neris companion (PDF)', url: '/press/materials/swordweave-build-with-neris.pdf' },
        { title: 'Prepare a session with the printable or fillable run sheet (PDF)', url: '/press/materials/swordweave-first-session-run-sheet.pdf' },
      ],
      details: [
        {
          title: 'Rebuilding this saved alpha example in the current creator',
          body: 'The saved Neris character ledger has no named Domain-category acquisition. Its specific physical treatment recipes do not grant unrestricted domain magic. Today’s new-character flow asks for domain and verb access, so review the appropriate foundation with your GM when rebuilding or changing the example. This walkthrough does not silently add a domain to the public record or claim that this exact snapshot was freshly recreated through the current validator.',
        },
        {
          title: 'Next: inspect Orren’s more elaborate construction',
          body: 'Orren Vaultwright is a level-16 Ironborn, Siege Mason and Terrain Architect. Inspect the stone constructions, material requirements, equipment and conditional Shielded Passage benefit. Ask the same questions: what is owned, what the saved expression actually says, what the current scene permits and what it costs.',
          links: [{ title: 'Inspect Orren’s advanced example', url: ORREN_SHEET_URL }],
        },
      ],
    }],
    sources: [{ title: 'Rules: your first character', url: '/rules#first-character' }, { title: 'Rules: the first-session checklist', url: '/rules#start' }],
  },
];
