DROP INDEX "primitives_name_category_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "primitives_name_category_user_unique_idx" ON "primitives" USING btree ("name","category","user_id");