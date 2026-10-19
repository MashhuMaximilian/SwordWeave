import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import { ContactForm, CopyContactEmail } from "@/components/contact/contact-form";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { CONTACT_EMAIL, DISCORD_INVITE_URL } from "@/lib/community";
import { getContactMailConfig } from "@/lib/server/contact-mail";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact · SwordWeave",
  description: `Questions, table feedback or creator collaborations: send Mashu a message at ${CONTACT_EMAIL}.`,
};

export default function ContactPage() {
  return <div className="sw-home sw-public-site sw-public-site--arcane sw-contact">
    <PublicNav />
    <div id="main-content" className="sw-contact__layout">
      <div className="sw-contact__intro">
        <header>
          <h1 className="sw-public-title">Let’s talk<br /><em>SwordWeave.</em></h1>
          <p className="sw-public-deck">A question about the game, feedback from your table, or a creator collaboration? Send Mashu a message.</p>
        </header>
        <div className="sw-contact__direct">
          <h2>Email</h2>
          <CopyContactEmail />
          <p>SwordWeave is a one-person project. Replies may take a little time.</p>
        </div>
      </div>
      <ContactForm configured={Boolean(getContactMailConfig())} />
      <section className="sw-contact__community" aria-labelledby="contact-community-title">
        <h2 id="contact-community-title">Prefer the tavern?</h2>
        <p>Ask a rules question, share a character, or find people to play with in the community.</p>
        <a className="sw-public-link sw-discord-link" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer"><DiscordIcon /> Join the Discord <ArrowUpRight size={16} aria-hidden="true" /></a>
      </section>
    </div>
  </div>;
}
