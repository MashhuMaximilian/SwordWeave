import Link from "next/link";
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
  { number: "01", name: "Primitives", label: "The mechanical foundation", icon: "delapouite/cube", description: "Buy the rules your character owns with Build Units: a domain, a verb tier, a die, a range, a bonus, a permission. Small pieces with explicit meaning.", example: "A rule you can point to.", kind: "primitive" },
  { number: "02", name: "Effects", label: "Rules that work together", icon: "lorc/fire-shield", description: "Group primitives into a reusable effect. Keep its mechanics together, then use it inside a capability or an item.", example: "A barrier. A blessing. A lingering change.", kind: "effect" },
  { number: "03", name: "Capabilities", label: "Your signature expression", icon: "lorc/rune-sword", description: "Compose primitives and effects into an action or talent. Record how it resolves; add optional scaling declarations for play.", example: "The thing your character is known for.", kind: "capability" },
  { number: "04", name: "Heritages", label: "A story behind the mechanics", icon: "lorc/dna1", description: "Lineage, Upbringing, and Manifest hold primitives and capabilities. Give the same mechanical possibilities a different place in your story.", example: "Where you come from. Who you become.", kind: "heritage" },
  { number: "05", name: "Items", label: "Power with a place in the world", icon: "lorc/knapsack", description: "Put primitives, effects, and capabilities into equipment. The rules travel with the item, and its place in the fiction matters.", example: "An heirloom. A tool. A dangerous gift.", kind: "item" },
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
          <p className="sw-home-hero__intro">SwordWeave gives your imagination a mechanical language. Your table gives it meaning.</p>
          <div className="sw-public-actions"><Link className="sw-cta-primary" href="/start">See how to play <ArrowRight aria-hidden="true" /></Link><Link className="sw-cta-ghost" href="/character"><Users aria-hidden="true" /> Create a character</Link></div>
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
        <div className="sw-public-note"><Check aria-hidden="true" /><p><strong>Build Units buy mechanics.</strong> Compositions make those mechanics easier to author, understand, and use. Reusing a rule and buying a new one are different choices.</p></div>
      </section>

      <section className="sw-public-section sw-home-table" aria-labelledby="table-title">
        <div className="sw-home-table__statement"><p className="sw-public-kicker">02 / The rules meet the room</p><h2 id="table-title">The final word<br />belongs to<br /><em>your table.</em></h2><p>Every table develops its own rulings over time. SwordWeave embraces that. Keep the mechanics clear, then let your world, your group, and the moment shape how they play.</p><div className="sw-home-condition"><span className="sw-public-kicker">Context gives a condition meaning</span><p>“Prone” on a narrow ledge and “poisoned” at a royal feast call for different conversations. Agree on what the condition actually does in this scene.</p></div><Link href="/combat" className="sw-public-link">See the rhythm of play <ArrowRight aria-hidden="true" /></Link></div>
        <div className="sw-home-table__principles">
          <article><span className="sw-public-number">I</span><div><h3>Say what you intend.</h3><p>Describe the outcome you want in the fiction. Your purchased rules establish what your character can bring to it.</p></div></article>
          <article><span className="sw-public-number">II</span><div><h3>Make the stakes visible.</h3><p>Work out scale, impact, complexity, and consequences together. Clarify when each rule applies and what an imposed condition means here.</p></div></article>
          <article><span className="sw-public-number">III</span><div><h3>Resolve. Respond. Keep playing.</h3><p>Let the agreed rules and rolls answer uncertainty. When the situation changes, adjust the intent and keep the story moving.</p></div></article>
        </div>
      </section>

      <section className="sw-public-section" aria-labelledby="tools-title">
        <header className="sw-public-section-head"><div><p className="sw-public-kicker">03 / From an idea to the table</p><h2 id="tools-title">A workshop.<br /><em>Not a prescription.</em></h2></div><p>Author something from scratch, explore what others have built, or roll for inspiration. Keep the parts that fit your character.</p></header>
        <div className="sw-public-grid sw-home-tools">
          <Link className="sw-public-panel" href="/atelier?build=primitive"><Hammer aria-hidden="true" /><p className="sw-public-kicker">Create</p><h3>The Atelier</h3><p>Build rules, compose capabilities, and inspect every piece before it joins your character.</p><span className="sw-public-link">Open the workbench <ArrowRight aria-hidden="true" /></span></Link>
          <Link className="sw-public-panel" href="/library/browse"><BookOpen aria-hidden="true" /><p className="sw-public-kicker">Discover</p><h3>The Library</h3><p>Explore primitives, effects, capabilities, heritages, and items. Find a starting point and make it your own.</p><span className="sw-public-link">Find your next piece <ArrowRight aria-hidden="true" /></span></Link>
          <Link className="sw-public-panel" href="/characters"><Shield aria-hidden="true" /><p className="sw-public-kicker">Play</p><h3>Your characters</h3><p>Bring story and mechanics together. Review your changes, then return to the sheet you use at the table.</p><span className="sw-public-link">Open your roster <ArrowRight aria-hidden="true" /></span></Link>
        </div>
      </section>

      <section className="sw-public-invitation"><div className="sw-public-invitation__seal" aria-hidden="true"><Sparkles /></div><p className="sw-public-kicker">Bring the idea you cannot stop thinking about.</p><h2>There is room for it<br /><em>at your table.</em></h2><p>Start with a character. A strange gift. One impossible thing.<br />Then give it rules you and your friends can play.</p><div className="sw-public-actions"><Link href="/character" className="sw-cta-primary">Begin your character <ArrowRight aria-hidden="true" /></Link><Link href="/about" className="sw-cta-ghost"><MessageCircle aria-hidden="true" /> Meet the project</Link></div></section>
      <footer className="sw-public-footer"><Link href="/" className="sw-public-footer__brand">Sword<span>·</span>Weave</Link><p>A framework for the stories you tell together.</p><nav aria-label="Project information"><Link href="/start">Walkthrough</Link><Link href="/combat">Combat</Link><Link href="/about">About</Link><Link href="/attributions">Credits</Link></nav></footer>
    </div>
  );
}
