import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowRight,
  CircuitBoard,
  Crown,
  Library,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Wand2,
} from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  effects,
  primitives,
  heritage,
} from "@/db/schema";
import { queryLibrary } from "@/lib/publishing/library-query";

export const dynamic = "force-dynamic";

export default async function LibraryHubPage() {
  const [primitiveRows, capabilityRows, effectRows, templateRows] =
    await Promise.all([
      db.query.primitives.findMany({
        where: (table, { eq, isNull, or }) =>
          or(eq(table.isPublic, true), isNull(table.userId)),
        orderBy: [asc(primitives.category), asc(primitives.name)],
      }),
      db.query.capabilities.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [desc(capabilities.createdAt), asc(capabilities.name)],
        with: {
          primitiveLinks: {
            orderBy: [asc(capabilityPrimitives.sortOrder)],
          },
        },
      }),
      db.query.effects.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [desc(effects.createdAt), asc(effects.name)],
      }),
      db.query.heritage.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [asc(heritage.kind), asc(heritage.name)],
      }),
    ]);

  // Category breakdown for primitives
  const categoryCount = new Map<string, number>();
  for (const p of primitiveRows) {
    categoryCount.set(p.category, (categoryCount.get(p.category) ?? 0) + 1);
  }

  // Template kind breakdown
  const templateCount = new Map<string, number>();
  for (const t of templateRows) {
    templateCount.set(t.kind, (templateCount.get(t.kind) ?? 0) + 1);
  }

  // PLAN Eilxina (Mashu 2026-09-09): /library hub CHARACTER tile.
  // Uses the same queryLibrary() dispatch the browse page uses,
  // filtered to targetType=CHARACTER + sort by recency. Limit is
  // generous (we only need the count + top row for the preview).
  const characterLibrary = await queryLibrary({
    targetType: "CHARACTER",
    sort: "RECENT",
    limit: 12,
  });
  const characterCount = characterLibrary.total;

  const collections = [
    { name: "Primitives", type: "PRIMITIVE", icon: CircuitBoard, tone: "gold", count: primitiveRows.length, caption: "Individual rules", description: "Reusable access, bonuses, movement and fictional permissions your character can own." },
    { name: "Effects", type: "EFFECT", icon: Sparkles, tone: "copper", count: effectRows.length, caption: "Reusable combinations", description: "Keep related primitives together, ready to use inside capabilities and items." },
    { name: "Capabilities", type: "CAPABILITY", icon: Library, tone: "teal", count: capabilityRows.length, caption: "Actions & talents", description: "Saved ideas for quick access, assembled from primitives you can also reuse in new actions." },
  ];
  const shelves = [
    { name: "Lineages", type: "LINEAGE_TEMPLATE", icon: Shield, count: templateCount.get("LINEAGE") ?? 0, description: "Their species, ancestry and inherited qualities." },
    { name: "Upbringings", type: "UPBRINGING_TEMPLATE", icon: ScrollText, count: templateCount.get("UPBRINGING") ?? 0, description: "Their background, work, learning and early training." },
    { name: "Manifests", type: "MANIFEST_TEMPLATE", icon: Wand2, count: templateCount.get("MANIFEST") ?? 0, description: "Their main role and developing build." },
    { name: "Builds", type: "BUILD_TEMPLATE", icon: Crown, count: null, description: "Foundations shared by the community." },
    { name: "Characters", type: "CHARACTER", icon: Swords, count: characterCount, description: "Meet a character. Make your own version." },
  ];
  return (
    <div className="sw-library-landing">
      <header className="sw-library-intro">
        <div><p className="sw-library-eyebrow"><Library aria-hidden="true" /> The shared collection</p><h1>Find your<br /><em>next possibility.</em></h1><p>Welcome to the SwordWeave Library. Explore the rules, combinations, and characters that other tables have made their own.</p><Link className="sw-library-primary" href="/library/browse">Explore the full Library <ArrowRight aria-hidden="true" /></Link></div>
        <aside className="sw-library-index" aria-label="Library at a glance"><span className="sw-library-index__seal"><Library aria-hidden="true" /></span><p className="sw-library-eyebrow">Rules with something to build on</p><dl><div><dt>Primitives</dt><dd>{primitiveRows.length}</dd></div><div><dt>Rule categories</dt><dd>{categoryCount.size}</dd></div><div><dt>Capabilities</dt><dd>{capabilityRows.length}</dd></div></dl><p>Start with one rule, explore a finished idea, or bring a composition into your own build.</p></aside>
      </header>
      <section className="sw-library-section" aria-labelledby="collections-title"><div className="sw-library-section-head"><div><p className="sw-library-eyebrow">Curated by the community & SwordWeave</p><h2 id="collections-title">Explore public collections.</h2></div><Link href="/library/collections">Discover collections <ArrowRight aria-hidden="true" /></Link></div><p>Find groups of rules, heritages, equipment, and creatures collected for a theme, campaign, or way of playing.</p></section>
      <section aria-labelledby="mechanics-title" className="sw-library-section"><div className="sw-library-section-head"><div><p className="sw-library-eyebrow">01 / The mechanical pieces</p><h2 id="mechanics-title">Start small. Put it together.</h2></div><Link href="/atelier">Compose in the Atelier <ArrowRight aria-hidden="true" /></Link></div>
        <div className="sw-library-collections">{collections.map(entry=><Link key={entry.type} href={`/library/browse?type=${entry.type}`} className="sw-library-collection" data-tone={entry.tone}><header><span className="sw-library-medallion"><entry.icon aria-hidden="true" /></span><span className="sw-library-count">{entry.count}<small>public entries</small></span></header><p className="sw-library-eyebrow">{entry.caption}</p><h3>{entry.name}</h3><p>{entry.description}</p><span className="sw-library-collection__action">Browse {entry.name.toLowerCase()} <ArrowRight aria-hidden="true" /></span></Link>)}</div>
        <div className="sw-library-categories"><span>Inside primitives</span>{Array.from(categoryCount.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=><span key={name}>{name.replace(/_/g," ").toLowerCase()} <strong>{count}</strong></span>)}</div>
      </section>
      <section aria-labelledby="stories-title" className="sw-library-section"><div className="sw-library-section-head"><div><p className="sw-library-eyebrow">02 / Give the rules a life</p><h2 id="stories-title">Heritages, builds, and people.</h2></div></div><div className="sw-library-shelves">{shelves.map(entry=><Link className="sw-library-shelf" key={entry.type} href={`/library/browse?type=${entry.type}`}><entry.icon aria-hidden="true" /><div><h3>{entry.name}</h3><p>{entry.description}</p></div><span>{entry.count !== null && <strong>{entry.count}</strong>}<ArrowRight aria-hidden="true" /></span></Link>)}</div></section>
      {capabilityRows.length > 0 && <section className="sw-library-section" aria-labelledby="recent-title"><div className="sw-library-section-head"><div><p className="sw-library-eyebrow">03 / Recently added</p><h2 id="recent-title">A few ideas to follow.</h2></div><Link href="/library/browse?type=CAPABILITY">All capabilities <ArrowRight aria-hidden="true" /></Link></div><div className="sw-library-recent">{capabilityRows.slice(0,6).map(cap=><article key={cap.id}><header><h3>{cap.name}</h3><Link href={`/library/browse?type=CAPABILITY&q=${encodeURIComponent(cap.name)}`} aria-label={`Find ${cap.name} in the Library`}><ArrowRight aria-hidden="true" /></Link></header><p className="sw-library-recent__meta">{cap.type.toLowerCase()} · {cap.sourceType.toLowerCase()}</p><p>{cap.verboseDescription}</p><span>{cap.primitiveLinks.length} linked primitives</span></article>)}</div></section>}
      <footer className="sw-library-footer"><div><h2>Make something worth sharing.</h2><p>Use the Atelier to put your own rules and combinations into words.</p></div><Link className="sw-library-primary" href="/atelier">Open the Atelier <ArrowRight aria-hidden="true" /></Link></footer>
    </div>
  );
}
