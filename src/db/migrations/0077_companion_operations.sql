CREATE TABLE "companion_operations" (
  "id" uuid PRIMARY KEY,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "schema_version" integer NOT NULL,
  "subject_kind" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "character_id" uuid,
  "proposal" jsonb,
  "proposal_digest" text NOT NULL,
  "nonce_digest" text,
  "nonce_expires_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "approval_source" text,
  "status" text NOT NULL,
  "last_activity_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "terminal_receipt" jsonb,
  "superseded_by" uuid,
  CONSTRAINT "companion_operations_status_check"
    CHECK ("status" IN ('pending_approval', 'approved', 'completed', 'blocked', 'superseded'))
);
--> statement-breakpoint
CREATE INDEX "companion_operations_owner_idx" ON "companion_operations" ("owner_id", "id");
--> statement-breakpoint
CREATE INDEX "companion_operations_expiry_idx" ON "companion_operations" ("expires_at", "id");
--> statement-breakpoint
CREATE TABLE "companion_operation_steps" (
  "operation_id" uuid NOT NULL REFERENCES "companion_operations"("id") ON DELETE CASCADE,
  "step_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "entity_kind" text,
  "entity_id" text,
  "version_pin" uuid,
  "failure_code" text,
  CONSTRAINT "companion_operation_steps_pk" PRIMARY KEY ("operation_id", "step_id"),
  CONSTRAINT "companion_operation_steps_ordinal_unique" UNIQUE ("operation_id", "ordinal"),
  CONSTRAINT "companion_operation_steps_ordinal_check" CHECK ("ordinal" >= 0),
  CONSTRAINT "companion_operation_steps_status_check" CHECK ("status" IN ('pending', 'committed', 'blocked'))
);
--> statement-breakpoint
CREATE TABLE "companion_progression_documents" (
  "operation_id" uuid PRIMARY KEY REFERENCES "companion_operations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "ideas" jsonb NOT NULL,
  "digest" text NOT NULL
);
