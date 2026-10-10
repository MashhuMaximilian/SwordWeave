import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps } from "./common";
import { monsterVersions, monsterCopies } from "./monsters";
import type { EncounterDefinition } from "@/lib/encounters/model";
export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    visibility: text("visibility").$type<"PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE">().notNull().default("PRIVATE"),
    revision: integer("revision").notNull().default(0),
    definition: jsonb("definition")
      .$type<Omit<EncounterDefinition, "entries">>()
      .notNull(),
    ...timestamps,
  },
  (t) => [index("encounters_owner_idx").on(t.ownerId, t.updatedAt), index("encounters_visibility_updated_idx").on(t.visibility,t.updatedAt),check("encounters_visibility_check",sql`${t.visibility} IN ('PRIVATE','FOLLOWERS_ONLY','PUBLIC')`)],
);
export const encounterEntries = pgTable(
  "encounter_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    encounterId: uuid("encounter_id")
      .notNull()
      .references(() => encounters.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").notNull(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => monsterVersions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    uniqueIndex("encounter_entry_pin_idx").on(t.encounterId, t.versionId),
  ],
);
export const encounterRuns = pgTable(
  "encounter_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    encounterId: uuid("encounter_id").references(() => encounters.id, {
      onDelete: "set null",
    }),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    startOpId: uuid("start_op_id").notNull(),
    party: jsonb("party")
      .$type<Omit<EncounterDefinition, "entries">>()
      .notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("encounter_start_op_idx").on(t.ownerId, t.startOpId),
    index("encounter_runs_owner_idx").on(t.ownerId, t.encounterId),
  ],
);
export const encounterRunCopies = pgTable(
  "encounter_run_copies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => encounterRuns.id, { onDelete: "cascade" }),
    copyId: uuid("copy_id").references(() => monsterCopies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    index("encounter_run_members_idx").on(t.runId),
    uniqueIndex("encounter_copy_membership_idx").on(t.copyId),
  ],
);
