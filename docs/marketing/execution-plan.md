# SwordWeave execution plan

Updated 21 October 2026. The founder asked for an actionable plan and delegation. This plan defines order, ownership, dependencies and acceptance. The [implementation board](implementation-board.md) is the single source of task status; the [delivery review](delivery-review-2026-10-20.md) explains why the earlier release needs correction. The active work is SEO, AI discovery and desktop/mobile performance. Video production is deferred by the founder.

## Working agreement

- Preserve `/character`, the complete Rules page and the homepage's current identity. Connect the character guide and existing creation flow; do not delete the guide or replace the builder without a concrete need.
- Preserve the existing gold/silver/teal materials, fonts, mail delivery, authentication, consent and private workspaces. Work in the discovery worktree; the primary checkout contains unrelated ongoing book work.
- Use the approved PHB/editorial rules and actual selected public examples. Neris is primary; Orren is advanced. Never turn illustrative numbers into universal rules or silently settle pending rules.
- No paid advertising, new purchases/accounts or automated creator messages. The founder conducts personal outreach.
- Founder book consistency, all-three-book itch upload and personal playtests remain separate workstreams. Revised full/compressed organic-edges GM Guide PDFs and the ready 78-page reference-edition SRD were supplied on 21 October. All supplied object bytes/hashes are publicly verified through Cloudflare; the GM and SRD website releases are Ready, with verified canonical downloads. The implementation board records exact paths, sizes, hashes and release evidence. Full/compressed does not mean light/dark. Make progress on independent work while the founder's upload/playtest decisions continue.
- A delegated task is a bounded deliverable with owned files. The parent integrates and checks the whole user journey; agent completion is not product acceptance.

## Status and release evidence

Track these separately: **planned → in progress → implemented → technically verified → reviewed/accepted → released**. A failed review reopens the task. Record precise evidence and limits; do not equate a passing build, a working link or a ZIP hash with a useful learning experience.

For each batch retain its diff, focused checks, desktop/phone proof, content/rule checks and known open items. Review a coherent result before publishing it. Existing authorization covers routine work; request input only for a genuine missing decision, credentials/agreements or a concrete review the founder explicitly reserved.

## Batch 1 — shared reader and visible destinations

**Owners:** reader agent, navigation agent, tutorial-data agent; parent integration/review. **Implemented; see the current board.** Tasks WEB-06, NAV-01 and the source-completeness portion of AI-01.

| Work | Deliverable | Acceptance |
| --- | --- | --- |
| Reader | Extract the actual Rules reader into a reusable component; keep Rules and its embedded sheet guide using it. | Same visual template and selected-topic behavior, search, detail panels, previous/next, phone topics, keyboard focus and source links. No lost Rules chapters. |
| Tutorial data | Move all ten existing primitive tutorial chapters into structured data, including ordered actions, tables, source links and prior factual corrections. | Existing deep links remain meaningful; Use number, phone labels, private save and standalone-primitive testing instructions retained. |
| Creating | Present a navigable creation guide through the same reader. Add shared links to the editor tutorial and real creation destinations. | Reachable through Rules and the public menu; no separate sparse prose template. A complete content rewrite remains Batch 2. |
| Navigation | Clear Create destinations and a visible Creator kit link. Retain `/character` and every existing destination. | Desktop and phone reach Character guide, builder, Creating, primitive tutorial and Atelier; active states, Escape, focus and disclosure controls work; normal desktop navigation does not clip. |
| Markdown | Export every chapter of the reader's shared source, regardless of the selected browser topic. | Complete public text, tables and links; correct canonical/type/index headers; private routes excluded. Tests verify final chapters, not only the initial view. |

**Dependencies:** none on unfinished books or playtests. **Review point:** one coherent reader/navigation result, including Rules regression checks. The parent will not report the teaching rewrite as complete after a template change.

## Batch 2 — complete teaching and the character journey

**Owners:** teaching/content agent, source/numeric reviewer, parent UI integration. **Depends on:** shared reader/schema from Batch 1. Tasks WEB-03, WEB-04, WEB-05.

1. **Character guide and creation handoff.** Keep `/character` as a public guide with a clear Build your character action into the existing flow. Trace Neris's actual concept, attributes/proficiency, origin choices and reasons, checked acquisitions and BU reuse, a saved capability and a resolved use. Preserve the full public sheet for deeper inspection. Add relevant help/handoffs inside the existing flow only where it helps the actual step; avoid a second compulsory onboarding wizard.
2. **One owned set, several actions.** Show the same ingredient list beside at least three legal intents. Make ordinary action, already-owned permission and genuinely missing permission distinct. Show which scene decisions change resolution/Cost without inventing a purchase for every scaling dial. Then show saving one expression.
3. **Combat.** Retain the nonviolent encounter approach and add one complete hostile branch: actual participant rules/bonuses, illustrative dice totals, a legal reaction, outcome and changed state. Correct movement and upkeep wording across public guides. Do not imply encounter balance or independent playtesting.
4. **First-session preparation.** Keep it within Rules, give it a clear entry and linked reading order, selected character/encounter, materials and feedback handoff. Separate essentials from optional references.

**Acceptance:** follow a complete example without needing the author's explanation; cross-check source and arithmetic; all referenced records/chapters open; no unsupported automation, price, balance or rule claims. Website and Markdown teach the same complete material. Advanced qualifications belong in detail panels when they are not needed in the main example.

### Requested extension — character from scratch

On 20 October the founder requested a separate advanced authoring page and Create submenu destination, covering personal traits rather than supplied heritage choices. `/creating-a-character` now teaches a complete original proposal through numerical/nonnumerical primitives, conditional bonuses, optional compositions, exact accounting, resolved uses and consequences/recovery. It preserves the main Character guide and existing builder. The board records rule/UI review, tests and release evidence.

## Batch 3 — original companion materials and revised kit

**Owners:** material/PDF agent, brand/kit agent, parent review. **Depends on:** reviewed examples from Batch 2; exact gradient export may proceed independently. Tasks MATERIAL-01, MATERIAL-02, BRAND-01, WEB-02.

- **First-session run sheet:** target two pages, separately authored for preparation and play. Include useful writing space, an action/consequence record and actionable feedback. Deliver printable/fillable PDF plus equivalent web text.
- **Build with Neris:** target three pages explaining the actual choices, ownership/reuse ledger, composition and one resolved use. Include annotations and a personal-variation prompt. It must stand alone as a compact companion.
- **Gradient mark:** export the actual navigation gradient/mask as a faithful transparent asset; no replacement logo design.
- **Kit:** add these materials, captions, source/version records and appropriate existing rights notices; retain PHB excerpts only as book previews. Derive dates/version information consistently and rebuild the reproducible archive.

**Acceptance:** render and visually inspect every PDF page at realistic size; validate actual fillable field data and appearance; test writing/print space, links and downloads; compare the exported mark to the real navigation mark. Verify archive contents and notices. Do not call a JPEG excerpt an independent worksheet.

## Batch 4 — discovery, measurement and performance

**Owners:** SEO/research agent, analytics/performance agent, parent. **Dependencies:** stable public paths/content for final checks; investigations and source research can run earlier. Tasks AI-01, SEO-01/02, MEASURE-01, PERF-01.

| Track | Concrete output | Acceptance |
| --- | --- | --- |
| Search strategy | Prioritized page-by-page use of existing US/UK keyword research, intent evidence and specific improvements. | Clear reader question and primary destination per cluster; no duplicate thin pages or keyword-driven hero rewrite. Estimates remain ranges with actual market/source dates. |
| Technical discovery | Public canonical/indexing/internal-link/social/structured-data review and GSC/Bing evidence. | Public versus private policy matches intent; actual fetched/indexed/pending states recorded separately; no fabricated rich-result or ranking claims. |
| AI access | Complete public Markdown and llms index; investigate the failed external-reader probes. | Check real public delivery independently of unit tests and signed-in browser downloads. Record supported crawler/security evidence without weakening protections. Separate retrieved, cited, accurate and referred. |
| Measurement | Live proof of remaining event hooks and a small useful report connecting discovery, reading, trying tools and saving work. | Consented events carry no private text/PII. Existing events retained; kit click is not a completed download or partnership, invite click is not a Discord join. No GTM added by default. |
| Performance | Address the large shared public/app CSS dependency and measure a concrete before/after. | Preserve material styles, FAB and embedded tools; compare production assets and representative mobile loading. Keep lab variability and lack of field data explicit. |

**21 October current checkpoint:** GM/performance source `2007ef3b` is live in Ready deployment `dpl_AW5w72WjRzEvQK1Bxm4iL9Zf9FMG`, with canonical HTTP artifact checks. A real post-release PageSpeed report records mobile 63 / LCP 7.8 s and desktop 97 / LCP 1.1 s; both Accessibility, Best Practices and SEO are 100. The comparison is one Lighthouse 13.5 pair, not causal proof or field performance. Realtime confirms one consented keyboard-triggered `media_kit_download`; parameter values remain unchecked after another browser disconnect. The implementation board and current performance/measurement reviews retain the full metrics and limits.

**Remaining in this batch:** deeper shared-CSS separation, full desktop/phone authoring-tool visual checks, matched-request ChatGPT retrieval diagnosis and remaining useful reporting/parameter proof. The ready SRD is published in `40a0536c`, Ready deployment `dpl_7WJFLEBcMTcP1dVHGBFebNk8oWeC`; canonical pages, exact PDF bytes/hash and rebuilt kit are verified. No video task gates this work.

## Batch 5 — videos, deferred by founder

**Current state, 21 October:** deferred. The founder no longer requires a pilot and may record tutorials personally later. Do not begin recording, synthesis or editing as part of the active SEO/performance work. Tasks VIDEO-03/04 are retained as optional future work; no video is a prerequisite for discovery or publication.

**Earlier proposed workflow, retained for context:** the latest faster conversational voice direction was approved. A short excerpt would have used actual editor footage, legible framing, deliberate cursor/cuts, accurate captions and the proposed voice, followed by founder review before a longer recording. Founder talking points and screen actions remain available if useful later.

If the founder resumes video work, agree its scope then. Any future captions/transcript must match the final actual edit; planned text is not a finished transcript. Do not generate fictional UI footage or publish an unreviewed video.

## Batch 6 — distribution and community preparation

**Owners:** community/outreach research agent, parent, founder for personal messages. **Depends on:** useful kit/examples; public release timing depends on founder books/playtests. Tasks DIST-01/02/03 plus community follow-through.

- Prepare the existing private itch project with a coherent theme, cover/banner, actual screenshots, accurate release description and all three founder-ready PDFs together. Do not publish early or imply unreleased books are finished.
- Review Discord's welcome/rules/resources/help/feedback path, update links and prepare useful pinned material and real release announcements. Preserve the requested pet-pics space and avoid adding channels without a purpose.
- Research a relevant creator shortlist, individual outreach angles, evaluation instructions and a simple contact/evidence tracker. The founder sends personal outreach; no unsolicited automated messages.
- Use personal playtest feedback to improve the materials, identify known limitations and prepare meaningful version/release notes. Quotes and testimonials require actual evidence and permission.

**Acceptance:** a newcomer can find what to read/download, try the tools, ask a useful question and report feedback. Creator materials are usable without a private explanation. Public distribution reflects the founder's actual readiness.

## Batch 7 — print feasibility

**Owner:** research/production agent with founder decisions. **Depends on:** sufficiently stable books. No manufacturing purchase is authorized by this plan.

Research trim/page formats, bleed/safe areas, paper/binding, color options, print-on-demand/short-run providers, current regional costs/shipping and physical proofs. Provide a comparison grounded in actual supplier requirements and current quotes. Keep this separate from alpha digital-readiness work.

## Delegation and verification rules

- Give each agent exclusive owned files or a separate checkout when scopes overlap. Agree interfaces before parallel edits. Do not run multiple production builds against the same `.next` directory.
- Use focused tests appropriate to changed behavior. Preserve existing checks; add tests for meaningful new contracts, not decorative edits.
- Parent reviews source/rules, integration and actual desktop/phone behavior. Build fully, inspect a bounded batch, fix findings together and confirm. Use screenshots of the final result, not an old release.
- No task becomes accepted simply because its agent finished. Every handoff lists changed files, checks, open concerns and a reviewable artifact.
- Use one active batch plus genuinely independent work; do not begin all seven batches at once. Continue independent work when founder input is needed, without treating silence as approval.

## Current handoff

Batches 2–3 have been implemented with bounded agent scopes for the Neris construction trail, reuse/encounter teaching, source/numeric review and faithful gradient export. The parent integrated the original PDF/web companions, revised kit, public Library navigation and complete Neris Markdown. Both public monster and encounter browsing work signed out; private records and saving controls retain their existing checks.

Fifty-four focused tests, scoped lint, actual desktop/phone reading flows and browser downloads pass. Every companion PDF page and all fillable fields were checked. The implementation board records source evidence, archive hashes, final build/preview status and the production-mode Markdown caveat. These checks establish a reviewable result; founder acceptance is still separate.

The founder-requested logo layout, PHB-style companion revision and separate original-character guide are implemented; see the board for release evidence. The active implementation batch is discovery/measurement/performance (Batch 4), with SEO, AI discovery and desktop/mobile performance prioritized. The GM/performance release is Ready and has actual live PageSpeed plus kit-event receipt evidence; full authoring visual smoke, deeper CSS separation, retrieval diagnosis and remaining reporting proof are open. Batch 5 is deferred; no pilot is required. The founder has now supplied the ready SRD and its public object is verified, so SRD authoring is no longer pending; its canonical website release is Ready and verified. Founder book consistency, all-three-book itch upload and real playtest feedback remain separate. No claim is made that the entire marketing program is finished.

### Later 21 October checkpoint

The bounded font/resource-hint and connected-schema release `e93eef33` is Ready, with final 17-page/17-Markdown production checks. Latest mobile lab score is 68 / LCP 5.9 s; desktop remains 97 / LCP 1.1 s. Mobile TBT is 240 ms and there is no field data, so performance work remains open. The public/tool CSS replay and Clerk UI deferral experiments were rejected after measured/functional regressions. Detailed desktop/phone smoke now covers the main reading and editor handoffs, not every possible authoring path. Forty-four focused tests pass; 151 unrelated full-suite failures reproduce on unchanged baseline and require separate maintenance. The [current follow-up](mobile-ai-schema-followup-2026-10-21.md) and board supersede earlier current-checkpoint figures. ChatGPT retrieval still needs a real matched request; no video or bulk new content is required.
