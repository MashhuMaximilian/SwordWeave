await db.execute(sql`
  DELETE FROM character_primitives
  WHERE character_id = '1a603977-611d-4026-8ae1-b30b-e1da024'::uuid
  AND primitive_id IN (
    SELECT id FROM primitives WHERE name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')
  )
`);

console.log("Deleted old links");

// Re-attach all 3 once each
for (const name of ['Smite Damage', 'Mark of the Hunt', 'Stone Skin']) {
  await db.execute(sql`
    INSERT INTO character_primitives (character_id, primitive_id, is_mirrored, acquired_at_level)
    SELECT '1a603977-611d-4026-8ae1-b30b-e1da024'::uuid, id, false, 18
    FROM primitives
    WHERE name = ${name}
  `);
  console.log(`Attached: ${name}`);
}

// Verify
const check = await db.execute(sql`
  SELECT p.name, COUNT(*) as cnt
  FROM character_primitives cp
  JOIN primitives p ON p.id = cp.primitive_id
  WHERE cp.character_id = '1a603977-611d-4026-8ae1-b30b-e1da024'::uuid
  AND p.name IN ('Smite Damage', 'Mark of the Hunt', 'Stone Skin')
  GROUP BY p.name ORDER BY p.name
`);
console.log("\nFinal attachments:", check.map((r: any) => `${r.name}: ${r.cnt}`));
