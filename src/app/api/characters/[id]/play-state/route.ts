import { privateJson } from "@/lib/http/private-json";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters, characterConsequences } from "@/db/schema";
import { resolveCharacterAccess } from "@/lib/character/resolve-character-access";
import { loadCharacterMaxVitality, clampVitality } from "@/lib/character/character-vitality";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { vitalityRuntimeUpdate } from "@/lib/character/vitality-update";
import { parseOccurrence } from "@/lib/character/consequences/validation";
import { PlayConflict, playMutationSchema } from "@/lib/play-state/model";
import { appendCharacterLog } from "@/lib/character/character-log";
import { validatePlayReferences } from "@/lib/play-state/references";
import { readWorkspace } from "@/lib/character/workspace/read";
import { readPlayState, reconcilePlayState, mutatePlayState } from "@/lib/play-state/service";
import { canonicalCharacterPlayValues, logCharacterPlayVitality, writeCharacterPlayVitality } from "@/lib/play-state/character";
import { RequestSizeError, readBoundedJson } from "@/lib/http/read-bounded-json";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
async function canonical(id: string, userId: string) {
  const [character] = await db.select().from(characters).where(eq(characters.id, id)).for("update");
  await resolveCharacterAccess(userId, id, { require: "EDITOR" });
  if (!character) throw new Error("Character not found.");
  const records = await db.select().from(characterConsequences).where(eq(characterConsequences.characterId, id));
  const state = await readPlayState("CHARACTER", id);
  return reconcilePlayState("CHARACTER", id, canonicalCharacterPlayValues(state, character.currentVitality, records));
}
function buildRefs(graph: WorkspaceGraph) {
  return graph.nodes.map(node => `${node.kind}:${node.id}:${node.versionId ?? "unversioned"}`).sort();
}
function failure(error: unknown) {
  if (error instanceof PlayConflict) return privateJson({ error: error.message, state: error.state, conflicts: error.fields }, { status: 409 });
  return privateJson({ error: error instanceof Error ? error.message : "Session save failed." }, { status: error instanceof RequestSizeError ? 413 : error instanceof Error && error.name === "CharacterAccessDenied" ? 403 : 400 });
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth(); if (!userId) return privateJson({error:"Unauthorized."},{status:401}); const { id } = await params;
    await resolveCharacterAccess(userId, id, { require: "EDITOR" });
    return await withDatabaseTransaction(async () => {
      const state = await canonical(id, userId);
      const { max, graph } = await loadCharacterMaxVitality(id);
      return privateJson({ state, buildRefs: buildRefs(graph), max, runtime: vitalityRuntimeUpdate(await readDraftSheet(id, graph)) });
    });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth(); if (!userId) return privateJson({error:"Unauthorized."},{status:401}); const { id } = await params;
    const mutation = playMutationSchema.parse(await readBoundedJson(request, 131072));
    if (mutation.changes.some(c => c.field === "baselineVitality")) throw new Error("Character baseline vitality is authored in the build.");
    await resolveCharacterAccess(userId, id, { require: "EDITOR" });
    const result = await withDatabaseTransaction(async () => {
      const previous = await canonical(id, userId);
      const graph = await readWorkspace(id);
      validatePlayReferences(graph, mutation);
      return mutatePlayState("CHARACTER", id, mutation, async (next, applied) => {
        const consequenceRecords = applied.changes.some(c => c.field.startsWith("consequence:"))
          ? await db.select().from(characterConsequences).where(eq(characterConsequences.characterId, id)) : [];
        for (const change of applied.changes) {
          if (change.field === "currentVitality") {
            const { max } = await loadCharacterMaxVitality(id);
            const value = change.value === null ? null : clampVitality(change.value as number, max);
            await writeCharacterPlayVitality(id, value, next);
          } else if (change.field.startsWith("consequence:")) {
            const occurrenceId = change.field.slice(12);
            const existing = consequenceRecords.find(r => r.occurrenceId === occurrenceId);
            if (change.value === null) {
              if (existing) await db.update(characterConsequences).set({ deletedAt: new Date(), revision: existing.revision + 1 }).where(and(eq(characterConsequences.characterId, id), eq(characterConsequences.occurrenceId, occurrenceId)));
            } else {
              const parsed = parseOccurrence(change.value);
              if (parsed.id !== occurrenceId) throw new Error("Consequence identity cannot change.");
              const occurrence = { ...parsed, ...(existing?.occurrence.applicationId ? { applicationId: existing.occurrence.applicationId, applicationSnapshot: existing.occurrence.applicationSnapshot, sourceEntityId: existing.occurrence.sourceEntityId, sourceEntityType: existing.occurrence.sourceEntityType, sourceVersionId: existing.occurrence.sourceVersionId } : {}), ...(existing?.occurrence.applicationSnapshot ? { applicationSnapshot: existing.occurrence.applicationSnapshot } : {}), ...(existing?.occurrence.promotedPrimitiveId ? { promotedPrimitiveId: existing.occurrence.promotedPrimitiveId } : {}) };
              next.overrides[change.field] = occurrence;
              if (existing) await db.update(characterConsequences).set({ occurrence, deletedAt: null, revision: existing.revision + 1 }).where(and(eq(characterConsequences.characterId, id), eq(characterConsequences.occurrenceId, occurrenceId)));
              else await db.insert(characterConsequences).values({ characterId: id, occurrenceId, occurrence });
            }
          }
        }
        // Consequence changes may reduce maximum vitality. Clamp after all fields
        // are applied so the canonical row and session override remain coherent.
        const { max } = await loadCharacterMaxVitality(id);
        const [character] = await db.select({ current: characters.currentVitality }).from(characters).where(eq(characters.id, id));
        if (character?.current !== null && character?.current !== undefined && character.current > max) {
          await db.update(characters).set({ currentVitality: max }).where(eq(characters.id, id));
          next.overrides["currentVitality"] = max; next.fieldRevisions["currentVitality"] = next.revision;
        }
        for (const change of applied.changes) {
          if (change.field === "currentVitality") {
            await logCharacterPlayVitality(id, previous, next, max, mutation.source ?? "manual");
          }
          if (change.field.startsWith("cap:") || change.field.startsWith("itemcap:")) {
            const capabilityId = change.field.split(":").at(-1)!;
            await appendCharacterLog(id, "capability_toggle", { capabilityId, capabilityName: graph.nodes.find(n => n.kind === "capability" && n.id === capabilityId)?.name ?? "Capability", active: change.field.startsWith("itemcap:") ? change.value === true : change.value === null });
          }
        }
        if (mutation.source === "long_rest" || mutation.source === "short_rest") {
          const prev = typeof previous.overrides["currentVitality"] === "number" ? previous.overrides["currentVitality"] as number : max;
          const current = typeof next.overrides["currentVitality"] === "number" ? next.overrides["currentVitality"] as number : max;
          await appendCharacterLog(id, "rest", { restType: mutation.source === "long_rest" ? "long" : "short", vitalityRestored: current - prev });
        }
      });
    });
    bustResolverCache(id);
    const { max, graph } = await loadCharacterMaxVitality(id);
    return privateJson({ state: result, max, runtime: vitalityRuntimeUpdate(await readDraftSheet(id, graph)) });
  } catch (error) { return failure(error); }
}
