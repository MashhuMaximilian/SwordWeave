import type { GuideBlock } from './play-guide';

/** PHB Mira / River Hand. These are the published example's acquisitions, not new prices. */
export const MIRA_REUSE_LEDGER = [
  { name: 'Verb Access II', bu: 8 },
  { name: 'Water Domain I', bu: 4 },
  { name: 'Near Range', bu: 4 },
  { name: 'd8 Output', bu: 4 },
  { name: 'Knowledge Proficiency', bu: 4 },
];

export const REUSE_EXAMPLE_BLOCKS: GuideBlock[] = [
  {
    id: 'reuse',
    title: 'One owned set, several actions',
    body: 'Mira, the Player’s Handbook example, repairs canal boats and works with existing water. She has already spent 24 of her 25 character BU. The three permissions below are a 16-BU subset of that existing ledger. Read each definition; their names are not unlimited powers. These are the PHB example’s authored prices, not a new price rule for every table.',
    table: {
      caption: 'Keep this same owned ingredient list for all three water uses',
      headers: ['Owned ingredient', 'What it permits here', 'Existing BU'],
      rows: [
        ['Verb Access II', 'Change existing states or properties: reshape, redirect, combine, separate, transfer or stabilize within owned domain access.', '8'],
        ['Water Domain I', 'Work with grounded water. It does not grant every domain, create water from nothing or control an abstract meaning of water.', '4'],
        ['Near Range', 'Work up to 30 ft away, with an actual located target and an eligible path.', '4'],
      ],
    },
    details: [{
      title: 'Where the other 8 BU went',
      body: 'Mira also owns d8 Output for 4 BU and Knowledge Proficiency for 4 BU: 8 + 4 + 4 + 4 + 4 = 24 BU, leaving 1. None of the following three water uses needs rolled damage or healing, so adding the d8 would not make them more complete. An appropriate output construction can reference that existing d8 separately; the die does not grant a new behavior.',
    }],
    links: [{ title: 'Read Mira’s complete PHB record', url: '/books/players-handbook#mira-a-complete-starting-character' }],
  },
  {
    id: 'expression',
    title: 'Three uses, with the same ingredients',
    body: 'The following are three bounded uses of the same acquired permissions. The table still agrees the actual volume, route, timing and opposition before commitment. The second follows the PHB’s resolved example; the first and third are illustrative applications, not fixed difficulty or Cost entries.',
    table: {
      caption: 'The intention changes; the acquisition ledger stays at 24 BU',
      headers: ['Concrete intent', 'Owned ingredients reused', 'Resolution and Cost for this scene'],
      rows: [
        ['Transfer existing water from an open bucket to an empty basin 10 ft away.', 'Verb II + Water I + Near Range.', 'The route is clear and the quantity small. The GM agrees no roll and negligible Cost. Stop when the transfer is complete.'],
        ['Redirect a narrow visible stream from a worker’s legs, 20 ft away.', 'Verb II + Water I + Near Range.', 'The PHB table agrees a Magical check, DC 12, and continued direction until the worker crosses. Mira’s roll of 7 + 6 = 13 succeeds.'],
        ['Reshape a shallow flow around a stone 20 ft away so one traveler can use the exposed stepping place.', 'Verb II + Water I + Near Range.', 'For this example, the GM permits the small diversion without a roll once Mira has time to establish it. She must keep directing it while the traveler steps past; releasing it lets the ordinary flow return. It does not move the traveler or create a permanent bridge.'],
      ],
    },
    paragraphs: ['A wider flow, more recipients, a dangerous route or an urgent deadline changes the attempt’s pressure and may change its resolution and Cost. Those scaling decisions are not automatically a purchase of one new primitive for every die, recipient or second of duration. A genuinely new behavior can still require new access.'],
  },
  {
    id: 'ordinary-owned-missing',
    title: 'Ordinary action, owned access or missing access?',
    table: {
      caption: 'Check permission before increasing the payment',
      headers: ['What Mira proposes', 'What makes it possible'],
      rows: [
        ['Carry a bucket by hand along a reachable path.', 'An ordinary action. Mira does not need to buy extraordinary Water access merely to lift the bucket; weight, footing and interference can still matter.'],
        ['Guide existing water across the room.', 'The owned Verb II, Water I and Near Range permissions above. Reference them again without another acquisition charge.'],
        ['Heal an injured worker by moving that water.', 'A different behavior to establish. Water access and a bigger Cost do not automatically grant healing; inspect or author the actual treatment/healing permission before claiming that outcome.'],
        ['Guide water she cannot locate, beyond the owned reach.', 'A real targeting or range gap. Paying more effort does not silently grant an absent sense or different range permission. Change the approach or acquire appropriate access when agreed.'],
      ],
    },
  },
  {
    id: 'river-hand-resolution',
    title: 'Resolve one use all the way through',
    ordered: [
      'Intent and access: Mira can see the worker and the existing narrow stream 20 ft away. Verb II, Water I and Near Range fit the proposed diversion; no damage or healing is being attempted.',
      'Agree before commitment: for this particular current, use a Magical check against DC 12. The Cost is the restriction that Mira keeps directing this channel until the worker crosses. The number 12 is this example’s threshold, not the DC of every water use.',
      'Roll once: Mira’s Magical attribute 4 plus applicable PB 2 gives the combined +6. A d20 result of 7 gives 13, meeting DC 12. Do not add the attribute and PB again.',
      'Apply the outcome: the stream is diverted and the worker crosses. Mira releases the working; normal flow resumes. Record the task as complete. There is no automatic d8 damage, no Vitality bill introduced by the example, and no second purchase of Water I.',
    ],
    details: [{
      title: 'If the working must continue into another round',
      body: 'Agree its maintenance requirement, continuation point and ending before commitment. Council can be that point; there is no universal requirement to pay at the start of every individual turn. If Mira must keep directing the channel, record that restriction while it lasts. Duration alone does not create upkeep.',
    }],
  },
  {
    id: 'save-river-hand',
    title: 'Save one expression without buying it again',
    ordered: [
      'In the Atelier, choose a Capability and call it River Hand. Write the intended result: guide or reshape existing located water within 30 ft. Start from your own concept when you want a different working.',
      'Reference the already owned Verb II, Water I and Near Range ingredients. You may group them first as the Guided Water effect, or put primitives directly in the capability. An effect is a useful organization choice, not a compulsory extra layer.',
      'Describe the useful expression: redirect a narrow stream or transfer water between vessels. Note that the scene determines the actual quantity, path, opposition, resolution and continuation requirement. Do not save DC 12 or guaranteed success as a universal property of River Hand.',
      'Preview the composition and save it privately while testing. For the character, review the draft and its underlying acquisitions before applying it. Naming this expression does not turn the 24-BU ledger into 48 BU or duplicate the same contribution.',
      'Use River Hand as a convenient starting point during play. Mira may still propose the other eligible water uses, or save another capability that references the same owned set. A new permission is a separate acquisition when the new idea actually needs one.',
    ],
    links: [
      { title: 'Compose in the Atelier', url: '/atelier?build=capability' },
      { title: 'Learn the primitive editor', url: '/tutorials/create-a-primitive' },
      { title: 'Read Strain, Cost & scaling', url: '/rules#strain' },
    ],
  },
];
