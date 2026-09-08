# Character workspace and Consequences

The character sheet now uses a navigator and workspace in BUILD and PLAY, with
contextual shared composers and explicit bundle reference operations. Atelier,
the build modal, drawers and bottom tabs retain their existing entry points.

## Implemented behavior

- Canonical supply graph retains every bundle path, independently held instances,
  mirror polarity and item contribution. Shared supply is displayed without
  charging for another copy of the same materialized piece.
- Character-scoped create, edit, add/remove/move/reorder, mirror and undo commands
  lock the character, reject stale revisions and use the existing publishing
  dispatcher for owned versions, non-owned forks and unchanged no-ops. Container
  edits leave referenced child definitions unchanged. Undo is compensating history.
- Contextual authoring supports empty bundles, on-character and Library selection,
  grouping, nested breadcrumbs, explicit drag alternatives and sortable composers.
  Save review previews membership and BU before committing. Pickers refresh through
  shared invalidation events without full-page reloads.
- Consequences persist with overrides, application snapshots, recovery notes and
  source identity. Legacy import is idempotent and retains its local backup until
  acknowledged. Restrictions retain alternate supply paths and combine blockers.
- Typed on-use primitive behavior composes into effect/capability packages. A
  committed application atomically records vitality, occurrences and history with
  an idempotency key. Promotion creates a definition without replaying the action.
- My Creations has Mechanics, Heritages and Characters tabs. Heritage formalization
  and ownership fixes are retained, including the prior Master of Surroundings repair.

## Verification evidence — 8 September 2026

- Targeted regressions: 998 passed across 65 files.
- Isolated transactional integration suite: 15 passed, including creation retry,
  owned versioning, borrowed forks, stale submissions, move/undo, rollback,
  build-modal instance and pinned-reference preservation, root detach/restore,
  direct mirror/undo with independent bundle supply, import tombstones, automatic
  override reset, repeat package applications and promotion without duplicate cost.
- TypeScript and scoped lint pass. Local production build, four Vercel preview
  builds and the production build passed.
- The wider existing suite reported 2362 passing, 6 failing and 9 skipped tests.
  The six failures assert older seed content in phase710-3 and phase79-stat-like;
  production authored data was not rewritten to satisfy those assertions.
- Existing repository-wide lint issues remain outside this change; changed workspace
  files pass their scoped checks.
- Migration 0058 ran twice in an isolated schema-only database. The release runner
  also applied its journal entry and repeated safely. Production check confirmed the
  intended database and that 0058 was pending. The runner guards existing heritage
  ownership and hashes and applies only this migration in one transaction.
- Authenticated isolated browser journey: create primitive, group into capability,
  reuse through a lineage with no duplicate BU; promote and sync a consequence;
  create an on-use primitive with save preview (BU 1→2); switch BUILD→PLAY without
  reload; trigger and preview vitality 12→9; commit once; resolve with notes while
  vitality remains 9 and BU remains 2. My Creations shows all three tabs and entries.
- Mobile 390×844: navigation sheet opens and selects the capability; preserved
  top/bottom drawers and bottom tabs render. A separate browser session reads the
  same server consequence/vitality state. Temporary mobile browser was closed.

## Version compatibility

Existing slot-source and version IDs remain authoritative and survive build-modal
saves. The existing sheet resolves live canonical entity rows while retaining pinned
reference metadata; this release does not introduce a different snapshot-following
or character-draft ownership model.

## Rollout

Preview with complete action journey:
https://sword-weave-esbtmy392-mashus-projects-3b3cfec0.vercel.app

Preview with direct-instance mirror support:
https://sword-weave-n1t35f6s0-mashus-projects-3b3cfec0.vercel.app

Final preview: https://sword-weave-6bmoqqa95-mashus-projects-3b3cfec0.vercel.app
(`dpl_3X7K6cc9qyZyYFkUsZDnQikZSCsn`). Authenticated workspace and item authoring
verified: an item reuses Ember Perception, keeps character BU at 2, and retains
existing equipment controls.

Production migration 0058 committed successfully and preserved existing heritage
ownership/content. Production deployment `dpl_4rNpYbpsjQC24nRF3iV9QYKZuB2e` is READY
at https://www.swordweave.quest (immutable URL:
https://sword-weave-3obq0e3cq-mashus-projects-3b3cfec0.vercel.app).
It inherits production project settings, including sensitive Clerk variables;
no preview database or development Clerk overrides were applied.

Production public homepage renders successfully. Authenticated production mutation
verification remains pending sign-in in the existing browser tab; this limitation
must not be described as a completed production journey.

Rollback deployment retained: `dpl_GrThhFvvLqU8cr2THkCs5TCTTcvJ`
(`https://sword-weave-13gos5hcr-mashus-projects-3b3cfec0.vercel.app`).

Never store deployment credentials in source or verification artifacts. All mutating
pre-release tests use the isolated database `sw_workspace_verify_20260908`.

## Follow-up: upbringing save wording and practice grants

Three reported issues were corrected without changing the workspace layout:

- Container saves name the entity: Save upbringing, Save lineage, Save capability,
  etc. Direct removal and character attachment retain their own action labels.
- Practice proficiency/expertise grants now contribute to the canonical practice
  total and its attribution. Expertise adds one PB when already proficient;
  proficiency and expertise resolve independently of input order. Repeated grants
  do not add repeated proficiency tiers. Inactive/inhibited grants contribute zero.
  Server sheet aggregation and client totals use the same grant calculation.
- Bottom-drawer contribution rows read both keyword `text` and legacy `value`,
  displaying the granted keyword instead of an empty chip.

Read-only inspection confirmed the reported Thaumaturgic tracker and Mental
inclination definitions were valid; their production content was not modified.

Validation: 779 engine/override tests passed (including 8 new regressions),
TypeScript and scoped new-file lint passed. Authenticated isolated preview verified
Awareness +8 → +12 on manual expertise On → +8 on Off; the formula showed
4 attribute + 4 proficiency + 4 practice contribution, and both grant labels were
visible. A created upbringing displayed Save upbringing and saved its new contents.
Preview: https://sword-weave-5orao6oda-mashus-projects-3b3cfec0.vercel.app

Follow-up production deployment `dpl_4EiNdi7BTzZzVDG9PCDuq78xifLj` is READY:
https://sword-weave-27f8driw8-mashus-projects-3b3cfec0.vercel.app
Vercel confirms both swordweave.quest and www.swordweave.quest aliases. The
production homepage rendered in the existing browser tab. Authenticated gameplay
was verified on the isolated preview; production authentication remains unavailable
in this browser session. Production inherited its existing project environment;
no migration or production content mutation was needed. Temporary preview access
was revoked after verification.

Previous deployment retained for rollback: `dpl_4rNpYbpsjQC24nRF3iV9QYKZuB2e`
(https://sword-weave-3obq0e3cq-mashus-projects-3b3cfec0.vercel.app).
