import type { GuideTopic } from './play-guide';

export const PRIMITIVE_TUTORIAL_INTRO = {
  title: 'Create your first primitive',
  summary: 'Follow one rule through the Atelier, from a description to Result, Operation, Value, Recipient and Trigger. Then check what you actually saved.',
  editionNote: 'This v0.1 alpha walkthrough uses an illustrative +2 attack-roll bonus. Its BU price is a separate agreement with your GM; the number 2 is the bonus, not its price.',
};

/** The existing editor walkthrough, shared by the reading surface and text export. */
export const PRIMITIVE_TUTORIAL: GuideTopic[] = [
  {
    id: 'choose',
    title: 'Decide what the primitive does',
    summary: 'Choose one clear outcome before setting its mechanical rule.',
    keywords: 'primitive outcome permission narrative mechanical tracked number access ownership reuse action cost',
    blocks: [
      {
        title: 'Start with one clear outcome',
        paragraphs: [
          'Start with one clear outcome: while this primitive is active, add 2 to the character’s attack rolls. This example changes a tracked number. It does not add damage or grant a new way to reach a target.',
          'A primitive can also describe a fictional permission without changing a tracked number. In that case, its Verbose Narrative Rule can be the complete explanation. Add a mechanical rule when you need a tracked change or a construction permission.',
          'Owning a primitive and using an action are separate. A character can reuse owned permissions in several actions and capabilities. The scope, resolution and execution cost of an attempt still depend on the situation.',
        ],
      },
    ],
  },
  {
    id: 'identity',
    title: 'Give it an identity',
    summary: 'Name and describe the primitive, review its price, then start the mechanical rule.',
    keywords: 'identity name icon lexicon category universal mathematical modifiers tier bracket exact bu price phone rule format change number',
    blocks: [
      {
        title: 'Open Identity',
        body: 'In the Atelier, choose a new Primitive and open Identity. If another draft is already open, finish or keep that work before starting this example.',
        ordered: [
          'Give the example a name you will recognize, such as Steady Aim · tutorial.',
          'Choose an icon and a Lexicon Category appropriate to the rule (Lexicon on a phone). For this numerical example, inspect Universal Mathematical Modifiers.',
          'Review Cost Tier Bracket and Exact BU with your GM (Tier and Cost (BU) on a phone). A bracket is a pricing anchor; this tutorial does not establish the correct purchase price.',
          'Write the intended behavior in Verbose Narrative Rule: “While active, add 2 to the character’s attack rolls. This bonus does not add damage.”',
        ],
      },
      {
        title: 'Choose the mechanical format',
        body: 'Now open Mechanical rule and choose Change a number. On a phone, open Rule format first to reveal that choice. The format supplies a starting rule. Review every field even when the starting values already look right.',
      },
      {
        title: 'The rule we are building',
        table: {
          caption: 'Illustrative editor settings, with pricing agreed separately',
          headers: ['Result', 'Operation', 'Value', 'Recipient', 'Trigger'],
          rows: [['Attack Roll', 'Add', 'Fixed number: 2', 'Self', 'Always']],
        },
      },
      {
        title: 'Read it aloud',
        body: 'Read it aloud: Change Attack Roll by adding 2 for Self. Include it whenever the primitive is active.',
      },
    ],
  },
  {
    id: 'result',
    title: 'Result: what changes?',
    summary: 'Select the named number or permission that the rule changes.',
    keywords: 'result rolls checks action roll attack roll any skill practice awareness fieldcraft character sheet movement vitality value',
    blocks: [
      {
        title: 'Choose Attack Roll',
        paragraphs: [
          'Choose Result, then Rolls & checks. In Action Roll, select Attack Roll. Choose the named result rather than Any, which is broader than this example.',
          'The Result identifies the number or permission being changed. It is different from the Value, which supplies what will be added, set or otherwise applied.',
          'For a bonus to Awareness or Fieldcraft, inspect Skill / Practice Check instead. For a movement speed or maximum Vitality, inspect Character sheet. Changing the primitive’s name does not change its selected Result.',
        ],
      },
    ],
  },
  {
    id: 'operation',
    title: 'Operation: how does it change?',
    summary: 'Add a contribution, and distinguish it from the other operations.',
    keywords: 'operation add set multiply grant revoke permission state feature generated sentence',
    blocks: [
      {
        title: 'Choose Add',
        paragraphs: [
          'Choose Operation and select Add. We are adding a contribution to the attack-roll bonus.',
          'Set assigns a value instead. Multiply scales a value. Grant and Revoke concern permissions, states or features. These choices are different rules, even if the Value happens to be the same.',
          'Watch the generated sentence above the editor. It should still describe the rule you meant to create.',
        ],
      },
    ],
  },
  {
    id: 'value',
    title: 'Value: by how much?',
    summary: 'Apply the fixed number 2 and check what the other Value formats mean.',
    keywords: 'value fixed number use number shortcut sheet proficiency bonus dice formula state keyword custom runtime cost price',
    blocks: [
      {
        title: 'Apply a fixed number',
        body: 'Choose Value and select Fixed number. Click the 2 shortcut, or type 2 in the custom number field and click Use number to apply it. Confirm the generated sentence shows 2. This is the amount of the bonus. It is neither the primitive’s BU price nor an action’s execution cost.',
      },
      {
        title: 'Other Value choices',
        table: {
          caption: 'Other Value choices answer different questions',
          headers: ['Choice', 'Use it when'],
          rows: [
            ['Sheet value', 'The contribution reads a character value, such as Proficiency Bonus, rather than a fixed number.'],
            ['Dice', 'The rule needs a rolled value. Check where and how that output is resolved; a die alone does not define a complete attack or healing action.'],
            ['Formula', 'The contribution uses an expression. Check the editor’s validation and preview before applying it.'],
            ['State / keyword', 'The rule uses a named state or permission, shown in square brackets. A keyword is not a numerical bonus.'],
            ['Custom runtime', 'The rule reads a named value supplied during play. Define who supplies it and what it means.'],
          ],
        },
      },
      {
        title: 'Keep Result and Value distinct',
        body: 'Keep the distinction visible: a Result is what changes; a runtime Value reads something used to calculate that change. Naming a runtime value does not make the application detect it automatically.',
      },
    ],
  },
  {
    id: 'recipient',
    title: 'Recipient: who receives it?',
    summary: 'Choose Self, and distinguish the recipient from reach and targeting permissions.',
    keywords: 'recipient self target scene creature object range targeting permission automatic cross character updates',
    blocks: [
      {
        title: 'Choose Self',
        paragraphs: [
          'Choose Recipient and select Self. This is the character who owns or uses the rule.',
          'Target refers to the creature or object affected by the action. Scene refers to the shared environment or encounter state. Those choices do not by themselves grant range, targeting permission, control of another sheet or automatic cross-character updates.',
          'For this example, the generated sentence should still end with for Self.',
        ],
      },
    ],
  },
  {
    id: 'trigger',
    title: 'Trigger: when does it apply?',
    summary: 'Use Always for the first rule, then distinguish tracked and declared conditions.',
    keywords: 'trigger always condition active inactive equipped tracked declared table state comparison and or manual',
    blocks: [
      {
        title: 'Choose Always',
        paragraphs: [
          'Choose Trigger and select Always. No condition is stored. The modifier is included while its containing primitive, effect, item or capability is active.',
          'Always does not mean an inactive or unequipped source must contribute. Check the source’s actual state on the sheet.',
        ],
      },
      {
        title: 'Tracked condition',
        body: 'The engine reads supported sheet, target or scene state. Choose the actual state, comparison and value; combine predicates with AND or OR when needed.',
      },
      {
        title: 'Declared at table',
        body: 'A player or GM switches on a named situation. Use this when the fiction needs a declaration rather than something the sheet can detect by itself.',
      },
      {
        title: 'Try a condition after the first rule works',
        body: 'Keep the first example on Always. Once it works, a useful second exercise is to define a condition and confirm both its active and inactive behavior.',
      },
    ],
  },
  {
    id: 'stacking',
    title: 'Choose how contributions combine',
    summary: 'Review stacking separately from reusing an owned acquisition.',
    keywords: 'stacking rule how combine stack all compare resolver order highest lowest contribution repeat replace reuse acquisition purchase',
    blocks: [
      {
        title: 'Review the stacking policy',
        paragraphs: [
          'Under Stacking rule → How they combine, inspect Stack all and Compare all stacking rules. Stack all keeps contributions and combines them in resolver order; other choices can retain the highest or lowest contribution, limit repeated application, or replace an earlier contribution.',
          'Choose the policy the rule actually needs. Reusing the same owned acquisition in several compositions is separate from stacking several active contributions. It does not charge the character for that acquisition again.',
        ],
      },
    ],
  },
  {
    id: 'review',
    title: 'Review, save and try it',
    summary: 'Check the stored rule, save the practice entry privately, then compare its actual contribution on a test character.',
    keywords: 'review save primitive private publish preview json draft apply attack bonus baseline test acquire toggle standalone active equipped',
    blocks: [
      {
        title: 'Review and save',
        ordered: [
          'Read the complete generated sentence. Check Attack Roll, Add, 2, Self and Always.',
          'Compare that sentence with the narrative description. Resolve any mismatch before saving.',
          'Review the live preview. The optional Full Primitive JSON Preview lets you inspect the stored rule; you do not need to write JSON to use the editor.',
          'Open Publish. For a practice entry, choose Private visibility. Add accurate tags and a source if useful.',
          'Choose Save Primitive. Wait for the saved confirmation. Authoring from inside a character instead uses Add to draft or Update draft; review that character draft before applying it.',
          'Open the saved entry again and inspect it. Saving an entry does not automatically give it to every character.',
        ],
      },
      {
        title: 'Try it on a test character',
        paragraphs: [
          'Try the rule on a character you use for testing, with the agreed BU available. Record its attack-roll bonus first, acquire the saved primitive in the character draft, then apply the draft and compare. A baseline bonus of +5 with only this +2 contribution becomes +7. If other rules affect the result, inspect them too.',
          'A standalone primitive does not have a general on/off button. To test activation separately, use it inside a capability or effect that supports toggling, then compare the enabled and disabled states.',
          'If the number does not change as expected, check ownership, active/equipped state, Result, Recipient, Trigger and stacking before adding another rule. A numerical bonus still needs an actual action and the table’s agreed resolution.',
        ],
      },
    ],
  },
  {
    id: 'next',
    title: 'Build on the example',
    summary: 'Try one variation at a time, or continue into reusable construction permissions.',
    keywords: 'next practice sheet value condition domain access verb access range output die scaling contact help',
    blocks: [
      {
        title: 'Choose the next exercise',
        paragraphs: [
          'Next, try a single named Practice bonus, a rule that reads a sheet value, or a clearly declared condition. Change one idea at a time and compare its preview with its actual use.',
          'For construction permissions, inspect formats such as Domain access, Verb access, Range or Output die. These define access for composing actions. The other scaling choices discussed at the table are not automatically a list of extra purchases.',
        ],
        links: [
          { title: 'Build your own rule', url: '/atelier?build=primitive' },
          { title: 'One set of primitives, several uses', url: '/creating' },
          { title: 'Player’s Handbook', url: '/books/players-handbook' },
        ],
      },
      {
        title: 'Ask about a confusing result',
        body: 'For a question or a confusing result, use Contact and describe the intended rule and what you observed.',
        links: [{ title: 'Contact', url: '/contact' }],
      },
    ],
  },
];
