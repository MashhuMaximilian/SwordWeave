import {and,eq} from "drizzle-orm";
import {db,withDatabaseTransaction} from "@/db/client";
import {monsterCopies} from "@/db/schema/monsters";
import {parseOccurrence} from "@/lib/character/consequences/validation";
import {playMutationSchema,PlayConflict} from "@/lib/play-state/model";
import {readPlayState,mutatePlayState} from "@/lib/play-state/service";
import {monsterCopyDefinition} from "./copy-definition";
import {resolveMonsterComposition} from "./composition";
import {resolveMonsterPlay} from "./play";
/** Authorizes and locks the private play copy before generic state mutation. */
export async function mutateMonsterPlay(userId:string,id:string,raw:unknown){
 const mutation=playMutationSchema.parse(raw);
 return withDatabaseTransaction(async()=>{
  const [copy]=await db.select().from(monsterCopies).where(and(eq(monsterCopies.id,id),eq(monsterCopies.userId,userId))).for("update");
  if(!copy)throw new Error("Play copy not found.");
      const definition = await monsterCopyDefinition(copy);
      const slots = definition.resolvedSlots ?? await resolveMonsterComposition(definition, copy.userId,undefined,{trustedPinnedComposition:!!copy.templateVersionId&&Array.isArray(definition.componentPins)});
      for (const change of mutation.changes) {
        if (change.field.startsWith("itemcap:")) throw new Error("Unsupported monster play field.");
        if (change.field === "baselineVitality" && change.value !== null && (typeof change.value !== "number" || change.value < 1)) throw new Error("Baseline Vitality must be positive.");
        if (change.field.startsWith("consequence:") && change.value !== null) {
          const occurrence = parseOccurrence(change.value);
          if (`consequence:${occurrence.id}` !== change.field) throw new Error("Consequence identity mismatch.");
        }
        for (const [fieldPrefix, pathPrefix] of [["cap:", "capability:"], ["eff:", "effect:"]] as const) {
          if (change.field.startsWith(fieldPrefix) && !slots.some(slot => slot.supplyKeys?.some(path => path.includes(pathPrefix + change.field.slice(fieldPrefix.length))))) throw new Error("This ability is not in this play copy.");
        }
      }
      return mutatePlayState("MONSTER_PLAY_COPY", copy.id, mutation, async next => {
        const sheet = resolveMonsterPlay(definition, slots, next.overrides, copy.currentVitality).sheet;
        const rawCurrent = typeof next.overrides["currentVitality"] === "number" ? next.overrides["currentVitality"] : copy.currentVitality;
        if (rawCurrent > sheet.maximum) {
          if ((next.fieldRevisions["currentVitality"] ?? 0) > mutation.baseRevision && !mutation.changes.some(change => change.field === "currentVitality")) throw new PlayConflict(await readPlayState("MONSTER_PLAY_COPY", copy.id), ["currentVitality"]);
          next.overrides["currentVitality"] = sheet.maximum;
          next.fieldRevisions["currentVitality"] = next.revision;
        }
        await db.update(monsterCopies).set({ currentVitality: sheet.currentVitality, updatedAt: new Date() }).where(eq(monsterCopies.id, copy.id));
      });

 });
}
