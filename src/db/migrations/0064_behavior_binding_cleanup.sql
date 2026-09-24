-- Some legacy targets include the `Behavior:` namespace in the copied
-- binding. Store the semantic behavior name without that transport prefix.
UPDATE "primitives"
SET "mechanical_rule" = jsonb_set(
  "mechanical_rule",
  '{bindings,behavior}',
  to_jsonb(trim(regexp_replace(
    coalesce("mechanical_rule"#>>'{bindings,behavior}', "mechanical_rule"->>'target', "name"),
    '^behavior[.:][[:space:]]*',
    '',
    'i'
  ))),
  true
)
WHERE "mechanical_rule"->>'family' IN ('BEHAVIOR_ACCESS', 'BEHAVIOR_COUNTER');
