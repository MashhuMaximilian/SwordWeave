# Character-sheet editing: implementation status and design

Date: 24 September 2026
Status: implemented in the working tree with focused automated, rollback integration, and desktop/mobile browser checks completed. No deployment is implied.
Rollback checkpoint: `2ae2897` — completed character creation flow and progression rules.

## Implemented status — 24 September 2026

The replacement workshop now exists inside `/characters/[id]`. The sections below preserve the original design intent and its pre-implementation audit; they are not all claims of completed behavior. This status section is the current implementation contract. Acceptance scenarios at the end remain test targets until individually verified.

| Area | Implemented behavior and source |
| --- | --- |
| One sheet workspace | `character-build-workspace.tsx` replaces the Build surface with Overview / Lineage / Upbringing / Manifest / Items, destination-aware Library / On character / Ideas sources, shared composition and preview, and draft review. Desktop panels default to 27% / 48% / 25%, with a collapsible preview. Destination and authoring context can resume. Play remains on the same route. |
| Authoring | `entity-composer.tsx` reuses the Atelier forms. `persistent-authoring-surface.tsx` moves one mounted form between inline editing and the existing Build & Preview drawer. Final character application is separate from adding a piece to the draft. |
| Foundation editing | Concept, roots, backstory, body, attributes, level/BU live in a contextual foundation editor and become draft operations. Portrait editing and draft persistence are implemented with backend regression coverage. A network image-upload browser journey was not part of the verified browser checks. |
| Durable draft | `drafts.ts` stores author-specific operations and base revision/fingerprint in existing workspace command records. Preview executes inside a rolled-back transaction; apply is one transaction. New and forked pieces use stable draft aliases. A failed or stale application keeps the draft. |
| Review and history | `draft-change-review.tsx` shows changed mechanical output, mirrored effects, foundation fields, placements, supply changes and derived totals. It omits unchanged graph entries. Draft Undo/Redo supports grouped actions; applied-build undo restores a saved build snapshot only if that build has not changed. The current UI offers applied undo in the active session; this is not yet a complete historical revision browser. |
| Composition | Explicit Move / Use in / Remove / Mirror actions target occurrence paths. Compatible selected root pieces can form a new capability or heritage. Relocation, reuse, authored changes and materialization use the existing graph/containment rules. No workflow requires drag-and-drop. |
| Collaboration | Owners, suggesters and trusted direct editors share the workshop; viewers retain the read-only sheet. Whole-character proposals, author attribution, revision-bound review marks, preview and atomic owner approval use the same draft engine. |
| Discovery | `workspace/discovery/` retrieves the complete authorized catalogue instead of randomizing only a rendered Library page. Ideas use task shortcuts or typed wording, an editable spending allowance, comparison choices, replacement and selected-set actions. Tier is not a level lock; drawback capacity is checked separately. |
| Legacy entry points | Character edit, backstory, foundation/level and Build entry points route to the workshop through character-scoped events. Read-only viewers do not receive the mutation editor. Existing Play controls retain their gameplay role. Legacy version-update review remains a separate compatibility surface. |

### Current limits and deliberate boundaries

- **A proposal is one dependency group.** The owner applies or declines the complete connected change set. Independent-group acceptance and selective hunk acceptance are deferred. A stale revision or changed build fingerprint requires a refreshed draft and resubmission; there is no automatic rebase or merge UI.
- **Matching is heuristic, not embeddings or a language model.** Normalized words, a maintained concept vocabulary, simple typo tolerance and mechanical/narrative evidence rank related entries. Reasons explicitly say that related wording appears in a rule or description. This does not prove that a suggestion grants the intended immunity, resistance or other effect. Broad semantic understanding, comprehensive negation/condition interpretation, semantic indexes and model-generated interpretations remain future work.
- **Discovery cost is advisory until draft validation.** Known supplied primitive leaves reduce a bundle estimate; item scope and mirror credit have separate treatment. Suggestions do not run a complete hypothetical resolver evaluation for every possible candidate or combination. Adding and reviewing use the canonical draft pipeline. A proposed set consists of selected comparison choices, not an exhaustive combination optimizer.
- **Shuffle can revisit seen choices after exhausting the eligible pool.** Kept choices remain excluded and three unique entries are shown when available. The stricter original design below called for explicit opt-in before recycling seen entries; that is not the current shuffle contract. Comparison choices are UI state, not a durable cross-device favorites collection.
- **Gameplay state stays separate.** Applying/restoring a build does not overwrite current vitality, equipment state, resources or active conditions from a stale character copy. Server preview considers persisted condition/consequence and supply data; browser-local activation toggles are not a server preview input. Source comparison reports placement/equipment changes and states this limitation. Do not promise identical live numbers for every local toggle configuration.
- **Pinned versions are preserved across build and play.** The historical-version overlay is shared by the main Play sheet, resolve endpoint and draft preview, so ordinary historical pins resolve their saved rules. Editing historical content creates a private character copy. Mutations of ambiguous/conflicting pins remain guarded pending an explicit version decision; the editor does not silently choose one conflicting version.
- **Runtime and compatibility controls are not all retired.** Owner/editor note editing, Play-state controls and legacy version-update review can still use their established paths. The new workshop owns the character-build journey; this is not a claim that every old mutation endpoint or helper was deleted.
- **No remote schema migration is needed for these collaboration records.** Suggestion-role metadata, drafts, proposals and revision review records use existing workspace command storage alongside existing share rows. Git rollback is still not a database backup.
- **Browser coverage is specific, not exhaustive.** Desktop 1280 × 720 and mobile 390 × 844 were inspected; mobile had no horizontal overflow. Inline/drawer form continuity, reload recovery and the unfinished-close guard were exercised. These checks do not establish a complete keyboard/screen-reader audit, usability with actual new players, every mutation/proposal journey in the browser, or a network image-upload journey.

### Evidence recorded so far

- The broader repository test run was not green: 141 failures were reproduced against the unchanged rollback checkpoint (legacy mechanical-text/database expectations and three preview expectations). The focused feature checks below are separate from that existing baseline.

- Final full `tsc --noEmit`, scoped UI lint, and `git diff --check` passed.
- The final focused automated run passed **124 tests across 20 files**; **15 opt-in integration tests were skipped**. Covered areas include role isolation, denied self-approval, revocation, stale bases, atomic failure, idempotency, revision review, read-only editor gating, changed-only review, placement-only changes, equipment supply loss, actual mirrored mechanical text, and draft/form behavior. This is a focused test baseline, not a claim that the skipped integration tests ran or that every UX criterion below passed. Portrait persistence has backend regression coverage.
- A live service smoke created a fresh temporary character inside an outer transaction: save two draft operations → apply a name change and an existing published primitive → repeat apply without a new revision → undo to the original name and empty composition. It passed. The mandatory outer rollback completed, and a separate query verified that the temporary character did not exist afterward. Futoshi was read only to obtain valid foundation/owner values; its saved data was untouched. The smoke caught a JSONB key-order fingerprint mismatch, which was fixed with canonical serialization before the passing rerun.
- Browser checks covered desktop **1280 × 720** and mobile **390 × 844**, with no horizontal overflow at 390px. Capability fields stayed in the same mounted DOM form when moved into Build & Preview and back. Reload recovered the composer destination and all exercised form values. The unfinished-close guard was exercised. The foundation flow was also exercised through stage → before/after review → discard, with zero browser errors. These browser checks left the live character unchanged.

- The final live catalogue compatibility audit for the Futoshi viewer returned **433 Library entries** and **432 workshop discovery entries** (428 System, 4 Community; discovery excludes the character record). Library counts were 354 primitives, 32 capabilities, 16 effects, 10 items, 8 Lineages, 5 Upbringings, 7 Manifests and 1 character. The shared authorizer preserves an explicitly public legacy record when it has no publication row; any publication record remains authoritative. Only four null-owner primitive expressions with `isPublic=false` and no publication were excluded from the legacy flag/system/owner pool. Actual Add checks confirmed that explicit legacy-public entries and the owner's unpublished entries remained usable, while the unmarked null-owner entry was rejected. These Add checks ran only on a random temporary character inside an outer rollback; a separate absence check confirmed no test character remained. No existing character or publication was changed. The complete internal catalogue path has no per-kind 500-entry cap; these live counts validate the current corpus, not a synthetic >500-record dataset.
- Preview collapse, destination/context resume and foundation portrait editing are implemented. The separate rollback smoke above verifies persistence without permanent test data. The 124-test run includes the final publication-visibility and mechanical-rule rendering regressions; the separate live catalogue compatibility audit is recorded alongside it. No deployment or unperformed UX validation is implied.

## Original design intent and baseline audit

The remaining sections describe the approved direction, original observations and acceptance targets. Where they differ from the implementation boundary above, treat them as follow-up goals rather than existing product behavior.

## The decision

Build one character editing workspace for finishing a new character, improving an existing character, and proposing changes to somebody else's character. Rebuild the interaction layer around the existing composition and rules engines.

The player's primary task is **turn my character idea into things they can do**. Selecting database entity types, purchasing pieces, arranging origins, and reviewing versions support that task. They should not be the opening question.

Use the same workspace throughout the character's life. New characters receive optional contextual guidance; returning players start at their current composition. There is no second mandatory creation wizard, no requirement to fill all three heritages, and no target to spend every remaining BU.

All of this happens **inside the character sheet**, currently routed at `/characters/[id]`. “Character-sheet editor” names that experience; this proposal does not introduce a separate `/character-sheet` page, redirect the player to Atelier, or require a trip to Library. Opening authoring, finding rules, organizing, reviewing, and collaborating retain the current character context.

## Pre-implementation product audit

Before this replacement, the design audit inspected the live Futoshi sheet, its edit mode, Library picker, capability authoring surface, Atelier, and the corresponding source. Futoshi already has Ursa Major as Lineage, Glorious Combatant as Upbringing, and several direct Manifest pieces. The current sheet is a useful example of a partly built character, not a blank test case.

- Atelier already has a recognizable Library / authoring / preview apparatus. Reuse its component language and working parts.
- The sheet's Build mode adds several creation buttons, another Library selector, and additional composition-source selectors. Opening a composer adds more headers and selectors before the actual form. At 1280 × 720, much of the useful editor is below the fixed sheet bars.
- The initial editing destination is Manifest even before the player makes an explicit placement choice. A new player should not need to notice a small destination label to prevent a misplaced addition.
- The existing workspace has graph operations, version/fork handling, revision checks, cost previews, undo, and an atomic create-and-attach route. These are assets to preserve.
- Current sharing supports viewing and direct editing. Its proposals concern version updates to individual primitives, capabilities, or items. It does **not** provide whole-character suggested edits, moves, new heritages, or a complete nested composition review.
- Some legacy character routes do not enforce the same per-character permissions as the newer workspace. Centralizing those checks is a prerequisite to expanding collaboration.

## Player-facing model

Keep the canonical terms visible, with short explanations where they first matter:

| Player's question | Place in the editor |
| --- | --- |
| Who are they? | Concept, portrait, backstory, and foundation |
| What comes from their nature? | **Lineage** — inherited, constructed, or transformed nature |
| What did life and training teach them? | **Upbringing** — upbringing, background, and learned training |
| Who are they becoming? | **Manifest** — developing role, powers, and chosen disciplines |
| What do they carry or wield? | **Items** — equipment and its own abilities |

Heritages explain and organize abilities; they are not a mandatory race/background/class questionnaire. Multiple bundles or direct pieces remain possible. A character does not have to invent a named bundle before adding one trait.

Keep structural and mechanical distinctions explicit. A primitive is a purchased rule. A capability describes an ability and composes its rules. A heritage groups what the character's story supplies. Items retain their own scope and equipment behavior. A narrative label by itself must not secretly grant a mechanical effect.

## One workspace, with space to work

Desktop layout, using resizable Atelier panels:

```text
Futoshi · Build     Concept / Lineage / Upbringing / Manifest / Items
Character budget · Drawback credit · Points remaining       Draft saved

Find something                  Build the selected thing        See the result
Library | On this character     Futoshi > Lineage > Ursa Major   Playable preview
Suggestions                     Traits and capabilities         Changed sheet values
Search / familiar filters       Contextual authoring             Cost and availability
                                + Add here                       Why it changes

Undo / Redo          Changes in this draft               Review changes (3)
```

Start the Library region near 25–28%, the center around 45–50%, and the preview with the remainder, respecting minimum usable widths. The composition lives in the center, not in a third narrow editor inside a modal. The right side can collapse when more writing space is needed. Identity/backstory editing does not need a permanently visible Library.

A compact root navigator and breadcrumb make placement visible. The center shows the selected root, bundle, or capability; returning to the character overview shows a compact map of all roots and loose pieces. It must not hide direct pieces merely because they are also reachable through a bundle.

The left panel has one source switch: **Library**, **On this character**, **Suggestions**. Those share the current search, destination, and compatible-result handling. Creating something new opens the actual authoring surface in the center. Do not embed a second Library inside that form.

At narrower desktop/tablet widths, retain center + one auxiliary pane rather than squeezing three unreadable columns. On phones, show **Build**, **Find**, and **Preview** as explicit views with persistent destination, draft, and review access. Move/group operations have tap and keyboard alternatives; drag-and-drop is an enhancement.

Use the existing metallic panel chassis, medallions, entity rows, rule typography, and preview renderer. Gold identifies structure and decisive commands; teal identifies selection/live state; copper identifies mechanical meaning. Remove duplicated mastheads and large explanatory banners. The current Play sheet retains its useful compact composition and game controls; Build mode devotes the working area to editing.

### The FAB and Build & Preview modal

Use both the Atelier-like workspace and the existing **Build & Preview** modal, with different jobs. The workspace provides spatial context for browsing and organizing; the modal provides focused authoring or inspection of the currently selected thing. These are two presentations of **one draft**, not two editors with separate save behavior.

| Entry point | Expected behavior |
| --- | --- |
| Select an existing piece | Inspect it in the right preview; an explicit Edit action opens authoring in the center |
| Build your own / Customize | Open the shared Atelier controls in the selected destination, with a visible Focus button |
| FAB → Build & Preview while editing | Open the independent modal workbench; preserve the middle-column editor |
| FAB → Build & Preview from Play | Resume this character's draft/last editing context; if none exists, show the character overview and an explicit Add action |
| Close the modal | Return to the same selection, destination, search results, and scroll position; keep draft edits |
| Inspect a nested rule | Follow a preview breadcrumb inside the current surface, with Back; do not pile up modals |

On mobile, the same modal can expand to the available screen and provide Build / Find / Preview views. Picking a Library result returns to the invoking field or composition. Keep a visible destination and draft status; do not make the player navigate through three simultaneous narrow columns.

Store form values, selected version/path, validation, and operation history above the inline/modal presentation. The middle and modal workbenches have independent authoring sessions; opening or closing the modal must not reset either form or trigger duplicate effects/saves. Closing the modal is not Apply. Its main action is **Add to draft** or **Update draft**; **Apply changes** belongs to the character-wide review. For a collaborator, that final action is **Send proposed changes**.

Existing integration is a starting point, not the desired contract: `global-controls.tsx` currently clicks DOM-selected bridge buttons or dispatches `sw-character-open-atelier`; that event can reset the workspace path and start a new primitive. Replace this with an explicit character-workspace controller carrying draft, selection, and destination. Reuse `build-preview-drawer.tsx` / `useDrawerSlot` as the presentation shell, with clear ownership of the active character's content. Do not retain the reset-to-new-primitive behavior or navigate to `/atelier` from the sheet.

## A better first session

After `/characters/new`, show the saved concept and a small optional invitation: **Make this character yours**. Offer a few useful tasks, rather than another progress bar:

- Add a trait from their nature or training.
- Make an ability they would use at the table.
- Add or customize an item.
- Review the character with the DM.

These are suggestions, not completion requirements. Hide completed/dismissed guidance, remember that preference, and offer the same help to existing characters. Do not infer that a character is incomplete merely because a heritage is empty or BU remains.

Use “Add to Lineage,” “Add to this capability,” etc. at the place of action. From a global Add action, ask for a destination or keep the choice in a clearly labelled draft tray. Do not silently file everything under Manifest. Existing direct pieces keep their current placement until explicitly moved.

For Futoshi, the working journey would be:

1. Open Ursa Major and see its current traits, including their mechanical rules.
2. Find or build the specific rule for the desired resistance to magic. Explain the chosen scope; do not equate an evocative concept with unlimited immunity.
3. Add combat training to Glorious Combatant, or move a misplaced training piece there.
4. Build a named ability using already-held rules and any newly chosen rules.
5. Inspect actual changes to practices, defenses, vitality, availability, and BU.
6. Apply the changes, or send them for review.

Futoshi currently exposes Mental inclination both in Upbringing and among direct Manifest pieces. The new editor should explain these occurrences and their contributions, not automatically remove one because their names match.

## Adding and authoring without a wall of technical choices

Start with **Find in Library** or **Build your own**, in the chosen destination. Offer task-oriented filters such as training, defense, senses, movement, subjects, and output. Preserve access to the complete canonical families and every tier; these are helpful filters, not level locks.

When building an ability, ask for a name and what it does in ordinary words, then expose the relevant shared Atelier controls. An optional shortcut can start from “A trait,” “An action,” or “An item.” Explain primitive/effect/capability distinctions in context rather than forcing novices to choose correctly before they can start.

The builder should show which relevant rules are already available, which come from equipment or restricted sources, and which would be newly added. “Already on this character” is meaningful only if its actual availability and scope support the proposed use. Keep advanced composition and rules controls accessible.

The playable preview should answer:

- What does this ability do?
- Which purchased rules support it?
- Is it always available, triggered, or dependent on something being active/equipped?
- What changes on the character if I add or move it?
- What remains a declaration and negotiated Strain at the table?

Range and output-die access use their primitives. Target count, shape, scale, placement, duration, and time compression remain spoken intent unless a particular purchased rule modifies their handling. Explain the existing scaling/Strain rules without turning every option into a required purchase. Do not claim that all these declarations are free of action cost.

Character editing defaults to a character-local customization. It must not silently update a Library definition used elsewhere, even when the character owner also owns that definition. “Save to my Library” / publishing is a separate explicit action. Versions and provenance remain inspectable, but publishing fields do not interrupt normal character creation.

## Organizing existing pieces

Select one or several pieces, then offer only valid actions:

| Action | Meaning |
| --- | --- |
| Move to… | Relocate the chosen occurrence/membership, preserving its configuration and mirror state |
| Use in… | Reuse an existing rule in another composition, retaining the source where appropriate |
| Group as a capability | Create a named capability around compatible selected pieces |
| Group as a heritage | Create a Lineage, Upbringing, or Manifest from compatible selected pieces |
| Take out of this bundle | Choose another destination and move the membership there in one operation; explicitly preserve access that the bundle was supplying |
| Remove from character | Explicitly remove the chosen occurrence; show affected compositions and access first |
| Add a separate copy | Create an independent instance deliberately; show any additional cost |

These are different operations. “Move” must never secretly purchase another copy. “Use in” must not silently move a rule out of its original source. Removing one path must not erase an independent supply path or a separate purchased instance.

Selection targets must include placement/instance identity and the path being edited, not just a primitive definition ID. Distinguish shared definitions from independent copies. Keep the existing containment rules unless the game model is deliberately changed.

A nested reference is a supply path, not automatically an independently purchased instance. Today, inherited primitive rows are coalesced by definition and mirror state, while direct purchases can have independent instance IDs. Reusing a supply path avoids a new purchase only where the acquisition model actually supports that reuse. Independently configured copies must retain their own identity. A simple remove-reference operation can remove the sole source of a rule; preserving that access while taking it out of a bundle is a new compound move operation, not something to assume the old remove action does.

Pure reorganization should normally leave purchased BU unchanged. Moving a trait into a conditional capability or an item can affect availability or application even when BU is unchanged; show that consequence. Preview the authoritative resolver result and explain any non-zero cost change instead of assuming every graph edit is free.

## Drafts make experimentation and collaboration possible

Entering Build mode opens a recoverable draft based on the current saved character revision. Selection, comparison, and preview do not apply changes to the live sheet. Drafts autosave; **Apply changes** is explicit. Undo/redo works within the draft. The user can leave and resume it.

This durable draft layer is implemented as new infrastructure: the previous workspace commands versioned and materialized immediately. Draft Undo changes only the proposed build; undoing an already applied change creates another audited character revision. Applying newly authored definitions stores private, character-scoped versions atomically with the character change. Listing them as reusable Library creations or publishing them is a separate explicit action; the scope/listing policy needs implementation rather than being inferred from the current private-entity behavior.

Review is one compact before/after view for the editing session. It groups changes by meaning: additions, changed rules, moves, removals, and resulting stats/BU. Repeated edits to the same field collapse to their final outcome. Dependency groups stay together—for example, a new primitive and the new capability that requires it.

Do not expose a confirmation dialog for every click. Use extra confirmation only for consequential removal or replacement that loses a configured piece. Reversible draft operations provide Undo.

Build changes must not overwrite gameplay state that changed meanwhile: current vitality, resources, equipment state, conditions, and consequences need distinct revision domains and an explicit reconciliation policy where maximum values change. A draft changes the build, not a stale copy of the entire live character.

## Shuffle as useful exploration

Suggestions should answer a selected intent such as “find a training trait,” “improve defense,” or “ideas for this capability.” The player does not need to know catalogue terminology, choose a database entity type, or write tags correctly. Use available Library metadata, chosen filters, and explicit player intent; do not pretend to understand the complete free-text concept when the data cannot support that match.

### What the player sees

Within the left panel's Suggestions view:

```text
Ideas for: Lineage > Ursa Major                         Change
What would you like them to do?
[ Be harder to hurt with spells                       ]
[ Defense ] [ Movement ] [ Training ] [ Drawback ]

Looking for: resistance to magical effects              Change
Spend up to [ 8 ] BU     System + Community              Filters
[ Find ideas ]

Three compact suggestions · mechanical rule · cost · why it fits
[ Keep ] [ Preview ] [ Add to Lineage ]

[ Shuffle ideas ] [ See all matches ]
Kept for comparison (2)                                  Open
```

Task chips are optional shortcuts, not an exhaustive vocabulary. Empty input can offer **Surprise me** within the chosen destination and budget. Selecting a card previews it; Keep and Add are separate explicit actions. Wider layouts may use the center temporarily to compare three candidates; keep the destination breadcrumb visible and return to the composition when done. On a phone, show compact stacked cards with expandable details. Do not truncate the actual mechanical rule behind an unexplained count.

Distinguish three requests: **Find something to add**, **Replace this piece**, and **Build a set within a budget**. The last one is an explicit combination search and may propose several compatible primitives, ranges, dice, or subjects. Ordinary Shuffle must not silently replace a piece or assemble an unrelated package. All modes use the same comparison and draft actions.

For ambiguous ideas, offer a small useful clarification without blocking exploration. “Anti-magic” could mean **Resist it**, **Interrupt it**, **Detect it**, or **Remove its effects**. Showing those interpretations is better than silently assuming immunity. The player can change the interpretation or browse all related ideas.

### Finding related ideas without requiring exact words

The current query code already searches primitive names, mechanical output text, narrative rules, tags, and serialized hard modifiers. Capability/effect/item/heritage searches also inspect several nested contents. It is broader than title-only search, but the whole query still becomes a literal `ILIKE` pattern. A sentence such as “hard to hurt with spells” can miss a relevant rule written in different words. The current picker also requests only 50 entries; those visible entries must not become the shuffle's entire pool.

Build discovery around the following pipeline:

1. **Define the request.** Preserve the player's original words alongside any editable interpretation, destination, operation mode, origin filters, and BU/debt allowance. Do not mine their entire backstory without a deliberate “Use my concept” action.
2. **Search authorized content broadly.** Use names/titles, narrative descriptions, mechanical descriptions, tags, canonical families, structured modifier targets/operators/conditions, and nested composition contents. Index the exact version being offered. Include System and Community by default; the owner's accessible private creations may be an explicit additional source. Apply access rules before retrieval, counts, snippets, or indexing for a viewer.
3. **Match wording and meaning.** Combine normalized word matching, typo tolerance, and a maintained concept vocabulary with semantic similarity over the saved text. Examples: “quick on their feet” can relate to movement or agility; “hard to hurt with spells” can relate to magical damage mitigation. Preserve negation and conditions: “cannot resist fire” is not a resistance benefit. Weight actual mechanical evidence above decorative names or tags.
4. **Validate the proposed use.** Check containment, mirror support, conditions, source availability, and authoritative incremental BU/debt against the draft. Similar language alone never establishes a mechanical effect or permission. A fire attack might be thematically related to fire resistance but is not a defense match. Narrative-only connections remain labelled as related ideas, not verified solutions.
5. **Rank fit, then vary the selection.** Draw diverse candidates from the eligible matching pool. Group equivalent versions/near-identical expressions enough to avoid presenting three copies of the same idea, while retaining access to exact variants. Avoid always favoring popular or System entries; Community entries must remain reachable. Offer See all matches for predictable browsing.
6. **Explain and add explicitly.** Show the rule that supports the match, its source/version, any conditions, and its actual cost for this character. A reason such as “Reduces damage from magical attacks while…” is grounded in the stored rule. Do not invent a reason from the title. Adding uses the normal draft pipeline.

Semantic retrieval is a planned capability, not something the existing Library search already supplies. It should use cached representations of authorized saved versions; a Shuffle click resamples candidates and does not need a fresh generative-model call. Version changes invalidate matching records, and permission changes invalidate access immediately. A lexical/concept implementation can ship first, but must pass the paraphrase examples below and clearly expose its limits; do not call simple substring randomization meaning-aware search. Semantic candidates still pass the same mechanical checks.

Keep the full eligible corpus reachable through server-side retrieval and progressive candidate batches. A retrieval batch/top-results limit is not proof that the Library has no more matches. Track seen candidates per search/filter context, and exclude the comparison tray across shuffles. Changing the budget or destination revalidates kept choices without silently deleting them. Candidates already supplied by the character should normally be offered as **Use existing** rather than another purchase; an independent copy remains explicit.

### Randomization and budget rules

- Draw from the complete authorized System + Community corpus by default, honoring origin filters.
- Accept a typed BU allowance; show incremental character cost and remaining debt capacity, not merely the sum of visible catalogue prices.
- Tiers are never locked to level. Mirror legality and total debt capacity still apply.
- Show three distinct fresh candidates when the eligible pool permits. Avoid repeats until the pool is exhausted; explain a genuinely small pool rather than fabricating options.
- Keeping a candidate immediately places it in a separate comparison tray. Kept candidates are excluded from future suggestion draws. Removing a kept candidate is explicit.
- Separate **Keep for comparison** from **Add to draft**. A favorite should not unexpectedly change the build.
- Shuffle changes suggestions only. It never replaces chosen abilities, removes a saved candidate, or silently spends BU.
- Every suggestion shows the actual rule, source, incremental cost, intended destination, and a short grounded reason it fits the selected filter/task.
- Replacement suggestions, when requested, compare the complete valid replacement against the current build; they do not temporarily remove the old ability to manufacture affordability.

If there is no suitable definition, offer **Build your own** in the same destination. Do not make irrelevant catalogue entries look like valid matches.

If fewer than three unseen eligible choices remain, show the available choices and explain the count. Offer **Broaden search** or **Show previously seen** explicitly. Never repeat kept choices or relax budget, permissions, mirror eligibility, or containment silently to fill three slots. For drawbacks, evaluate the mirrored effect and remaining total debt capacity; affordability of one primitive does not make every combination affordable.

Search acceptance examples must include paraphrases, misspellings, mixed System/Community results, rules whose useful terms occur only in nested mechanical text, negative statements, and a concept with no real match. In particular: “hard to hurt with spells” must not return only titles containing “spell”; a magical attack must not be described as magical defense; a rule outside the first 50 Library rows must remain discoverable. Shuffling should explore meaningfully different valid options without losing the player's kept comparisons.

## Interaction details required before replacing the old editor

- **Context follows the player.** Switching roots preserves each root's navigation state and never silently relocates pending work. A selected preview is not a selected editing destination. Every Add/Move action states where it will go.
- **Progressive detail.** Show the playable rule and cost first. Expand conditions, constituent pieces, versions, and mechanical internals on demand. Keep explanations reachable instead of showing repeated onboarding banners.
- **Honest persistence.** Distinguish Saving draft, Draft saved, and Could not save—retry. Preserve recoverable work after failed requests. Applying is unavailable while required validation is stale; a failed apply leaves the draft intact and does not report success.
- **Responsive feedback.** Cancel outdated search/preview requests when the selection changes; slow responses must not overwrite a newer choice. Show loading, empty, unavailable, and incompatible states distinctly. Retain the current composition while auxiliary panels load.
- **Budget clarity.** Show owned budget, allocated BU, drawback credit used/max, and remaining spend separately. Distinguish the suggestion's spending allowance from the character's total budget. Unspent BU is normal. Lowering a limit flags incompatible kept ideas rather than discarding them.
- **Scope and side effects.** Explain passive/triggered/equipped/conditional access and source changes beside their preview. Before removing a supplying piece, show dependent abilities. Runtime toggles remain Play controls; a draft must not activate a capability just because it is being previewed.
- **Accessible focus.** Keyboard selection, explicit Move actions, labelled icon buttons, and visible focus everywhere. Modal opening/closing restores focus, Escape closes the current preview layer, and mobile controls remain usable without hover. Reduced motion retains clear metallic contrast without animation.
- **Stable shared work.** Owner drafts and collaborator drafts are separate. Review shows author, base revision, dependencies, and changed-since-review state. Revoked access does not leave a usable cached authoring surface with unrestricted source data.
- **Migration and exit.** Map every existing edit entry point to the new workspace before removing it. Preserve existing instance/version identity, permissions, and data; test with Futoshi and a resolver-heavy existing sheet. The Play view remains immediately reachable with the draft preserved.

## Sharing, DM review, and owner control

Recommended permissions:

| Role | Can do |
| --- | --- |
| Owner | Apply own edits; approve/reject proposals; manage access |
| Viewer | View the permitted character and its review state |
| Can suggest | Use the same editor in a private proposed draft; submit changes for owner review |
| Can edit directly | Apply changes, with attribution and history; an explicit trusted permission |

Preserve existing grants during migration. Do not silently turn viewers into suggesters or editors. “Can suggest” should be the recommended choice for new review invitations, while direct editing remains available.

The DM uses the same Library, composer, move controls, and preview. Their main action becomes **Send proposed changes**. A proposal can contain several connected changes with an explanation. The owner sees before/after rules, placement, BU, and derived values. The implemented version applies or declines the complete proposal as one dependency group. Selective acceptance of independent groups is a future extension; dependencies cannot be half-applied.

A request for DM approval and permission to edit are separate concepts. The DM may mark a particular revision reviewed or propose modifications. If the owner changes relevant mechanics afterward, show **Changed since review**. Do not imply permanent approval of all future edits. Campaign-required approval can be added without making it mandatory for every user.

If the character changes while a proposal is pending, do not overwrite it. The implemented version requires refresh and resubmission after a stale base; it does not rebase independent changes. A future rebase feature must produce a fresh preview and still require review for conflicting field, instance, or composition changes. Revoked access is enforced when reading, editing, submitting, and applying—not just when opening the page.

Character access should let a reviewer inspect the exact referenced rules necessary to understand that character. It must not grant access to the owner's unrelated private Library. Review and preview endpoints therefore need character-scoped access to referenced versions, not a blanket Library permission bypass.

## Engineering direction

Reuse the existing graph, containment validation, source paths, resolver, immutable versions, shared authoring controls, and transaction primitives. Replace the overlapping editor entry points with one workspace state and one operation vocabulary.

Implemented service boundaries, with design goals noted above:

1. **Draft service:** base revision, normalized operations, new unpublished definitions, persisted working state, undo/redo. Stable client IDs for new pieces map to permanent IDs at commit.
2. **Preview service:** resolve the proposed complete build without publishing temporary definitions or mutating the live character. Return stat/BU/access deltas and structured validation. Current graph-only cost preview is not sufficient for this promise.
3. **Commit service:** recheck access and base revision, validate the whole operation group, publish character-local versions, materialize supply paths, recompute the ledger, and write build history in one transaction with idempotency.
4. **Proposal service:** use the same draft payload and preview/commit machinery, with owner approval as the application boundary.
5. **Workspace UI:** selected destination/path, source panel, central authoring/composition, shared preview, draft review. All old edit buttons route here; no competing legacy save path.
6. **Discovery service:** authorized version-aware content retrieval, concept/semantic matching, mechanical eligibility and incremental-cost validation, explanation evidence, and per-context seen/kept state. Reuse Library retrieval and shared validators rather than creating a separate rules authority for Shuffle.

Do not call independently committing commands in a loop and call that an atomic proposal. Extract/reuse their lower-level operations inside one transaction. Preserve pin/version semantics; the current implementation sometimes resolves live entity rows despite retaining pinned metadata, so exact-version previews and commit behavior must be reconciled before promising stable review.

The original legacy snapshot helpers omitted several identity/narrative fields and could capture after a write. The new draft receipt instead captures before/after build foundation and composition graphs inside the application transaction; guarded undo restores that build snapshot. Legacy snapshot callers still exist and should not be described as providing the new draft receipt contract. Keep runtime history separate.

### Original source audit: reuse and gaps addressed by the new implementation

- Graph, containment, instance metadata, supply paths: `src/lib/character/workspace/model.ts` and `read.ts`.
- Existing command, revision, idempotency, move, and version/fork handling: `src/lib/character/workspace/commands.ts`.
- Supply materialization and BU accounting: `src/lib/character/workspace/materialize.ts`, `src/lib/engine/recompute-bu-spent.ts`.
- Shared composer and exact-entry picker: `src/components/characters/workspace/entity-composer.tsx`, `library-picker.tsx`.
- Existing FAB/drawer integration and reset behavior: `src/components/layout/global-controls.tsx`, `build-preview-drawer.tsx`, and the `sw-character-open-atelier` listener in `character-workspace.tsx`.
- Existing broad-field but literal Library search: `src/lib/publishing/library-query.ts`; the header's title-only comment is outdated. `library-picker.tsx` currently requests 50 rows, so its rendered result set is not a full-corpus suggestion service.
- Atomic create-and-attach: `src/app/api/characters/[id]/workspace/create/route.ts`.
- Legacy attach-after-save forms: `src/components/characters/workspace/embedded-atelier-forms.tsx`; do not make these the new draft pipeline.
- Existing roles: `src/lib/character/can-resolve-character.ts`, `character_shares` in `src/db/schema/characters.ts`.
- Proposal scope and scalar diff limitations: `src/lib/character/proposal-types.ts`, `compute-proposal-diff.ts`.
- Proposal creation currently does not fully bind the proposed/current version to the target slot; approval updates primitive slots by primitive ID rather than instance ID and lacks a complete transactional stale-base check: `src/app/api/characters/[id]/proposals/route.ts`, `proposals/[proposalId]/route.ts`.
- Main character GET/PATCH/DELETE need consistent per-character authorization: `src/app/api/characters/[id]/route.ts`; login alone is insufficient for write permission.
- Incomplete/post-write snapshots: `src/lib/character/capture-character-snapshot.ts`, `with-character-snapshot.ts`, `src/lib/publishing/hash-content.ts`.

These were pre-implementation source findings, not a list of outstanding vulnerabilities. Character GET/PATCH/DELETE authorization, proposal slot/version binding and transactional gates have since been hardened. This audit did not attempt unauthorized requests against another user's character.

## Original implementation sequence and acceptance targets

1. **Unify permissions and mutation semantics.** Fix the demonstrated access/instance/stale-proposal gaps; define version behavior, build-vs-runtime state, and atomic snapshots.
2. **Deliver one complete editing journey.** New or existing character → select root → find or build a trait → draft preview → review → apply → verify Play sheet. Include draft recovery and Undo. This is the first meaningful UX milestone.
3. **Finish composition operations.** Moves, grouping/ungrouping, reuse, mirrors, item scope, nested editing, and all old entry points routed to the new workspace. Retire replaced controls after parity is verified.
4. **Add purposeful suggestions.** Reuse full-corpus candidate selection, add incremental-cost preview and comparison; test candidate coverage, no tier locks, saved exclusion, and exhausted-pool behavior.
5. **Enable collaborative proposed edits and revision-bound DM review.** Same workspace and draft model, full before/after, conflict handling, atomic approval.

Acceptance is measured with concrete tasks:

- A first-time player can add a lineage trait, create a training capability, add an item, inspect the result, and stop with BU unspent without leaving the sheet or learning the entity hierarchy first.
- An existing character retains all configuration, narrative, versions, instances, mirror states, conditions, and alternate supply paths.
- Grouping/reusing the same purchased instance does not double-charge it; deliberate independent copies behave according to the actual accounting rules.
- Moving a nested composition preserves its contents and reports availability changes. Removing one occurrence does not remove another.
- Preview and saved-sheet numbers agree, including PB-driven vitality, conditional practice modifiers, mirrors, and item-only effects.
- No action relies on drag-and-drop; the complete workflow works at 390px width and by keyboard, with readable labels and visible focus.
- Reload recovers the draft; duplicate submission is idempotent; stale proposals cannot overwrite a newer build; partial failure commits nothing.
- Inline authoring → FAB Build & Preview → close → reopen preserves unsaved fields, exact selected version, destination, undo history, and scroll context. No route departure, implicit new primitive, duplicate form save, or silent Apply occurs.
- Suggestion paraphrases find mechanically supported ideas across authorized origins and beyond the first loaded page. Wrong/negated effects are not presented as valid matches; saved comparisons are not reshuffled; an exhausted pool is reported honestly.
- Permission matrix covers unauthenticated, unrelated, viewer, suggester, direct editor, revoked collaborator, and owner. An accepted change records who proposed and who applied it.

## Checkpoint scope

`2ae2897` contains the approved character-creation work and progression correction, including the prepared `0067_open_ended_progression.sql`. The database migration was not applied by this design audit. A Git checkpoint restores code; it is not a database snapshot. Generated screenshots, scratch files, and `next-env.d.ts` regeneration were not added to the checkpoint.

## September 25 feedback follow-up

- Character creation and character editing share Full description and Personality alongside the existing backstory prompts. Numeric level entry permits an empty in-progress value.
- The workshop Library reuses Atelier's search, family/tier/origin controls and canonical rows. Row selection inspects; Add is explicit. Forms fill the integrated middle column; the right side has separate Piece preview and Character numbers disclosures.
- Ideas separates exploring the authorized System + Community Library from starting a rule using priced canonical options. A comparison is a bookmark, not a character mutation. Arbitrary modifier amounts must go through the rule authoring and validation flow; do not infer a generic linear price.
- Draft changes remain separate from the live character until Review → Apply. Server drafts can be resumed; browser recovery protects unfinished forms and unsent draft operations. Conflict checks must remain authoritative.
- Test characters: Bartholomew Vey for a new base character, Tessy3 for an existing character with bundles. The development roster must honor both the actual signed-in identity and the explicitly resolved legacy local profile.

### Later: one rules reference inside the sheet FAB

Add an Info action opening a searchable, sectioned rules modal. This is a future task, not part of the current workshop changes. Two clear entry points: **Mechanics & numbers** (BU, debt/mirroring, level, PB, vitality, attributes/practices, capabilities, primitives, conditions, scaling and Strain) and **Playing at the table** (declare an intention, assemble a capability, negotiate cost, roll and resolve, examples of play). Reuse the existing authoritative rule helpers and explanations from builders, scaling/action drawers and sheet modals; do not introduce another disconnected rules source. Cross-link contextual help to the relevant section. Keep the same entry point for a newly created or existing character.

Validation for this pass: 140 focused tests passed (the opt-in database integration suite was skipped; separate rollback-only database smokes covered add/apply/idempotent retry/undo). Bartholomew was verified in the roster and opened in the workshop. Tessy3's existing pending draft and bundles were preserved. Desktop composer width and 390px mobile layout were checked.

Latency probe on Tessy3: three foundation operations in a rollback preview went from about 21.2s to 1.7–2.6s after graph reuse/batching. A structural addition over its 47-node graph still took roughly 9–10s against the remote database. Do not describe the workshop as fully offline or all edits as instant: the local journal protects interrupted saves, but composing authoritative graphs still requires server validation. A future dedicated client projection engine could provide immediate structural previews; it must preserve pinned versions, identity aliases, shared memberships, budget semantics and conflict handling.

## 2026-09-28 — local working copy and procedural inspiration

- Routine edits now project into a browser working copy. It is scoped to the signed-in author and character; storage-stamp checks prevent silently overwriting another tab. No definition or live character is saved by Add/Remove/Edit. Loading an uncached Library definition is a read-only request.
- Review compares net supplied pieces and foundation fields, not the operation journal. A piece's rule, placement, and supply facets share one card. Canceled changes disappear. Private fork identities are paired with their original piece where it was replaced.
- Opening Review checks a changed local draft automatically; **Check draft & numbers** also lets the user retry. This saves an account draft and runs the existing authoritative transactional preview. **Apply changes** is available only after that check and commits the live character. Local BU is an estimate; combat statistics wait for review. Existing permissions, pinned-version checks, concurrent-revision checks and debt limits remain server-enforced.
- Local identities are bound only to entities and instances produced by validated server operations. Browser snapshots never directly overwrite the database. A stale browser copy remains recoverable rather than silently replacing a newer account draft.
- Undo/redo uses local snapshots. After reloading, older local actions are replayed in the browser when possible; drafts authored by the earlier server-only implementation retain the legacy checked undo path.
- Randomizer is a separate workshop tab. It creates priced mechanical recipes and active/passive capabilities, optionally reusing exact, unmirrored, non-item rules already supplied by the character. It uses no AI or Library search. Generated proposals remain unsaved until the builder is finished. New constituent rules and the capability are one undoable draft action.
- Saved Library comparisons are a named section with a counted jump and return link. They spend no BU and do not enter the build until explicitly added.

### September 28 — story cards and procedural composition

Backstory review compares each changed field beside its own previous value; unchanged fields no longer produce walls of repeated text. Manifest description is a string in the existing backstory JSON, preserved by the shared parser/sanitizer and draft snapshots. The story tab also presents Lineage, Upbringing, Manifest, and slotted heritage descriptions. On-character entries use bordered cards with type/cost and explicit reuse actions.

Randomizer now makes primitives, effects, capabilities, and heritage bundles. Additional controls and behaviors: (1) minimum new BU, (2) maximum new BU, (3) optional available-budget restriction for future planning, (4) minimum pieces, (5) maximum pieces, (6) active/passive/mixed capability intent, (7) physical/magical source, (8) domain absent/flavor/purchased, (9) verb absent/flavor/purchased, (10) optional range primitive, (11) optional output primitive, (12) optional play declarations, (13) custom shape inspiration, (14) theme/motif, (15) fixed or random situations, (16) one/three/five/eight results, (17) repeatable seeds, (18) individual rerolls, (19) keep-result locks, (20) saved ideas, (21) recent roll history, and (22) exact owned-rule reuse across compound kinds. Saved ideas/history are session-local to the open Randomizer; opening a result in the builder moves it into existing recoverable form editing. Generated compound pieces enter the character as one undo group when saved from the builder. This is bounded recipe composition, not arbitrary numeric pricing or AI semantic interpretation of a theme.

Shared capability At the table: every non-range/non-output axis accepts custom text. Casting includes Reaction. Duration, timing, and range presets have explanations. Timing labels without canonical numeric units explicitly require table agreement rather than inventing a time rule. Play declarations never automatically attach paid primitives. Range/output selections retain their explicit purchased-piece behavior. Optional guidance is stored as a readable, round-trippable Markdown section in the existing capability narrative. Existing explicitly purchased duration/shape pieces are retained until deliberately removed.

Validation: TypeScript passes. Relevant suites total 183 passing tests; 15 existing isolated-database tests remain skipped. Browser fixture exercised generated heritage handoff, result locks, saved ideas, mobile effect cards, and the actual shared CapabilityForm custom-shape/Reaction save-and-reload path. The latter retained exactly the original one primitive while restoring both declarations. These fixture checks do not substitute for signed-in database apply testing; no live character was modified. Localhost dev server remains running.

### September 28 — generation range and authoring bug fixes

Randomizer collects valid candidates before selecting ideas across their attainable cost range, instead of stopping at the first cheap matches. Prices still come from canonical recipes. Explicitly requested domain, verb, range, and output references must all fit the budget and piece limit; passive capabilities no longer silently omit requested references. Flavor domain/verb references appear in the dedicated slots and can be edited without buying access. Custom situations use the shared structured condition editor; access grants remain unconditional.

The shared capability and effect forms now have a Who rolls? editor for actor action rolls, target saves, target practice checks, opposed checks, or no roll, with an editable DC and success/failure instructions. These round-trip through readable narrative sections and do not grant bonuses. Build & Preview includes a chooser for new pieces or existing character pieces, using the existing unfinished-form guard.

Numeric fields in character editing, shared authoring, and the older workshop composers retain an empty typing buffer so a final digit can be deleted and replaced. Malformed/HTML API responses produce readable retry/session errors; compound forms retain unfinished data on save failure. The original reported malformed response was not reproduced, so its specific failing request remains unidentified.

Validation: 177 relevant workspace, capabilities, and HTTP tests pass; 15 existing database-dependent tests remain skipped. TypeScript passes; focused lint has no errors (two existing effect dependency warnings). Browser fixtures exercise numeric deletion/replacement, custom condition access, capability and effect roll-resolution save/reopen, and the capability form's simulated HTML-error recovery path. No live character was changed during these checks.


### September 28 — independent middle and modal workbenches

Build & Preview now owns a second composer, with a separate recovery namespace, selection, incoming-piece channel, preview, and destination. The middle editor stays mounted. Library routing offers Add to middle, Replace middle, Add to modal, and Replace modal; replace operations ask before abandoning an unfinished form. Opening a library definition uses the read-only workspace resolver and does not add it to the draft until the form is saved. Adding into an open composite uses its scoped slot event channel. A middle piece can be saved to the draft and sent into a compatible modal composition in the same action. The modal can save new pieces into Lineage, Upbringing, Manifest, or Items as appropriate. Both contexts recover separately on refresh.

Each generated proposal gets a fresh form recovery identity, preventing an older capability's slots from replacing the newly generated selection. Reference cards distinguish purchased/reused access from flavor. Randomizer includes the shared roll-resolution editor. Effects now preserve and edit the optional target, shape, size, placement, duration, and casting declarations as well as resolution. Local negative primitive identities contribute to authoring preview totals through an explicit preview-only option; persisted-entity BU calculations keep their existing validation.

Validation: browser fixtures exercised two simultaneous forms, middle-to-modal primitive delivery, modal save into Lineage, and a four-piece generated capability with table declarations and a target Mental save against My Magical DC. All four primitives appeared and saved; the available budget fell by the expected 8 BU. Routine editing made no draft write request. These checks used mocked transport with actual components, not live character mutations.

The drawer footer queries only its own mounted form for Save/Reset and never broadcasts a save to another editor. Browser checks saved an effect with a custom Star shape, Reaction timing, and an Awareness check using the modal footer while the middle form retained its unsaved name. Relevant workspace suites: 178 passing / 15 existing skips; the follow-up pricing/generator/guidance subset adds coverage for temporary-ID preview totals (32 passing tests). TypeScript and focused lint pass with existing warnings only.


### September 28 — scaling correction and compact inspiration

The previous full-table editor for effects is superseded: effects offer optional Who rolls? resolution only. Capability scaling remains optional, with a prominent gold/teal checkbox shared by Atelier and the sheet. Existing effect narrative guidance is preserved when loading/saving, but no scaling control is offered and new effect generation does not add scaling declarations.

Capability generation counts only additional primitives against its min/max piece limits; the four separately selected reference slots still consume BU but are outside that count. Zero additional rules is allowed for a capability made only of references. Generated previews use a fixed two-column slot grid, compact scaling and resolution summaries, and list additional rules without repeating references. Resolution can be omitted, explicitly chosen, or randomized. Generated ideas can open in the middle or modal workbench independently.

Modal replacement now focuses a prominent sticky discard confirmation. Browser fixture checks preserve the old primitive until confirmation, replace it with a capability after confirmation, and open a generated capability in the modal while the middle stays on Randomizer. Workspace loading uses a themed skeleton with loading/restoration text, retry on failure, and a return action. No live character data was edited during validation.


### Randomizer composition and budget follow-up (2026-09-28)

Composite generation loads the complete authorized discovery catalog once, then rolls locally. Additional primitive source follows the reuse checkbox: supplied non-item, non-mirrored character primitives when enabled, full Library otherwise. Effects/capabilities can be included according to containment rules; items are now supported. Each direct child counts once toward additional-piece limits, excluding capability reference slots. Impossible exact sampled counts are rejected rather than silently truncated. Budget sums unique primitive leaves across all children and reference slots, excludes owned leaves for non-item composites, and displays definition cost separately from budget used. Nested entities retain their existing rules/conditions. Opening either editor hydrates every selected child and nested graph link; generated item defaults to a common small trinket. Scaling checkbox is now “Add scaling options”; Library Add sits under price.

Validation: generator regressions cover complete catalog entries without rule seeds, exact piece counts, nested deduplication, owned costs, allowed containment and items. Browser fixture exercised item → modal with nested capability; no live character writes.


### Review responsiveness and nested preview follow-up (2026-09-28)

Opening Review no longer silently starts a long server calculation. Check is explicit, and Save & return to play checks an unchecked draft before applying. Keep editing/close cancels the pending check, preventing it from holding editing controls disabled or installing a late preview. Review errors render inside the modal. Successful apply uses its returned graph and sheet immediately instead of awaiting redundant reloads, then switches to play. Validation remains server-side.

Nested editor catalogs and entity previews reconstruct full graph links; item live previews include effects inside capabilities, and heritage state callbacks retain capability contents instead of emitting name-only slots. Generated sessions retain their source graph independently of the other workbench. Long generated descriptions wrap inside card columns. Browser fixture checks: cancel delayed validation, immediately stage another edit, apply once; long nested descriptions fit a 440px card.


### Manual imports and long draft replay (2026-09-28)

Manual composer additions now fetch the authorized workspace subtree and retain its nodes and edges before delivering the slot event. The prior single-row fetch omitted graph edges, causing nested capability/effect contents to disappear when catalogs were reconstructed. Browser QA manually added a capability → effect → primitive to a heritage and verified both Pieces and preview show all levels and 4 BU.

The reported description-only review had 36 historical operations. Read-only graph/sheet timings were under one second; rollback-only full replay took 79.2 seconds. Conservative replay compaction skips isolated root primitive or capability add/remove pairs, never pre-existing memberships, mismatched instances, duplicate unresolved additions, or dependencies crossing a container edit. The saved journal remains intact. Final replay executed 8 operations in 13.5 seconds and retained the original final memberships; both diagnostics rolled back. Client review deadline now allows 180 seconds with cancellation, rather than aborting valid replay at 30 seconds.

### 2026-09-28 — preview navigation finishing pass

- Character workspace entity titles and Preview actions open the shared preview stack; Open composition remains a separate middle-column navigation action.
- Composition-card preview events now resolve against the current workspace graph (including generated drafts), falling back to a fetched record. Local nested previews preserve graph data instead of fetching unsaved IDs.
- Shared previews sit above Build & Preview, escape Atelier's local scope when launched over that drawer, and handle Escape/focus without closing the underlying builder or workspace surface.
- Renamed Restore benefit to Undo mirror; highlighted randomizer additional-piece entity kinds with bold gold text.
- Checked real components in a mocked browser fixture: capability → primitive stacked previews, one-layer Escape, and drawer preservation. Typecheck and focused lint passed (existing image lint warning); composition/handoff regression tests run separately. No live character save or deployment performed.
