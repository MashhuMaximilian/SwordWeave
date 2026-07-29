import { db } from "./src/db/client";
import { eq } from "drizzle-orm";

async function main() {
  // Get Mystic's capability IDs from heritage_capabilities
  const heritage = await db.query.heritages.findFirst({
    where: (h, { eq }) => eq(h.name, "Mystic"),
  });
  if (!heritage) { console.log("No Mystic"); return; }

  const caps = await db.query.heritageCapabilities.findMany({
    where: eq((await import("./src/db/schema")).heritageCapabilities.templateId, heritage.id),
  });
  console.log("Mystic capabilities:");
  for (const c of caps) {
    console.log(`  ${c.capabilityId}`);
  }

  // Get all primitives from those capabilities via capability_primitives
  const capabilityIds = caps.map(c => c.capabilityId);
  if (capabilityIds.length === 0) { console.log("No caps"); return; }

  console.log("\nLooking for capabilities with primitives via JSON metadata:");
  // Get full capabilities
  const fullCaps = await db.query.capabilities.findMany({
    where: (c, { inArray }) => inArray(c.id, capabilityIds),
  });
  for (const c of fullCaps) {
    console.log(`  ${c.name}`;
  }
  process.exit(0);
}
main();
