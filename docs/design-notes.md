# SwordWeave Design Notes

## Primitive Market Revision - Mirror Vectors

Source: `BU_Market_of_Primitive_components__Complete_System.pdf`, revised July 3, 2026.

The primitive system now supports negative primitives through the Mirror-Vector Architecture.

Core rule:

- A standard primitive vector costs positive BU and grants a benefit, permission, or structural capability.
- A mirror primitive vector grants negative BU credit by adding a real drawback, vulnerability, or penalty to the character ledger.
- Mirror vectors are not a separate flaws subsystem. They are primitive-ledger entries with inverted mechanical direction.

Mirrorable primitive categories:

- Numerical metrics: penalties to practices, attributes, accuracy tracks, defensive DCs, or similar sheet baselines.
- Vitality blocks: reductions to max vitality or other survivability pools.
- Probability bias tracks: permanent disadvantage or negative bias on a specific practice, save, or resolution gate.
- Structural faults: vulnerabilities such as doubled damage, failed initial saves, or similar exposed weaknesses against a domain or payload.
- Kinematic metrics: movement penalties such as reduced land speed.
- Strain and cost buffers: inverted mitigation, such as increased strain or doubled vitality costs.

Non-mirrorable primitive categories:

- Verbs and domains, because they are semantic permissions.
- Damage/healing dice blocks, because negative dice are not valid currency.
- Range gates, sizing templates, targeting logic, and duration permissions.
- Qualitative bypasses such as flight, darkvision, tremorsense, phase movement, reaction slots, or trigger hooks.
- Foundational semantic state tags that define what an intent can legally touch.

Balancing rules:

- Mirror credit only counts when the drawback creates real structural friction in the current campaign.
- The DM must approve every mirror primitive.
- A flaw that the DM cannot reasonably expose should grant 0 BU or reduced BU.
- Track a character's total negative primitive debt as Volatility Rating.
- Default volatility ceiling for levels 1-4: max -8 BU.
- Default volatility ceiling for levels 5-10: max -12 BU.
- Default volatility ceiling for levels 11-15: max -16 BU.
- Default volatility ceiling for levels 16+: max -24 BU.

Future schema/UI implication:

- Primitives need mirror metadata: mirrorable boolean, vector type, mirror BU value/credit, exposure notes, and DM approval state when assigned to an entity.
- Entity primitive ledgers need to distinguish standard owned primitives from mirrored negative ledger entries.
- Character creation should show volatility rating and enforce/edit max penalty tier rules.

## Character Creation Reminders

- When selecting library primitives, effects, capabilities, backgrounds, races, items, or templates, players and DMs must be able to override or adjust costs.
- Character creation at level X should allow normal level-derived BU budget.
- Character creation at level X should also allow explicit custom BU budget as a proxy for level.
- The max penalty tier / volatility ceiling for characters taking negative primitives must be editable by the DM.

## Import, Export, and AI Pack Notes

- Users should eventually be able to export and import primitives, effects, capabilities, characters, items, monsters, background templates, class/build templates, and whole builds.
- JSON is the likely interchange format because it can preserve nested primitive/effect/capability graphs and hard modifier directives.
- Imports should support both personal/account-owned records and public library records.
- Imported records need attribution/source metadata and conflict handling for duplicate names, IDs, or incompatible schema versions.
- Library content should remain editable after import, including BU cost overrides.
- The app should eventually provide AI-facing JSON instructions/prompts so a model can generate SwordWeave-compatible content from scratch.
- AI import prompts must be treated as assisted drafting, not trusted execution. The app should validate categories, hard modifier targets, BU costs, mirror eligibility, and required fields before saving.
