import { db } from "@/db/client";
import { primitiveMarketClassifications } from "@/db/schema";
import { MARKET_FAMILIES } from "./canonical-market";

export async function savePrimitiveMarketClassification(primitiveId: number, familyKey: string, costTier: string, authoredIn: "atelier" | "companion") {
  const family = MARKET_FAMILIES.find(item => item.key === familyKey);
  if (!family) throw new Error("Choose a valid Lexicon Market family.");
  const tier = Number(costTier.match(/Tier\s+(\d+)/i)?.[1] ?? 0) || null;
  const classification = { familyKey: family.key, tier, source: "REVIEW" as const, status: "CLASSIFIED" as const, evidence: { authoredIn } };
  await db.insert(primitiveMarketClassifications).values({ primitiveId, ...classification }).onConflictDoUpdate({
    target: primitiveMarketClassifications.primitiveId,
    set: { ...classification, updatedAt: new Date() },
  });
}
