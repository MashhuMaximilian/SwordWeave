import Link from "next/link";
import { BookCards } from "@/components/publications/book-cards";
import "./books/books.css";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, BookOpen, Check, GitFork, Hammer, Layers, MessageCircle, Shield, Sparkles, Users } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import { TableIntent } from "@/components/home/table-intent";
import { ArcaneForge } from "@/components/home/arcane-forge";
import { IconDisplay } from "@/components/icons/icon-display";

export const metadata: Metadata = {
  title: "SwordWeave · A TTRPG for YOUR table",
  description: "Build the character you imagine. Compose clear mechanical rules, shape the stakes with your group, and make SwordWeave your table’s own roleplaying game.",
};

const PIECES = [
  { number: "01", name: "Primitives", label: "Reusable building blocks", icon: "delapouite/cube", description: "Buy the rules your character owns with Build Units: a domain, a verb tier, a die, a range, a bonus, a permission. Pieces can change numbers, grant permissions or describe a particular fictional ability.", example: "A rule you can point to.", kind: "primitive" },
  { number: "02", name: "Effects", label: "Rules that work together", icon: "lorc/fire-shield", description: "Group primitives into a reusable effect. Keep its mechanics together, then use it inside a capability or an item.", example: "A barrier. A blessing. A lingering change.", kind: "effect" },
  { number: "03", name: "Capabilities", label: "Your signature expression", icon: "lorc/rune-sword", description: "Compile primitives and effects into a familiar action or talent for quick access. You can also compose new actions from owned pieces during play.", example: "The thing your character is known for.", kind: "capability" },
  { number: "04", name: "Heritages", label: "A story behind the mechanics", icon: "lorc/dna1", description: "Lineage, Upbringing, and Manifest hold primitives and capabilities. Give the same mechanical possibilities a different place in your story.", example: "Where you come from. Who you become.", kind: "heritage" },
  { number: "05", name: "Items", label: "Power with a place in the world", icon: "lorc/knapsack", description: "Put primitives, effects, and capabilities into equipment. The rules travel with the item, and its place in the fiction matters.", example: "An heirloom. A tool. A dangerous gift.", kind: "item" },
] as const;

const CORE_TENETS = [
  { title: "Actions have consequences.", text: "Discuss the stakes together, with the DM appraising the attempt. There are no spell slots: ambitious actions can cost vitality, or bring other consequences agreed at your table." },
  { title: "Let the story lead.", text: "SwordWeave is a framework for judgment and imagination. Use its numbers as guides. Have fun telling a story; pursue the perfect build when that is the game your table wants." },
  { title: "Tell it together.", text: "Players and DM negotiate what happens, build on each other’s ideas, and share the spotlight. The aim is a story you enjoy making together, full of moments worth remembering." },
  { title: "Rule of cool is king.", text: "Give exciting ideas a chance. Talk through what makes the attempt possible, what it risks, and how you will resolve it. Then see where it takes the scene." },
  { title: "Imagine freely.", text: "The world lives in your shared imagination. Try the strange idea, invent the impossible place, and do the thing your group wants to explore." },
  { title: "Everything is a guideline.", text: "Make SwordWeave yours. Bend the framework around your world and playstyle. Change a guideline whenever your group finds a way that serves its game better." },
  { title: "Balance is a lie.", text: "No formula can promise balance for every world, character, and situation. Agree what feels fair and fun at your table, and adjust as you play." },
  { title: "Begin with a character idea.", text: "Know what you want your character to do, then create primitives, capabilities, and effects for that concept. Authoring your own pieces can be easier than searching the whole community library for a unique idea." },
] as const;

export default function HomePage() {
  return (
    <div className="sw-home sw-public-site sw-public-site--arcane">
      <PublicNav />
      <section className="sw-public-hero sw-home-hero" aria-labelledby="home-title">
        <div className="sw-home-hero__copy">
          <div className="sw-public-kicker"><span className="sw-public-sigil">✦</span> SwordWeave · A modular roleplaying engine</div>
          <h1 id="home-title" className="sw-public-title">A TTRPG<br /> for <em>YOUR</em><br /> table.</h1>
          <p className="sw-public-deck">Build the character you mean. Shape the rules with the people you play with.</p>
          <p className="sw-home-hero__intro">Each player describes a character’s choices. The DM describes the world and helps your group resolve what happens. SwordWeave gives those ideas reusable rules.</p>
          <div className="sw-public-actions"><Link className="sw-cta-primary" href="/start">Learn to play <ArrowRight aria-hidden="true" /></Link><Link className="sw-cta-ghost" href="/character"><Users aria-hidden="true" /> Create a character</Link></div>
          <div className="sw-home-hero__links"><Link href="/atelier?build=primitive">Enter the Atelier <ArrowUpRight aria-hidden="true" /></Link><Link href="/library/browse">Explore the Library <ArrowUpRight aria-hidden="true" /></Link></div>
        </div>
        <div className="sw-home-hero__instrument"><ArcaneForge /></div>
      </section>

      <div className="sw-public-principles" aria-label="Built around your table">
        <div><Users aria-hidden="true" /><span><strong>Your table</strong><small>Shared rulings. Shared authorship.</small></span></div>
        <div><Layers aria-hidden="true" /><span><strong>Your mechanics</strong><small>Compose the rules you need.</small></span></div>
        <div><GitFork aria-hidden="true" /><span><strong>Your creation</strong><small>Keep it private. Share it. Make it yours.</small></span></div>
      </div>

      <section className="sw-public-section sw-home-play-stage" aria-labelledby="play-stage-title">
        <div className="sw-home-play-stage__copy"><p className="sw-public-kicker">The moment before the dice</p><h2 id="play-stage-title">One scene.<br /><em>Your way through.</em></h2><p>No list can anticipate everything you will try. Start with the situation and the rules your character owns. Then work out the attempt together.</p><div className="sw-home-play-stage__inscription"><span>Intent</span><ArrowRight aria-hidden="true"/><span>Stakes</span><ArrowRight aria-hidden="true"/><span>Resolution</span></div><p className="sw-home-play-stage__hint">Explore three approaches to the same moment.</p></div>
        <TableIntent />
      </section>

      <section className="sw-public-section" aria-labelledby="composition-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">01 / The pieces of possibility</p><h2 id="composition-title">Build the rules<br /><em>your character needs.</em></h2></div><p>Begin with one rule. Combine it with another. Build a character whose mechanics belong to their story, instead of fitting a story around a fixed class.</p></header>
        <div className="sw-home-pieces">
          {PIECES.map(piece => <Link key={piece.kind} id={`piece-${piece.kind}`} href={`/atelier?build=${piece.kind}`} className={`sw-home-piece sw-home-piece--${piece.kind}`}><div className="sw-home-piece__head"><span className="sw-home-piece__icon"><IconDisplay iconSource="GAME_ICONS" iconKey={piece.icon} iconColor={piece.kind === "capability" ? "#94e9d8" : piece.kind === "effect" ? "#efb88e" : piece.kind === "item" ? "#e2e6de" : "#f6dc9d"} size={38} alt="" /></span><span className="sw-public-number">{piece.number}</span><ArrowUpRight aria-hidden="true" /></div><p className="sw-public-kicker">{piece.label}</p><h3>{piece.name}</h3><p>{piece.description}</p><div className="sw-home-piece__example">{piece.example}</div></Link>)}
        </div>
        <div className="sw-public-note"><Check aria-hidden="true" /><p><strong>Build Units buy mechanics.</strong> Compositions make those mechanics easier to author, understand, and use. An owned primitive can be reused without buying it twice. Execution has its own agreed costs; a new capability card is not a new purchase of every ingredient.</p></div>
      </section>

      <section className="sw-public-section sw-home-table" aria-labelledby="table-title">
        <div className="sw-home-table__statement"><p className="sw-public-kicker">02 / The rules meet the room</p><h2 id="table-title">The final word<br />belongs to<br /><em>your table.</em></h2><p>Every table develops its own rulings over time. SwordWeave embraces that. Keep the mechanics clear, then let your world, your group, and the moment shape how they play.</p><div className="sw-home-condition"><span className="sw-public-kicker">Context gives a condition meaning</span><p>Venom poisoning and an overwhelming psychedelic can both be called “poisoned” while causing different consequences. Agree what this condition does, when it applies and how it ends; an effect can describe or mechanically define its particular expression.</p></div><Link href="/combat" className="sw-public-link">See the rhythm of play <ArrowRight aria-hidden="true" /></Link></div>
        <div className="sw-home-table__principles">
          <article><span className="sw-public-number">I</span><div><h3>Say what you intend.</h3><p>Describe the outcome you want in the fiction. Your purchased rules establish what your character can bring to it.</p></div></article>
          <article><span className="sw-public-number">II</span><div><h3>Make the stakes visible.</h3><p>Work out scale, impact, complexity, and consequences together. Clarify when each rule applies and what an imposed condition means here.</p></div></article>
          <article><span className="sw-public-number">III</span><div><h3>Resolve. Respond. Keep playing.</h3><p>Let the agreed rules and rolls answer uncertainty. When the situation changes, adjust the intent and keep the story moving.</p></div></article>
        </div>
      </section>

      <section className="sw-public-section sw-home-tenets" aria-labelledby="tenets-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">Core tenets</p><h2 id="tenets-title">Your imagination.<br /><em>Your table’s game.</em></h2></div><p>Keep these ideas close when you create a character, make a ruling, or try something nobody has written a rule for yet.</p></header>
        <ol className="sw-home-tenets__list">
          {CORE_TENETS.map((tenet, index) => <li key={tenet.title}><span className="sw-public-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{tenet.title}</h3><p>{tenet.text}</p></div></li>)}
        </ol>
        <Link href="/atelier?build=primitive" className="sw-public-link">Give your idea a rule <ArrowRight aria-hidden="true" /></Link>
      </section>

      <section className="sw-public-section" aria-labelledby="tools-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">03 / From an idea to the table</p><h2 id="tools-title">A workshop.<br /><em>Not a prescription.</em></h2></div><p>Author something from scratch, explore what others have built, or roll for inspiration. Keep the parts that fit your character.</p></header>
        <div className="sw-public-grid sw-home-tools">
          <Link className="sw-public-panel" href="/atelier?build=primitive"><Hammer aria-hidden="true" /><p className="sw-public-kicker">Create</p><h3>The Atelier</h3><p>Build rules, compose capabilities, and inspect every piece before it joins your character.</p><span className="sw-public-link">Open the workbench <ArrowRight aria-hidden="true" /></span></Link>
          <Link className="sw-public-panel" href="/library/browse"><BookOpen aria-hidden="true" /><p className="sw-public-kicker">Discover</p><h3>The Library</h3><p>Explore primitives, effects, capabilities, heritages, and items. Find a starting point and make it your own.</p><span className="sw-public-link">Find your next piece <ArrowRight aria-hidden="true" /></span></Link>
          <Link className="sw-public-panel" href="/characters"><Shield aria-hidden="true" /><p className="sw-public-kicker">Play</p><h3>Your characters</h3><p>Bring story and mechanics together. Review your changes, then return to the sheet you use at the table.</p><span className="sw-public-link">Open your roster <ArrowRight aria-hidden="true" /></span></Link>
        </div>
      </section>

      <section className="sw-home-books" aria-labelledby="home-books-title"><div><p className="sw-public-kicker">Read, make, play · v0.1 alpha</p><h2 id="home-books-title">The books for your table</h2><p>Three free core books, with light and dark PDF editions. Learn to play, run a session, or use the open reference to create your own.</p><Link href="/books">Explore the books <ArrowRight size={16} aria-hidden="true" /></Link></div><BookCards /></section>
      <section className="sw-public-invitation"><div className="sw-public-invitation__seal" aria-hidden="true"><Sparkles /></div><p className="sw-public-kicker">Bring the idea you cannot stop thinking about.</p><h2>There is room for it<br /><em>at your table.</em></h2><p>Start with a character. A strange gift. One impossible thing.<br />Then give it rules you and your friends can play.</p><div className="sw-public-actions"><Link href="/character" className="sw-cta-primary">Begin your character <ArrowRight aria-hidden="true" /></Link><Link href="/about" className="sw-cta-ghost"><MessageCircle aria-hidden="true" /> Meet the project</Link></div></section>
      <footer className="sw-public-footer"><Link href="/" className="sw-public-footer__brand">Sword<span>·</span>Weave</Link><p>A framework for the stories you tell together.</p><nav aria-label="Project information"><Link href="/start">Walkthrough</Link><Link href="/combat">Combat</Link><Link href="/books">Books</Link><Link href="/about">About</Link><Link href="/attributions">Credits</Link></nav></footer>
    </div>
  );
}
