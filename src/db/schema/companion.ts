import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./profiles";

export const companionOperations = pgTable("companion_operations", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  characterId: uuid("character_id"),
  proposal: jsonb("proposal").$type<unknown>(),
  proposalDigest: text("proposal_digest").notNull(),
  nonceDigest: text("nonce_digest"),
  nonceExpiresAt: timestamp("nonce_expires_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalSource: text("approval_source"),
  status: text("status").notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  terminalReceipt: jsonb("terminal_receipt").$type<unknown>(),
  supersededBy: uuid("superseded_by"),
}, (table) => [
  index("companion_operations_owner_idx").on(table.ownerId, table.id),
  index("companion_operations_expiry_idx").on(table.expiresAt, table.id),
  check("companion_operations_status_check", sql`${table.status} in ('pending_approval', 'approved', 'completed', 'blocked', 'superseded')`),
]);

export const companionOperationSteps = pgTable("companion_operation_steps", {
  operationId: uuid("operation_id").notNull().references(() => companionOperations.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  entityKind: text("entity_kind"),
  entityId: text("entity_id"),
  versionPin: uuid("version_pin"),
  failureCode: text("failure_code"),
}, (table) => [
  primaryKey({ name: "companion_operation_steps_pk", columns: [table.operationId, table.stepId] }),
  unique("companion_operation_steps_ordinal_unique").on(table.operationId, table.ordinal),
  check("companion_operation_steps_ordinal_check", sql`${table.ordinal} >= 0`),
  check("companion_operation_steps_status_check", sql`${table.status} in ('pending', 'committed', 'blocked')`),
]);

export const companionProgressionDocuments = pgTable("companion_progression_documents", {
  operationId: uuid("operation_id").primaryKey().references(() => companionOperations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  ideas: jsonb("ideas").$type<string[]>().notNull(),
  digest: text("digest").notNull(),
});
