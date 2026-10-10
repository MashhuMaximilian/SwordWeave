# Delivered work and remaining verification

Checked 10 October 2026 against checkout `3fa371530dbe5713a2d0412eb88aae7118e0af0e`, the original private roadmap, release records and current code. This is a repository and regression-test audit, not a new production/database certification.

## Roadmap status

| Work | Status | Evidence and limits |
| --- | --- | --- |
| Session continuity | Implemented; October 5 release documented | Shared revisioned state for characters and monster play copies; operation receipts, field conflicts, coordinated focus/reconnect refresh, offline queue and session backups. `src/lib/play-state/`, character/monster API adapters and the continuity rollout report. Actual two-physical-device testing and a real mobile backup download/import remain explicit manual checks in that report. |
| Collections | Implemented; subsequently extended | Custom and system collections, nesting, multiple memberships, source associations and independent entry access. Current service handles primitives, effects, capabilities, heritages, items, characters, monsters, encounters and collections. Public/follower/private visibility and ownership checks remain independent. Deleting a collection does not imply deleting its referenced content. `src/lib/collections/service.ts` and its permission/privacy/nesting/source tests. |
| Monsters and private play copies | Implemented | Templates, immutable versions/dependency pins, preparation/resolution, independent private copies and synchronized play state. Public/follower/private authored-template visibility exists. Template visibility is distinct from private gameplay-copy ownership. `src/lib/monsters/service.ts`, `resolve.ts`, play service and tests. |
| Focused GM workflow | Implemented | FAB account submenu and server GM preference; preparation, optional owned/shared party references, separate Party BU/Item BU, creature quantities, suggestions/manual selection, review and live runs. Revision checks and transactional starts preserve independent copies. Current encounter definitions support public/follower/private visibility; runs remain owner-managed. `src/lib/encounters/` and `src/components/encounters/`. |
| 100 new system monsters | Manifest complete; previous seed/validation release documented | Fresh static check: 100 recipes, 100 unique keys, 10 environments. This pass did not rerun the production seed or independently re-resolve all live database templates. Earlier validation/seed evidence is in `docs/implementation/gm-tools-2026-10.md`. |
| Monster portraits | Manifest and CDN mapping complete | Fresh static check: 100 portrait references with 100 unique paths. `src/lib/assets/public-art.ts` maps legacy `/art/monsters/*` URLs to the existing public origin's **`images/monsters/*`** objects. The legacy URL is an application alias, not a requirement to recreate an R2 `art/` folder. Git release `5d3e84f` records verified Cloudflare delivery. No new upload or bucket mutation in this audit. |
| Mobile compaction and subsequent directory/encounter feedback | Latest released source present | HEAD is the mobile compaction commit. This pass does not claim another complete device/theme visual regression. |
| Three free core books | In progress | Rights direction, chapter outlines and approved eight-page light/dark proof exist. The full manuscripts and complete SRD are not yet written. Full-system rule reconciliation is the current next step. |
| ChatGPT app/MCP plus general JSON interoperability | Deferred | Combined concept-to-character workflow remains in the original roadmap. Existing session continuity is already implemented; it is not waiting for the app/MCP. |
| Broader GM workspace | Deferred | Campaign notes, maps and VTT features are distinct from the delivered encounter workflow. |
| Store, adventures, print/retail, rights inventory and historical R2 cleanup | Deferred | See the original roadmap and `docs/next-work.md`. No commerce, license replacement or destructive cleanup is performed here. |

## Fresh checks

Two focused Vitest runs completed during this audit:

- 31 files / **336 passing tests**: session state/synchronization, collections, monsters, encounters, Rules Guide and core BU/Vitality/defense/Load formulas.
- 12 additional files / **120 passing tests**: creation requirements/budgets, practices and proficiency grants, conditional fail-closed behavior, canonical primitive contracts, movement reconciliation, attribute constraints, debt and capability table guidance.
- Total: **456 passing tests across 43 distinct files**. No skipped or failed tests in these runs.
- Static bestiary/art checks: 100 templates, 100 unique keys, 10 environments, 100 unique portrait references.

These tests support the inspected contracts. They do not prove every production account, provider quota, database migration, generated illustration or physical-device interaction. The historical release's build/typecheck/database checks are historical evidence, not newly rerun checks. No application code changed in this editorial audit, and no development server was started.

## Next

Use [the full-system rules audit](full-rules-audit-2026-10-10.md) to reconcile publication wording, settle the small remaining decision packet, then write the PHB and matching SRD sections together. The approved graphic proof can be retained throughout.
