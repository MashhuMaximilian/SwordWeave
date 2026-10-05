import { consequenceJson } from "@/lib/character/consequences/json";
import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { playStates, playStateOperations } from "@/db/schema/play-state";
import { applyPlayMutation, playMutationSchema, type PlayMutation, type PlayState, type SubjectKind } from "./model";
const whereState = (kind: SubjectKind, id: string) => and(eq(playStates.subjectKind, kind), eq(playStates.subjectId, id));
/** Call only inside an adapter that has authorized the subject. */
export async function readPlayState(kind: SubjectKind, id: string): Promise<PlayState> {
  let [state] = await db.select().from(playStates).where(whereState(kind, id));
  if (!state) {
    await db.insert(playStates).values({ subjectKind: kind, subjectId: id }).onConflictDoNothing();
    [state] = await db.select().from(playStates).where(whereState(kind, id));
  }
  if (!state) throw new Error("Session state unavailable.");
  return { revision: state.revision, overrides: state.overrides, fieldRevisions: state.fieldRevisions };
}
/** Adapter can participate in this same transaction to maintain canonical vitality/consequences. */
export async function mutatePlayState(kind: SubjectKind, id: string, raw: PlayMutation, apply?: (next: PlayState, mutation: PlayMutation) => Promise<void>): Promise<PlayState> {
  const mutation = playMutationSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify(mutation)).digest("hex");
  return withDatabaseTransaction(async () => {
    await readPlayState(kind, id);
    const [state] = await db.select().from(playStates).where(whereState(kind, id)).for("update");
    if (!state) throw new Error("Session state unavailable.");
    const receiptWhere = and(eq(playStateOperations.subjectKind, kind), eq(playStateOperations.subjectId, id), eq(playStateOperations.opId, mutation.opId));
    const [receipt] = await db.select().from(playStateOperations).where(receiptWhere);
    if (receipt && receipt.expiresAt > new Date()) {
      if (receipt.requestHash !== hash) throw new Error("Operation ID already used for different content.");
      return { revision: state.revision, overrides: state.overrides, fieldRevisions: state.fieldRevisions };
    }
    // Even after expiry, every touched field has a revision greater than the old
    // base. Absolute assignments cannot be applied a second time.
    const next = applyPlayMutation(state, mutation);
    if (next.revision !== state.revision) {
      if (apply) await apply(next, { ...mutation, changes: mutation.changes.filter(c => consequenceJson(state.overrides[c.field]) !== consequenceJson(c.value)) });
      await db.update(playStates).set({ ...next, updatedAt: new Date() }).where(whereState(kind, id));
    }
    await db.delete(playStateOperations).where(and(eq(playStateOperations.subjectKind, kind), eq(playStateOperations.subjectId, id), lt(playStateOperations.expiresAt, new Date())));
    await db.insert(playStateOperations).values({ subjectKind: kind, subjectId: id, opId: mutation.opId, requestHash: hash, revision: next.revision, expiresAt: new Date(Date.now() + 30 * 86400000) });
    return { revision: next.revision, overrides: next.overrides, fieldRevisions: next.fieldRevisions };
  });
}
/** Absorb writes from established gameplay APIs; adapters must lock the subject. */
export async function reconcilePlayState(kind: SubjectKind, id: string, canonical: Record<string, unknown>): Promise<PlayState> {
  const current = await readPlayState(kind, id);
  const changes = Object.entries(canonical).filter(([field, value]) => JSON.stringify(current.overrides[field] ?? null) !== JSON.stringify(value));
  if (!changes.length) return current;
  const next = { revision: current.revision + 1, overrides: { ...current.overrides }, fieldRevisions: { ...current.fieldRevisions } };
  for (const [field, value] of changes) { if (value === null) delete next.overrides[field]; else next.overrides[field] = value; next.fieldRevisions[field] = next.revision; }
  await db.update(playStates).set({ ...next, updatedAt: new Date() }).where(whereState(kind, id));
  return next;
}
