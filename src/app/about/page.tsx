import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Hammer, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { PublicNav } from "@/components/home/public-nav";

export const metadata: Metadata = {
  title: "About · SwordWeave",
  description: "A TTRPG for your table. Why Marius Ion is building SwordWeave, an open game of character creation, shared imagination, and table rulings.",
};

export default function AboutPage() {
  return (
    <div className="sw-home sw-public-site sw-public-site--arcane">
      <PublicNav />
      <div id="main-content">
        <header className="sw-public-hero sw-public-hero--compact">
          <div>
            <p className="sw-public-kicker"><Hammer aria-hidden="true" /> The person behind the forge</p>
            <h1 className="sw-public-title">Made for the people<br />around <em>your table.</em></h1>
            <p className="sw-public-deck">SwordWeave began with a wish: to play the character in your head, with friends who help decide what happens next.</p>
            <div className="sw-public-actions">
              <Link className="sw-cta-primary" href="/start">See how it plays <ArrowRight aria-hidden="true" /></Link>
              <Link className="sw-cta-ghost" href="/library">Explore the Library <BookOpen aria-hidden="true" /></Link>
            </div>
          </div>
        </header>

        <section className="sw-public-section" aria-labelledby="why-title">
          <header className="sw-public-section-head"><div><p className="sw-public-kicker">01 / A note from the creator</p><h2 id="why-title">The best part of a game<br /><em>is who you play it with.</em></h2></div></header>
          <div className="sw-public-duet">
            <article className="sw-public-panel" data-tone="gold">
              <UsersRound aria-hidden="true" />
              <p className="sw-public-kicker">The wish that started it</p>
              <h3>A game friends would play.</h3>
              <blockquote className="sw-public-quote">“I started because I wanted a natural game system without so many rules. A game friends would play. Where things are flexible and decided at a table, not rigid.”</blockquote>
              <p>Marius Ion / creator of SwordWeave</p>
            </article>
            <article className="sw-public-panel" data-tone="teal">
              <Hammer aria-hidden="true" />
              <p className="sw-public-kicker">A foundation for imagination</p>
              <h3>You bring the impossible idea.</h3>
              <p>The people at your table decide what matters in the scene. SwordWeave gives that conversation a shared language: what you attempt, how far it reaches, and what it costs.</p>
              <p>I’m Marius Ion. There is no publisher behind this project. I’m building the game and the tools together, and it is still an early build.</p>
              <p>I want it open because I cannot gatekeep something I want people to make their own. Take the ideas to your table. Share what you make. Help the game become better through play.</p>
            </article>
          </div>
        </section>

        <section className="sw-public-section" aria-labelledby="principles-title">
          <header className="sw-public-section-head"><div><p className="sw-public-kicker">02 / What stays at the heart</p><h2 id="principles-title">Your character. Your friends. Your call.</h2></div></header>
          <div className="sw-public-grid">
            <article className="sw-public-panel"><span className="sw-public-number">I</span><h3>Start with a person.</h3><p>A strange talent, an old debt, a way of seeing the world. Build rules that express the character you want to play.</p></article>
            <article className="sw-public-panel"><span className="sw-public-number">II</span><h3>Leave room for the moment.</h3><p>The scene matters. Discuss conditions, scale, stakes, and consequences with your table before resolving an action.</p></article>
            <article className="sw-public-panel"><span className="sw-public-number">III</span><h3>Keep the door open.</h3><p>Share and adapt the game under its open license. Give credit to the people whose work helped yours take shape.</p></article>
          </div>
        </section>

        <section className="sw-public-section" aria-labelledby="project-title">
          <header className="sw-public-section-head"><div><p className="sw-public-kicker">03 / Project record</p><h2 id="project-title">An open work in progress.</h2></div></header>
          <dl className="sw-public-facts">
            <div><dt>Created by</dt><dd>Marius Ion</dd><dd>Independent creator</dd></div>
            <div><dt>Game license</dt><dd><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 <ArrowUpRight aria-hidden="true" /></a></dd><dd>Share and adapt with attribution</dd></div>
            <div><dt>Stage</dt><dd>Early build</dd><dd>The game and tools are evolving</dd></div>
            <div><dt>First published</dt><dd>2026</dd><dd>A new beginning for SwordWeave</dd></div>
          </dl>
          <p className="sw-public-deck">The software engine is MIT licensed; the game design uses CC BY 4.0. The site is built with Next.js, Drizzle, Neon Postgres, and Clerk. Its visual language also owes a great deal to the artists at game-icons.net.</p>
          <div className="sw-public-actions"><a className="sw-cta-ghost" href="https://github.com/MashhuMaximilian/SwordWeave" target="_blank" rel="noopener noreferrer">Explore the source <ArrowUpRight aria-hidden="true" /></a><Link className="sw-public-link" href="/attributions">Meet the artists and read the credits <ArrowRight aria-hidden="true" /></Link></div>
        </section>
      </div>
    </div>
  );
}
