import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Compass, MessageCircle, ScrollText, WandSparkles } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import { CHATGPT_INSTALL_LABEL, CHATGPT_LISTING_URL } from "@/lib/chatgpt-listing";
import { CopyPromptButton } from "./copy-prompt-button";

export const metadata: Metadata = {
  title: "SwordWeave in ChatGPT · Character-building guide",
  description: "Talk through a character idea, use SwordWeave Companion to preview a starting build, or open a saved sheet and plan its next level.",
};

const buildPaths = [
  {
    title: "Talk through your idea first",
    icon: MessageCircle,
    description: "Start with a normal ChatGPT conversation. Explore what drives your character, how they help the group, and what you want them to do in play. Once the idea feels right, bring SwordWeave into that same chat and ask for a short recap before building.",
    prompt: "Help me shape a lighthouse keeper who guides people home through storms. Ask me what I want them to do in play before we pick any rules.",
  },
  {
    title: "Ask for a starting build",
    icon: WandSparkles,
    description: "Bring a short brief or a character you’ve played in another game. Say what you want to keep and the kind of scenes you expect to play. SwordWeave can suggest starting choices from its catalogue for you to compare.",
    prompt: "Use SwordWeave Companion to preview a level-one character who protects allies with bursts of wind. Give me a starter build, show its cost, and explain one trade-off I could make.",
  },
  {
    title: "Bring the rules you’ve picked",
    icon: BookOpen,
    description: "Already know some of the pieces you want? Name them or paste their SwordWeave catalogue links. Ask for the exact versions available to you, then see how they fit and what choices are still open.",
    prompt: "Use SwordWeave Companion to preview a level-one character with Verb Access Tier III, Domain Access Tier I, Touch Range, and Heavy Die Block (1d8). Show my Build Units spent and remaining.",
  },
  {
    title: "Continue a saved character",
    icon: ScrollText,
    description: "Pick a character from the roster you can access or paste their SwordWeave sheet link. Review their current build and budget. For a character you own, ask for a preview of a specific higher level before choosing new abilities.",
    prompt: "Use SwordWeave Companion to list my characters. After I pick one I own, show its current Build Units, proficiency, and Vitality alongside a preview of its next level.",
  },
];

const startingChoices = [
  { name: "Verb tier", detail: "What kind of change can you make?" },
  { name: "Domain", detail: "What can you act on?" },
  { name: "Range", detail: "How far can the action reach?" },
  { name: "Die type", detail: "Which effect die can you use?" },
];

const followUpPrompts = [
  {
    title: "Look up a rule",
    prompt: "Use SwordWeave Companion to explain how Vitality recovers after a rest. Link me to that part of the Play Guide.",
  },
  {
    title: "Make a portrait prompt",
    prompt: "Use SwordWeave Companion to write an image prompt for the character above in SwordWeave’s illustration style. Include the details we agreed on.",
  },
  {
    title: "Bring a sheet to the table",
    prompt: "Use SwordWeave Companion to find my saved character [name]. Give me their standard PDF and the available play-sheet and Bestiary links for their monster companions.",
  },
];

export default function ChatGptGuidePage() {
  return (
    <div className="sw-home sw-public-site sw-public-site--arcane sw-chatgpt-guide">
      <PublicNav />
      <div id="main-content">
        <header className="sw-public-hero sw-chatgpt-guide__hero" aria-labelledby="chatgpt-guide-title">
          <div className="sw-chatgpt-guide__intro">
            <h1 id="chatgpt-guide-title" className="sw-public-title">SwordWeave<br />in <em>ChatGPT.</em></h1>
            <p className="sw-public-deck">Talk through a character, check how the idea works with SwordWeave’s rules, and open the sheets you bring to the table.</p>
            <div className="sw-public-actions">
              {CHATGPT_LISTING_URL ? (
                <a className="sw-cta-primary" href={CHATGPT_LISTING_URL} target="_blank" rel="noopener noreferrer">
                  {CHATGPT_INSTALL_LABEL} <ArrowUpRight aria-hidden="true" />
                </a>
              ) : (
                <a className="sw-cta-primary" href="#build-paths">Explore ways to build <ArrowRight aria-hidden="true" /></a>
              )}
              <a className="sw-cta-ghost" href="#connect">How to connect</a>
            </div>
            {!CHATGPT_LISTING_URL && <p className="sw-chatgpt-guide__status">Public installation is coming. You can explore the steps and save prompts for later.</p>}
          </div>
          <figure className="sw-public-panel sw-chatgpt-example">
            <figcaption>From conversation to build preview</figcaption>
            <blockquote>“I want to play a lighthouse keeper who uses storms to guide people home.”</blockquote>
            <p>Talk it through with ChatGPT. You might decide they sense danger through wind and want to reach stranded people from shore.</p>
            <blockquote className="sw-chatgpt-example__invocation">
              <strong>@SwordWeave Companion</strong>
              Use the idea we agreed on. Preview a level-one build and show me the starting choices and their costs.
            </blockquote>
            <p>If any details are missing, paste a short recap along with the request. Check that recap before choosing rules.</p>
          </figure>
        </header>

        <section id="build-paths" className="sw-public-section" aria-labelledby="build-paths-title">
          <header className="sw-public-section-head">
            <div><h2 id="build-paths-title">Where do you want to start?</h2></div>
            <p>Start with what you already have. Try a prompt as written or swap in your character’s details.</p>
          </header>
          <div className="sw-public-duet sw-chatgpt-guide__paths">
            {buildPaths.map(({ title, icon: Icon, description, prompt }) => (
              <article className="sw-public-panel sw-chatgpt-path" key={title}>
                <div className="sw-chatgpt-path__head"><Icon aria-hidden="true" /><h3>{title}</h3></div>
                <p>{description}</p>
                <div className="sw-chatgpt-path__prompt">
                  <blockquote>{prompt}</blockquote>
                  <CopyPromptButton prompt={prompt} title={title} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="preview" className="sw-public-section" aria-labelledby="preview-title">
          <header className="sw-public-section-head">
            <div><h2 id="preview-title">Read your starting build</h2></div>
            <p>Check the four choices that govern what your character can do. The preview will show your Build Units and flag choices you still need to make.</p>
          </header>
          <dl className="sw-chatgpt-guide__starting">
            {startingChoices.map(({ name, detail }) => (
              <div className="sw-public-panel" key={name}><dt>{name}</dt><dd>{detail}</dd></div>
            ))}
          </dl>
          <div className="sw-public-note sw-chatgpt-guide__guidance">
            <Compass aria-hidden="true" />
            <div>
              <p>Choose a positive verb tier and domain. Touch and 1d4 are free defaults when you leave range or die type open. Once the starting access fits, ask about optional mirrored drawbacks and how they affect your budget.</p>
              <Link className="sw-public-link" href="/rules#first-character">Read the first-character rules <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="connect" className="sw-public-section" aria-labelledby="connect-title">
          <header className="sw-public-section-head">
            <div><h2 id="connect-title">How to connect</h2></div>
            <p>{CHATGPT_LISTING_URL ? "Use your existing SwordWeave account." : "Follow these steps once the public listing is available."}</p>
          </header>
          <ol className="sw-public-grid sw-chatgpt-guide__steps">
            <li className="sw-public-panel">
              <h3>Install SwordWeave Companion</h3>
              <p>Find SwordWeave Companion in the ChatGPT Plugins directory and choose Install.</p>
            </li>
            <li className="sw-public-panel">
              <h3>Connect your SwordWeave account</h3>
              <p>Choose Connect when asked. Sign in to SwordWeave, check the requested read access, and approve the connection.</p>
            </li>
            <li className="sw-public-panel">
              <h3>Use it in a conversation</h3>
              <p>In a new or existing chat, type <strong>@</strong> and select SwordWeave Companion. Then ask for a rule, a preview, or a sheet.</p>
            </li>
          </ol>
        </section>

        <section id="follow-up" className="sw-public-section" aria-labelledby="follow-up-title">
          <header className="sw-public-section-head">
            <div><h2 id="follow-up-title">Keep going after the preview</h2></div>
            <p>The first release brings reads and previews into the conversation. Keep your ideas there while you decide, then use SwordWeave to create a character, apply an advancement, or edit a saved sheet.</p>
          </header>
          <div className="sw-public-grid">
            {followUpPrompts.map(({ title, prompt }) => (
              <article className="sw-public-panel sw-chatgpt-path" key={title}>
                <h3>{title}</h3>
                <div className="sw-chatgpt-path__prompt">
                  <blockquote>{prompt}</blockquote>
                  <CopyPromptButton prompt={prompt} title={title} />
                </div>
                {title === "Make a portrait prompt" && <p>Paste the result into an image generator, then upload the finished portrait in SwordWeave.</p>}
              </article>
            ))}
          </div>
          <Link className="sw-public-link sw-chatgpt-guide__help" href="/characters/new">Build a character in SwordWeave <ArrowRight aria-hidden="true" /></Link>
        </section>

        <section id="access" className="sw-public-section" aria-labelledby="account-title">
          <header className="sw-public-section-head">
            <div><h2 id="account-title">Your account and sheets</h2></div>
          </header>
          <div className="sw-public-duet">
            <article className="sw-public-panel">
              <h3>Access follows your SwordWeave account</h3>
              <p>Companion can look up sheets you own or that someone has shared with you. Sign in to SwordWeave to open protected PDFs and play sheets.</p>
              <Link className="sw-public-link" href="/characters">Open your roster <ArrowRight aria-hidden="true" /></Link>
            </article>
            <article className="sw-public-panel">
              <h3>Manage the connection in ChatGPT</h3>
              <p>You can disconnect SwordWeave Companion in ChatGPT’s plugin settings. Your saved sheets stay in SwordWeave.</p>
              <Link className="sw-public-link" href="/privacy">Read the privacy notice <ArrowRight aria-hidden="true" /></Link>
            </article>
          </div>
          <Link className="sw-public-link sw-chatgpt-guide__help" href="/contact">Get help with SwordWeave <ArrowRight aria-hidden="true" /></Link>
        </section>
      </div>
    </div>
  );
}
