import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { characters, publications } from "@/db/schema";
import { canResolveCharacterForPage } from "@/lib/character/can-resolve-character";
import { BACKSTORY_FIELDS, parseBackstory } from "@/lib/character/character-backstory";
import { resolveAuthorByClerkId } from "@/lib/auth/author-resolver";
import { isPublicCharacterPreview } from "@/lib/character/public-preview-policy";
import { portraitFrameStyle } from "@/lib/character/portrait-frame";
import { Markdown } from "@/components/ui/markdown";
import { RosterCharacterCard } from "./roster-character-card";
import { ForkCharacterButton } from "./fork-character-button";

/** Public character links use the same composite URLs as other library entries.
 * This preview deliberately excludes private notes, DM notes, and share data. */
export async function LibraryCharacterDetail({ id, viewerClerkId }: { id: string; viewerClerkId: string | null }) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) notFound();
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: true,
      heritageLinks: { with: { heritage: true } },
    },
  });
  if (!row) notFound();
  const publication = await db.query.publications.findFirst({
    where: and(eq(publications.targetType, "CHARACTER"), eq(publications.targetId, id)),
    columns: { visibility: true, unpublishedAt: true },
    orderBy: desc(publications.publishedAt),
  });
  // A publication overrides the legacy flag, including explicit unpublishing.
  const publicPreview = isPublicCharacterPreview(row.isPublic, publication);
  if (!publicPreview && !(viewerClerkId && await canResolveCharacterForPage(viewerClerkId, id))) notFound();
  const author = row.userId ? await resolveAuthorByClerkId(row.userId) : null;
  const authorName = !row.userId || author?.isAdmin ? "System" : author?.displayName ?? author?.username ?? "Unknown author";
  const story = parseBackstory(row.backstory);
  const roots = [
    { label: "Lineage", name: row.lineageName, text: row.lineageDescription },
    { label: "Upbringing", name: row.upbringingName, text: row.upbringingDescription },
    { label: "Manifest", name: row.manifestName, text: story.manifestDescription },
  ];
  return <main className="v12-character-library-preview">
    <h1 className="sr-only">{row.name}</h1>
    <Link href="/characters?tab=public" className="v12-character-preview-back"><ArrowLeft size={16} />Back to characters</Link>
    <div className="v12-character-preview-hero">
      {row.portraitUrl && <div className="v12-character-preview-portrait"><img src={row.portraitUrl} alt={row.name} style={portraitFrameStyle(row.portraitFrame)} /></div>}
      <RosterCharacterCard character={row} attribution={<span>By {authorName}</span>} actions={<>
        <Link href={`/characters/${id}`} className="v12-roster-open">Open sheet <ArrowRight size={16} /></Link>
        <ForkCharacterButton characterId={id} roster />
      </>} />
    </div>
    <div className="v12-character-preview-sections">
      {roots.filter(root => root.name).map(root => <section key={root.label}>
        <span className="v12-character-preview-label">{root.label}</span><h2>{root.name}</h2>
        {root.text && <Markdown copyRole="narrative">{root.text}</Markdown>}
      </section>)}
      {BACKSTORY_FIELDS.filter(field => story[field.key]).map(field => <section key={field.key}>
        <h2>{field.label}</h2><Markdown copyRole="narrative">{story[field.key]}</Markdown>
      </section>)}
      {row.capabilityLinks.length > 0 && <section className="v12-character-preview-wide"><h2>Capabilities</h2>
        <div className="v12-character-preview-capabilities">{row.capabilityLinks.map(link => <article key={link.capabilityId}>
          <Link href={`/library/item/CAPABILITY:${link.capabilityId}`}>{link.capability.name}<ArrowRight size={16} /></Link>
          <Markdown copyRole="narrative">{link.capability.verboseDescription}</Markdown>
        </article>)}</div>
      </section>}
    </div>
  </main>;
}
