import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { PlayOverrides } from "@/lib/play-state/model";
/** One compact current session state. Tombstone revisions protect cleared fields. */
export const playStates = pgTable("play_states", {
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  revision: integer("revision").notNull().default(0),
  overrides: jsonb("overrides").$type<PlayOverrides>().notNull().default({}),
  fieldRevisions: jsonb("field_revisions").$type<Record<string, number>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.subjectKind, t.subjectId] })]);
/** Bounded receipts; field revisions continue to guard stale retries after expiry. */
export const playStateOperations = pgTable("play_state_operations", {
  subjectKind: text("subject_kind").notNull(), subjectId: uuid("subject_id").notNull(),
  opId: uuid("op_id").notNull(), requestHash: text("request_hash").notNull(),
  revision: integer("revision").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.subjectKind, t.subjectId, t.opId] })]);
