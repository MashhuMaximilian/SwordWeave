import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { monsterVersions,monsterCopies } from "@/db/schema/monsters";
import type { PinnedDefinition } from "./service";
export async function monsterCopyDefinition(copy:typeof monsterCopies.$inferSelect):Promise<PinnedDefinition>{
 if(copy.templateVersionId){const [version]=await db.select().from(monsterVersions).where(eq(monsterVersions.id,copy.templateVersionId));if(!version)throw new Error("Pinned template version is unavailable.");return version.definition as PinnedDefinition;}
 if(copy.definition)return copy.definition as PinnedDefinition;
 throw new Error("Play copy has no pinned template version.");
}
