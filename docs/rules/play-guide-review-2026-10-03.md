# Central play guide — source review

Local implementation: `/rules` and the same component in the character-sheet FAB modal. Existing contextual help stays available. No database changes or resolver changes.

## Sources checked in Notion

- SwordWeave TTRPG hub — 37eed8479ccd81fa8150d0b31e22ff1f
- Player Loop and runtime clarifications — 37fed8479ccd811b9b1cc3a97723dc6e
- Combat Rhythm — 392ed8479ccd80f5b55ffe9863ab815d
- Capability Composition Map — 37fed8479ccd810dbd98e4c942a98553
- Upkeep & Interruption — 37fed8479ccd81aa9467d9779c45f40a (September clarification: contextual cost, independent Track/Duration/Upkeep)
- Damage & Resistance — 380ed8479ccd81f69dcbf3888f5e384b
- Evaluation Layer — 37eed8479ccd81a4bd1ae21e1a0e1354
- Vitality — 37eed8479ccd81d693dbf6ca9b4ac4c4
- Encumbrance — 380ed8479ccd8114afb0c77a0dd0b3ed
- Tactical Subsystems — 390ed8479ccd80118106cd4b8f28a9bf

Also checked saved practice and probability-bias source exports, the live sheet resolver, creation budget policy, and current project conversation decisions.

## Explicit precedence decisions

The user's current rules override older examples: single DC = 5 + PB + selected modified attribute + direct modifiers; three separate saves; round up; Touch/1d4 are free baselines; mirrors are uses of existing primitives; narrative permissions need not be numerical; conditions are contextual; item BU is separate; primitives are reusable purchases; no class/ancestry UX restrictions introduced.

Older composition examples describe attribute-specific DCs; those examples are deliberately not reproduced. Damage page's clarification supersedes its older ambiguous example 8: matching resistance + vulnerability cancel. Damage immunity alone does not imply every related state is negated: scope matters.

## Clarification requested

Upkeep page lists automatic ending conditions; Player Loop says conditions interrupt only if defined or adjudicated. Asked the user which applies. Current guide explains checking the effect and agreeing the interruption with the GM, without publishing a universal named-condition list.

## App versus table

Guide explicitly explains that typed damage/resistance/healing is resolved at the table and applied manually to Vitality. It does not claim an automatic action resolver. Tracked versus manually activated authored conditions and pinned version behavior are explained.

## Verification

- TypeScript check passed.
- New guide component/content/page lint passed; broader GlobalControls lint reports existing state-in-effect errors outside this change.
- Browser: public guide, topic switching/deep link hash, search within examples, no-result recovery, desktop sheet FAB modal, phone layouts, Escape and close return to sheet.
- Fixed page topic scrolling, inherited search-input chrome, and inherited phone-modal heading size.
- Local screenshots: output/play-guide/rules-page.jpg and output/play-guide/sheet-modal.jpg.
- Left local for review; no production push in this pass.
