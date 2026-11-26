import Link from "next/link";
import { notFound } from "next/navigation";
import { MonsterWorkbench } from "@/components/monsters/monster-workbench";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; version?: string | string[] }>;
}) {
  const [{ id }, { edit, version: requestedVersion }] = await Promise.all([params, searchParams]);
  const version = typeof requestedVersion === "string" && /^[1-9]\d*$/.test(requestedVersion)
    ? Number(requestedVersion) : undefined;
  if (requestedVersion !== undefined && (version === undefined || !Number.isSafeInteger(version) || version > 2_147_483_647)) notFound();
  if (version === undefined && edit === "1") return <MonsterWorkbench id={id} />;
  return <main className="mx-auto w-full max-w-[1060px] space-y-5 px-4 py-6">
    <Link className="sw-metal-button sw-metal-button--secondary" href="/monsters">← Bestiary</Link>
    <MonsterTemplatePreview id={id} {...(version === undefined ? {} : { version, hideActions: true })} />
  </main>;
}
