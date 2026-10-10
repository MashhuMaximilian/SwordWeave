import { randomUUID } from "node:crypto";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  encounters,
  encounterEntries,
  encounterRuns,
  encounterRunCopies,
  monsterVersions,
  monsterCopies,
  playStates,
  characters,
} from "@/db/schema";
import {
  encounterDefinitionSchema,
  appraiseEncounter,
  runMutationSchema,
  type EncounterDefinition,
  type CreatureSummary,
} from "./model";
import { visibleMonster, type PinnedDefinition } from "@/lib/monsters/service";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import { resolveMonster } from "@/lib/monsters/resolve";
import { monsterCopyDefinition } from "@/lib/monsters/copy-definition";
import { resolveMonsterPlay } from "@/lib/monsters/play";
import { readPlayState, mutatePlayState } from "@/lib/play-state/service";
import { canResolveCharacter } from "@/lib/character/can-resolve-character";
import { readDraftSheet } from "@/lib/character/workspace/draft-sheet";
import { readWorkspace } from "@/lib/character/workspace/read";
import { partyMechanics } from "./party-mechanics";
import { validateRunReferences, validateRunLimits } from "./run-state";
import { monsterArtwork } from "@/lib/monsters/art";
import { directVisibilityCondition, audienceIncludes, sharePreparation } from "./access";
import { assertMonsterAudience } from "@/lib/monsters/visibility";
import type { EntityKey } from "@/lib/character/workspace/model";
import { listEncounterDirectory } from "./directory";
import { evaluateCondition } from "@/lib/engine/condition-evaluator";
export class EncounterError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly current?: unknown,
  ) {
    super(message);
  }
}
export const listEncounters = (owner: string) => listEncounterDirectory(owner, {ownOnly:true, limit:100});
async function owned(owner: string, id: string, lock = false) {
  const q = db
    .select()
    .from(encounters)
    .where(and(eq(encounters.id, id), eq(encounters.ownerId, owner)));
  const [row] = await (lock ? q.for("update") : q);
  if (!row) throw new EncounterError("Encounter not found.", 404);
  return row;
}
async function readable(viewer: string | null, id: string, lock = false) {
  const q = db.select().from(encounters).where(and(eq(encounters.id,id), directVisibilityCondition(sql`${encounters.ownerId}`,sql`${encounters.visibility}`,viewer)));
  const [row] = await (lock ? q.for("update") : q);
  if(!row) throw new EncounterError("Encounter not found.",404);
  return row;
}
export async function pinSummary(owner: string | null, templateId: string, version: number) {
  const template = await visibleMonster(templateId, owner);
  if (!template)
    throw new EncounterError("A creature is no longer accessible.");
  const [pin] = await db
    .select()
    .from(monsterVersions)
    .where(
      and(
        eq(monsterVersions.monsterId, templateId),
        eq(monsterVersions.version, version),
      ),
    );
  if (!pin) throw new EncounterError("Creature version is unavailable.");
  const definition = pin.definition as PinnedDefinition;
  const slots = await resolveMonsterComposition(definition, owner);
  const sheet = resolveMonster(definition, slots);
  return {
    pin,
    summary: {
      templateId,
      version,
      name: definition.name,
      imageUrl: monsterArtwork(definition),
      budget: definition.budget,
      itemBu: sheet.itemBu,
      maximum: sheet.maximum,
      ...definition.catalogue,
    } satisfies CreatureSummary,
  };
}
export async function getEncounter(owner: string | null, id: string) {
  const row = await readable(owner, id);
  const isOwner = row.ownerId === owner;
  const entries = await db
    .select()
    .from(encounterEntries)
    .where(eq(encounterEntries.encounterId, id));
  const creatures: CreatureSummary[] = [];
  for (const e of entries) {
    try {
      creatures.push(
        (await pinSummary(owner, e.templateId, e.version)).summary,
      );
    } catch {
      creatures.push({
        templateId: e.templateId,
        version: e.version,
        name: "Unavailable creature",
        budget: 0,
        itemBu: 0,
        maximum: 0,
        unavailable: true,
      });
    }
  }
  const definition: EncounterDefinition = {
    ...(isOwner ? row.definition : sharePreparation(row.definition)),
    visibility: row.visibility,
    entries: entries.map((e) => ({
      templateId: e.templateId,
      version: e.version,
      quantity: e.quantity,
    })),
  };
  const runs = owner ? await db
    .select({
      id: encounterRuns.id,
      name: encounterRuns.name,
      createdAt: encounterRuns.createdAt,
    })
    .from(encounterRuns)
    .where(
      and(eq(encounterRuns.encounterId, id), eq(encounterRuns.ownerId, owner)),
    )
    .orderBy(desc(encounterRuns.createdAt))
    .limit(100) : [];
  return {
    id,
    isOwner,
    revision: row.revision,
    definition,
    creatures,
    runs,
    appraisal: appraiseEncounter(definition, creatures),
  };
}
export async function saveEncounter(
  owner: string,
  raw: unknown,
  id?: string,
  revision?: number,
) {
  const definition = encounterDefinitionSchema.parse(raw);
  return withDatabaseTransaction(async () => {
    const prior = id ? await owned(owner, id, true) : null;
    if (prior && prior.revision !== revision)
      throw new EncounterError(
        "This encounter changed on another device. Your local draft is preserved.",
        409,
        { revision: prior.revision },
      );
    const pins = [];
    for (const e of definition.entries)
      pins.push({
        entry: e,
        ...(await pinSummary(owner, e.templateId, e.version)),
      });
    for (const p of pins) {
      const template = await visibleMonster(p.entry.templateId, owner);
      if (!template || !audienceIncludes(definition.visibility, owner, template))
        throw new EncounterError("Every creature must be available to this encounter’s audience. Share its template first or keep the encounter private.");
      const pin = p.pin.definition as PinnedDefinition;
      await assertMonsterAudience((pin.componentPins ?? []).map(p => `${p.kind}:${p.id}` as EntityKey), owner, definition.visibility);
    }
    appraiseEncounter(
      definition,
      pins.map((p) => p.summary),
    );
    for (const cid of definition.characterIds) {
      const access = await canResolveCharacter(owner, cid);
      if (
        access.permission !== "OWNER" &&
        !(await characterIsShared(owner, cid))
      )
        throw new EncounterError(
          "Party character is no longer shared with you.",
        );
    }
    const { entries: _, ...compact } = definition;
    const [row] = prior
      ? await db
          .update(encounters)
          .set({
            name: definition.name,
            visibility: definition.visibility,
            definition: compact,
            revision: prior.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(encounters.id, prior.id))
          .returning()
      : await db
          .insert(encounters)
          .values({
            ownerId: owner,
            name: definition.name,
            visibility: definition.visibility,
            definition: compact,
          })
          .returning();
    if (!row) throw new EncounterError("Could not save encounter.");
    await db
      .delete(encounterEntries)
      .where(eq(encounterEntries.encounterId, row.id));
    if (pins.length)
      await db.insert(encounterEntries).values(
        pins.map((p) => ({
          encounterId: row.id,
          templateId: p.entry.templateId,
          version: p.entry.version,
          versionId: p.pin.id,
          quantity: p.entry.quantity,
        })),
      );
    return getEncounter(owner, row.id);
  });
}
export async function deleteEncounter(owner: string, id: string) {
  return withDatabaseTransaction(async () => {
    await owned(owner, id, true);
    await db.delete(encounters).where(eq(encounters.id, id));
    return { deleted: true };
  });
}
export async function startEncounter(
  owner: string,
  id: string,
  opId: string,
  revision: number,
) {
  return withDatabaseTransaction(async () => {
    const row = await readable(owner, id, true);
    const [existing] = await db
      .select()
      .from(encounterRuns)
      .where(
        and(
          eq(encounterRuns.ownerId, owner),
          eq(encounterRuns.startOpId, opId),
        ),
      );
    if (existing) {
      if (existing.encounterId !== id)
        throw new EncounterError("Start request belongs to another encounter.");
      return { id: existing.id };
    }
    if (row.revision !== revision)
      throw new EncounterError(
        "The encounter changed. Save or reload before starting.",
        409,
      );
    const entries = await db
      .select()
      .from(encounterEntries)
      .where(eq(encounterEntries.encounterId, id));
    if (!entries.length)
      throw new EncounterError("Add a creature before starting.");
    const pins = [];
    for (const entry of entries)
      pins.push({
        entry,
        ...(await pinSummary(owner, entry.templateId, entry.version)),
      });
    const [run] = await db
      .insert(encounterRuns)
      .values({
        ownerId: owner,
        encounterId: id,
        name: row.name,
        startOpId: opId,
        party: row.ownerId === owner ? row.definition : sharePreparation(row.definition),
      })
      .returning();
    if (!run) throw new EncounterError("Could not start encounter.");
    const copies = [];
    const memberships = [];
    let position = 0;
    for (const p of pins)
      for (let i = 0; i < p.entry.quantity; i++) {
        const name = p.summary.name + (p.entry.quantity > 1 ? ` ${i + 1}` : "");
        const copyId = randomUUID();
        copies.push({
          id: copyId,
          userId: owner,
          name,
          templateId: p.entry.templateId,
          templateVersion: p.entry.version,
          templateVersionId: p.pin.id,
          definition: null,
          currentVitality: p.summary.maximum,
        });
        memberships.push({ runId: run.id, copyId, name, position: position++ });
      }
    await db.insert(monsterCopies).values(copies);
    await db.insert(encounterRunCopies).values(memberships);
    await readPlayState("ENCOUNTER_RUN", run.id);
    return { id: run.id };
  });
}
export async function ownedRun(owner: string, id: string, lock = false) {
  const q = db
    .select()
    .from(encounterRuns)
    .where(and(eq(encounterRuns.id, id), eq(encounterRuns.ownerId, owner)));
  const [run] = await (lock ? q.for("update") : q);
  if (!run) throw new EncounterError("Encounter run not found.", 404);
  return run;
}
export async function getRun(owner: string, id: string, sessionOnly = false) {
  return withDatabaseTransaction(async () => {
    const run = await ownedRun(owner, id);
    const state = await readPlayState("ENCOUNTER_RUN", id);
    if (sessionOnly) return { state, buildRefs: [] };
    const members = await db
      .select()
      .from(encounterRunCopies)
      .where(eq(encounterRunCopies.runId, id))
      .orderBy(encounterRunCopies.position);
    const ids = members.flatMap((m) => (m.copyId ? [m.copyId] : []));
    const copies = ids.length
      ? await db
          .select()
          .from(monsterCopies)
          .where(
            and(
              inArray(monsterCopies.id, ids),
              eq(monsterCopies.userId, owner),
            ),
          )
      : [];
    const states = ids.length
      ? await db
          .select()
          .from(playStates)
          .where(
            and(
              eq(playStates.subjectKind, "MONSTER_PLAY_COPY"),
              inArray(playStates.subjectId, ids),
            ),
          )
      : [];
    const definitions = new Map<
      string,
      {
        definition: PinnedDefinition;
        slots: Awaited<ReturnType<typeof resolveMonsterComposition>>;
      }
    >();
    const summaries = [];
    for (const member of members) {
      const copy = copies.find((c) => c.id === member.copyId);
      if (!copy) {
        summaries.push({ ...member, unavailable: true });
        continue;
      }
      const key = copy.templateVersionId ?? copy.id;
      let bundle = definitions.get(key);
      if (!bundle) {
        const definition = await monsterCopyDefinition(copy);
        const slots = await resolveMonsterComposition(
          definition,
          owner,
          undefined,
          {
            trustedPinnedComposition:
              !!copy.templateVersionId &&
              Array.isArray(definition.componentPins),
          },
        );
        bundle = { definition, slots };
        definitions.set(key, bundle);
      }
      const resolved = resolveMonsterPlay(
        bundle.definition,
        bundle.slots,
        states.find((s) => s.subjectId === copy.id)?.overrides ?? {},
        copy.currentVitality,
      );
      const { sheet, occurrences, context } = resolved;
      summaries.push({
        ...member,
        currentVitality: sheet.currentVitality,
        maximum: sheet.maximum,
        budget: bundle.definition.budget,
        itemBu: sheet.itemBu,
        tactics: bundle.definition.catalogue?.tactics,
        role: bundle.definition.catalogue?.role,
        artwork: monsterArtwork(bundle.definition),
        attributes: sheet.attributes,
        attack: sheet.resolved.totals["attack_bonus"] ?? 0,
        saveDc: sheet.resolved.totals["save_dc"] ?? 0,
        speed: sheet.resolved.totals["speed"] ?? 0,
        consequences: occurrences
          .filter(
            (c) =>
              c.status !== "resolved" &&
              (c.manualOverride ??
                (c.source === "sheet-auto"
                  ? evaluateCondition(
                      c.modifiers[0]?.condition as never,
                      context,
                    )
                  : c.active)),
          )
          .map((c) => ({
            id: c.id,
            title: c.title,
            recovery: c.recovery ?? "",
          })),
      });
    }
    const partyLinks = [];
    for (const cid of run.party.characterIds) {
      try {
        const access = await canResolveCharacter(owner, cid);
        if (
          access.permission === "OWNER" ||
          (await characterIsShared(owner, cid))
        )
          partyLinks.push({ id: cid, name: access.character.name });
      } catch {
        /* No private identity is exposed after access is revoked. */
      }
    }
    return {
      run: {
        id: run.id,
        name: run.name,
        encounterId: run.encounterId,
        party: { ...run.party, characterIds: partyLinks.map((c) => c.id) },
      },
      members: summaries,
      partyLinks,
      state,
    };
  });
}
export async function mutateRun(owner: string, id: string, raw: unknown) {
  const mutation = runMutationSchema.parse(raw);
  return withDatabaseTransaction(async () => {
    const run = await ownedRun(owner, id, true);
    const actorFields = mutation.changes.filter((c) =>
      c.field.startsWith("actor:"),
    );
    if (
      actorFields.length ||
      mutation.changes.some((c) => c.field.startsWith("party:"))
    ) {
      const members = await db
        .select({ id: encounterRunCopies.id })
        .from(encounterRunCopies)
        .where(eq(encounterRunCopies.runId, id));
      try {
        validateRunReferences(
          mutation.changes.map((c) => c.field),
          members.map((m) => m.id),
          run.party.characterIds,
        );
      } catch (e) {
        throw new EncounterError((e as Error).message);
      }
    }
    return {
      state: await mutatePlayState(
        "ENCOUNTER_RUN",
        id,
        mutation,
        async (next) => {
          validateRunLimits(next.overrides);
        },
        (value) => runMutationSchema.parse(value),
      ),
    };
  });
}
async function characterIsShared(owner: string, id: string) {
  const result = await db.execute(
    sql`SELECT 1 FROM character_shares cs JOIN users u ON u.id=cs.shared_with_user_id WHERE cs.character_id=${id} AND cs.revoked_at IS NULL AND u.clerk_user_id=${owner} LIMIT 1`,
  );
  return result.rows.length > 0;
}
async function partyCharacterSummary(owner: string, id: string) {
  try {
    const access = await canResolveCharacter(owner, id);
    if (access.permission !== "OWNER" && !(await characterIsShared(owner, id))) return { id, unavailable: true as const };
    const graph = await readWorkspace(id);
    const sheet = await readDraftSheet(id, graph);
    return { id, name: access.character.name, partyBu: sheet.buBalance.progressionPool,
      partyItemBu: sheet.buBalance.itemBuSpent, ...partyMechanics(graph) };
  } catch { return { id, unavailable: true as const }; }
}
export async function partyCharacters(owner: string, ids?: string[], offset = 0, search = "") {
  if (ids) {
    const result = [];
    for (const id of ids) result.push(await partyCharacterSummary(owner, id));
    return result;
  }
  const rows = await db
    .select({ id: characters.id, name: characters.name, level: characters.level, size: characters.size, portraitUrl: characters.portraitUrl, portraitFrame: characters.portraitFrame, physical: characters.attrPhysical, mental: characters.attrMental, magical: characters.attrMagical, shared: sql<boolean>`NOT (${characters.userId}=${owner} OR EXISTS(SELECT 1 FROM users u WHERE u.id::text=${characters.userId} AND u.clerk_user_id=${owner}))` })
    .from(characters)
    .where(
      sql`(${characters.userId}=${owner} OR EXISTS(SELECT 1 FROM users u WHERE u.id::text=${characters.userId} AND u.clerk_user_id=${owner}) OR EXISTS(SELECT 1 FROM character_shares cs JOIN users u ON u.id=cs.shared_with_user_id WHERE cs.character_id=${characters.id} AND cs.revoked_at IS NULL AND u.clerk_user_id=${owner})) AND ${characters.name} ILIKE ${"%" + search + "%"}`,
    )
    .orderBy(characters.name)
    .limit(20)
    .offset(offset);
  const result = [];
  for (let start = 0; start < rows.length; start += 4) {
    const batch = await Promise.all(rows.slice(start, start + 4).map(async row => {
      const summary = await partyCharacterSummary(owner, row.id);
      return summary && !summary.unavailable ? { ...row, ...summary } : {
        id: row.id, name: "Character unavailable", level: 0, size: "", portraitUrl: null,
        portraitFrame: null, physical: 0, mental: 0, magical: 0, shared: false, unavailable: true,
      };
    }));
    result.push(...batch);
  }
  return result;
}
