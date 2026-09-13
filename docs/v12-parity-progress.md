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
