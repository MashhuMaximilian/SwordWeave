import Link from "next/link";
import { MonsterWorkbench } from "@/components/monsters/monster-workbench";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  if ((await searchParams).edit === "1") return <MonsterWorkbench id={id} />;
  return <main className="mx-auto w-full max-w-[1060px] space-y-5 px-4 py-6">
    <Link className="sw-metal-button sw-metal-button--secondary" href="/monsters">← Bestiary</Link>
    <MonsterTemplatePreview id={id} />
  </main>;
}
