# Phase 4 depth and buildability review

Research supplement to [the 34-game inspiration catalog](./phase4-inspiration-catalog-2026-10.md), 2 October 2026. This is a **read-only authoring plan**, not published database content. The earlier catalog has 20 proposed effects, 26 capabilities, 20 upbringings, and 20 manifests. Those are too few to be a finished public shelf, and many lack a checked assembly. This supplement adds **24 effects, 24 capabilities, 24 upbringings, and 24 manifests**: proposed totals of **44 effects, 50 capabilities, 44 upbringings, and 44 manifests**. Counts are ideas, not verified playable rows. Exact names and prices remain subject to a duplicate and editorial pass. The library must support characters across **all budgets and stages of development**, including substantial heritages whose assembled cost is well above the 25 BU creation package.

**Selection principle:** optimize for how easily a player can find useful pieces and assemble the character they imagine. In every major role and theme, offer a compact ready-to-use option, several narrower forks and effects to grow it, and deeper composed capabilities and heritages for larger budgets. A 10, 20, or 50 BU heritage can all belong in the public library if its components and price are clear; those numbers are examples, not mandated price bands. Players remain free to buy the same components separately or place them in a different channel. Starter coverage is one usability check, not the organizing rule for most entries.

## What the current system can express

The read-only public DB has 459 primitives. Relevant *existing* rows include the +1/+2/+3/+5/+PB ladders for Practices and the three separate saving throws; Attack and the **one DC**; +2/+3/+5/+PB Attributes; Vitality, walking/climbing/swimming/flying/burrowing speed, carry capacity, and equip slots. It also contains named typed resistances/immunities, several sensory and bodily permissions, targeting/area, range, duration, action timing, and domains. The phase-3 audit documents 157 new versioned forks and their resolver checks in [primitive-audit-2026-10.md](./primitive-audit-2026-10.md).

The schema supports effect → primitive, capability → primitive/effect, heritage → primitive/capability, and item → primitive/effect/capability links. Effect primitive links store `targetWho` (`self`, `target`, or `scene`) and mirror state. The resolver evaluates supported sheet conditions and active/inactive state; target/scene facts unavailable to the sheet require table adjudication. Authored damage and healing output can be displayed, but an action resolver does not automatically apply them to Vitality. Typed resistance likewise has a helper but is not applied by an untyped manual Vitality delta. These are **manual play paths**, which the user accepts, provided cards do not imply automation. A named condition such as poisoned, slowed, or afraid has no fixed SwordWeave consequence.

Codes below: **R** = existing public primitive can supply the stated number or permission, subject to checking its current version and binding; **F** = fork or add a bounded primitive first; **T** = table resolves a stated fictional outcome or manually adjusts Vitality; **X** = requires additional runtime support *if* the card promises automatic resolution. A proposal with `R+T` can be playable now, but its text must make the manual step clear. These codes are design assessments, not test results for saved cards.

## Additional source prompts

Four more publisher/developer sources broaden the earlier 34-game scan to **38 games**. They suggest areas of variety, not text or mechanics to copy:

| Source | High-level prompt translated into SwordWeave |
| --- | --- |
| [Vaesen, Free League](https://freeleaguepublishing.com/games/vaesen/) | Its archetypes and life-path approach suggest more prior occupations and investigative support, especially an upbringing that matters outside combat. |
| [Mutant: Year Zero, Free League](https://freeleaguepublishing.com/games/mutant-year-zero/) | Distinct character origins and a harsh exploration setting suggest material survival, improvised repair, and altered bodies. |
| [Draw Steel, MCDM official character sheet](https://files.mcdmproductions.com/DrawSteel/DwarfFury.pdf) | Distinct class and kit fields suggest offering several fighting approaches without making the manifest a locked class or changing SwordWeave's UX. |
| [Divinity: Original Sin 2, Larian](https://larian.com/news/divinity-original-sin-2-is-now-available-on-switch-2-ps5-and-xbox-series-x-s_147) | Flexible builds plus beginner presets suggest visible ready-to-use manifests whose primitives can still be bought and moved elsewhere. |

## 24 additional effects

Each row is a particular authored event and consequence. The name does not define a universal status rule. `targetWho` and ending condition must be set on the saved card. Numeric rows cite the relevant existing primitive *family*; actual row/version is selected during authoring.

| Proposed effect | Assembly and boundary | Path |
| --- | --- | --- |
| **Brace at the Threshold** | +2 Physical save to the braced subject until leaving a named doorway; fork the existing flat save bonus to encode that condition. | F+T |
| **Lantern Signal Found** | A target can see one agreed signal from a lit scene point until light is blocked; no automatic detection through cover. | F+T |
| **Clear Crossing** | +2 Fieldcraft to a subject crossing one surveyed route, ending after arrival or route alteration. | F+T |
| **Soot-Clouded Vision** | One splash limits sight as written until eyes are cleared; any numeric Awareness change is a separate fork. | F+T |
| **Repaired Grip** | +1 Attack while a named handle remains wrapped and usable. | F+T |
| **Salt-Wet Footing** | −2 Finesse for the named subject on a specific slick surface; fork then mirror or author subtractive version. | F+T |
| **Shelter Against Hail** | A scene location blocks ordinary hail while its cover stands; no damage resistance unless added. | F+T |
| **Tether Before the Drop** | One subject is caught by an anchored line at its stated length and load, until cut or released. | F+T |
| **Fevered Aim** | −2 Attack for a particular fever or exposure until treated; fork and mirror an eligible +2 Attack row. | F+T |
| **Steady Hands** | +2 Finesse for a specified fine task until interrupted. | F+T |
| **Cracked Plate** | One named armor section can be exploited until patched; if it changes the one DC, fork a scoped DC modifier. | F+T |
| **Buoyant Pack** | +10 Swimming Speed only while the specified float remains secured. | F+T |
| **Trail Marked in Resin** | A particular route can be followed by those who recognize the markings until rain or removal. | F+T |
| **Held Breath Reserve** | A subject has air for a stated task and duration; no automatic poison immunity. | F+T |
| **Focused Listening** | +2 Awareness while stationary and listening through a named contact surface. | F+T |
| **Resonant Warning** | A prepared stone gives an audible or tactile warning when disturbed; exact hearing range is stated. | F+T |
| **Shaking Foundation** | A particular scene section becomes unsafe under a specified load until stabilized. | F+T |
| **Mended Vitality** | Author a 1d4 healing-output primitive, roll it, and manually add it to the named target's Vitality within the table's normal limits. The d4 die block alone is not a healing action. | F+T |
| **Barbed Wound** | Author a 1d4 damage-output primitive for the stated action/tick and apply it manually; ending treatment is specified. | F+T |
| **Shared Air Pocket** | Up to a stated number of occupants can breathe in a created pocket until its duration or seal ends. | F+T |
| **Measured Pace** | +5 walking speed on a rehearsed route until the subject leaves it. | F+T |
| **Silenced Mechanism** | One named small mechanism ceases to make its usual sound until reopened or strained. | F+T |
| **Witnessed Oath** | Parties remember agreed words and a visible mark; compulsion or truth detection is not implied. | F+T |
| **Quickened Recovery** | +5 Max Vitality for a stated temporary interval; current Vitality interaction must be explicit. | F+T |

These 24 are *not* 24 unique root primitives. Most numeric variants should fork an existing row with authored condition and scope; the rest are bounded permissions whose text can be the entire primitive rule. The +5 Max Vitality base exists, but a conditional temporary fork and its end behavior still need review.

## 24 additional capabilities

Each capability is a reusable recipe, not a new locked class ability. Effects above are referenced by name to show a workable composition route.

| Proposed capability | Composition or prerequisite | Path |
| --- | --- | --- |
| **Doorway Brace** | Brace at the Threshold + reaction timing; subject must occupy named doorway. | F+T |
| **Hail Canopy** | Shelter Against Hail + range/area/duration; scenery is recipient. | F+T |
| **Surveyed Traverse** | Clear Crossing + route marking permission; route is chosen before use. | F+T |
| **Line Catch** | Tether Before the Drop + rope item, Touch/Near range as actually purchased. | F+T |
| **Handle Wrap** | Repaired Grip + carried materials; expires when wrap fails. | F+T |
| **Smoke Reading** | Focused Listening or a forked Awareness bonus in smoke; says which sense carries the clue. | F+T |
| **Resin Trail** | Trail Marked in Resin + carried resin; no guaranteed pursuit success. | F+T |
| **Float Lash** | Buoyant Pack + physical float item; equipped/carried state must be accurate. | F+T |
| **Hand-Signal Lattice** | Lantern Signal Found + agreed observers and visible points; line of sight matters. | F+T |
| **Stone Alarm** | Resonant Warning + touched-stone permission + duration. | F+T |
| **Patch the Seam** | Silenced Mechanism or Repaired Grip + material and time; one object only. | F+T |
| **Breath Share** | Shared Air Pocket + area/target count + upkeep if maintained. | F+T |
| **Splint and Rally** | Mended Vitality + short-range target; player rolls and manually updates Vitality. | F+T |
| **Barb Placement** | Barbed Wound + weapon/item and a specific hit event; ongoing damage is manual. | F+T |
| **Crack Reader** | Cracked Plate + Knowledge or Fieldcraft; identifies an actual seam, with GM adjudication. | F+T |
| **Pace Caller** | Measured Pace + small-group target scope; separate target handling must be checked. | F+T |
| **Witness Seal** | Witnessed Oath + object mark and consent; no mind control. | F+T |
| **Rapid Scaffold** | Existing Structural Wall/Stationary Zone plus carried frame; strength and assembly time stated. | R+T |
| **Dispersing Screen** | Soot-Clouded Vision + cone/area/duration; obscured consequences remain card-specific. | F+T |
| **Counterweight Lift** | Existing Carry Capacity fork + rigging permission; affects a stated lift, not permanent sheet Load. | F+T |
| **Groundline Scout** | Existing Ground Contact Echo (10 ft) + Touch range; connected ground and moving source required. | R+T |
| **Voice Relay** | Existing Vocal Mimicry + signal protocol; mimicry is not automatic persuasion. | R+T |
| **Wing-Catch Descent** | Existing Controlled Glide + a bounded fall condition; does not grant flight speed. | R+T |
| **Pressed Escape** | Existing Phase Slip or movement permission with range/action; destination must be legal. | R+T |

Some older proposals need honest boundaries: **Relay Guard** cannot automatically transfer a running effect between recipients merely because `targetWho` exists; **Third Beat** has no confirmed automatic two-action counter; **Deflecting Blow** and **Drawback Pulse** need table adjudication of movement and resistance; **Returning Shard** and **Forking Lumen** need separate target/output adjudication; **Lantern Moth** and **Message Moth Case** can be narrative companions, but autonomous turns or attacks would need more rules/runtime. All can be *written* as manual capabilities after those limits are clear. None should advertise automatic execution yet.

## 24 additional upbringings

These are plausible prior lives rather than mandatory skill packages. Each row names an assembly anchor in the existing DB, a proposed capability above, or a needed bounded permission. Authors can choose different BU and swap ingredients.

| Proposed upbringing | First assembly anchor | Path |
| --- | --- | --- |
| **Floodgate Tender** | Fieldcraft Check +1; Line Catch. | R+T |
| **Tunnel Surveyor** | Awareness Check +1; Groundline Scout. | R+T |
| **Rooftop Messenger** | Climbing Speed +5; Hand-Signal Lattice. | R+F |
| **Ferry Quartermaster** | Carry Capacity Augment +10; Float Lash. | R+F |
| **Winter Shelter Builder** | Fieldcraft Check +2; Hail Canopy. | R+F |
| **Market Ledger Clerk** | Reason Check +1; Witness Seal. | R+F |
| **Wellkeeper** | Knowledge Check +1; Breath Share or water-testing permission. | R+F |
| **Bell Foundry Worker** | Prowess Check +1; Stone Alarm. | R+F |
| **Roadside Apothecary** | Knowledge Check +2; Splint and Rally. | R+F+T |
| **Coastal Pilot** | Awareness Check +2; Surveyed Traverse. | R+F |
| **Court Intermediary** | Influence Check +2; Witness Seal. | R+F |
| **Archive Conservator** | Knowledge Check +2; Patch the Seam. | R+F |
| **Firewatch Runner** | Stride Extension +5; Hand-Signal Lattice. | R+F |
| **Quarry Cook** | Fieldcraft Check +1; Hail Canopy for workers. | R+F |
| **Theater Rig Worker** | Finesse Check +2; Rapid Scaffold. | R+T |
| **Tidepool Harvester** | Swimming Speed +5; resin or sample-gathering permission. | R+F |
| **Temple Roof Mender** | Climbing Speed +5; Patch the Seam. | R+F |
| **Caravan Watermaster** | Fieldcraft Check +2; Breath Share. | R+F |
| **City Alarm Keeper** | Awareness Check +1; Stone Alarm. | R+F |
| **Bridge Toll Recorder** | Reason Check +1; Witness Seal. | R+F |
| **Wreck Examiner** | Knowledge Check +1; Crack Reader. | R+F |
| **Moorland Guide** | Fieldcraft Check +1; Surveyed Traverse. | R+F |
| **Workshop Tester** | Finesse Check +1; Handle Wrap. | R+F |
| **Village Mediator** | Influence Check +1; Witness Seal, with no compelled agreement. | R+F |

## 24 additional manifests

A manifest is a current main build, not a permanent class restriction. Its ingredients can instead be bought independently and placed in lineage/upbringing/another card. Each row has a clear play role and at least one assemblable numeric or existing permission anchor.

| Proposed manifest | Core bundle or capability | Path |
| --- | --- | --- |
| **Passage Guard** | Physical Saving Throw +2; Doorway Brace. | R+F+T |
| **Routefinder** | Awareness Check +2; Surveyed Traverse. | R+F |
| **Field Medic** | Knowledge Check +2; Splint and Rally, manual Vitality. | R+F+T |
| **Rope Rescuer** | Prowess Check +2; Line Catch. | R+F |
| **Signal Captain** | Influence Check +2; Hand-Signal Lattice. | R+F |
| **Bulwark Maker** | Save DC +2; Rapid Scaffold and Hail Canopy. | R+F |
| **Understone Listener** | Ground Contact Echo (10 ft); Groundline Scout. | R+T |
| **Vial Brewer** | Knowledge Check +2; Barbed Wound or Mended Vitality, manual output. | R+F+T |
| **Current Rider** | Swimming Speed +10; Float Lash and Tidal Relay. | R+F |
| **Ledge Strider** | Climbing Speed +10; Wing-Catch Descent if glide acquired. | R+T |
| **Resonance Caller** | Domain of Sound; Voice Relay and Stone Alarm. | R+F |
| **Smoke Pathfinder** | Awareness Check +2; Smoke Reading and Dispersing Screen. | R+F |
| **Treaty Binder** | Influence Check +3; Witness Seal. | R+F |
| **Siege Surveyor** | Fieldcraft Check +3; Crack Reader and Rapid Scaffold. | R+F |
| **Packwright** | Carry Capacity Augment +20; Counterweight Lift. | R+F |
| **Quickstep Duelist** | Attack Bonus +2; Pressed Escape. | R+T |
| **Hidden Line Scout** | Awareness Check +2 while tracking; Resin Trail. | R+F |
| **Storm Shelterer** | Fieldcraft Check +2; Hail Canopy and Breath Share. | R+F |
| **Carapace Sentinel** | Retractable Carapace; Doorway Brace and Physical Save +2. | R+F+T |
| **Boundary Mage** | Domain of Stone, Structure Tier I, Structural Wall; Rapid Scaffold. | R+T |
| **Precision Stitcher** | Finesse Check +3; Patch the Seam and Splint and Rally. | R+F+T |
| **Echo Skirmisher** | Tactile Echo or Ground Contact Echo; Pressed Escape. | R+T |
| **Beacon Keeper** | Domain of Light or bounded visible-light permission; Hand-Signal Lattice. | F+T |
| **Burrow Scout** | Burrowing Speed +5; tunnel-safety permission and Groundline Scout. | R+F |

## Primitive work implied by this shelf

The numeric ladders already cover most *magnitudes*. The missing public variety is often a **conditional fork** or a **bounded narrative permission**, not a new mathematical operator. Proposed additions to check against the fork map and existing names:

| Candidate | Existing parent/family to inspect | Why it is needed |
| --- | --- | --- |
| +2 Physical save while braced at a doorway | Physical Saving Throw +2 | Makes Brace at the Threshold conditional on authored location. |
| +2 Fieldcraft on a surveyed route | Fieldcraft Check +2 | Gives Clear Crossing an exact scope. |
| +1 Attack while wielding a wrapped handle | Attack Bonus Increment or Attack Bonus +2 | Gives Repaired Grip a smaller item-bound magnitude. |
| −2 Finesse on named slick ground | Finesse Check +2 mirrored, if eligible | Gives Salt-Wet Footing a consequence without a universal slowed rule. |
| +2 Finesse on one fine task | Finesse Check +2 | Gives Steady Hands narrow scope. |
| +2 Awareness through contacted stone | Awareness Check +2 + Ground Contact Echo | Requires both perception bonus and sensory permission. |
| +5 Walking Speed on a rehearsed route | Stride Extension +5 | Makes Measured Pace conditional. |
| +10 Swimming Speed while float equipped | Swimming Speed +10 | Makes Buoyant Pack item-bound. |
| +2 Knowledge for field triage | Knowledge Check +2 | Gives medic upbringing a narrower variant. |
| +2 Influence for witnessed negotiation | Influence Check +2 | Gives Treaty Binder narrower scope without mind control. |
| Bounded signal/mark permission | Existing sensory/behavior family; new description-only fork if no match | Serves Lantern Signal Found, Resin Trail, Witness Seal. |
| Bounded tether/air/shelter permission | Existing structural/targeting/duration family; new description-only fork if no match | Serves Line Catch, Breath Share, Hail Canopy without claiming an automatic physics engine. |
| Bounded object patch permission | Existing composition/structural family; new description-only fork if no match | Serves Handle Wrap and Patch the Seam, limited by materials/time. |
| Conditional +5 Max Vitality | Vitality Core Augment +5 | Temporary end behavior must be clear on current and maximum Vitality. |
| 1d4 healing output to a named target | Existing d4 die block and the builder's `damage_healing_output` rule format | The public numeric output ladder was deliberately held; author a healing-specific primitive and show manual Vitality application. |
| 1d4 damage output to a named target | Existing d4 die block and the builder's `damage_healing_output` rule format | Author a damage-specific primitive and name its trigger/tick; it does not automatically change Vitality. |

These are candidates, not 14 rows to insert blindly. In particular, reuse an existing descriptive primitive if its current text already fits. Preserve source-version lineage and author pricing when forking. For automatic multi-recipient transfer, autonomous companion action, action sequence counters, or physical movement resolution, a new primitive row alone cannot create execution behavior.

## Can the earlier 146 ideas be constructed?

**Many can be composed as playable cards, but not all can honestly promise automatic execution today.** The 146 were unverified sketches. The present DB can carry sensory permissions, numeric sheet effects, scoped conditions, items, and manual target/scene outcomes. A high-level ancestry such as Hollowbone can use Controlled Glide today; a true flying variant additionally buys Aero Unlock/Flying Speed. A simple guard manifest can use the one DC or a named saving throw and a bracing condition. Healing, damage, environmental changes, forced movement, companions, and delayed/repeating sequences need explicit table procedures or more runtime support. The database authoring pass should mark each final card `sheet automatic`, `table/manual`, or `requires runtime`, and validate its exact linked primitive versions. The catalog is a pool of candidates, not a promise that all 146 are publishable as written.

## Originality and lineage images

The [US Copyright Office's games guidance](https://www.copyright.gov/register/tx-games.html) distinguishes a game's ideas from protectable text and art. That supports studying broad design patterns; it does **not** certify a particular final card. The proposed names, wording, fictional combinations, and SwordWeave compositions should be reviewed before publication for close resemblance to a specific ability, species, visual design, or setting. Keep source URLs as internal provenance. Do not copy source prose, art, icons, distinctive names, or signature character designs. Final content and images need their own publication review.

The heritage schema already stores `imageUrl`; the current form takes an absolute image URL (`type="url"`) and the preview/card renders it with `<img>`. Imgur is therefore possible, but not required. A first-party hosted URL is more stable for a public library. Images can be generated **after** lineage cards and visual descriptions are finalized, then uploaded to a controlled host and stored as URLs on the heritage rows. The current app has an icon upload path, but heritage portraits do not use that path; a dedicated upload workflow would be a later implementation choice. No images or DB rows were created in this research pass.

## Authoring gate for the next pass

1. Deduplicate and prioritize the proposed shelves against public DB names and current versions. Select a mix of straightforward, specialized, and extensive builds for each role and heritage channel. Do not force every effect, capability, or heritage toward the 25 BU creation package; the final price is authored from its actual pieces.
2. Save only the necessary primitive forks/permissions. Test each numeric fork on the sheet in active, inactive, condition true/false, mirror, and compiled use before making it public.
3. Author effects, then capabilities, then heritages/items. On every card show the relevant target, duration/end, manual resolution step, and linked version. Keep item BU separate from character BU.
4. Check both a quick-start character and more developed characters for every role, then run the character randomizer. Record any card whose text promises more than the resolver actually computes.
