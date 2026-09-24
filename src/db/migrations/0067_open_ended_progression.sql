ALTER TABLE "builds" DROP CONSTRAINT IF EXISTS "builds_level_range_check";--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_level_min_check" CHECK ("builds"."level" >= 1);--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_starting_bu_check";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_starting_bu_check" CHECK ("characters"."starting_bu" >= 0);
