# Beginner guide and public explanation review — 4 October 2026

## Teaching outcome

The guide now begins by teaching a shared tabletop game to someone without prior gaming knowledge. It explains the DM, party, scene, intent, dice notation and a complete check, then walks through a first character and a complete party combat round. Reference topics remain accessible from the same page and the sheet modal.

Optional panels provide all three attribute definitions, all ten practice definitions, access vocabulary, seven Strain grades, component tier guidance, CV calculations, interruption outcomes and cover examples. Search includes panel contents and opens optional panels while searching. Sequential previous/next navigation provides a reading path.

## Rules clarified

- Players buy reusable primitives; capabilities are convenient compilations, not a closed action list.
- An owned compatible primitive may be used in either direction without a second purchase. Personal mirrored drawback consequences remain accounted for.
- Spare BU can acquire or invent a primitive during play, including combat when appropriate and agreed.
- Range and dice type are permissions. Other table-selected numerical scaling does not each require a purchase by default, but contributes to action weight and CV.
- CV is the evaluated total composition, including chosen scaling and added effects/primitives. The chosen value minus the minimum value is the scaling increase, not total CV. This does not charge purchase BU again at runtime or modify a resolution roll.
- Strain is judged from the actual scale, impact, complexity, circumstances and urgency. Numeric scaffolding is optional guidance; costs can be numerical, roll-related, resource or narrative consequences.
- Maintenance can trade lower initial pressure for ongoing payments and interruption exposure. Interruption requires an actual window and relevant interference; damage does not universally cancel an action.
- Context gives conditions their meaning, including whether they interrupt casting or maintenance.
- One DC remains `5 + PB + selected attribute including modifiers + direct DC modifiers`; three saving throws remain separate. Rounding remains upward.
- Levels continue beyond 20 and are a progression reference, not a complete measure of power. The DM awards BU without a fixed schedule.

## Source checks

Fresh Notion reads (4 October 2026):

- [Leveling & Progression Canon v1](https://app.notion.com/p/37fed8479ccd80fba08bc88bb715658a): cumulative BU progression, DM awards at any time, reuse and immediate acquisition. Its explicit table agrees with `src/lib/engine/bu.ts` (L1=25, L5=69, L9=117, L10=127, L13=169, L17=225, L21=286). The prose spike labels describe bracket boundaries while the cumulative table applies the increase at the next level; the guide uses the cumulative table and avoids double counting. Some legacy Vitality cells conflict with their own PB column; the guide uses the current engine formula instead.
- [Player Loop and Runtime Clarifications](https://app.notion.com/p/37fed8479ccd811b9b1cc3a97723dc6e): ordinary language, heuristic Strain, atomic capability and per-capability upkeep, conditions interrupt only when defined or ruled, no default initiative.
- [Evaluation Layer Canon v2](https://app.notion.com/p/37eed8479ccd81a4bd1ae21e1a0e1354): CV is analytical, not an extra roll modifier.
- Local source snapshots: `docs/audit-sources/02`, `03`, `08`, `10`, `12`, `13`, `15` provide composition, practices, upkeep, cover and seven Strain grades.
- Current conversation rulings override older source formulas, broad condition packages and ownership interpretations.

The phrase “10 per level” was checked independently: no XP/experience-point fields exist in the character data and the current sheet explicitly describes DM Bonus BU as an alternative to experience points. The guide states ordinary +10 **BU** progression steps and DM-paced awards; it does not invent an XP rule.

## Public-site corrections

Home now introduces the player/DM conversation and explains descriptive primitives and improvised compositions. The walkthrough explains both current creation modes and heritage foundations rather than requiring all heritage work after creation. The character introduction's erroneous prohibition on positive use of mirrored primitives is corrected. The combat page emphasizes a shared party plan and maintenance trade-offs, with a direct guide link. The public mobile menu now uses a single centered X glyph rather than transformed hamburger lines that did not align.

## Validation

- Four recursive-search tests passed, including optional definitions and analytical examples, whitespace/case handling and an empty search's full reading order.
- Scoped ESLint passed after replacing the final internal anchor with Next Link (existing set-state-in-effect pattern excluded for this pass).
- `npx tsc --noEmit` passed on the combined working tree after this implementation. Visual integration checks remain part of the parent refinement pass. No rules engine or database changes are included in this work.
