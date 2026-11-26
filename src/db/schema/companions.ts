import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { characters } from "./characters";
import { monsterCopies } from "./monsters";

export const characterMonsterCompanions = pgTable("character_monster_companions", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  copyId: uuid("copy_id").notNull().unique().references(() => monsterCopies.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
}, table => [
  check("character_monster_companions_position_check", sql`${table.position} >= 0`),
  index("character_monster_companions_order_idx").on(table.characterId, table.position, table.id),
]);
