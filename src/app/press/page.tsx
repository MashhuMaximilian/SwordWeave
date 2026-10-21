import { QuickCoreDownloads } from '@/components/publications/quick-core-downloads';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Download, Mail } from 'lucide-react';
import { PublicNav } from '@/components/home/public-nav';
import { StructuredData } from '@/components/analytics/structured-data';
import { TrackLink } from '@/components/analytics/track-link';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { PRESS_KIT, PRESS_KIT_ZIP } from '@/lib/marketing/press-kit';
import { CompanionMaterials } from '@/components/marketing/companion-materials';
import './press.css';

export const metadata: Metadata = publicPageMetadata('/press');

const previews = PRESS_KIT.assets.filter(asset => asset.kind === 'book' || asset.kind === 'companion');
const logos = PRESS_KIT.assets.filter(asset => asset.kind === 'logo');
const screenshots = PRESS_KIT.assets.filter(asset => asset.kind === 'screenshot');

export default function PressPage() {
  return <div className="sw-home sw-public-site sw-public-site--arcane sw-press">
    <StructuredData path="/press" />
    <PublicNav />
    <div id="main-content">
      <header className="sw-press__intro">
        <div>
          <h1 className="sw-public-title">The SwordWeave<br /><em>creator kit.</em></h1>
          <p className="sw-public-deck">Descriptions, current books, real previews and project facts for reviewers, streamers and curious tables.</p>
          <p className="sw-press__intro-note">{PRESS_KIT.version} · An independent project by {PRESS_KIT.creator}. Updated <time dateTime={PRESS_KIT.updated}>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(PRESS_KIT.updated))}</time>.</p>
          <div className="sw-public-actions">
            <TrackLink event={{ name: 'media_kit_download', params: { placement: 'press', release_version: 'v0.1-alpha' } }} className="sw-cta-primary" href={PRESS_KIT_ZIP} download><Download aria-hidden="true" /> Download the creator kit</TrackLink>
            <Link className="sw-cta-ghost" href="/contact"><Mail aria-hidden="true" /> Contact Mashu <ArrowRight aria-hidden="true" /></Link>
          </div>
          <p className="sw-press__download-note">ZIP: descriptions, fact sheet, original fillable companions and their previews, flat and gradient marks, the PHB cover, a public character screenshot, captions and asset notices. Books are linked separately so you can choose the current edition.</p>
        </div>
        <figure className="sw-press__cover">
          <Link href="/books/players-handbook" aria-label="Read the Player’s Handbook">
            <Image src="/press/previews/phb-cover.jpg" alt="Cover of SwordWeave’s illustrated Player’s Handbook, v0.1 alpha" width={894} height={1200} sizes="(max-width: 760px) 72vw, 360px" priority />
          </Link>
          <figcaption>The illustrated Player’s Handbook · 268 pages</figcaption>
        </figure>
      </header>

      <nav className="sw-press__contents" aria-label="Creator kit sections">
        <a href="#descriptions">Descriptions</a><a href="#facts">Facts &amp; alpha status</a><a href="#books">Books &amp; examples</a><a href="#materials">Table companions</a><a href="#quick-core">Publish your work</a><a href="#screenshots">Previews</a><a href="#logos">Logos</a><a href="#credits">Credits &amp; AI use</a>
      </nav>

      <section className="sw-public-section sw-press__editorial" id="descriptions" aria-labelledby="press-descriptions">
        <h2 id="press-descriptions">Describe the game.</h2>
        <div className="sw-press__copy">
          <article><h3>One sentence</h3><p>{PRESS_KIT.oneLine}</p></article>
          <article><h3>A short introduction</h3><p>{PRESS_KIT.shortDescription}</p></article>
          <article><h3>A little more context</h3><p>{PRESS_KIT.longDescription}</p></article>
          <a className="sw-public-link" href="/press/fact-sheet.md" download>Download the text and fact sheet <Download aria-hidden="true" /></a>
        </div>
      </section>

      <section className="sw-public-section sw-press__editorial" id="facts" aria-labelledby="press-facts">
        <h2 id="press-facts">The current alpha.</h2>
        <div>
          <dl className="sw-press__facts">{PRESS_KIT.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
          <h3 className="sw-press__subheading">Before you cover or play it</h3>
          <ul className="sw-press__limitations">{PRESS_KIT.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}</ul>
          <p>Independent criticism is welcome. A kit download comes with no obligation to cover the project or give it a favorable review.</p>
        </div>
      </section>

      <section className="sw-public-section sw-press__editorial" id="books" aria-labelledby="press-books">
        <h2 id="press-books">Read it.<br /><em>Inspect a real build.</em></h2>
        <div>
          <ul className="sw-press__book-list">{PRESS_KIT.books.map(book => <li key={book.path}><h3><Link href={book.path}>{book.title} <ArrowRight aria-hidden="true" /></Link></h3><p>{book.status}</p></li>)}</ul>
          <Link className="sw-public-link" href="/books">Choose current readers and PDF editions <ArrowRight aria-hidden="true" /></Link>
          <div className="sw-press__examples">
            <h3>Public demonstration characters</h3>
            <p><Link href="/characters/1662962b-14c5-4433-994e-6273b3f7ca57?view=public">Neris Cinderthread</Link> is the first character to inspect. <Link href="/characters/1da4e351-da76-4822-bf1f-632d2e657145?view=public">Orren Vaultwright</Link> shows a more elaborate build. These are existing demonstration records, not independent player testimonials.</p>
            <p>Read <Link href="/character#build-example">Neris’s construction walkthrough</Link> for the acquisitions and decisions behind his sheet. For the procedures behind the tools, read the <Link href="/rules">Play Guide</Link>, <Link href="/creating">creation guide</Link> and <Link href="/combat">combat guide</Link>.</p>
          </div>
        </div>
      </section>

      <CompanionMaterials />
      <QuickCoreDownloads placement="press" ids={['create-and-publish']} title="Create and publish your own work" description="You can make and sell compatible adventures, characters, creatures and more. This guide explains attribution, license boundaries, asset permissions and selling; it creates no new platform-store agreement." />

      <section className="sw-public-section" id="screenshots" aria-labelledby="press-screenshots">
        <header className="sw-press__section-head"><h2 id="press-screenshots">On the page.<br /><em>In the browser.</em></h2><p>A real public character sheet, the illustrated PHB cover and previews of the current table companions. Download each complete companion as a PDF below.</p></header>
        {screenshots.map(asset => <figure className="sw-press__tool-preview" key={asset.file}>
          <a href={`/press/${asset.file}`} aria-label={`View full-size ${asset.label.toLowerCase()}`}><Image src={`/press/${asset.file}`} alt={asset.caption} width={asset.width} height={asset.height} sizes="(max-width: 1280px) 94vw, 1200px" /></a>
          <figcaption><div><h3>{asset.label}</h3><p>{asset.caption}</p></div><a className="sw-public-link" href={`/press/${asset.file}`} download>Download PNG <Download aria-hidden="true" /></a></figcaption>
        </figure>)}
        <div className="sw-press__previews">{previews.map(asset => <figure key={asset.file}>
          <a href={`/press/${asset.pdf ?? asset.file}`} aria-label={asset.pdf ? `Read the complete ${asset.label} PDF` : `View full-size ${asset.label.toLowerCase()}`}><Image src={`/press/${asset.file}`} alt={asset.caption} width={asset.width} height={asset.height} sizes="(max-width: 640px) 88vw, (max-width: 1000px) 44vw, 30vw" /></a>
          <figcaption><h3>{asset.label}</h3><p>{asset.caption}</p><div className="sw-press__material-links">{asset.pdf && <a className="sw-public-link" href={`/press/${asset.pdf}`} download aria-label={`Download ${asset.label} PDF`}>Download PDF <Download aria-hidden="true" /></a>}<a className="sw-public-link" href={`/press/${asset.file}`} download aria-label={`Download ${asset.label} preview JPEG`}>Download JPEG <Download aria-hidden="true" /></a></div></figcaption>
        </figure>)}</div>
      </section>

      <section className="sw-public-section" id="logos" aria-labelledby="press-logos">
        <header className="sw-press__section-head"><h2 id="press-logos">The project mark.</h2><p>The navigation’s gold-and-teal gradient mark and the original flat versions. Keep their proportions and use the name SwordWeave when identifying the project.</p></header>
        <div className="sw-press__logos">{logos.map((asset, index) => <figure key={asset.file}>
          <div className={`sw-press__logo-field ${index === 0 ? 'sw-press__logo-field--light' : ''}`}><Image src={`/press/${asset.file}`} alt={asset.caption} width={asset.width} height={asset.height} sizes="160px" /></div>
          <figcaption><h3>{asset.label}</h3><a className="sw-public-link" href={`/press/${asset.file}`} download>Download PNG <Download aria-hidden="true" /></a>{asset.file.endsWith('swordweave-mark-gradient.png') && <a className="sw-public-link" href="/press/logos/swordweave-mark-gradient.svg" download>Download SVG <Download aria-hidden="true" /></a>}</figcaption>
        </figure>)}</div>
        <p className="sw-press__asset-note">The files identify SwordWeave. They do not imply an endorsement or grant trademark rights. See the <a href="/press/asset-notices.md">asset notices</a> for reuse boundaries.</p>
      </section>

      <section className="sw-public-section sw-press__editorial" id="credits" aria-labelledby="press-credits">
        <h2 id="press-credits">Credit and process.</h2>
        <div className="sw-press__copy">
          <article><h3>Licenses and asset use</h3><p>Designated original game text and instructional diagrams use <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. The software uses MIT. Artwork, branding, fonts and third-party material keep their separate notices; the text’s open license does not make every file openly licensed.</p><p>Keep the supplied captions and credits with preview images. The kit does not add a standalone art license. For artwork extraction, adaptation or any reuse the existing notices do not cover, <Link href="/contact">ask Mashu</Link>. The relevant book credits and <Link href="/attributions">icon attributions</Link> provide the source notices.</p><a className="sw-public-link" href="/press/asset-notices.md">Read the kit’s asset notices <ArrowRight aria-hidden="true" /></a></article>
          <article><h3>AI and this alpha</h3>{PRESS_KIT.aiDisclosure.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</article>
          <article><h3>Questions or coverage?</h3><p>Contact <a href={`mailto:${PRESS_KIT.email}`}>{PRESS_KIT.email}</a> or use the <Link href="/contact">website contact form</Link>. SwordWeave is a one-person project, so a reply may take a little time.</p><p>Website: <a href={PRESS_KIT.website}>{PRESS_KIT.website.replace('https://', '').replace(/\/$/, '')}</a>. Source and license: <a href="https://github.com/MashhuMaximilian/SwordWeave" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight aria-hidden="true" /></a>.</p><p><a href="/press.md" download>Download this page as Markdown</a></p></article>
        </div>
      </section>
    </div>
  </div>;
}
