import type { Metadata } from "next";
import { PublicNav } from "@/components/home/public-nav";
import { CookiePreferencesButton } from "@/components/privacy/cookie-consent";
import { CONTACT_EMAIL } from "@/lib/community";

export const metadata: Metadata = { title: "Privacy & cookies · SwordWeave", description: "How SwordWeave uses essential storage, optional analytics, and contact messages." };

export default function PrivacyPage() {
  return <div className="sw-home sw-public-site sw-public-site--arcane">
    <PublicNav />
    <article id="main-content" className="sw-privacy">
      <h1 className="sw-public-title">Privacy & <em>cookies.</em></h1>
      <p className="sw-public-deck">A guide to the data used by the SwordWeave website.</p>
      <p>Updated 19 October 2026.</p>
      <h2>Essential storage</h2>
      <p>SwordWeave uses Clerk for accounts and sign-in. Its cookies support authentication and account security. Your browser also stores functional settings such as your theme and tool preferences. CookieConsent stores your privacy choice in a cookie named <code>sw_consent</code> for 180 days.</p>
      <h2>Optional analytics</h2>
      <p>Vercel Web Analytics measures site visits and page views. Vercel Speed Insights measures loading speed and responsiveness. These tools load only after you accept analytics. URL query strings and fragments are removed from analytics events. Changing your choice stops future analytics events; it does not undo data already sent.</p>
      <p>You can keep analytics off and still use the game tools. <CookiePreferencesButton />.</p>
      <h2>Accounts and game content</h2>
      <p>Signing in lets you save and manage content in SwordWeave. The site uses Vercel hosting, Clerk authentication, and Neon database hosting to provide these features. Cloudflare serves public artwork and book downloads; some icons load through jsDelivr. Content you choose to publish or share can be viewed by others according to its sharing settings.</p>
      <h2>Contact messages</h2>
      <p>Your email address, optional name, and message are used to read and respond to your enquiry in the project’s Proton Mail inbox. Website form messages are delivered through SMTP2GO. Email sent directly to the project’s domain addresses is forwarded by Porkbun. Please do not include passwords or sensitive account information.</p>
      <h2>Questions and requests</h2>
      <p>SwordWeave is maintained by Mashu. For privacy questions or a request concerning your account or messages, write to <strong>{CONTACT_EMAIL}</strong> or visit the <a href="/contact">contact page</a>.</p>
      <p>Provider information: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel</a>, <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">Clerk</a>, <a href="https://neon.com/privacy-policy" target="_blank" rel="noopener noreferrer">Neon</a>, <a href="https://www.smtp2go.com/privacy/" target="_blank" rel="noopener noreferrer">SMTP2GO</a>, <a href="https://proton.me/legal/privacy" target="_blank" rel="noopener noreferrer">Proton</a>.</p>
      <p>Privacy controls use <a href="https://github.com/orestbida/cookieconsent" target="_blank" rel="noopener noreferrer">CookieConsent by Orest Bida</a>, bundled with this website under the <a href="/licenses/vanilla-cookieconsent.txt">MIT license</a>.</p>
    </article>
  </div>;
}
