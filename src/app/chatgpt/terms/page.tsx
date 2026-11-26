import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav } from "@/components/home/public-nav";
import { CONTACT_EMAIL } from "@/lib/community";

export const metadata: Metadata = {
  title: "SwordWeave Companion Terms of Service",
  description: "Terms for using SwordWeave Companion with a linked SwordWeave account in ChatGPT.",
  alternates: { canonical: "/chatgpt/terms" },
};

export default function CompanionTermsPage() {
  return (
    <div className="sw-home sw-public-site sw-public-site--arcane">
      <PublicNav />
      <article id="main-content" className="sw-privacy">
        <h1 className="sw-public-title">SwordWeave Companion <em>Terms of Service</em></h1>
        <p>Effective date <time dateTime="2026-11-26">26 November 2026</time></p>
        <p>Marius Ion provides SwordWeave Companion, an optional connection between SwordWeave and ChatGPT. These terms apply when you use Companion. Your use of ChatGPT is also subject to the <a href="https://openai.com/policies/">OpenAI terms</a> that apply to your account.</p>

        <h2>What Companion does</h2>
        <p>Companion can look up SwordWeave rules and catalogue entries, preview character builds, and read saved sheets your SwordWeave account can access. It can provide links to monster companion sheets and character sheet PDFs. Open those links in SwordWeave and sign in if prompted. Use the SwordWeave website to save character changes, record play state, or change who can access a sheet.</p>

        <h2>Connecting your account</h2>
        <p>When you connect Companion, sign in to your SwordWeave account and choose whether to grant the requested permissions. SwordWeave checks your account’s access before returning saved content. Use an account you’re authorized to use and respect other players’ privacy when bringing shared material into a chat. Use the connection lawfully and respect its access controls.</p>

        <h2>Your requests and content</h2>
        <p>ChatGPT sends a tool request that may draw on your conversation and enabled memories. The response can include game content from a sheet that you can access. By using Companion, you allow SwordWeave to process the request and return the permitted result to ChatGPT.</p>
        <p>You keep any rights you hold in the content you provide. SwordWeave rules, software, artwork and third-party material retain their applicable licenses and credits. See the <Link href="/about">SwordWeave project and licenses</Link> for details.</p>
        <p>The <Link href="/privacy">SwordWeave privacy notice</Link> explains account linking, information returned through the connection, and how to contact SwordWeave about privacy. Use your ChatGPT settings to manage your chats, memories, and connected plugins.</p>

        <h2>Checking results and disconnecting</h2>
        <p>Compare ChatGPT’s answers with the linked rules and the saved character sheet before using them in play. SwordWeave is an early build and Companion features may change or become unavailable.</p>
        <p>You can disconnect Companion from ChatGPT’s plugin settings. Manage saved characters and sharing in SwordWeave. Manage prior conversations in ChatGPT and keep or remove any PDFs you downloaded using the controls on your device.</p>

        <h2>Contact and your rights</h2>
        <p>For help with the connection, a SwordWeave account, or these terms, use the <Link href="/contact">SwordWeave contact page</Link> or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        <p>These terms preserve any rights you have under applicable law that cannot be waived.</p>
      </article>
    </div>
  );
}
