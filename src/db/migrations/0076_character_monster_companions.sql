CREATE TABLE "character_monster_companions" (
  "id" uuid PRIMARY KEY,
  "character_id" uuid NOT NULL,
  "copy_id" uuid NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "character_monster_companions_character_id_characters_id_fk"
    FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE,
  CONSTRAINT "character_monster_companions_copy_id_monster_copies_id_fk"
    FOREIGN KEY ("copy_id") REFERENCES "monster_copies"("id") ON DELETE RESTRICT,
  CONSTRAINT "character_monster_companions_copy_id_unique" UNIQUE ("copy_id"),
  CONSTRAINT "character_monster_companions_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE INDEX "character_monster_companions_order_idx"
  ON "character_monster_companions" ("character_id", "position", "id");
