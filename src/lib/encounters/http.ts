import { auth } from "@clerk/nextjs/server";
import { privateJson } from "@/lib/http/private-json";
import { PlayConflict } from "@/lib/play-state/model";
import { EncounterError } from "./service";
import { ZodError } from "zod";
export async function encounterRequest(
  work: (owner: string) => Promise<unknown>,
) {
  const { userId } = await auth();
  if (!userId)
    return privateJson(
      { error: "Sign in to manage encounters." },
      { status: 401 },
    );
  try {
    return privateJson(await work(userId));
  } catch (e) {
    if (e instanceof PlayConflict)
      return privateJson(
        { error: e.message, state: e.state, conflicts: e.fields },
        { status: 409 },
      );
    if (e instanceof EncounterError)
      return privateJson(
        { error: e.message, current: e.current },
        { status: e.status },
      );
    if (e instanceof ZodError)
      return privateJson(
        { error: e.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    console.error(
      "[encounter]",
      e instanceof Error ? e.message : "request failed",
    );
    return privateJson(
      { error: "Encounter could not be updated. Try again." },
      { status: 400 },
    );
  }
}

export async function encounterReadRequest(work:(viewer:string|null)=>Promise<unknown>) {
  const {userId}=await auth();
  try {return privateJson(await work(userId));}
  catch(error) {return privateJson({error:error instanceof EncounterError ? error.message : "Encounter could not be loaded."},{status:error instanceof EncounterError ? error.status : 400});}
}
