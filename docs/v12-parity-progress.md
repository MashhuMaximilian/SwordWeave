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
| Composite authors | Pieces / Identity / At the table / Publish retain mounted state. Missing-name save switches to Identity. | Full heritage/effect/item composition parity, nested rule visibility, and signed-in save/reload coverage. |
| Fork graph | Nodes, edges, zoom, fit, node exploration, and pagination implemented. | Reference parity for versions inside nodes, search, branch expansion, and pan behavior is not established. |
| Character sheet | Shared author improvements apply; drawer files untouched by these changes. | Compare expressions/mastery/source grouping and all signed-in runtime views against V12. |

Last production baseline: `6fd6895`. Later local navigation, unified family panel, and provenance changes require final verification and deployment.
