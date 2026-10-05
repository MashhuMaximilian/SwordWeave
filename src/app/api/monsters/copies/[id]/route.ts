import { monsterCopyDefinition } from "@/lib/monsters/copy-definition";
import {mutateMonsterPlay} from "@/lib/monsters/play-service";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { playStates, playStateOperations } from "@/db/schema/play-state";
import { db, withDatabaseTransaction } from "@/db/client";
import { monsterCopies } from "@/db/schema/monsters";
import { playMutationSchema, PlayConflict } from "@/lib/play-state/model";
import { resolveMonsterPlay } from "@/lib/monsters/play";
import { monsterPackages } from "@/lib/monsters/packages";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import type { PinnedDefinition } from "@/lib/monsters/service";
import { readPlayState } from "@/lib/play-state/service";
import { readBoundedJson } from "@/lib/http/read-bounded-json";
type Context = { params: Promise<{ id: string }> };
type Copy = typeof monsterCopies.$inferSelect;
/** Lock the owner subject before touching generic session rows, including reads
 * that initialize state. Copy deletion uses the same order and transaction. */
async function withOwnedCopy(context: Context, work: (copy: Copy) => Promise<Response>) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to open this play copy." }, { status: 401 });
  const { id } = await context.params;
  return withDatabaseTransaction(async () => {
    const [copy] = await db.select().from(monsterCopies).where(and(eq(monsterCopies.id, id), eq(monsterCopies.userId, userId))).for("update");
    if (!copy) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return work(copy);
  });
}
export async function GET(request: Request, context: Context) {
  return withOwnedCopy(context, async copy => {
    const definition = await monsterCopyDefinition(copy);
    const slots = definition.resolvedSlots ?? await resolveMonsterComposition(definition, copy.userId,undefined,{trustedPinnedComposition:!!copy.templateVersionId&&Array.isArray(definition.componentPins)});
    const state = await readPlayState("MONSTER_PLAY_COPY", copy.id);
    if(new URL(request.url).searchParams.get("session")==="1")return NextResponse.json({state,buildRefs:[`${copy.templateId}:${copy.templateVersion}`],max:resolveMonsterPlay(definition,slots,state.overrides,copy.currentVitality).sheet.maximum});
    return NextResponse.json({ copy:{...copy,definition:{...definition,resolvedSlots:slots}}, state, packages: monsterPackages(slots), buildRefs: [`${copy.templateId}:${copy.templateVersion}`], sheet: resolveMonsterPlay(definition, slots, state.overrides, copy.currentVitality).sheet });
  });
}
export async function PATCH(request: Request, context: Context) {
  try {
    const mutation = playMutationSchema.parse(await readBoundedJson(request, 131072));
    return await withOwnedCopy(context, async copy => {
      const state=await mutateMonsterPlay(copy.userId,copy.id,mutation);
      return NextResponse.json({ state });
    });
  } catch (error) {
    if (error instanceof PlayConflict) return NextResponse.json({ error: error.message, state: error.state, conflicts: error.fields }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid play update." }, { status: 400 });
  }
}
export async function DELETE(_: Request, context: Context) {
  return withOwnedCopy(context, async copy => {
    await db.delete(playStateOperations).where(and(eq(playStateOperations.subjectKind, "MONSTER_PLAY_COPY"), eq(playStateOperations.subjectId, copy.id)));
    await db.delete(playStates).where(and(eq(playStates.subjectKind, "MONSTER_PLAY_COPY"), eq(playStates.subjectId, copy.id)));
    await db.delete(monsterCopies).where(eq(monsterCopies.id, copy.id));
    return NextResponse.json({ deleted: true });
  });
}
