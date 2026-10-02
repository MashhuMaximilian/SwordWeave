/** Bounded, descriptive permission forks. Dry-run unless --apply. */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { forks, primitiveMarketClassifications, primitives, primitiveVersions, users } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";

config({ path: ".env.local", quiet: true });
type Row = typeof primitives.$inferSelect;
type Variant = { key: string; parentId: number; family: string; name: string; cost: number; tier: number; rule: string };
const variants: Variant[] = [
  { key: "controlled-glide", parentId: 221, family: "MOBILITY", name: "Controlled Glide", cost: 4, tier: 2,
    rule: "With room to spread wings or a similar surface, guide a fall and travel sideways up to 30 feet for each 10 feet descended. This does not create lift, hovering, or a flying speed. The table determines whether the space and surface permit gliding." },
  { key: "adhesive-grip", parentId: 218, family: "MOBILITY", name: "Adhesive Grip", cost: 4, tier: 2,
    rule: "Hands and feet can adhere to ordinary dry stone, wood, or masonry for climbing without separate climbing gear. Use the character's current climbing speed and relevant check for difficult surfaces. This gives no extra speed or grip on slick ice or magically repelling surfaces." },
  { key: "short-ground-echo", parentId: 215, family: "SENSORY_ARRAY", name: "Ground Contact Echo (10 ft)", cost: 3, tier: 2,
    rule: "While touching the same continuous ground as a moving creature or object within 10 feet, sense its vibration and approximate direction. This does not reveal a motionless creature, identity, or anything separated by a gap in the ground." },
  { key: "prehensile-tail", parentId: 183, family: "METAMORPHOSIS", name: "Prehensile Tail", cost: 4, tier: 2,
    rule: "Use a tail to hold or manipulate one light unattended object, such as a key, cup, or small tool, while the hands are occupied. It does not grant another attack, equipped item slot, or the precision of a free hand for complex crafting." },
  { key: "retractable-carapace", parentId: 183, family: "METAMORPHOSIS", name: "Retractable Carapace", cost: 4, tier: 2,
    rule: "Withdraw exposed soft tissue beneath a natural shell or plate when there is room to curl or brace. This can shelter small carried objects and the body from ordinary weather or loose debris. It grants no numeric DC, save, damage resistance, or immunity by itself." },
  { key: "shed-skin-decoy", parentId: 183, family: "METAMORPHOSIS", name: "Shed-Skin Decoy", cost: 4, tier: 2,
    rule: "Slough a loose outer layer to leave a recognizable decoy of the body or to attempt escape from a loose physical hold. The hold still calls for the usual check or table ruling; this permission does not automatically remove restraint or end a condition." },
  { key: "vocal-mimicry", parentId: 183, family: "METAMORPHOSIS", name: "Vocal Mimicry", cost: 4, tier: 2,
    rule: "After hearing a creature speak for at least a minute, reproduce its voice and familiar short phrases. This changes the sound made; it does not reveal unknown information, language, or grant automatic success on Influence checks." },
  { key: "scent-signaling", parentId: 214, family: "SENSORY_ARRAY", name: "Scent Signaling", cost: 3, tier: 2,
    rule: "Release distinct scent signals for simple rehearsed meanings to nearby creatures that can smell and know the code. Wind, water, masks, and unfamiliar recipients can block or confuse the signal. It is not telepathy or automatic understanding." },
  { key: "touch-memory-impression", parentId: 217, family: "SENSORY_ARRAY", name: "Touch Memory Impression", cost: 8, tier: 3,
    rule: "On sustained bare contact with an object, seek an emotional impression left by a significant past use. The GM describes any impression the object retains. This does not reconstruct every event, identify every handler, or read a living mind." },
];
const origin = (v: Variant) => `system:v12:curated:permission:${v.key}`;
function candidate(parent: Row, v: Variant): Row {
  return { ...parent, id: 0, name: v.name, userId: null, isPublic: true, sourceOrigin: origin(v),
    definitionKind: "EXPRESSION", bindingSchema: {}, bindings: {}, buCost: v.cost,
    costTier: `Tier ${v.tier} — author price ${v.cost} BU`, mechanicalRule: { family: "DESCRIPTIVE" },
    mechanicalTemplateText: "", mechanicalOutputText: v.rule, narrativeRule: v.rule,
    hardModifiers: [], isMirrorable: false, mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0,
    mirrorEligibilityNotes: "This narrative permission has no meaningful mirrored numerical effect.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date() };
}
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for fork lineage");
  const parents = new Map<number, { row: Row; versionId: string }>();
  for (const id of new Set(variants.map(v => v.parentId))) {
    const [row] = await db.select().from(primitives).where(eq(primitives.id, id)).limit(1);
    const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, id), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!row || row.userId !== null || !row.isPublic || !version) throw new Error(`Invalid parent ${id}`);
    parents.set(id, { row, versionId: version.id });
  }
  for (const v of variants) {
    const parent = parents.get(v.parentId)!;
    const row = candidate(parent.row, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(row));
    const [existing] = await db.select().from(primitives).where(eq(primitives.sourceOrigin, origin(v))).limit(1);
    if (existing) {
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(v.parentId)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      const [classification] = await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, existing.id)).limit(1);
      if (existing.contentHash !== hash || !version || !edge || classification?.familyKey !== v.family) throw new Error(`Drift or metadata gap ${existing.id}`);
      console.log(`already present ${existing.id} ${existing.name}`); continue;
    }
    const [duplicate] = await db.select({ id: primitives.id }).from(primitives).where(and(eq(primitives.name, row.name), eq(primitives.isPublic, true))).limit(1);
    if (duplicate) throw new Error(`Public name already exists: ${row.name}`);
    console.log(`${apply ? "creating" : "ready"} ${row.name}`);
    if (!apply) continue;
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(primitives).values({ ...row, id: undefined, contentHash: hash }).returning();
      if (!inserted) throw new Error(`Insert failed: ${row.name}`);
      const versionId = resolveContentVersionId("primitive", inserted.id, hash);
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: inserted.id, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: JSON.parse(JSON.stringify(inserted)) as Record<string, unknown>, publishedByUserId: null });
      await tx.insert(forks).values({ forkedByUserId: actor!.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(v.parentId),
        sourceVersionId: parent.versionId, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, permission: v.key } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: v.family, tier: v.tier,
        expressionKey: v.key, canonicalTemplateId: parent.row.templatePrimitiveId,
        canonicalExpressionId: inserted.id, source: "INHERITED", status: "CLASSIFIED",
        evidence: { parentId: v.parentId, curatedPhase: 3, permission: v.key } });
    });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
