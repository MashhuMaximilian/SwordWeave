/**
 * Migration 0023: content-addressed version_id backfill
 *
 * Phase 4 redo of the edit-creates-fork refactor (§11 of edit-creates-fork.md).
 * Per the doc's "option A" design, the *_versions.id column is a
 * content-addressed UUID v5 (not defaultRandom). The hash is computed in JS
 * (SHA-1 of the v5 namespace + "<entityKind>:<entityId>:<contentHash>").
 *
 * This migration:
 *
 *   1. DELETEs the one stale test row in primitive_versions (no content_hash,
 *      empty snapshot, is_latest=false, version_number=1, primitive_id=1).
 *      It pre-dates the content-hash system and is not derivable from any
 *      current entity state.
 *
 *   2. For every entity that has a non-null content_hash, INSERTs a
 *      version row into the matching _versions table. The id is the
 *      content-addressed UUID; snapshot is the canonical payload
 *      reconstructed from the entity + its links; is_latest = true;
 *      version_number = 1 (first published snapshot).
 *
 * Affected counts (verified before migration run, 2026-07-08):
 *   - 190 primitives (1 has no content_hash: Strike (Copy) - leaves it)
 *   - 2 effects
 *   - 1 capability
 *   - 0 items (none have content_hash)
 *   - 0 templates (none have content_hash)
 *   Total: 193 backfilled rows.
 *
 * Idempotency: each INSERT uses ON CONFLICT (id) DO NOTHING. The
 * content-addressed id is unique per (entity_kind, entity_id, content_hash),
 * so a re-run on an already-backfilled DB finds the existing row and skips.
 *
 * After this migration, every save via dispatchSave will create a new
 * version row with the same content-addressed UUID, and stale-slot checks
 * (Phase 5) can match the slot's version_id against the entity's
 * *_versions.id directly.
 */

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const SWORDWEAVE_CONTENT_VERSION_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidStringToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}
function bytesToUuidString(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
function resolveContentVersionId(
  entityKind: string,
  entityId: string | number,
  contentHash: string,
): string {
  const name = `${entityKind}:${entityId}:${contentHash}`;
  const nameBytes = Buffer.from(name, "utf8");
  const nsBytes = uuidStringToBytes(SWORDWEAVE_CONTENT_VERSION_NAMESPACE);
  const hash = createHash("sha1").update(nsBytes).update(nameBytes).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuidString(hash.subarray(0, 16));
}

export const meta = {
  idx: 22,
  version: "7",
  when: Date.now(),
  tag: "0023_content_addressed_version_id",
  breakpoints: true,
};

export async function up(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const sql = neon(url);

  // 1) Delete the stale test row in primitive_versions. It pre-dates the
  //    content-hash system (snapshot is empty, is_latest=false,
  //    version_number=1, primitive_id=1) and would conflict with the
  //    backfill below.
  //    Note: *_versions tables don't have a content_hash column; the
  //    hash lives on the entity table (primitives.content_hash etc.).
  const deleted = await sql`
    DELETE FROM primitive_versions
    WHERE snapshot::text = '{}'
      AND is_latest = false
      AND version_number = 1
      AND primitive_id = 1
  `;
  console.log(`[0023] deleted ${deleted.length ?? 0} stale primitive_versions row(s)`);

  // 2) Backfill each entity kind.
  // For each row, look up content_hash, compute the content-addressed id,
  // and INSERT a version row (idempotent on the (entity_id, version_number) key).

  // PRIMITIVES (integer entity_id, 190 expected)
  const primitives = await sql`
    SELECT id, content_hash, source_origin, name, category, cost_tier,
           bu_cost, mechanical_output_text, narrative_rule, is_public,
           is_mirrorable, mirror_vector, mirror_bu_credit,
           mirror_eligibility_notes, hard_modifiers
    FROM primitives
    WHERE content_hash IS NOT NULL
  `;
  console.log(`[0023] backfilling ${primitives.length} primitives`);
  for (const row of primitives) {
    const id = resolveContentVersionId("primitive", row.id, row.content_hash);
    const snapshot = {
      id: row.id,
      sourceOrigin: row.source_origin,
      data: {
        name: row.name,
        category: row.category,
        costTier: row.cost_tier,
        buCost: row.bu_cost,
        mechanicalOutputText: row.mechanical_output_text,
        narrativeRule: row.narrative_rule,
        isPublic: row.is_public,
        isMirrorable: row.is_mirrorable,
        mirrorVector: row.mirror_vector,
        mirrorBuCredit: row.mirror_bu_credit,
        mirrorEligibilityNotes: row.mirror_eligibility_notes ?? "",
        hardModifiers: row.hard_modifiers ?? [],
      },
    };
    await sql`
      INSERT INTO primitive_versions
        (id, primitive_id, version_number, is_latest, delta_kind,
         snapshot, published_by_user_id, published_at, created_at, updated_at)
      VALUES (
        ${id}, ${row.id}, 1, true, 'FULL',
        ${JSON.stringify(snapshot)}::jsonb, NULL, NOW(), NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // EFFECTS (uuid entity_id, 2 expected)
  const effects = await sql`
    SELECT id, content_hash, source_origin, name, narrative_description, tags, is_public
    FROM effects
    WHERE content_hash IS NOT NULL
  `;
  console.log(`[0023] backfilling ${effects.length} effects`);
  for (const row of effects) {
    const id = resolveContentVersionId("effect", row.id, row.content_hash);
    const links = await sql`
      SELECT primitive_id, quantity, notes
      FROM effect_primitives
      WHERE effect_id = ${row.id}
      ORDER BY sort_order
    `;
    const snapshot = {
      id: row.id,
      sourceOrigin: row.source_origin,
      data: {
        name: row.name,
        narrativeDescription: row.narrative_description,
        tags: row.tags,
        isPublic: row.is_public,
        primitiveSlots: links.map((l) => ({
          primitiveId: l.primitive_id,
          quantity: l.quantity,
          notes: l.notes ?? "",
        })),
      },
    };
    await sql`
      INSERT INTO effect_versions
        (id, effect_id, version_number, is_latest, delta_kind,
         snapshot, published_by_user_id, published_at, created_at, updated_at)
      VALUES (
        ${id}, ${row.id}, 1, true, 'FULL',
        ${JSON.stringify(snapshot)}::jsonb, NULL, NOW(), NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // CAPABILITIES (uuid entity_id, 1 expected)
  const capabilities = await sql`
    SELECT id, content_hash, source_origin, name, type, source_type,
           verbose_description, tags, is_public
    FROM capabilities
    WHERE content_hash IS NOT NULL
  `;
  console.log(`[0023] backfilling ${capabilities.length} capabilities`);
  for (const row of capabilities) {
    const id = resolveContentVersionId("capability", row.id, row.content_hash);
    const primLinks = await sql`
      SELECT primitive_id, role, quantity, slot_label, notes
      FROM capability_primitives
      WHERE capability_id = ${row.id}
      ORDER BY sort_order
    `;
    const effLinks = await sql`
      SELECT effect_id
      FROM capability_effects
      WHERE capability_id = ${row.id}
      ORDER BY sort_order
    `;
    const snapshot = {
      id: row.id,
      sourceOrigin: row.source_origin,
      data: {
        name: row.name,
        type: row.type,
        sourceType: row.source_type,
        verboseDescription: row.verbose_description,
        tags: row.tags,
        isPublic: row.is_public,
        primitiveSlots: primLinks.map((l) => ({
          primitiveId: l.primitive_id,
          role: l.role,
          quantity: l.quantity,
          slotLabel: l.slot_label ?? "",
          notes: l.notes ?? "",
        })),
        effectIds: effLinks.map((l) => l.effect_id),
      },
    };
    await sql`
      INSERT INTO capability_versions
        (id, capability_id, version_number, is_latest, delta_kind,
         snapshot, published_by_user_id, published_at, created_at, updated_at)
      VALUES (
        ${id}, ${row.id}, 1, true, 'FULL',
        ${JSON.stringify(snapshot)}::jsonb, NULL, NOW(), NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // ITEMS (uuid entity_id, 0 expected but kept for symmetry)
  const items = await sql`
    SELECT id, content_hash
    FROM items
    WHERE content_hash IS NOT NULL
  `;
  console.log(`[0023] backfilling ${items.length} items`);
  for (const row of items) {
    const id = resolveContentVersionId("item", row.id, row.content_hash);
    await sql`
      INSERT INTO item_versions
        (id, item_id, version_number, is_latest, delta_kind,
         snapshot, published_by_user_id, published_at, created_at, updated_at)
      VALUES (
        ${id}, ${row.id}, 1, true, 'FULL',
        '{}'::jsonb, NULL, NOW(), NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // TEMPLATES (uuid entity_id, 0 expected but kept for symmetry)
  const templates = await sql`
    SELECT id, content_hash
    FROM templates
    WHERE content_hash IS NOT NULL
  `;
  console.log(`[0023] backfilling ${templates.length} templates`);
  for (const row of templates) {
    const id = resolveContentVersionId("template", row.id, row.content_hash);
    await sql`
      INSERT INTO template_versions
        (id, template_id, version_number, is_latest, delta_kind,
         snapshot, published_by_user_id, published_at, created_at, updated_at)
      VALUES (
        ${id}, ${row.id}, 1, true, 'FULL',
        '{}'::jsonb, NULL, NOW(), NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log("[0023] backfill complete");
}
