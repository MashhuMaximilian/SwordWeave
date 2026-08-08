#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./src/db";
import { reseedTestCharacter } from "./scripts/seed-test-character";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run with .env.local exported.");
  }

  // The seed script creates a fresh character. We need to also add
  // a capability with a conditional primitive.

  // For now, let's just re-run the seed and then add capabilities
  await reseedTestCharacter();

  // Now add a capability "Bless" with a conditional primitive
  // that gives +2 physical on self when vitality > 50%
  // and a capability "Curse" with the same primitive but mirrored
  // to show the conflict resolution

  console.log("Done");
}

main().catch(console.error);
