import { pgTable, uuid, integer, text, jsonb, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { characters } from "./characters";
import { effects } from "./engine";
import { timestamps } from "./common";
import type { ConsequenceOccurrence } from "@/lib/character/consequences/types";

export const characterWorkspaceState = pgTable("character_workspace_state", {
  characterId: uuid("character_id").primaryKey().references(() => characters.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(0),
  ...timestamps,
});
export const characterConsequences = pgTable("character_consequences", {
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  occurrenceId: text("occurrence_id").notNull(),
  revision: integer("revision").notNull().default(1),
  occurrence: jsonb("occurrence").$type<ConsequenceOccurrence>().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, t => [primaryKey({ columns: [t.characterId, t.occurrenceId] })]);

/** Successful command receipts are also the retry boundary. Never delete history to undo. */
export const characterWorkspaceCommands = pgTable("character_workspace_commands", {
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  commandId: text("command_id").notNull(),
  kind: text("kind").notNull(),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(),
  ...timestamps,
}, t => [primaryKey({ columns: [t.characterId, t.commandId] })]);

export const characterEffects = pgTable("character_effects", {
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  effectId: uuid("effect_id").notNull().references(() => effects.id, { onDelete: "restrict" }),
  category: text("category").notNull().default("MANIFEST"),
  versionId: uuid("version_id"),
  slotSource: text("slot_source").notNull().default("PINNED"),
  ...timestamps,
}, t => [primaryKey({ columns: [t.characterId, t.effectId] })]);
