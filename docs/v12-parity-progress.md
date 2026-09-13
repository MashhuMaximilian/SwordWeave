# V12 production parity — active audit

Reference: `mockups/v12-arcane-masterwork/desktop/`. This is an incomplete audit, not a completion certificate.

## Preserved invariants

- Character top, bottom, and right drawers retain their layouts and actions.
- Load into build and Slot into … retain their handlers.
- Existing resolver, modifier, condition, equation, stacking, mirror, version, and BU contracts remain authoritative.
- No mock data or temporary review routes may ship.

## Evidence and outstanding checks

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Shared materials | Invalid layered CSS backgrounds corrected; local Library screenshots show opaque dark and light surfaces. | Compare all author, Character, preview, and modal states against both reference themes. |
| Workbench navigation | Added V12 navigation to Library and Atelier; Character does not use that component. | Verify signed-in Atelier height/collapse behavior with new navigation. |
| Library family panel | Header and Domain tiers now share a metallic frame; 390px viewport has 390px document width. | Other families need accurate reference-specific tier representations; compare full grouped results and pagination. |
| Library provenance | Inspector requests actual ancestry and direct-parent records through existing map API. | Verify nonempty lineage and precise pinned-version information. No inferred ancestry is shown for legacy records. |
| Primitive author | Sentence opens real target/operation/value/condition controls; generated output uses actual draft tokens/equations. | Verify all target families and nested conditions in authenticated saves, reload, and mobile creation flows. |
| Composite authors | Pieces / Identity / At the table / Publish retain mounted state. Missing-name save switches to Identity. Heritage recipe cards now expose capability descriptions, direct primitives and nested effects; desktop fixture rendered successfully. Effect quantities now flow through the existing flat query. Stable DnD IDs fixed a verified hydration mismatch. | Full effect/item composition parity, mobile nested-composition layout, and signed-in save/reload coverage remain. |
| Fork graph | Retained branch canvas with stable generation positions, deduplicated pagination, zoom/fit/pan/search, and lazy version headers implemented. Selecting a version opens its reconstructed stored snapshot in the inspector without leaving the graph; real PRIMITIVE:24 v1 verified in browser. Current entry preview also loads inline on demand. Ten graph/version access tests pass. | Composite historical child-name/BU resolution, multi-branch browser interaction, and exact desktop/mobile graph styling still require verification. 390px page/dialog width verified; full map and selected-version region remain present. |
| Character sheet | Added Expressions source layers and a family-grouped Mastery ledger using the existing workspace graph/actions. Direct and effect-granted rules exposed; all supply paths shown beneath each primitive. Local desktop/mobile fixture verified two primitive identities and three supply paths, no overflow at 390px. Drawer files untouched. | Exact source medallions/header styling, grouped direct primitives, per-path pinned version labels, and signed-in runtime flow checks remain. |

Last production baseline: `6fd6895`. Later local navigation, unified family panel, and provenance changes require final verification and deployment.

### Character projection pass (local, not deployed)

- Expressions defaults to granting sources rather than the previous flat primitive list. Mastery groups primitives by Market family and preserves all source paths. Existing row actions remain available.
- Source hierarchy exposes nested mechanical and narrative information. Grid/list, category filters, modal navigation and creation actions are retained.
- Screenshots: `output/playwright/v12-character-expressions.png`, `v12-character-mastery.png`, `v12-character-mastery-mobile.png`. These are local fixture checks, not authenticated runtime validation or proof of complete parity.
- TypeScript and 16 workspace model/cost/DnD tests passed. Temporary fixture removed.

### Fork-map continuation (local, not deployed)

- Branch exploration merges records and edges into the session instead of replacing the canvas. Failed requests retain the loaded map.
- Node version selection uses the existing visibility policy before querying version snapshots. Reconstruction starts at the nearest FULL snapshot and applies only the required chain; missing/broken chains return errors rather than current data.
- Added an opt-in XL detail-modal size for the graph; existing modal sizes and Character drawers are unchanged.
- Screenshot: `output/playwright/v12-fork-version-inspector.png` (before the final XL width adjustment). A real v1 snapshot loaded successfully; mobile DOM width stayed 390px.

### Direct reference material and Library density pass (local)

- Compared production and reference Library at 1600×1000. Ported V12 surface glass, mixed-metal edge, inset engraving and header finish into Library/Atelier panels; modal surfaces and Character drawers excluded.
- Restored family-specific category glyphs in both source rails. Compact Library introduction now places record-group navigation alongside it; all destinations retained. Rail/family headers are compressed, with Oxanium subtitle treatment.
- Platinum Frost+ navigation and teal primary action materials now match the reference direction. Screenshots `v12-library-matched-frame.png` and `v12-library-platinum-frame.png` precede the final small heading/teal corrections; they are progress evidence, not final parity proof.
- Mobile Library document width remains 390px; all four record-group links verified. No save/load/slot handlers changed. Signed-in Atelier and full visual audit remain outstanding.

### Composite primitive recipe identity pass (local)

- Effects, capabilities and heritages now share a primitive identity block with Market-family medallion, title, readable mechanical rule, family and expandable complete source preview. Narrative detail is retained. Existing stored slot identity takes precedence over lookup identity.
- Membership controls remain attached to their existing handlers. A local EffectForm fixture verified quantity 1→2 updates 3 BU→6 BU. Mobile inherited row layout was corrected; final computed card uses one 286px column and document width is 390px.
- Screenshot: `output/playwright/v12-effect-recipe-mobile-fixed.png`. Fixture removed; this does not substitute for signed-in save/reload verification. Drawer components were not changed.

### Item author chapters (local)

- Item author now uses Pieces / Identity / At the table / Publish with mounted fields. All former fields and save/reorder/mirror/slot handlers retained. Primitive identities use the shared recipe block; granted capability/effect detail is available without leaving the composer.
- Local 390px fixture verified missing-name submit selects Identity and focuses Name, edited name persists across chapters, and Two-handed changes equipped slots 1→2. Document width remains 390px. No item was saved; fixture removed.
- Screenshot `output/playwright/v12-item-table-mobile.png` predates removal of the implementation-note helper copy. Full signed-in save/reload and exact visual review remain required.

### Library identity grouping follow-up (local)

- Explicit domain keys take precedence over general scope and normalize case/whitespace. Group identity uses separate category/tier/key fields; all-tier results order by tier while preserving result order inside groups. Headers lead with the group name, with provenance fields beneath and honest page-local counts.
- Default browse opens Primitive Market. Explicit ALL remains available as a mixed-record view, preventing item/heritage rows appearing inside primitive tier clusters.
- Five classification tests pass. Local real-data Domain browse has 390px document width at 390px viewport; screenshot `output/playwright/v12-library-cluster-mobile.png` (before final tier ordering). Existing Domain records without stored scope/key remain Unclassified rather than inferring identity from names.
- Accumulated implementation passed production build before this grouping follow-up. Final typecheck and deployment remain separate checks; signed-in author/save coverage and full parity are still outstanding.

### Live composite preview hierarchy (local)

- Replaced legacy Effect/Capability/Heritage form-preview lists with shared V12 player cards: type-specific medallion, metadata pills, readable mechanical summary, direct primitive rules, expandable nested effects/capabilities, source and tags. Heritage fiction, image and suggested traits remain; slot roles, quantities, mirrors, labels and notes remain available.
- Atelier preview projections now carry mechanical/narrative rules and nested effect data. Loaded capability effects are retained before a form snapshot arrives. Missing compositions remain inspectable and partial BU labels are explicit. Capability/heritage totals use the existing transitive BU helper, preserving its deduplication contract.
- 13 live-card/BU tests passed. Mobile 390px capability and heritage fixture checks have no horizontal overflow; no live-card text below 12px. Light rule text uses the dark copper pigment against platinum wells. Screenshots: `v12-live-capability-light.png`, `v12-live-heritage-light-mobile.png`; initial dark full-page screenshot predates the corrected concentric medallion ring and includes an offscreen global drawer captured by full-page photography.
- Browser clicks verified original `sw-sandbox-open-preview` payloads for capability and primitive. This verifies dispatch compatibility, not authenticated modal/save/reload integration. Fixture removed; no records saved. Item form preview and full signed-in parity remain outstanding. Character drawers untouched.

### Item live card and integrated build

- Item preview now uses the same V12 hierarchy, with equipment facts, engine-derived Load, source/tags, direct primitives, granted effects and granted capabilities. Nested rules and original preview dispatch remain. Existing items retain the carried-only flag before the form snapshot arrives.
- Displayed recipe BU uses the existing transitive helper plus the separately stored extra item cost. Unknown nested recipes are explicitly marked partial. Updated the obsolete quantity helper copy to match the current engine; no engine or save contract changed.
- 15 live-card/transitive-BU tests passed, including tiny pouches and shared primitive deduplication. Local dark/light item fixtures both remain 390px wide at 390px viewport. Screenshots `v12-live-item-mobile.png` and `v12-live-item-light-mobile.png`. Fixture removed; no records saved.
- Full production build passed with all accumulated local changes. Signed-in production inspection remains required; it is still not a complete parity certificate.

## Production check and tablet correction

Commit dd2a387 deployed successfully to www.swordweave.quest (dpl_EVCAR6CvJ3D4ZHsTN1D667y4ZqgU). Signed-in in-app reload confirms new navigation and live preview. At 847px the legacy tablet branch still squeezed three columns and omitted the V12 panel chrome. Updated it to show source/editor or editor/preview, retaining the mounted editor and source state; supplied the same contextual V12 headings and surfaces. Added a 480px container query for primitive identity fields in independently narrowed editor panels. TypeScript passes. This correction still requires deployed visual verification; overall parity remains incomplete.

Tablet correction 699657c deployed READY as dpl_ArofxyJMyWqRXJ5uHBLfUq4b7XNc and aliased to www.swordweave.quest. Signed-in 847×814 browser check confirms V12 headers/surfaces, usable two-column editor/preview, and Browse sources restores the category/entry panel. Viewport override reset. Production Library Domain selection visibly shows four canonical tiers. Remaining: tablet preview toggle contrast, full author/Character/fork parity audit and complete authenticated flow regression.

## Character source grouping correction

Compared character-sheet.html expression-grid with BundleContents: live code incorrectly put each direct primitive in its own grid cell. Extracted BundleContents and grouped direct heritage rules into one ledger beside granted capability/effect expressions. Kept each existing edge callback, recursive supply path, rule and description. Six targeted render/model tests and TypeScript pass, including the same primitive supplied directly and via nested effect. No Character drawer changes. Visual browser verification and deployment of this correction remain pending.

Character source renderer browser verification: desktop 1200px shows capability beside direct-rule ledger; 390px mobile stacks them with document scrollWidth 390. Added V12 recipe ingredient buttons, semantic capability/effect headers and definition BU, and rose nested-effect rules. Browser click on Impact Sink returned exact ancestor path 0 / 4 / 5. Light screenshot output/playwright/character-source-mobile-light.png inspected; desktop output/playwright/character-source-grouping.png captures grouping before recipe strip addition. Temporary fixture removed and dev process stopped. Six render/model tests and TypeScript pass. Not yet deployed. Full Character/authenticated regression and full V12 parity remain open.

## Fork-map overview navigator

Implemented the V12 Library reference’s specified production minimap: loaded-node overview, selected-node highlight, visible viewport rectangle, click/keyboard centering. Fit now resets pan as well as scale. ResizeObserver and scroll listener keep the overview synchronized and clean up on unmount. Desktop inspector explicitly spans graph and overview; mobile stacks. Browser fixture with twelve generations at 390px: centering final entry reached scrollLeft 2667, Fit returned 0, document width remained390. Screenshot output/playwright/fork-minimap-mobile.png inspected. Three progressive-session tests and TypeScript pass; temporary fixture removed/dev stopped. Not yet deployed; full graph/authenticated parity still pending.

## Primitive phrase fidelity

Found visible value phrase ignored equation operands and condition phrase replaced AND/OR with dots or omitted narrative when pills existed. Shared primitiveSentenceParts now formats the editable operation/value/when phrases and generated mechanical description from identical data, with V12 Change/by/adding and Set/to/minimum/maximum grammar. Fixed old operation-label lookup treating an array as a keyed object. Saved resolver fields unchanged. Two targeted tests pass (OR+narrative; parenthesized equation taking precedence over stale numeric/tokens and no mutation), TypeScript passes. Browser verification and deployment pending. Full objective remains incomplete.

Primitive sentence browser verification: actual PrimitiveForm with non-saving fixture at390px rendered `Set PHYSICAL to maximum 5 × (2 + 3) When Self is wounded OR Scene is dark; while holding a shield`. Equation value button opens editor (aria-expanded true); document scrollWidth390. Screenshot output/playwright/primitive-equation-mobile.png inspected. Found compressed picker close control, added nonshrinking36px target. Fixture removed, dev stopped.

Production deployment120d3e9 completed READY: dpl_grGymx5E9cbaCjzWsbZqRgWtgtmT, https://sword-weave-oy9xy9s78-mashus-projects-3b3cfec0.vercel.app, aliased www.swordweave.quest. Includes Character source ledger/recipe strip, fork minimap/Fit reset, primitive shared sentence formatting and picker close width. Vercel compile/TypeScript/static generation all passed. Combined targeted checks16pass. Postdeploy signed-in verification and complete V12 fidelity audit remain pending.

## Signed-in Character inspection

Opened existing Futoshi from production roster without modifying data. Live workspace confirms direct lineage/upbringing ledgers and nested rule descriptions. Found source headers still generic heritage/chevron unlike V12 source-head. Added central Expressions source medallion, actual stored heritage kind label and Oxanium source title; Expand/Collapse callback, title navigation and Preview retained. CSS scoped to v12-expression-sources; no Character drawer files changed. TypeScript passes; this header correction is local and needs render verification. Live initial screen also shows excess repeated workspace headings/navigation relative to V12: next layout audit should consolidate center-only controls without removing actions.

Character center heading consolidation: moved the capabilities section title into CharacterWorkspace beneath its lens selector, matching V12 lens→heading ordering. Heading now follows Expressions/Mastery selection. Removed duplicate root Granted expressions heading and repeated grouping/helper copy; selected/composer modal headings stay. Passed direct capability count into workspace so original count remains. Category/search/filter/Grid/List controls unchanged; no drawer changes. TypeScript and six existing workspace model/render checks pass. Visual verification of combined header changes still pending; not deployed.
