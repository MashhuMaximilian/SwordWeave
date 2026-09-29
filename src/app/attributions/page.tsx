import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Palette, ScrollText } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import iconIndex from "@/lib/icons/game-icons-index.json";

export const metadata: Metadata = {
  title: "Credits & attributions · SwordWeave",
  description: "The artists, icons, and open licenses behind SwordWeave. Full game-icons.net contributor credits.",
};
const CC0_AUTHORS = new Set(["viscious-speed", "zeromancer"]);

export default function AttributionsPage() {
  const idx = iconIndex as {
    authors: string[];
    icons: { key: string; author: string }[];
    authorCredits: Record<string, string | null>;
  };
  const counts: Record<string, number> = {};
  for (const icon of idx.icons) counts[icon.author] = (counts[icon.author] ?? 0) + 1;
  const rows = idx.authors.map(author => ({author,count:counts[author] ?? 0,homepage:idx.authorCredits[author] ?? null,isCc0:CC0_AUTHORS.has(author)})).sort((a,b)=>b.count-a.count || a.author.localeCompare(b.author));
  const totalIcons = idx.icons.length;
  const cc0Icons = idx.icons.filter(icon=>CC0_AUTHORS.has(icon.author)).length;

  return <div className="sw-home sw-public-site sw-public-site--arcane">
    <PublicNav />
    <div id="main-content">
      <header className="sw-public-hero sw-public-hero--compact"><div>
        <p className="sw-public-kicker"><Palette aria-hidden="true" /> The makers behind the marks</p>
        <h1 className="sw-public-title">Every symbol<br /><em>has a maker.</em></h1>
        <p className="sw-public-deck">The artists and communities who share their work help give SwordWeave its visual language. Here are their names, their work, and the licenses that make it possible.</p>
        <div className="sw-public-actions"><a className="sw-cta-primary" href="#artists">Meet the artists <ArrowRight aria-hidden="true" /></a><a className="sw-cta-ghost" href="https://game-icons.net/" target="_blank" rel="noopener noreferrer">Visit game-icons.net <ArrowUpRight aria-hidden="true" /></a></div>
      </div></header>
      <section className="sw-public-section" aria-labelledby="collection-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">01 / The collection</p><h2 id="collection-title">A shared visual vocabulary.</h2></div></header>
        <dl className="sw-public-facts">
          <div><dt>Icons in the collection</dt><dd>{totalIcons.toLocaleString()}</dd><dd>From game-icons.net</dd></div>
          <div><dt>Contributing artists</dt><dd>{rows.length}</dd><dd>Credited individually below</dd></div>
          <div><dt>CC BY 3.0</dt><dd>{(totalIcons-cc0Icons).toLocaleString()}</dd><dd>Icons used with attribution</dd></div>
          <div><dt>CC0</dt><dd>{cc0Icons.toLocaleString()}</dd><dd>Public domain dedication</dd></div>
        </dl>
      </section>
      <section id="artists" className="sw-public-section" aria-labelledby="artists-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">02 / Artist register</p><h2 id="artists-title">Credit where it belongs.</h2></div><p>Listed by contribution count. Artist links appear where a homepage was provided; other contributors are credited by their chosen handle.</p></header>
        <ul className="sw-public-credit-register">{rows.map(row=><li key={row.author}>
          <span className="sw-public-credit-name">{row.homepage ? <a href={row.homepage} target="_blank" rel="noopener noreferrer">{row.author}<ArrowUpRight aria-hidden="true" /><span className="sr-only"> artist website</span></a> : row.author}</span>
          <span>{row.count.toLocaleString()} {row.count === 1 ? "icon" : "icons"}</span>
          <a href={row.isCc0 ? "https://creativecommons.org/publicdomain/zero/1.0/" : "https://creativecommons.org/licenses/by/3.0/"} target="_blank" rel="noopener noreferrer" aria-label={`${row.author}: ${row.isCc0 ? "CC0 license" : "CC BY 3.0 license"}`}>{row.isCc0 ? "CC0" : "CC BY 3.0"}</a>
        </li>)}</ul>
      </section>
      <section className="sw-public-section" aria-labelledby="licenses-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">03 / Open licenses</p><h2 id="licenses-title">Read the terms. Keep the credit.</h2></div></header>
        <div className="sw-public-grid">
          <article className="sw-public-panel"><ScrollText aria-hidden="true" /><h3>Creative Commons Attribution 3.0</h3><p>Most icons in this collection use CC BY 3.0. Their artists are credited here and in icon tooltips. Refer to the license for the full terms when reusing an icon in your own work.</p><a className="sw-public-link" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">Read CC BY 3.0 <ArrowUpRight aria-hidden="true" /></a></article>
          <article className="sw-public-panel"><Palette aria-hidden="true" /><h3>Creative Commons Zero</h3><p>Icons by Viscious Speed and Zeromancer use the CC0 public domain dedication. We include their names here as a thank you for sharing their work.</p><a className="sw-public-link" href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">Read CC0 1.0 <ArrowUpRight aria-hidden="true" /></a></article>
        </div>
        <div className="sw-public-actions"><Link className="sw-cta-ghost" href="/about">About SwordWeave <ArrowRight aria-hidden="true" /></Link><Link className="sw-cta-ghost" href="/">Return to the homepage <ArrowRight aria-hidden="true" /></Link></div>
      </section>
    </div>
  </div>;
}
