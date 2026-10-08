# GM tools — October 2026

## Workflow

The FAB avatar opens Account inside Quick access. “I am a Game Master” is a
server-stored interface preference, not an account role or permission. It shows
encounters and monster navigation/creation controls; disabling it preserves
direct links, sheets, ownership and content.

Encounter preparation lives at `/encounters`. Manual Party BU and Party Item BU
are the default. Owned/shared characters are optional budget references: review
calculated contributions before applying them, and refresh explicitly. Editing
calculated totals creates a labelled manual override.

Monster entries retain immutable version pins and quantities. “Use current
version” explicitly updates a pin after resolving the current accessible
template. Equipment is appraised separately; mirror credit is not another
creature's budget. Comparable BU does not promise equal difficulty.

Starting creates independent private play copies in one transaction. A start
operation UUID prevents duplicate copies on retries. Preparation can have
multiple runs; deleting preparation preserves previous runs and copies.

Running records Council → Fast → Measured → Heavy, rounds and manual
intent/track/resolved markers. Phase controls never apply damage or expire
effects. Next Council clears the previous round's markers. Existing monster
gameplay controls retain their own synchronization and permissions.

## Persistence and access

- Migration `0073_gm_encounters.sql` is additive: profile preference, preparation,
  immutable template references, runs and copy membership.
- Definitions use revision checks. Conflict responses preserve the local draft
  and offer reload/reapply.
- Run markers use the existing account-scoped offline queue and conflict core
  with a separate validator. Character/monster mutation and backup formats stay
  compatible.
- Cached run metadata and opened creature sheets can be restored in the loaded
  application while offline. Starting requires connectivity. This is not a new
  installable/offline application shell.
- Owner authorization is independent of the GM preference. Template and
  component visibility is rechecked before preparation saves or new starts.
  Revoked references appear without their private identity. Existing authorized
  pinned copies preserve established behavior.
- Operational bounds: 200 creatures per run, 100 template entries and 30 linked
  characters. Catalogue and character pickers paginate; full creature previews
  load only when opened.

## System bestiary

`src/lib/monsters/catalogue/system-bestiary.ts` is the 100-entry stable manifest.
Each creature has a distinct concept, encounter use, tactics and mechanical
recipe. Ten public collections cover wilderness, subterranean, urban, aquatic,
aerial, undead, constructs, arcane anomalies, infernal and ancient guardians.

The seed resolves public canonical components, pins dependencies, validates
allocations, practices, costs, equipment and Vitality, and checks mechanical
uniqueness. Existing malformed capabilities/equipment were excluded rather than
modified. Snapshot comparisons use the JSON form persisted by PostgreSQL so
transient loader Date objects cannot create false changes. Reruns preserve
existing IDs and immutable versions; differing existing seeds fail for review.

## Release commands

```sh
pnpm exec tsx scripts/migrate-gm-encounters.mts
pnpm exec tsx scripts/migrate-gm-encounters.mts --apply
pnpm exec tsx scripts/seed-system-bestiary-2026-10.ts --initial
pnpm exec tsx scripts/seed-system-bestiary-2026-10.ts
pnpm exec tsx scripts/seed-system-bestiary-2026-10.ts --apply
pnpm exec tsx scripts/verify-gm-encounters.ts
pnpm exec vitest run src/lib/encounters/__tests__ src/lib/monsters/__tests__ src/lib/play-state/__tests__ src/lib/__tests__/fab-visibility.test.ts
pnpm typecheck
pnpm exec next build --webpack
```

The migration tool touches only 0073. Verification uses a rollback transaction
for every fixture. Stop the local server after browser checks and release.

## Later phases

Campaign notes, maps, VTT features and handbooks remain deferred. General entity
JSON interoperability belongs with the ChatGPT app/MCP phase: signed-in users
discuss a character concept, receive canonical or newly authored component
options validated against the rules, and save the completed character to their
account with a sheet link. Existing session synchronization remains the gameplay
foundation for multiple devices.
