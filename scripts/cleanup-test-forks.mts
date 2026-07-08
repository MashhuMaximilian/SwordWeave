import { db } from "../src/db/client";
import { effects } from "../src/db/schema/engine";
import { eq, and, like } from "drizzle-orm";

const source = "8b27f420-b541-495d-92fe-872cc5127c9b";
const sourceOrigin = `fork:${source}`;

// Find all forks of Blind Stun
const forks = await db.query.effects.findMany({
  where: eq(effects.sourceOrigin, sourceOrigin),
});
console.log(`Found ${forks.length} forks of Blind Stun`);
for (const f of forks) {
  console.log(`  - ${f.id} | ${f.name}`);
  await db.delete(effects).where(eq(effects.id, f.id));
}
console.log(`Deleted ${forks.length} forks`);
