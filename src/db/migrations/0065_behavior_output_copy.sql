-- Project the normalized behavior rule back into the legacy display column so
-- old cards and exported snapshots stop saying "Grant 1 to Behavior:…".
UPDATE "primitives"
SET "mechanical_output_text" = CASE
  WHEN "mechanical_rule"->>'family' = 'BEHAVIOR_COUNTER' THEN
    CASE coalesce("mechanical_rule"->>'operation', 'add')
      WHEN 'set' THEN format(
        'Set %s uses to %s.',
        "mechanical_rule"#>>'{bindings,behavior}',
        coalesce("mechanical_rule"->>'value', '1')
      )
      WHEN 'subtract' THEN format(
        'Remove %s %s use%s.',
        coalesce("mechanical_rule"->>'value', '1'),
        "mechanical_rule"#>>'{bindings,behavior}',
        CASE WHEN coalesce("mechanical_rule"->>'value', '1') = '1' THEN '' ELSE 's' END
      )
      ELSE format(
        'Add %s %s use%s.',
        coalesce("mechanical_rule"->>'value', '1'),
        "mechanical_rule"#>>'{bindings,behavior}',
        CASE WHEN coalesce("mechanical_rule"->>'value', '1') = '1' THEN '' ELSE 's' END
      )
    END
  ELSE format(
    '%s the %s behavior.',
    CASE WHEN "mechanical_rule"->>'operation' = 'revoke' THEN 'Revoke' ELSE 'Grant' END,
    "mechanical_rule"#>>'{bindings,behavior}'
  )
END
WHERE "mechanical_rule"->>'family' IN ('BEHAVIOR_ACCESS', 'BEHAVIOR_COUNTER');
