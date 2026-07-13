import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { HardModifier, JsonValue } from "@/types/swordweave";
import { timestamps } from "./common";
import {
  capabilityPrimitiveRoleEnum,
  capabilityTypeEnum,
  primitiveCategoryEnum,
  sourceTypeEnum,
} from "./enums";

export const primitives = pgTable(
  "primitives",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    userId: text("user_id"),
    isPublic: boolean("is_public").notNull().default(false),
    category: primitiveCategoryEnum("category").notNull(),
    costTier: text("cost_tier").notNull().default("Tier 1: Minor (4 BU anchor)"),
    buCost: integer("bu_cost").notNull().default(0),
    // What the primitive modifies (Phase 7). For metric/bias modifier primitives
    // this identifies the scope axis: a specific Practice (e.g. 'AWARENESS'),
    // an Attribute ('PHYSICAL'), 'HP' for vitality, 'NARROW_FOCUS' for ultra-
    // specific triggers. Null for primitives that don't modify a metric
    // (e.g., Mobility, Verbs, Domains). Enforced via targetScopeEnum.
    targetScope: text("target_scope"),
    mechanicalOutputText: text("mechanical_output_text")
      .notNull()
      .default(""),
    narrativeRule: text("narrative_rule").notNull().default(""),
    isMirrorable: boolean("is_mirrorable").notNull().default(false),
    mirrorVector: text("mirror_vector").notNull().default("STANDARD_ONLY"),
    mirrorBuCredit: integer("mirror_bu_credit").notNull().default(0),
    mirrorEligibilityNotes: text("mirror_eligibility_notes")
      .notNull()
      .default(""),
    hardModifiers: jsonb("hard_modifiers")
      .$type<readonly HardModifier[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Public-identity column (Phase 3 / migration 0020). The single
     * piece of metadata that, together with `name`, uniquely identifies
     * a primitive row in the public library. Same convention as
     * effects/capabilities/items/templates (see §6.5 of edit-creates-fork.md).
     *
     * Values:
     *   - system content → "system:<seed-name>"
     *     (e.g. "system:phase5-commit-c-library-seed")
     *   - user-authored  → "user:<clerk-user-id>"
     *   - fork           → "fork:<source-row-id>"
     *
     * Replaces the old (name, category, user_id) unique constraint with
     * a (name, source_origin) unique. Two primitives can now share a
     * name across categories as long as their source_origins differ
     * (e.g. a user's "Strike" in two categories is fine; two forks of
     * the same source "Strike" can coexist on (name="Strike", source_origin=
     * "fork:<id-a>") and (name="Strike", source_origin="fork:<id-b>")).
     */
    sourceOrigin: text("source_origin"),
    /**
     * SHA-256 hex digest of the canonical-JSON content envelope
     * (sorted keys, versioned `{v:1, primitive:{...}}`). Populated
     * by the client on save; used by the dispatch matrix to detect
     * no-op saves (draftHash == sourceHash) and short-circuit before
     * allocating a new row or version bump. Nullable so legacy rows
     * can be backfilled lazily; a NULL hash is treated as "always
     * changed" by decideSaveOutcome, falling back to the legacy
     * INSERT/UPDATE path. See src/lib/publishing/hash-content.ts and
     * src/lib/publishing/dispatch-save.ts.
     */
    contentHash: text("content_hash"),
    ...timestamps,
  },
  (table) => [
    index("primitives_category_idx").on(table.category),
    index("primitives_user_id_idx").on(table.userId),
    index("primitives_is_public_idx").on(table.isPublic),
    uniqueIndex("primitives_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
    index("primitives_content_hash_idx").on(table.contentHash),
    index("primitives_source_origin_idx").on(table.sourceOrigin),
  ],
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (table) => [uniqueIndex("conditions_name_unique_idx").on(table.name)],
);

export const conditionPrimitives = pgTable(
  "condition_primitives",
  {
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.conditionId, table.primitiveId],
      name: "condition_primitives_pk",
    }),
    index("condition_primitives_condition_id_idx").on(table.conditionId),
    index("condition_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const effects = pgTable(
  "effects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    userId: text("user_id"),
    narrativeDescription: text("narrative_description").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    contentHash: text("content_hash"),
    ...timestamps,
  },
  (table) => [
    index("effects_is_public_idx").on(table.isPublic),
    index("effects_user_id_idx").on(table.userId),
    index("effects_tags_idx").using("gin", table.tags),
    index("effects_content_hash_idx").on(table.contentHash),
    uniqueIndex("effects_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
  ],
);

export const effectPrimitives = pgTable(
  "effect_primitives",
  {
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.effectId, table.primitiveId],
      name: "effect_primitives_pk",
    }),
    index("effect_primitives_effect_id_idx").on(table.effectId),
    index("effect_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const effectConditions = pgTable(
  "effect_conditions",
  {
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.effectId, table.conditionId],
      name: "effect_conditions_pk",
    }),
    index("effect_conditions_effect_id_idx").on(table.effectId),
    index("effect_conditions_condition_id_idx").on(table.conditionId),
  ],
);

export const capabilities = pgTable(
  "capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: capabilityTypeEnum("type").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    verboseDescription: text("verbose_description").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false),
    userId: text("user_id"),
    sourceOrigin: text("source_origin"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    metadata: jsonb("metadata")
      .$type<Record<string, JsonValue>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    contentHash: text("content_hash"),
    ...timestamps,
  },
  (table) => [
    index("capabilities_type_idx").on(table.type),
    index("capabilities_source_type_idx").on(table.sourceType),
    index("capabilities_is_public_idx").on(table.isPublic),
    index("capabilities_user_id_idx").on(table.userId),
    index("capabilities_tags_idx").using("gin", table.tags),
    index("capabilities_content_hash_idx").on(table.contentHash),
    uniqueIndex("capabilities_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
  ],
);

export const capabilityPrimitives = pgTable(
  "capability_primitives",
  {
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    role: capabilityPrimitiveRoleEnum("role").notNull(),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.capabilityId, table.primitiveId, table.role],
      name: "capability_primitives_pk",
    }),
    index("capability_primitives_capability_id_idx").on(table.capabilityId),
    index("capability_primitives_primitive_id_idx").on(table.primitiveId),
    index("capability_primitives_role_idx").on(table.role),
  ],
);

export const capabilityEffects = pgTable(
  "capability_effects",
  {
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.capabilityId, table.effectId],
      name: "capability_effects_pk",
    }),
    index("capability_effects_capability_id_idx").on(table.capabilityId),
    index("capability_effects_effect_id_idx").on(table.effectId),
  ],
);

// =============================================================================
// Nested effects — an Effect can contain other Effects (per Notion schema):
//   Effect Template (v1) §2.Construction → "Effects (1–n)"
// This table enables recursive effect composition: e.g. "Abyssal Despair"
// → nests "Shattered Composure" which itself nests "Vertigo Spasms".
// =============================================================================

export const effectEffects = pgTable(
  "effect_effects",
  {
    parentEffectId: uuid("parent_effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    childEffectId: uuid("child_effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.parentEffectId, table.childEffectId],
      name: "effect_effects_pk",
    }),
    index("effect_effects_parent_idx").on(table.parentEffectId),
    index("effect_effects_child_idx").on(table.childEffectId),
  ],
);
