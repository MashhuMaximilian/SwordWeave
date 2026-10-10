import { db } from "@/db/client";
import { encounters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEncounter, EncounterError } from "@/lib/encounters/service";
import { EncounterPreview } from "@/components/encounters/encounter-preview";
import { EncounterWorkspace } from "@/components/encounters/encounter-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed=z.uuid().safeParse((await params).id);
  if(!parsed.success)notFound();
  const id=parsed.data;
  const {userId}=await auth();
  const [record]=await db.select({owner:encounters.ownerId}).from(encounters).where(eq(encounters.id,id));
  if(record && record.owner===userId)return <EncounterWorkspace id={id}/>;
  let encounter;
  try {encounter=await getEncounter(userId,id);}catch(error){if(error instanceof EncounterError && error.status===404)notFound();throw error;}
  const initial=JSON.parse(JSON.stringify(encounter));
  return <main className="sw-encounters"><Link className="sw-metal-button" href="/library/browse?type=ENCOUNTER">Browse encounters</Link><EncounterPreview id={id} initial={initial}/></main>;
}
