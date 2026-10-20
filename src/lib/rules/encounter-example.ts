/** Pinned public v1 creatures and the PHB Mira record, with separate scene rulings. */
export const ROOTED_FORD_HOSTILE = {
  encounterId: '2aec9871-7900-59f4-a68f-7cd8b80af5a9',
  collectionId: '20bdea10-4878-5ffe-abff-37f9bdc1527e',
  jackalId: '74929175-01ef-5a77-a864-b1232d02e940',
  grazerId: '3ff11c7b-dfb7-583e-a943-d19b7f3fcfd0',
  mira: { physical: 3, pb: 2, proficientAttribute: 'Magical', dc: 11, vitalityBefore: 12, speed: 30 },
  jackal: { budget: 25, physical: 3, pb: 2, proficientAttribute: 'Physical' },
  rolls: { miraClashDie: 12, jackalClashDie: 8, catchDie: 8, catchDc: 10, jackalAttackDie: 9, biteDamage: 3 },
  state: { miraVitalityAfter: 9, reactionSlotsBefore: 1, reactionSlotsAfter: 0, movementSpent: 10, movementRemaining: 20, carryStrapsSpent: 1, medicinePouchesLost: 0 },
  steps: [
    {
      title: 'Choose this hostile branch deliberately',
      body: 'The party tries to recover the medicine while one jackal contests it. Mira joins as the PHB’s complete level-1 example, not as an encounter-provided character or a claim that the parties are balanced. She begins at 12 Vitality, DC 11, Physical 3, Magical proficiency, one available Reaction Slot and Speed 30 ft. The public v1 Thornpath Jackal has Physical 3 and Physical proficiency; its 25-BU baseline gives PB 2. Driving Blow references Driving Strike, which grants no extra attack or damage. Climbing Speed +5 changes climbing only.',
    },
    {
      title: 'Council: declare every participant’s plan',
      body: 'Mira wants to pull the loose medicine pack onto the gravel edge before Jackal A takes it. Jackal A wants the same pack; both are placed in Fast for this example, because the nearby recovery is immediate. Jackal B uses its Main Intent to climb onto reachable roots and watch the bank rather than attack. The grazer holds beside its calf with its braced stance. Its conditional +2 Physical save needs the named intact rated anchor and tether; no such bonus is assumed merely from the name Anchored Stand.',
    },
    {
      title: 'Before commitment: agree reach, Cost and the possible reaction',
      body: 'The GM establishes a clear 10-ft approach from Mira’s bank to a pack she can lift, with Jackal A within Touch reach. Recovering it by the old strap will tear that strap: this named loss and her exposure beside the jackal are the accepted Cost. An unfastened medicine pouch will start slipping as the pack lifts. The table agrees that an immediate one-handed catch is possible at Touch, Complexity 0–1, with an available Reaction Slot. For this example only, it calls for an untrained Physical check against DC 10; failure loses that pouch to the water. These positions, thresholds and consequences are scene agreements, not values stored in the encounter or universal catch rules.',
    },
    {
      title: 'Fast: settle who reaches the pack first',
      body: 'Mira spends 10 of her 30 ft of movement on the established route. Their opposing Fast intents meet at the pack, so a Reaction Clash answers timing. Mira is not Physical-proficient: 12 + Physical 3 = 15. The jackal is Physical-proficient: 8 + Physical 3 + PB 2 = 13. Mira acts first, pulls the pack onto the gravel edge and tears the strap as agreed. A Reaction Clash is the timing procedure; it does not itself spend Mira’s separate Reaction Slot.',
    },
    {
      title: 'Reaction: catch the slipping pouch',
      body: 'As the unfastened pouch slides from the lifted pack, Mira spends her one available Reaction Slot to catch this single object beside her. Pause that event: her Physical check is 8 + 3 = 11, meeting the agreed DC 10. The pouch is caught, so no medicine is lost. The trigger is visible, the object is within Touch and a hand is available; this is why the immediate baseline reaction qualifies. It is neither an additional Main Intent nor permission to catch every falling object at range. No extra Vitality Cost was agreed for the catch.',
    },
    {
      title: 'The jackal still resolves its one intent',
      body: 'Losing the Clash did not automatically cancel Jackal A. With the pack now secured, the GM pivots its still-unresolved Main Intent to a direct bite at Mira, who remains within Touch. For this illustrative ordinary bite, the table agrees 1d4 Physical piercing damage using the baseline output; that output and damage type are not printed into Driving Strike. Its Physical attack is 9 + 3 + 2 = 14 against Mira’s single DC 11: a hit. The separate d4 result is 3, so her current Vitality changes from 12 to 9. Mira has no relevant resistance in this PHB record. The hit grants no free shove, dropped item, condition, second attack or automatic upkeep repayment.',
    },
    {
      title: 'Finish the round with an exact new state',
      body: 'Jackal B reaches the roots and watches; it did not also declare an attack. The grazer and calf stay together and the crossing is still contested. Mira is beside the recovered pack at the gravel edge, has the caught pouch, 9/12 Vitality, no Reaction Slot left this round, and 20 ft of her round’s movement unspent. The torn carry strap must be replaced; no food ration or medicine pouch was spent in this hostile branch. Record the injury and strap loss manually. At the next Council the baseline Reaction Slot resets to one, but Vitality, supplies and positions do not reset. The party decides whether to withdraw, offer food or continue; safe passage has not been granted automatically.',
    },
  ],
};
