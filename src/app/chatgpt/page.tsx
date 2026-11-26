import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import { CHATGPT_INSTALL_LABEL, CHATGPT_LISTING_URL } from "@/lib/chatgpt-listing";

export const metadata: Metadata = {
  title: "SwordWeave in ChatGPT · Setup and example prompts",
  description: "Learn how to connect your SwordWeave account in ChatGPT, look up rules, preview a character, and find your saved sheets.",
};

const prompts = [
  {
    title: "Look up a rule",
    prompt: "How does Vitality recover after a rest in SwordWeave? Link me to the rule.",
  },
  {
    title: "Preview a first character",
    prompt: "I want to play a storm caller. Help me choose a verb tier, domain, range, and die type for a first-level build. Show me the Build Unit cost.",
  },
  {
    title: "Check a build",
    prompt: "List my SwordWeave characters, then show me the Build Unit budget for the one I choose and link to its sheet.",
  },
];

export default function ChatGptGuidePage() {
  return (
    <div className="sw-home sw-public-site sw-public-site--arcane sw-chatgpt-guide">
      <PublicNav />
      <div id="main-content">
        <header className="sw-public-hero sw-public-hero--compact sw-chatgpt-guide__hero">
          <h1 className="sw-public-title">SwordWeave in <em>ChatGPT.</em></h1>
          <p className="sw-public-deck">
            Look up a rule, preview a character build, or bring up a sheet while you’re talking through an idea.
          </p>
          {!CHATGPT_LISTING_URL && (
            <p className="sw-chatgpt-guide__status">Public installation is coming.</p>
          )}
          <div className="sw-public-actions">
            {CHATGPT_LISTING_URL ? (
              <a className="sw-cta-primary" href={CHATGPT_LISTING_URL} target="_blank" rel="noopener noreferrer">
                {CHATGPT_INSTALL_LABEL} <ArrowUpRight aria-hidden="true" />
              </a>
            ) : (
              <a className="sw-cta-primary" href="#connect">See setup steps <ArrowRight aria-hidden="true" /></a>
            )}
            <Link className="sw-cta-ghost" href="/rules">Read the rules <ArrowRight aria-hidden="true" /></Link>
          </div>
        </header>

        <section id="connect" className="sw-public-section" aria-labelledby="connect-title">
          <header className="sw-public-section-head">
            <div><h2 id="connect-title">How to connect</h2></div>
            <p>
              {CHATGPT_LISTING_URL
                ? "Use your existing SwordWeave account."
                : "Follow these steps once the listing is published."}
            </p>
          </header>
          <ol className="sw-public-grid sw-chatgpt-guide__steps">
            <li className="sw-public-panel">
              <h3>Install the plugin</h3>
              <p>Open SwordWeave Companion in the ChatGPT Plugins directory and select the plus button.</p>
            </li>
            <li className="sw-public-panel">
              <h3>Link your account</h3>
              <p>Choose Connect when prompted. Sign in to SwordWeave, review the requested permissions, and approve the connection.</p>
            </li>
            <li className="sw-public-panel">
              <h3>Start a chat</h3>
              <p>Type <strong>@</strong> and choose SwordWeave Companion, or ask ChatGPT to use SwordWeave by name.</p>
            </li>
          </ol>
        </section>

        <section className="sw-public-section" aria-labelledby="prompts-title">
          <header className="sw-public-section-head"><div><h2 id="prompts-title">Try a prompt</h2></div></header>
          <div className="sw-public-grid">
            {prompts.map(({ title, prompt }) => (
              <article className="sw-public-panel sw-chatgpt-prompt" key={title}>
                <h3>{title}</h3>
                <blockquote>“{prompt}”</blockquote>
              </article>
            ))}
          </div>
        </section>

        <section className="sw-public-section" aria-labelledby="account-title">
          <header className="sw-public-section-head"><div><h2 id="account-title">Characters and permissions</h2></div></header>
          <div className="sw-public-duet">
            <article className="sw-public-panel">
              <h3>Your SwordWeave sheets</h3>
              <p>The linked account can look up the characters you own or that someone has shared with you. Open a sheet in SwordWeave to save changes, log a consequence, or print it.</p>
              <Link className="sw-public-link" href="/characters">Open your roster <ArrowRight aria-hidden="true" /></Link>
            </article>
            <article className="sw-public-panel">
              <h3>Manage the connection</h3>
              <p>Disconnect the plugin in ChatGPT settings. The characters saved on SwordWeave stay in your account.</p>
              <Link className="sw-public-link" href="/privacy">Read the privacy notice <ArrowRight aria-hidden="true" /></Link>
            </article>
          </div>
          <Link className="sw-public-link sw-chatgpt-guide__help" href="/contact">Get help with SwordWeave <ArrowRight aria-hidden="true" /></Link>
        </section>
      </div>
    </div>
  );
}
