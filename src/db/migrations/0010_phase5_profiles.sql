CREATE TYPE "public"."profile_visibility" AS ENUM('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."version_delta_kind" AS ENUM('FULL', 'DELTA');--> statement-breakpoint
CREATE TYPE "public"."flag_reason" AS ENUM('UNBALANCED', 'BROKEN', 'INAPPROPRIATE', 'DUPLICATE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."publish_target_type" AS ENUM('PRIMITIVE', 'CAPABILITY', 'CHARACTER', 'ITEM', 'RACE_TEMPLATE', 'BACKGROUND_TEMPLATE', 'ARCHETYPE_TEMPLATE', 'BUILD_TEMPLATE');--> statement-breakpoint
CREATE TYPE "public"."publish_visibility" AS ENUM('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('LIKE', 'DISLIKE');--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_usernames" (
	"username" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"public_primitives" integer DEFAULT 0 NOT NULL,
	"public_capabilities" integer DEFAULT 0 NOT NULL,
	"public_characters" integer DEFAULT 0 NOT NULL,
	"public_items" integer DEFAULT 0 NOT NULL,
	"public_races" integer DEFAULT 0 NOT NULL,
	"public_backgrounds" integer DEFAULT 0 NOT NULL,
	"public_archetypes" integer DEFAULT 0 NOT NULL,
	"total_forks_received" integer DEFAULT 0 NOT NULL,
	"total_likes_received" integer DEFAULT 0 NOT NULL,
	"total_dislikes_received" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "username_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"old_username" text NOT NULL,
	"new_username" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_anonymized" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "capability_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "primitive_adoptions" (
	"capability_version_id" uuid NOT NULL,
	"primitive_id" integer NOT NULL,
	"primitive_version_id" uuid NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "primitive_adoptions_pk" PRIMARY KEY("capability_version_id","primitive_id")
);
--> statement-breakpoint
CREATE TABLE "primitive_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primitive_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"is_latest" boolean DEFAULT false NOT NULL,
	"delta_kind" "version_delta_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_aggregates" (
	"target_type" "publish_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"unbalanced_count" integer DEFAULT 0 NOT NULL,
	"broken_count" integer DEFAULT 0 NOT NULL,
	"inappropriate_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"other_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_aggregates_pk" PRIMARY KEY("target_type","target_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "publish_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"reason" "flag_reason" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fork_aggregates" (
	"source_target_type" "publish_target_type" NOT NULL,
	"source_target_id" text NOT NULL,
	"source_version_id" uuid NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fork_aggregates_pk" PRIMARY KEY("source_target_type","source_target_id","source_version_id")
);
--> statement-breakpoint
CREATE TABLE "forks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forked_by_user_id" uuid NOT NULL,
	"source_target_type" "publish_target_type" NOT NULL,
	"source_target_id" text NOT NULL,
	"source_version_id" uuid NOT NULL,
	"source_author_id" uuid,
	"forked_target_type" "publish_target_type" NOT NULL,
	"forked_target_id" text NOT NULL,
	"forked_version_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "publish_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"author_id" uuid,
	"visibility" "publish_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reaction_aggregates" (
	"target_type" "publish_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"dislikes_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_aggregates_pk" PRIMARY KEY("target_type","target_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "publish_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_primitives" ADD COLUMN "is_mirrored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "username_history" ADD CONSTRAINT "username_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primitive_adoptions" ADD CONSTRAINT "primitive_adoptions_capability_version_id_capability_versions_id_fk" FOREIGN KEY ("capability_version_id") REFERENCES "public"."capability_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "primitive_adoptions" ADD CONSTRAINT "primitive_adoptions_primitive_version_id_primitive_versions_id_fk" FOREIGN KEY ("primitive_version_id") REFERENCES "public"."primitive_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follows_follower_following_unique_idx" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "username_history_user_id_idx" ON "username_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "username_history_old_username_unique_idx" ON "username_history" USING btree ("old_username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_purge_after_idx" ON "users" USING btree ("purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "capability_versions_id_version_unique_idx" ON "capability_versions" USING btree ("capability_id","version_number");--> statement-breakpoint
CREATE INDEX "capability_versions_capability_id_idx" ON "capability_versions" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "capability_versions_is_latest_idx" ON "capability_versions" USING btree ("is_latest");--> statement-breakpoint
CREATE UNIQUE INDEX "character_versions_id_version_unique_idx" ON "character_versions" USING btree ("character_id","version_number");--> statement-breakpoint
CREATE INDEX "character_versions_character_id_idx" ON "character_versions" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "character_versions_is_latest_idx" ON "character_versions" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX "primitive_adoptions_capability_version_idx" ON "primitive_adoptions" USING btree ("capability_version_id");--> statement-breakpoint
CREATE INDEX "primitive_adoptions_primitive_id_idx" ON "primitive_adoptions" USING btree ("primitive_id");--> statement-breakpoint
CREATE UNIQUE INDEX "primitive_versions_id_version_unique_idx" ON "primitive_versions" USING btree ("primitive_id","version_number");--> statement-breakpoint
CREATE INDEX "primitive_versions_primitive_id_idx" ON "primitive_versions" USING btree ("primitive_id");--> statement-breakpoint
CREATE INDEX "primitive_versions_is_latest_idx" ON "primitive_versions" USING btree ("is_latest");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_id_version_unique_idx" ON "template_versions" USING btree ("template_id","version_number");--> statement-breakpoint
CREATE INDEX "template_versions_template_id_idx" ON "template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_versions_is_latest_idx" ON "template_versions" USING btree ("is_latest");--> statement-breakpoint
CREATE UNIQUE INDEX "flags_unique_idx" ON "flags" USING btree ("user_id","target_type","target_id","version_id","reason");--> statement-breakpoint
CREATE INDEX "flags_target_idx" ON "flags" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "forks_forked_by_idx" ON "forks" USING btree ("forked_by_user_id");--> statement-breakpoint
CREATE INDEX "forks_source_idx" ON "forks" USING btree ("source_target_type","source_target_id");--> statement-breakpoint
CREATE INDEX "forks_source_author_idx" ON "forks" USING btree ("source_author_id");--> statement-breakpoint
CREATE INDEX "forks_forked_target_idx" ON "forks" USING btree ("forked_target_type","forked_target_id");--> statement-breakpoint
CREATE INDEX "publications_target_idx" ON "publications" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "publications_author_idx" ON "publications" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "publications_visibility_idx" ON "publications" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "publications_published_at_idx" ON "publications" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_unique_idx" ON "reactions" USING btree ("user_id","target_type","target_id","version_id","kind");--> statement-breakpoint
CREATE INDEX "reactions_target_idx" ON "reactions" USING btree ("target_type","target_id","version_id");--> statement-breakpoint
CREATE INDEX "reactions_user_idx" ON "reactions" USING btree ("user_id");