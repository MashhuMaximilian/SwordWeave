# Create a primitive: write its mechanical rule

**Prepared:** 20 October 2026
**Status:** Numbered talking points and shot list for the founder's own recording; not a read-aloud requirement, transcript or timed caption file.
**Target:** About 6–9 minutes, with chapters and deliberate reading holds.
**Audience:** A SwordWeave player who can already inspect a primitive and now wants to author one understandable rule.
**Written companion:** `/tutorials/create-a-primitive` (being prepared separately).
**Production workflow:** [Video production plan](../video-production-plan.md).

## The lesson and example

Build a private demonstration primitive with this readable rule:

> While this primitive is active for its owner, add 2 to that owner's Attack Roll. It does not add damage or improve other rolls. No additional trigger condition is required. Keep contributions according to the stacking rule chosen below.

This is a deliberately small **editor teaching example**, not a newly certified, priced or balanced Library recommendation. The five core choices are **Result: Attack Roll; Operation: Add; Value: fixed number 2; Recipient: Self; Trigger: Always**. The main walkthrough leaves **Stack all** visible and explains that it is an explicit stacking choice. Do not imply that repeatedly placing the same purchased ingredient in different recipes automatically grants extra acquisitions or duplicate bonuses.

The “2” is the amount added to the roll. It is not 2 BU, 2 Strain, damage, or the Cost of using a capability. A cost-tier anchor is also not an automatic quotation for this rule. The founder and table must approve an actual acquisition price before a final recording shows a numeric **Exact BU** entry. The current blank form's default `1` must not accidentally become a teaching claim.

## Source record and preflight

Source inspection at commit `716896cc9ae4816153e2b7329167287a7e72dce2`:

| Source | What was checked |
| --- | --- |
| `src/components/sandbox/primitive-form.tsx` | Identity, Mechanical rule and Publish sections; optional mechanical output; Rule format; starter selection; private default; save feedback |
| `src/components/sandbox/primitive-rule-instrument.tsx` | Result/Operation/Value/Recipient/Trigger labels, exact options, generated sentence, trigger semantics and stacking choices |
| `src/lib/primitives/rule-formats.ts` | “Change a number” compiles through the modifier editor |
| `src/lib/primitives/rule-starters.ts` | “Roll bonus” starter sets Add +2 in the Attack Roll scope; examples are not priced products |
| `docs/publications/manuscripts/players-handbook.md` | “Write a new primitive when your idea needs one,” “Keep one purchase ledger,” and “Write a primitive people can read” |

Recheck the final capture deployment and record its actual commit. Source inspection confirms the authoring controls; it does not prove every downstream resolver or character scenario works. The complete workflow must be rehearsed in the actual UI before footage is approved.

Before recording, confirm these fixture fields with the founder: demonstration name (proposed **Tutorial · Attack roll bonus**), appropriate Lexicon, acquisition price, Cost Tier Bracket and final narrative wording. Keep **Visibility: Private**, use a dedicated demonstration account, and source it as a tutorial example. Do not save over an existing public primitive or founder draft. The recording must not create a public catalogue entry without a separate publication decision.

## Optional sample wording: 20–30 seconds

**The founder records in their own words from the talking points below.** This optional approximately 50-word wording is an editing aid for a future finished footage/voice/captions sample. It is not founder-approved dialogue and does not identify the separate synthetic-voice audition prepared elsewhere:

> “First, choose what changes. Open Rolls and checks, then choose Attack Roll. That is the result this rule modifies. It doesn't add damage, and it doesn't improve every roll. We'll keep the result narrow, then add a fixed two to it in the next steps.”

Start with the five-step navigation visible. Move once to **Rolls & checks**, pause after selection, then move to **Attack Roll**. Use the real click result. Hold the selected scope, crop closer only for the explanatory sentence, and return to the full panel before the final phrase. Keep captions clear of the selected option. No logo sting, music bed or animated avatar in this first sample.

The founder approves the sound and edit. An unfamiliar viewer answers: “What would this bonus affect, and what would it leave alone?” If they answer “damage” or “all rolls,” revise this excerpt before making the full tutorial.

## Chapter plan

These are **planned durations**, not final playback timestamps. Generate chapter timestamps from the locked edit.

| Chapter | Planned duration | Outcome |
| --- | --- | --- |
| The rule we want to express | 35–50 s | Recognize the outcome and distinguish a primitive from a whole capability |
| Identity and readable description | 45–65 s | Name the rule and separate acquisition price from its numeric effect |
| Result and Operation | 60–80 s | Select the exact roll and choose Add rather than Set to |
| Value and Recipient | 50–70 s | Use fixed 2 and Self intentionally |
| Trigger | 60–80 s | Understand Always versus tracked state versus a declared event |
| Stacking, review and private save | 75–100 s | Check the whole rule and verify persistence |
| Change one thing and check scope | 35–55 s | Know the next safe learning step and find the written reference |

Allow additional screen-reading holds if the first viewer needs them. Trim duplicated explanation rather than speed up the cursor or remove essential distinctions.

## Numbered talking points and exact screen actions

For each shot, the founder explains the bullets naturally while performing or reviewing the real action. There is no requirement to read these bullets aloud. The agent edits the actual explanation afterward and flags any changed mechanic for review. Match labels to the capture; do not create a fake UI to match this draft. Pauses are editorial starting points and should be tested with the sample.

### 1. Show the destination

**Visible:** Actual completed demonstration rule in the editor, five-step navigation and sentence visible. Brief title: “Create a primitive · Mechanical rule.” Show the final real state, then clearly cut back to the beginning; this is a preview, not an implied instant creation.

**Talking points:**

- Outcome: add two to the owner's attack rolls while the primitive is active.
- Write the readable rule first, then check that the editor expresses the same thing.
- This teaches the editor; price and use in a character still need table review.

**Edit:** One full-panel view, followed by a close view of the generated sentence. Hold the result for two to three seconds. Cut back to the clean new-primitive form with a clear “Start here” chapter transition.

### 2. Establish when a mechanical rule is useful

**Visible:** **Mechanical rule** section guidance: a rule is optional when no tracked value or construction permission is needed. Return to **Identity** before typing.

**Talking points:**

- A primitive can grant a permission or describe behavior without adding a sheet number.
- Use the mechanical section for a tracked change or construction permission; this example changes a roll.
- One primitive is not a complete attack description with every possible target, damage and consequence.

**Cursor and hold:** Rest beside the guidance while it is explained. No click during the distinction between the primitive and the complete action. Do not demonstrate **Remove mechanical rule** on the working fixture; use a separate take if showing a description-only example later.

### 3. Give it an identity and a readable rule

**Visible:** **Identity**. Name field; **Lexicon**; **Cost Tier Bracket** and **Exact BU** on desktop (mobile labels differ); **Verbose Narrative Rule**. Enter the founder-reviewed name and narrative. Show only approved fixture values for Lexicon/price/tier.

**Talking points:**

- Choose a findable name; explain the player-facing scope in ordinary words.
- It adds two to the owner's Attack Roll while active; damage and other rolls are excluded.
- Lexicon organizes the entry. Acquisition BU and the amount added to the roll are separate decisions.

**Production note:** Do not state a price until its scope and price have been reviewed. Explain the approved demonstration price in the founder's own words, identifying it as an agreement for this rule, not a universal tariff. If pricing is unresolved, the recording is not ready for this shot. The written tutorial can still explain the distinction without inventing a price.

**Edit:** Cut lengthy typing only after the beginning and finished text are visible. Hold the completed description. Show the price label and rule amount in separate close views; avoid a graphic that could make `+2` look like a price.

### 4. Choose the format, and notice the starter

**Visible:** **Mechanical rule → Rule format → Change a number**. On phones, the Rule format control may need opening first. Show the existing five-step instrument and the resulting preset values.

**Talking points:**

- Choose **Change a number** and identify the starter it actually produces.
- Inspect all five decisions even when some are already filled correctly.
- A starter does not price the primitive or prove that it fits a character.

**Cursor and hold:** Click once, let the whole panel settle, then pause. Keep the real initial preset state; do not cut to imply every field was blank if it was already filled. If the current released preset changes, update this sentence and reshoot.

### 5. Result: choose the exact roll

**Visible:** **Result → Rolls & checks → Action Roll → Attack Roll**. The **Any**, save and **Other** choices can remain in frame as context; no need to tour each.

**Talking points:**

- **Result** is what changes: choose **Rolls & checks → Attack Roll** within the Action Roll group.
- Attack Roll is narrower than every Action Roll and different from damage output or a Practice check.
- Selecting the changed result is different from selecting a value to read elsewhere.

**Cursor and hold:** Use the actual selected state. If Attack Roll is already set by the starter, point out and confirm it rather than invent an unnecessary deselect/reselect step. Hold two to three seconds. Crop closer around the Action Roll scope while explaining the distinction, then return to the five-step panel.

### 6. Operation: Add is different from Set to

**Visible:** **Operation → Add**, with **Set to** also visible. Generated sentence updates or remains correct.

**Talking points:**

- **Add** adds a bonus; **Set to** replaces the selected value and expresses a different rule.
- Keep Add for this example.
- Read the generated sentence as a check, using the actual sentence visible in the capture.

**Cursor and edit:** Point to **Set to** without clicking it. Click/confirm **Add**. Do not briefly change the operation and leave an unexplained different result in a cut. Hold on the generated sentence before advancing to Value.

### 7. Value: use the number two

**Visible:** **Value → Fixed number → 2**. The other value-source tabs are visible: **Sheet value**, **Dice**, **Formula**, **State / keyword**, **Custom runtime**.

**Talking points:**

- **Value → Fixed number → 2** is the constant amount added to the roll.
- It is not two BU, two Strain or two damage.
- Other sources can read sheet values, dice or formulas; a fixed bonus does not need that complexity.

**Cursor and hold:** Select the real shortcut **2**. Pause on the selected chip and generated sentence. Do not open the formula editor for decorative footage; it adds a new task without teaching it. Keep the cost field out of this close crop.

### 8. Recipient: Self means the owner or user

**Visible:** **Recipient → Self**, with Target and Scene visible.

**Talking points:**

- **Self** is the character who owns or uses the rule.
- Target is the creature/object affected; Scene is the shared environment.
- This rule improves the owner's roll, so the target creature does not receive the bonus.

**Cursor and hold:** Move to **Self** and pause after selection. Keep its help text readable; this also checks the selected-state contrast fix. Return the cursor to an empty margin.

### 9. Trigger: Always is a condition choice, not infinite activity

**Visible:** **Trigger → Always**. Show its help and the note below: the modifier remains active while its primitive, effect, item or capability is active.

**Talking points:**

- **Always** stores no extra trigger condition for this modifier.
- It does not turn an inactive capability or unequipped item on permanently.
- Explain the actual note: the modifier remains active while its primitive/effect/item/capability is active.

**Cursor and hold:** Hold the note for three to four seconds. Avoid cropping away the word **active** or the explanation beneath the cards.

### 10. Explain the two conditional routes without pretending to test them

**Visible:** A separate clearly labeled comparison take, or the three Trigger choices with a restrained annotation. The main fixture remains **Always**. Do not leave a conditional edit in the fixture that will be saved.

**Talking points:**

- **Tracked condition** reads a supported state the application actually knows.
- **Declared at table** names a situation that a player or GM switches on; typing its name does not let the application infer an unrecorded story event.
- These routes deserve further examples. Keep this first rule on Always.

**Edit:** If opening either option, show an explicit comparison label and return to the main Always take. No staged downstream character change; the comparison demonstrates authoring options only. Do not claim a runtime condition is automated until a separate actual test shows it.

### 11. Read the stacking rule

**Visible:** **Stacking rule → How they combine → Stack all** and its actual help. Open **Compare all stacking rules** long enough to show where further help exists, then close it.

**Talking points:**

- Current selection **Stack all** keeps contributions and combines them in resolver order; it is an explicit rule choice.
- Other choices can keep a highest value or limit repeated contributions; use the behavior the rule intends.
- Reusing one purchased primitive in several recipes does not establish several purchases or free duplicate bonuses.

**Cursor and hold:** Point to the selection and help. Avoid cycling through all options while talking; it makes a confusing half-edited state. The script does not establish that Stack all is the default every new author should choose.

### 12. Review one complete rule before saving

**Visible:** Five-step summary, generated sentence, readable narrative and selected stacking rule in successive real views. The optional **Full Primitive JSON Preview** may be opened briefly only if the narration explains its role.

**Talking points:**

- Read back **Attack Roll; Add; fixed 2; Self; Always**, then the stacking choice.
- Compare generated sentence and readable description for matching scope and conditions.
- JSON preview is optional inspection, not required coding; fix any disagreement before save.

**Edit:** Use a simple five-label graphic beside the actual captured rule only if it improves readability. Do not replace the application's real preview with a rewritten graphic that hides a discrepancy.

### 13. Keep it private and prove the save

**Visible:** **Publish → Visibility → Private**, then **Save Primitive**. Actual success text and the entry reopened from the account's own material. Recheck the same mechanical selections.

**Talking points:**

- Keep the entry **Private** and save it to the demonstration account.
- Saving privately and publishing to the Library are separate choices.
- Wait for real success feedback, reopen the entry, and check persistence; a completed-looking form is insufficient evidence.

**Production note:** Capture the real success and reopen. Any failure pauses recording and becomes a bug to resolve, not a success overlay to add in editing. In a character-local authoring context, buttons become **Add to draft** or **Update draft**, and saving to the draft is not applying changes. That is a separate workflow; this recording uses standalone **Save Primitive** throughout.

**Edit:** A cut may remove a long load, but retain both the save action and actual reopened state. No public save, no anonymous public link to the private fixture, no personal account details in frame.

### 14. Check a valid use and an excluded use

**Visible:** Saved readable rule beside a modest two-example annotation. Label these as reasoning examples, not recorded automated play.

**Talking points:**

- In scope: a matching attack roll while this primitive is active.
- Out of scope: damage, saves and Practice checks; another recipe does not broaden the permission.
- A changed rule needs its description, scope, stacking and price reviewed again.

**Edit:** No invented dice result or sheet animation. If a later edit includes an actual character test, name the fixture and demonstrate the specific behavior rather than imply this reasoning panel is a runtime test.

### 15. End with a useful next step

**Visible:** Written tutorial page and its relevant rule references. Small final link to `/creating`; no unrelated signup or social montage.

**Talking points:**

- Point to the written tutorial and its review checklist.
- Start with a small rule and ask another person to explain what it would do.
- Owned ingredients can be reused across effects/capabilities without buying the same ingredient again.

**Edit:** Hold the final link for long enough to read. End cleanly. Optional credits identify the actual narrator, source release and any synthetic voice if one was selected.

## Pronunciation and text checks

These are **draft pronunciation decisions for founder confirmation**, not an impersonation brief. Record a short glossary before the narration session so pickups stay consistent.

| Term | Proposed handling |
| --- | --- |
| SwordWeave | Say the product name consistently; founder confirms preferred emphasis |
| Neris Cinderthread / Orren Vaultwright | Founder records or approves the names before the character clips; not needed in this tutorial's main narration |
| BU | Say “B-U”; define it using the founder-approved rules wording rather than guessing an expansion |
| Cost / Strain | Preserve their actual rule meaning; do not use either as a synonym for the primitive's BU price |
| Attack Roll / Action Roll | Speak both words clearly; captions must retain the distinction |
| Add / Set to / Self / Target / Scene | Match the visible controls exactly |
| Tier II / d8 | Say “tier two” and “dee eight” where needed; captions may retain the written notation |
| Atelier | Founder confirms pronunciation; avoid it in a take until agreed if its navigation name is unnecessary |

## Review checklist for this recording

- [ ] Fixture price, Lexicon, scope, stacking and narrative approved; no default value mistaken for a canonical price.
- [ ] Real final deployment/source version recorded and every visible control rehearsed.
- [ ] Spoken wording and captions distinguish Attack Roll, damage, acquisition BU and use Cost.
- [ ] Always explained with the active-source limit; conditional automation not overstated.
- [ ] All five selections shown clearly, selected text readable, cursor not covering labels.
- [ ] Save and reopen actually succeed; visibility remains private.
- [ ] An unfamiliar viewer can identify what changes, how much, for whom and when.
- [ ] Voice/sample accepted; no artificial pacing, excessive audio processing or generic presenter styling.
- [ ] Captions generated from the locked spoken edit, manually corrected and checked muted.
- [ ] Final transcript and chapter timestamps generated from the finished asset, not these planned durations.
- [ ] Founder reviews the actual export before website publication.

No footage or audio has been created by this shooting guide. A separate synthetic-voice audition was requested and prepared elsewhere; it does not approve synthetic voice for the website. The next recording step is a short founder-led excerpt using these talking points, while the written tutorial can be reviewed independently.
