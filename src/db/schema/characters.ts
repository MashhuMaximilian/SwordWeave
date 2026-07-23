/**
 * Phase 4 schema — characters, lineages, upbringings, items, builds.
 *
 * Identity model:
 * - Characters are user-owned (user_id required for ownership)
 * - Lineages, upbringings, items, builds have nullable user_id (null = canonical/system)
 * - All support soft identity: (name, user_id) is unique; (name, source_origin) is public identity
 *
 * Identity follows the DM-Override principle from UX-WORKFLOW-SPEC:
 * anyone can edit any record if they're using it.
 *
 * Heritage rename (Phase 8+): heritage→heritage, race→lineage, background→upbringing,
 * archetype→manifest. See docs/phase-8/HERITAGE-RENAME-PLAN.md.
 */
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { iconSourceEnum } from "./enums";
import { timestamps } from "./common";
import { entities } from "./entities";
import { items } from "./items";
import {
  capabilities,
  capabilityPrimitives,
  effects,
  primitives,
} from "./engine";

// =============================================================================
// Enums
// =============================================================================

export const characterSizeEnum = pgEnum("character_size", [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
]);

export const characterAttrEnum = pgEnum("character_attribute", [
  "PHYSICAL",
  "MENTAL",
  "MAGICAL",
]);

export const characterPrimitiveSourceEnum = pgEnum("character_primitive_source", [
  "LINEAGE",
  "UPBRINGING",
  "PERSONAL",
  "TRAINING",
  "LEVEL_UP",
  "DM",
  // Phase 8.1 batch 5 (rework): the modal's Manifest tab needs its
  // own slot source so primitives slotted into the Manifest tab from
  // /atelier can be tracked separately from LINEAGE / UPBRINGING /
  // PERSONAL. Migration: 0040_character_primitive_source_manifest.sql.
  "MANIFEST",
]);

export const heritageKindEnum = pgEnum("heritage_kind", [
  "LINEAGE",
  "UPBRINGING",
  "MANIFEST",
]);

export const itemSizeEnum = pgEnum("item_size", [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
]);

// =============================================================================
// Characters
// =============================================================================

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),                  // nullable for system/example characters
    name: text("name").notNull(),
    size: characterSizeEnum("size").notNull().default("MEDIUM"),
    lineageName: text("lineage_name"),
    lineageImageUrl: text("lineage_image_url"),
    lineageDescription: text("lineage_description"),
    upbringingName: text("upbringing_name"),
    upbringingImageUrl: text("upbringing_image_url"),
    upbringingDescription: text("upbringing_description"),
    manifestName: text("manifest_name"),
    level: integer("level").notNull().default(1),
    attrPhysical: integer("attr_physical").notNull().default(0),
    attrMental: integer("attr_mental").notNull().default(0),
    attrMagical: integer("attr_magical").notNull().default(0),
    attrProficient: characterAttrEnum("attr_proficient"),
    practiceSlices: jsonb("practice_slices").notNull().default(sql`'{}'::jsonb`),
    currentVitality: integer("current_vitality"),
    startingBu: integer("starting_bu").notNull().default(25),
    buSpent: integer("bu_spent").notNull().default(0),
    dmBonusBu: integer("dm_bonus_bu").notNull().default(0),
    enforceTemplateCaps: boolean("enforce_template_caps").notNull().default(false),
    isMirrored: boolean("is_mirrored").notNull().default(false),
    notes: text("notes"),
    dmNotes: text("dm_notes"),
    portraitUrl: text("portrait_url"),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"), // "build:<id>" | "manual" | etc.
    // Phase 8.1 batch 5 (rework): freeform backstory fields held by
    // the modal's Backstory tab. JSONB for flexibility per Mashu
    // 2026-07-21 — new fields can be added without schema migrations.
    // Shape: { origin: string, motivation: string, ties: string,
    //         flaw: string }. See CharacterBackstory in
    // src/components/character-modal/character-modal-store.tsx.
    // Migration: 0039_characters_backstory.sql.
    backstory: jsonb("backstory").notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    index("characters_user_id_idx").on(table.userId),
    index("characters_is_public_idx").on(table.isPublic),
    index("characters_user_name_idx").on(table.userId, table.name),
    // Attribute sum must equal 10, each in [-1, +5]
    check(
      "characters_attr_sum_check",
      sql`${table.attrPhysical} + ${table.attrMental} + ${table.attrMagical} = 10
          AND ${table.attrPhysical} BETWEEN -1 AND 5
          AND ${table.attrMental} BETWEEN -1 AND 5
          AND ${table.attrMagical} BETWEEN -1 AND 5`,
    ),
    // Level minimum 1 (Phase 8.1 batch 10g: removed the L20 upper
    // cap — Mashu 2026-07-22 clarified there is no maximum and the
    // cumulative BU formula extrapolates indefinitely).
    check(
      "characters_level_min_check",
      sql`${table.level} >= 1`,
    ),
    // Total BU progression cap (Phase 8.1 batch 10g): the canonical
    // pool is max(startingBu, cumulative(level)) + dmBonusBu.
    //
    //   - "By Level" mode (client sends startingBu: 25, level: N):
    //     max(25, cumulative(N)) = cumulative(N) for any N >= 1.
    //   - "By BU" mode (client sends startingBu: <user value>,
    //     level: <implied>): if the user typed a value above the
    //     canon threshold for that level, max() picks the user's
    //     value. If below, the canon still wins. Either way the
    //     user can't over-spend their declared pool.
    //
    // cumulative(L) = 25 + 10*(L-1) + 4*k*(k+1)/2 where k = floor(L/4).
    // Old formula was startingBu + (L-1)*5 which was wrong at every
    // 4th level (L4 = 40, canon = 59).
    //
    // Phase 8.2 batch 12: the characters_bu_progression_check DB
    // constraint was removed (migration 0047) per Mashu's "soft
    // warning only" directive. The server only soft-warns on
    // over-budget saves; the client renders the red BU footer.
    // Mirror debt still hard-fails server-side (see maxBuDebtForLevel).
    check(
      "characters_starting_bu_check",
      sql`${table.startingBu} >= 0 AND ${table.startingBu} <= 100000`,
    ),
  ],
);

// =============================================================================
// slot_source — Phase 3 of the edit-creates-fork refactor.
//
// The three values correspond to the three kinds of slot a build can hold
// for a primitive / capability / item (per §6.6 of edit-creates-fork.md):
//
//   OWNED   — the slotted entity is something the user authored from scratch.
//             Updateable from source dependencies (transitive walk).
//   FORKED  — the slotted entity is a fork. Frozen. Cannot be "updated from
//             source" — that would defeat the fork's whole purpose.
//   PINNED  — the slotted entity is a library item pinned to a specific
//             version. Updateable: re-fetch the latest version AND
//             transitively re-fetch its dependency tree.
//
// Decision logic for the value lives in the application layer
// (depends on the source's source_origin and the caller's relationship
// to the source). The DB just enforces the enum constraint.
// =============================================================================
export const slotSourceEnum = pgEnum("slot_source", [
  "OWNED",
  "FORKED",
  "PINNED",
]);

/** The 3 slot_source values. Type alias for use in app code. */
export type SlotSource = (typeof slotSourceEnum.enumValues)[number];

// Junction: character <-> primitive
export const characterPrimitives = pgTable(
  "character_primitives",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "restrict" }),
    source: characterPrimitiveSourceEnum("source").notNull().default("PERSONAL"),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    /**
     * True if this primitive was acquired as a mirror vector (negative BU).
     * Mirrored primitives contribute mirrorBuCredit to the character's
     * volatility rating (bounded by getVolatilityCeiling(level)).
     * See src/lib/engine/bu.ts for full mirror-vector accounting.
     */
    isMirrored: boolean("is_mirrored").notNull().default(false),
    /**
     * Phase 3: which version of the primitive this slot references.
     * Null on rows created before versioning existed (pre-Phase 3) —
     * the runtime treats those as "version unknown" and shows a
     * stale-version indicator until the user re-slots. Phase 4
     * (content-hash auto-snapshot) populates this on new slots.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: what kind of slot relationship this is. Drives the
     * "Update available" UI in the build preview (Phase 5) and the
     * transitive dependency walk. Defaults to PINNED because all
     * pre-Phase-3 slots are functionally a pin on the live row.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    // Phase 8.1 batch 13.1: bundle-origin tracking. When a primitive
    // is brought into the character via a heritage → capability →
    // effect chain, these columns record the topmost container that
    // shipped it (so the character sheet can show "from Lineage
    // 'Elf'" / "from capability 'Fireball'" / "from effect
    // 'Explosion'" with clickable breadcrumbs).
    //
    // Nullable because pre-batch-13.1 rows have all nulls (treated
    // as "directly slotted, origin unknown"). A primitive's chain
    // can have multiple of these set (heritage + capability + effect
    // if it bubbled up through all three) — the UI uses the most
    // specific for breadcrumbs.
    originHeritageId: uuid("origin_heritage_id").references(
      () => heritage.id,
      { onDelete: "set null" },
    ),
    originCapabilityId: uuid("origin_capability_id").references(
      () => capabilities.id,
      { onDelete: "set null" },
    ),
    originEffectId: uuid("origin_effect_id").references(() => effects.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.primitiveId],
      name: "character_primitives_pk",
    }),
    index("character_primitives_character_id_idx").on(table.characterId),
    index("character_primitives_primitive_id_idx").on(table.primitiveId),
    index("character_primitives_version_id_idx").on(table.versionId),
    index("character_primitives_slot_source_idx").on(table.slotSource),
    index("character_primitives_origin_heritage_idx").on(table.originHeritageId),
    index("character_primitives_origin_capability_idx").on(
      table.originCapabilityId,
    ),
    index("character_primitives_origin_effect_idx").on(table.originEffectId),
  ],
);

// Junction: character <-> capability
export const characterCapabilities = pgTable(
  "character_capabilities",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "restrict" }),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    /**
     * Phase 3: which version of the capability this slot references.
     * See character_primitives.versionId for the full rationale.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: slot-source enum. See character_primitives.slotSource.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    // Phase 8.1 batch 13.1: a capability can be brought in via a
    // heritage (lineage/upbringing/manifest). When that happens, the
    // capability row gets originHeritageId set so the sheet can show
    // "from Lineage 'Elf'" breadcrumbs. Direct slots have null.
    originHeritageId: uuid("origin_heritage_id").references(
      () => heritage.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.capabilityId],
      name: "character_capabilities_pk",
    }),
    index("character_capabilities_character_id_idx").on(table.characterId),
    index("character_capabilities_capability_id_idx").on(table.capabilityId),
    index("character_capabilities_version_id_idx").on(table.versionId),
    index("character_capabilities_slot_source_idx").on(table.slotSource),
    index("character_capabilities_origin_heritage_idx").on(
      table.originHeritageId,
    ),
  ],
);

// =============================================================================
// Heritage (lineage / upbringing / manifest — same shape)
// =============================================================================

export const heritage = pgTable(
  "heritage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    kind: heritageKindEnum("kind").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    description: text("description"),
    suggestedTraits: text("suggested_traits"), // markdown
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    // Phase 8 rev 10: heritage parity with primitives/capabilities/effects/
    // items — every entity kind now carries a `tags text[]` column for
    // free-form tag chips in the unified preview. Migration:
    // `src/db/migrations/0038_heritage_tags.sql`.
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    contentHash: text("content_hash"),
    // Phase 8: per-entity iconography (see engine.ts primitives for
    // rationale). Heritage rows share the same icon contract as every
    // other entity — single source, single key/url, single color.
    iconSource: iconSourceEnum("icon_source"),
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    iconColor: text("icon_color").notNull().default("#ffffff"),
    // Phase 8 backfill: see primitives for the rationale.
    iconProposedSource: iconSourceEnum("icon_proposed_source"),
    iconProposedKey: text("icon_proposed_key"),
    iconProposedUrl: text("icon_proposed_url"),
    iconProposedColor: text("icon_proposed_color"),
    ...timestamps,
  },
  (table) => [
    index("heritage_user_id_idx").on(table.userId),
    index("heritage_kind_idx").on(table.kind),
    index("heritage_is_public_idx").on(table.isPublic),
    index("heritage_content_hash_idx").on(table.contentHash),
    // Phase 8 rev 10: tags GIN index — matches items/capabilities/effects
    // (created via `CREATE INDEX ... USING gin ("tags")`). Drizzle generates
    // the migration SQL for this via `db:generate`.
    index("heritage_tags_idx").using("gin", table.tags),
    // (name, user_id) unique, but Postgres treats NULL user_id as distinct
    // so we rely on application-level dedup (like capabilities migration).
    unique("heritage_user_name_kind_unique").on(
      table.name,
      table.userId,
      table.kind,
    ),
  ],
);

export const heritagePrimitives = pgTable(
  "heritage_primitives",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => heritage.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    // Phase 7 Q-M-UX: per-slot Mirrored flag.
    isMirrored: boolean("is_mirrored").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.templateId, table.primitiveId],
      name: "heritage_primitives_pk",
    }),
    index("heritage_primitives_template_id_idx").on(table.templateId),
    index("heritage_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const heritageCapabilities = pgTable(
  "heritage_capabilities",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => heritage.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      // Phase 8.1 batch 13.1 follow-up: change from `restrict` to
      // `cascade`. Mashu 2026-07-22: deleting a capability that
      // other heritages reference was blocked. The user wants:
      // "if I created a character or a heritage of sorts or
      // capability, and I delete it, I only delete that
      // compilation, not its components too." So when a cap is
      // deleted, its link rows in heritage_capabilities are
      // cleaned up automatically; the heritages that referenced
      // it are unaffected (the cap slot just becomes empty in
      // their bundle).
      .references(() => capabilities.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.templateId, table.capabilityId],
      name: "heritage_capabilities_pk",
    }),
    index("heritage_capabilities_template_id_idx").on(table.templateId),
    index("heritage_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);

// =============================================================================
// Items — defined in items.ts (Phase 4 added itemPrimitives there too)
// =============================================================================
// items, itemCapabilities, itemPrimitives live in items.ts to keep item tables
// together. Re-exported via schema/index.ts.

// =============================================================================
// Character <-> Heritage (Phase 8.1 batch 5)
//
// Per Mashu 2026-07-21, when the user slots a heritage from /atelier
// into the character modal's Lineage / Upbringing / Manifest tab, the
// ENTIRE heritage comes as one unit — all bundled primitives +
// capabilities + effects. This junction tracks that whole-heritage
// slot. The heritage's own `kind` column carries the LINEAGE /
// UPBRINGING / MANIFEST semantics, so we don't need a separate
// `source` column here.
//
// Per-slot fields mirror characterPrimitives: acquiredAtLevel,
// isMirrored (Phase 7 Q-M-UX — mirror-flagged slot has inverted BU
// contribution), versionId (Phase 3+), slotSource (Phase 3+ fork
// tracking), notes, timestamps.
// =============================================================================
export const characterHeritages = pgTable(
  "character_heritages",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    heritageId: uuid("heritage_id")
      .notNull()
      .references(() => heritage.id, { onDelete: "restrict" }),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    isMirrored: boolean("is_mirrored").notNull().default(false),
    versionId: uuid("version_id"),
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.heritageId],
      name: "character_heritages_pk",
    }),
    index("character_heritages_character_id_idx").on(table.characterId),
    index("character_heritages_heritage_id_idx").on(table.heritageId),
    index("character_heritages_version_id_idx").on(table.versionId),
  ],
);

export const characterItems = pgTable(
  "character_items",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    equipped: boolean("equipped").notNull().default(false),
    /**
     * Phase 3: which version of the item this slot references.
     * See character_primitives.versionId for the full rationale.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: slot-source enum. See character_primitives.slotSource.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.itemId],
      name: "character_items_pk",
    }),
    index("character_items_character_id_idx").on(table.characterId),
    index("character_items_item_id_idx").on(table.itemId),
    index("character_items_version_id_idx").on(table.versionId),
    index("character_items_slot_source_idx").on(table.slotSource),
  ],
);

// =============================================================================
// Character Log (Phase 8.2 batch 1)
// =============================================================================
//
// Append-only per-character runtime event log. Captures vitality changes,
// rests, level-ups, capability trigger/toggle, item equip/unequip. Read
// by the sheet's history panel so players can reconstruct what
// happened between sessions (Mashu 2026-07-22: "sometimes it takes
// weeks between sessions and I can forget").
//
// Convention: app code only ever INSERTs. Updates and deletes are
// not part of the API. Cascade on character delete cleans the log
// automatically.
// =============================================================================

export const characterLogKindEnum = pgEnum("character_log_kind", [
  "vitality_change",
  "rest",
  "level_up",
  "capability_trigger",
  "capability_toggle",
  "item_equip",
  "item_unequip",
  // Phase 8.2 batch 5: when a DM-issued bonus BU is added/removed
  // by the inline editor. Body payload: { prev, next, applied,
  // note? }. Distinct from 'level_up' (which implicitly zeroes
  // dmBonusBu — that's a separate event we could add later).
  "dm_bonus_change",
]);

export type CharacterLogKind = (typeof characterLogKindEnum.enumValues)[number];

export const characterLog = pgTable(
  "character_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    kind: characterLogKindEnum("kind").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("character_log_character_created_idx").on(
      table.characterId,
      table.createdAt.desc(),
    ),
    index("character_log_kind_idx").on(table.kind),
  ],
);

// =============================================================================
// Builds (character snapshots + manifest heritage)
// =============================================================================

export const builds = pgTable(
  "builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    name: text("name").notNull(),
    description: text("description"),
    level: integer("level").notNull().default(1),
    startingBu: integer("starting_bu").notNull().default(25),
    isManifestTemplate: boolean("is_manifest_template").notNull().default(false),
    // Snapshot fields
    lineageName: text("lineage_name"),
    lineageDescription: text("lineage_description"),
    upbringingName: text("upbringing_name"),
    upbringingDescription: text("upbringing_description"),
    manifestName: text("manifest_name"),
    attrPhysical: integer("attr_physical"),
    attrMental: integer("attr_mental"),
    attrMagical: integer("attr_magical"),
    attrProficient: characterAttrEnum("attr_proficient"),
    practiceSlices: jsonb("practice_slices"),
    portraitUrl: text("portrait_url"),
    // Refs to library
    lineageId: uuid("lineage_id").references(() => heritage.id, { onDelete: "set null" }),
    upbringingId: uuid("upbringing_id").references(() => heritage.id, {
      onDelete: "set null",
    }),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    // Phase 8: per-entity iconography. Builds previously had only
    // portraitUrl (a free-form image link the user pastes in for the
    // hero shot). They now ALSO get the system icon so the picker is
    // available in the build composer and cards show the system icon
    // in tight spaces. portraitUrl is unchanged; it's a separate concept
    // (hero art, optional) from the system icon (always present, color
    // is a per-row tint applied via /api/icons/game?color=…).
    iconSource: iconSourceEnum("icon_source"),
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    iconColor: text("icon_color").notNull().default("#ffffff"),
    iconProposedSource: iconSourceEnum("icon_proposed_source"),
    iconProposedKey: text("icon_proposed_key"),
    iconProposedUrl: text("icon_proposed_url"),
    iconProposedColor: text("icon_proposed_color"),
    ...timestamps,
  },
  (table) => [
    index("builds_user_id_idx").on(table.userId),
    index("builds_is_public_idx").on(table.isPublic),
    index("builds_is_manifest_idx").on(table.isManifestTemplate),
    check(
      "builds_level_range_check",
      sql`${table.level} BETWEEN 1 AND 20`,
    ),
  ],
);

export const buildCapabilities = pgTable(
  "build_capabilities",
  {
    buildId: uuid("build_id")
      .notNull()
      .references(() => builds.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      // Phase 8.1 batch 13.1 follow-up: change from `restrict` to
      // `cascade` so deleting a capability auto-cleans the build's
      // capability slots (matches the heritage cascade behavior
      // and the user's mental model in Mashu 2026-07-22).
      .references(() => capabilities.id, { onDelete: "cascade" }),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.buildId, table.capabilityId],
      name: "build_capabilities_pk",
    }),
    index("build_capabilities_build_id_idx").on(table.buildId),
    index("build_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);

// Re-export engine capabilityPrimitives for relation wiring
export { capabilityPrimitives };

// Re-export entities for relation wiring
export { entities };