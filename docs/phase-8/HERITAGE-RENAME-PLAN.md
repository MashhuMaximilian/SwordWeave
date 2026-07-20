# Heritage Rename Plan — Layer 3 (DB schema + app code + URL contract)

**Status:** plan executed
**Scope:** All renames. No half-measures. `characters` and `builds` table names stay as-is.

## Goal

Rename the "templates" concept family to "heritage" everywhere it appears, and rename the
three sub-kinds RACE/BACKGROUND/ARCHETYPE to LINEAGE/UPBRINGING/MANIFEST.

| Old | New |
|---|---|
| `templates` table | `heritage` |
| `template_primitives` | `heritage_primitives` |
| `template_capabilities` | `heritage_capabilities` |
| `template_versions` | `heritage_versions` |
| `templateKindEnum` (DB enum) | `heritageKindEnum` |
| enum value `RACE` | `LINEAGE` |
| enum value `BACKGROUND` | `UPBRINGING` |
| enum value `ARCHETYPE` | `MANIFEST` |
| `publishTargetTypeEnum` value `RACE_TEMPLATE` | `LINEAGE_TEMPLATE` |
| `publishTargetTypeEnum` value `BACKGROUND_TEMPLATE` | `UPBRINGING_TEMPLATE` |
| `publishTargetTypeEnum` value `ARCHETYPE_TEMPLATE` | `MANIFEST_TEMPLATE` |
| characters.race_name / race_image_url / race_description | lineage_* |
| characters.background_name / background_image_url / background_description | upbringing_* |
| characters.archetype_name | manifest_name |
| builds.race_name / race_description | lineage_* |
| builds.background_name / background_description | upbringing_* |
| builds.archetype_name | manifest_name |
| builds.race_id (FK) | lineage_id (FK to heritage.id) |
| builds.background_id (FK) | upbringing_id (FK to heritage.id) |
| builds.is_archetype_template | is_manifest_template |
| `/api/templates/...` route | `/api/heritage/...` |

## What stays unchanged

- `characters` table name
- `builds` table name
- `character_primitives`, `character_capabilities`, `character_items` junction tables
- `templateKindEnum` *concept* — it just gets renamed to `heritageKindEnum`. Still 3 values.
- `publishTargetTypeEnum` *concept* — only the 3 suffixed values change.
- `BUILD_TEMPLATE` enum value (builds not renamed)
- `character_primitive_source` enum — its `RACE` / `BACKGROUND` / `DM` values are
  an orthogonal source-taxonomy and stay as-is.

## Migration strategy

### Step 1 — Drizzle schema rewrite (no migration yet)

Rewrite `src/db/schema/characters.ts` and `src/db/schema/engagement.ts` to use the
new names. **Don't run `drizzle-kit generate` yet** — the generated SQL will be wrong
because it doesn't know about renames.

### Step 2 — Hand-written SQL migration

Write a hand-rolled migration file because renames don't generate cleanly:

```sql
-- 1. Rename enum values (Postgres supports ALTER TYPE ... RENAME VALUE since v10)
ALTER TYPE template_kind RENAME VALUE 'RACE' TO 'LINEAGE';
ALTER TYPE template_kind RENAME VALUE 'BACKGROUND' TO 'UPBRINGING';
ALTER TYPE template_kind RENAME VALUE 'ARCHETYPE' TO 'MANIFEST';

-- 2. Rename publishTargetTypeEnum values
ALTER TYPE publish_target_type RENAME VALUE 'RACE_TEMPLATE' TO 'LINEAGE_TEMPLATE';
ALTER TYPE publish_target_type RENAME VALUE 'BACKGROUND_TEMPLATE' TO 'UPBRINGING_TEMPLATE';
ALTER TYPE publish_target_type RENAME VALUE 'ARCHETYPE_TEMPLATE' TO 'MANIFEST_TEMPLATE';

-- 3. Rename template_kind enum (only the type name, not values)
ALTER TYPE template_kind RENAME TO heritage_kind;

-- 4. Rename templates table → heritage (auto-updates FK refs)
ALTER TABLE templates RENAME TO heritage;

-- 5. Rename template_* junction tables
ALTER TABLE template_primitives RENAME TO heritage_primitives;
ALTER TABLE template_capabilities RENAME TO heritage_capabilities;
ALTER TABLE template_versions RENAME TO heritage_versions;

-- 6. Rename index names to match (cosmetic but keeps Drizzle happy)
ALTER INDEX templates_user_id_idx RENAME TO heritage_user_id_idx;
ALTER INDEX templates_kind_idx RENAME TO heritage_kind_idx;
ALTER INDEX templates_is_public_idx RENAME TO heritage_is_public_idx;
ALTER INDEX templates_content_hash_idx RENAME TO heritage_content_hash_idx;
ALTER INDEX template_primitives_template_id_idx RENAME TO heritage_primitives_template_id_idx;
ALTER INDEX template_primitives_primitive_id_idx RENAME TO heritage_primitives_primitive_id_idx;
ALTER INDEX template_capabilities_template_id_idx RENAME TO heritage_capabilities_template_id_idx;
ALTER INDEX template_capabilities_capability_id_idx RENAME TO heritage_capabilities_capability_id_idx;
ALTER INDEX template_versions_template_id_idx RENAME TO heritage_versions_template_id_idx;
ALTER INDEX template_versions_id_version_unique_idx RENAME TO heritage_versions_id_version_unique_idx;
ALTER INDEX template_versions_is_latest_idx RENAME TO heritage_versions_is_latest_idx;
ALTER INDEX templates_user_name_kind_unique RENAME TO heritage_user_name_kind_unique;

-- 7. Rename characters columns
ALTER TABLE characters RENAME COLUMN race_name TO lineage_name;
ALTER TABLE characters RENAME COLUMN race_image_url TO lineage_image_url;
ALTER TABLE characters RENAME COLUMN race_description TO lineage_description;
ALTER TABLE characters RENAME COLUMN background_name TO upbringing_name;
ALTER TABLE characters RENAME COLUMN background_image_url TO upbringing_image_url;
ALTER TABLE characters RENAME COLUMN background_description TO upbringing_description;
ALTER TABLE characters RENAME COLUMN archetype_name TO manifest_name;

-- 8. Rename builds columns (descriptive + FK + boolean flag)
ALTER TABLE builds RENAME COLUMN race_name TO lineage_name;
ALTER TABLE builds RENAME COLUMN race_description TO lineage_description;
ALTER TABLE builds RENAME COLUMN background_name TO upbringing_name;
ALTER TABLE builds RENAME COLUMN background_description TO upbringing_description;
ALTER TABLE builds RENAME COLUMN archetype_name TO manifest_name;
ALTER TABLE builds RENAME COLUMN race_id TO lineage_id;
ALTER TABLE builds RENAME COLUMN background_id TO upbringing_id;
ALTER TABLE builds RENAME COLUMN is_archetype_template TO is_manifest_template;

-- 9. Rename index on builds for archetype
ALTER INDEX builds_is_archetype_idx RENAME TO builds_is_manifest_idx;
```

**Notes:**

- Step 1 (RENAME VALUE) is safe; it rewrites the enum's string catalog. No data
  conversion needed because the values are stored as strings and the catalog
  change is atomic with the constraint check.
- Step 4-8 are pure DDL renames; data is preserved.
- Postgres FK references auto-update when the referenced table is renamed (Drizzle
  reads them at query time).
- `template_primitives_pk`, `template_capabilities_pk` — leave these constraint
  names alone unless Drizzle explicitly references them by old name. Check after.

### Step 3 — App code rename pass

Single sweep across the codebase:

- **Type renames** (`templateKind` → `heritageKind`, `TemplateRow` → `HeritageRow`,
  `TemplateKind` → `HeritageKind`, `RACE_TEMPLATE` → `LINEAGE_TEMPLATE`, etc.)
- **String literal renames** (`"RACE"` → `"LINEAGE"`, `"BACKGROUND"` → `"UPBRINGING"`,
  `"ARCHETYPE"` → `"MANIFEST"`)
- **Column-name renames in queries** (`race_name: raceName` → `lineage_name: lineageName`,
  etc. — rename both the field key and the camelCase accessor)
- **File renames**:
  - `src/app/api/templates/route.ts` → `src/app/api/heritage/route.ts`
  - `src/app/api/templates/[id]/route.ts` → `src/app/api/heritage/[id]/route.ts`
  - `src/app/api/templates/[id]/clone/route.ts` → `src/app/api/heritage/[id]/clone/route.ts`
  - `src/components/sandbox/template-form.tsx` → `src/components/sandbox/heritage-form.tsx`
  - `src/components/sandbox/template-form-preview.tsx` → `src/components/sandbox/heritage-form-preview.tsx`
  - `src/components/sandbox/blueprint-library.tsx` → `src/components/sandbox/heritage-library.tsx`
- **Component renames** (`TemplateForm` → `HeritageForm`, `BlueprintLibrary` →
  `HeritageLibrary`, etc.)
- **Test renames** — every test fixture using `kind: "RACE"` becomes `kind: "LINEAGE"`.

### Step 4 — URL contract (Layer 2 rolled in)

Since you said rename all, the URL also changes:

- `?build=template` → `?build=heritage`
- `?kind=RACE` → `?kind=lineage`
- `?kind=BACKGROUND` → `?kind=upbringing`
- `?kind=ARCHETYPE` → `?kind=manifest`
- `/api/templates/...` → `/api/heritage/...`
- **No back-compat shim** (per your "all renamed" direction). Old URLs 404.

If you change your mind about the shim, that's a small follow-up — `parseBuild`
and the API routes just need a fallback that maps old values to new ones.

### Step 5 — Tests + verification

- Run full test suite. Expect ~30+ test files to need fixture updates.
- Run `drizzle-kit check` to verify schema migrations are in sync.
- Run `pnpm typecheck` — every reference to a renamed column or enum value will
  surface as a type error.
- Manually smoke-test the atelier at each tab after build.

### Step 6 — Docs sweep

Update:
- `docs/architecture/edit-creates-fork.md`
- `docs/architecture/live-schema.md`
- `docs/phase-8/PHASE-8-PLAN.md` (terminology updates)
- `docs/phase-8/CREATION-MODAL-FLOW.md` (terminology)
- All `audit-sources/*.md` that mention "template", "race", "background", "archetype"

## Blast radius estimate

| Layer | File count | Edit cost | Risk |
|---|---|---|---|
| Schema files | 4 (`characters.ts`, `engagement.ts`, `relations.ts`, `versions.ts`) | medium | low (DDL renames are safe) |
| API routes | 3 (`/api/templates/*`) | medium | low |
| Components | ~8 (template-form, blueprint-library, related forms, library mappings) | medium | medium (visual regression risk) |
| Tests | ~15 fixtures | high | low |
| App code string refs | ~339 occurrences across ~80 files | high | medium (type errors catch most) |
| Docs | ~10 files | low | low |

## Suggested execution order

1. Schema files first (4 files). `pnpm typecheck` — should still pass because no
   app code references them yet under new names. Wait, that's backwards. Actually:
2. **App code first** in dev. Get everything compiling against the new schema
   names. Then run `drizzle-kit generate` to confirm it diffs cleanly to only
   the renames (no surprise drops/adds).
3. **Hand-write the SQL migration** based on the actual diff.
4. Run migration locally.
5. Smoke-test + full test suite.
6. Docs sweep.

## Decisions needed before coding

1. **URL shim or no shim?** (Default: no shim, per "all renamed")
2. **Confirm `characters.archetype_name` has no FK?** (verified — name-only)
3. **Confirm `is_archetype_template` rename target:** `is_manifest_template`?
   (reasonable default; flag for confirmation)
4. **Should `template_versions_*_idx` index names be renamed** for consistency?
   (Default: yes)

## Open risks

- **Drizzle introspect-vs-migrate divergence**: After step 3, `drizzle-kit generate`
  might emit the renames as drop-and-add, which would lose data. Mitigation: write
  the migration by hand (step 2 above) and check the generated SQL into source.
- **Postgres version constraint** on `ALTER TYPE ... RENAME VALUE`: requires
  Postgres ≥ 10. Confirm prod is ≥ 10.
- **Index name reference in Drizzle**: if Drizzle schema hard-codes the old index
  name (`templates_user_name_kind_unique`), it must match the renamed index.
  Need to grep for these references.
- **External scripts/backups**: any cron / backup script that references these
  tables by name will break silently. Audit `docs/audit-sources/` and any
  external Postgres tool.
