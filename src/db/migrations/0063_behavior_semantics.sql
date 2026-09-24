-- Normalize behavior primitives into semantic access grants and numeric counters.
-- Keep the legacy target/value keys during the transition so old published
-- versions and resolver snapshots remain readable.
UPDATE "primitives"
SET "mechanical_rule" = "mechanical_rule" || jsonb_build_object(
  'family', CASE
    WHEN lower(coalesce("mechanical_rule"->>'target', '')) LIKE '%legendary resistance%'
      OR lower(coalesce("name", '')) LIKE '%legendary resistance%'
    THEN 'BEHAVIOR_COUNTER'
    ELSE 'BEHAVIOR_ACCESS'
  END,
  'operation', CASE
    WHEN lower(coalesce("mechanical_rule"->>'target', '')) LIKE '%legendary resistance%'
      OR lower(coalesce("name", '')) LIKE '%legendary resistance%'
    THEN coalesce("mechanical_rule"->>'operation', 'add')
    ELSE CASE WHEN "mechanical_rule"->>'operation' = 'revoke' THEN 'revoke' ELSE 'grant' END
  END,
  'bindings', coalesce("mechanical_rule"->'bindings', '{}'::jsonb) || jsonb_build_object(
    'behavior', trim(regexp_replace(coalesce("mechanical_rule"->>'target', "name"), '^behavior[.:][[:space:]]*', '', 'i'))
  )
)
WHERE "mechanical_rule"->>'family' = 'GENERIC'
  AND coalesce("mechanical_rule"->>'target', '') ~* '^behavior[.:]';

-- A structure primitive describes a required composition choice. The chosen
-- shape remains on the composition link; this marker makes that contract
-- explicit without inventing a shape for existing capabilities.
UPDATE "primitives"
SET "mechanical_rule" = "mechanical_rule" || jsonb_build_object(
  'bindingRequired', true,
  'bindingKey', 'structure'
)
WHERE "mechanical_rule"->>'family' = 'STRUCTURE';
