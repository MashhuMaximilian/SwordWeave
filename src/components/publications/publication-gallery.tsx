import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Download, Eye, PackageOpen } from 'lucide-react';
import { TrackLink } from '@/components/analytics/track-link';
import type { AnalyticsEvent } from '@/lib/analytics/contract';
import books from '@/lib/publications/catalogue.json';
import previews from '@/lib/publications/preview-manifest.json';
import companionManifest from '../../../public/press/asset-manifest.json';
import { QUICK_CORE_GUIDES, quickCoreDownloadEvent, type QuickCoreId } from '@/lib/publications/quick-core';
import { bookPdfDownloads, bookDownloadEvent } from '@/lib/publications/downloads';
import { CHARACTER_SHEET_FILES, CHARACTER_SHEET_PACK, CHARACTER_SHEET_MONOCHROME_PACK, CHARACTER_SHEET_README, characterSheetDownloadEvent } from '@/lib/publications/character-sheets';
import './publication-gallery.css';

type Placement = 'books' | 'press';
type PreviewId = keyof typeof previews;
export const fileSize = (bytes: number) => bytes < 1_000_000 ? `${Math.ceil(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

export function PublicationPreview({ id, href, title, priority = false, page = 0 }: { id: PreviewId; href: string; title: string; priority?: boolean; page?: number }) {
  const preview = previews[id].previews[page] ?? previews[id].previews[0];
  if (!preview) throw new Error(`Missing publication preview: ${id}`);
  return <a className={`sw-publication-preview${preview.width > preview.height ? ' sw-publication-preview--landscape' : ''}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${title} PDF in a new tab`}>
    <Image src={preview.src} alt={`${title}, actual PDF page ${preview.page}`} width={preview.width} height={preview.height} sizes="(max-width: 560px) 86vw, (max-width: 900px) 42vw, 300px" priority={priority} />
    <span><Eye size={15} aria-hidden="true" /> Preview PDF</span>
  </a>;
}

export function PublicationHeading({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <header className="sw-publication-heading"><h2 id={id}>{title}</h2><p>{children}</p></header>;
}

export function PdfTile({ id, title, description, href, pages, bytes, note, event, textHref, imageHref }: { id: PreviewId; title: string; description: string; href: string; pages: number; bytes: number; note?: string; event?: AnalyticsEvent; textHref?: string; imageHref?: string }) {
  return <article className="sw-publication-tile">
    <PublicationPreview id={id} href={href} title={title} />
    <div className="sw-publication-tile__body"><p className="sw-publication-meta">{pages} {pages === 1 ? 'page' : 'pages'} · {fileSize(bytes)}{note ? ` · ${note}` : ''}</p><h3>{title}</h3><p>{description}</p>
      <div className="sw-publication-links">{event ? <TrackLink href={href} download event={event}><Download size={16} aria-hidden="true" /> Download PDF</TrackLink> : <a href={href} download><Download size={16} aria-hidden="true" /> Download PDF</a>}{textHref && <a href={textHref}>Read text <ArrowRight size={15} aria-hidden="true" /></a>}{imageHref && <a href={imageHref} download><Download size={15} aria-hidden="true" /> Page JPEG</a>}</div>
    </div>
  </article>;
}

export function CoreBookShelf({ placement }: { placement: Placement }) {
  return <section className="sw-publication-section" id="books" aria-labelledby={`${placement}-books-title`}>
    <PublicationHeading title="The three core books" id={`${placement}-books-title`}>Choose the Player’s Handbook to learn, the GM Guide to run, or the SRD to look up a rule. Read online or keep the PDF.</PublicationHeading>
    <div className="sw-core-shelf">{books.map((book, index) => {
      const editions = bookPdfDownloads(book);
      const current = editions[0];
      if (!current) throw new Error(`Missing current book edition: ${book.slug}`);
      return <article className="sw-core-volume" key={book.slug}>
        <PublicationPreview id={book.slug as PreviewId} href={current.href} title={book.title} priority={placement === 'books' && index === 0} />
        <div className="sw-core-volume__body"><p className="sw-publication-meta">{current.detail}</p><h3>{book.title}</h3><p>{book.description}</p>
          <div className="sw-core-volume__actions"><TrackLink className="sw-publication-button" href={current.href} download event={bookDownloadEvent(book.slug, current.href, placement)}><Download size={16} aria-hidden="true" /> {current.label}</TrackLink><Link prefetch={false} href={`/books/${book.slug}`}>Read online <ArrowRight size={16} aria-hidden="true" /></Link>{placement === 'press' && book.slug === 'players-handbook' && <a href="/press/previews/phb-cover.jpg" download><Download size={16} aria-hidden="true" /> Cover JPEG</a>}</div>
          <details className="sw-publication-editions"><summary>Inside the book &amp; other editions</summary><div className="sw-publication-inside">{previews[book.slug as PreviewId].previews.slice(1).map((preview, page) => <figure key={preview.src}><PublicationPreview id={book.slug as PreviewId} page={page + 1} href={`${current.href}#page=${preview.page}`} title={`${book.title}, page ${preview.page}`} /><figcaption>PDF page {preview.page}</figcaption></figure>)}</div><ul>{editions.slice(1).map(pdf => <li key={pdf.href} className={pdf.href.includes('-dark') ? 'sw-publication-archived-edition' : undefined}>{pdf.href.includes('-dark') && <PublicationPreview id={`${book.slug}-dark` as PreviewId} href={pdf.href} title={`${book.title}, earlier dark edition`} />}<div><TrackLink href={pdf.href} download event={bookDownloadEvent(book.slug, pdf.href, placement)}><Download size={15} aria-hidden="true" /> {pdf.label}</TrackLink><span>{pdf.detail}</span></div></li>)}</ul><p>High-resolution downloads use the same illustrated edition shown above. Earlier dark PDFs are previous editions.</p></details>
        </div>
      </article>;
    })}</div>{placement === 'press' && <p className="sw-publication-footnote">Keep the supplied <a href="/press/captions.md">caption and credit</a> with the cover image. <a href="/press/asset-notices.md">Asset notices</a> explain its reuse boundaries.</p>}
  </section>;
}

export function CompactGuideShelf({ placement, ids, title = 'A shorter way in' }: { placement: Placement; ids?: readonly QuickCoreId[]; title?: string }) {
  const guides = QUICK_CORE_GUIDES.filter(guide => !ids || ids.includes(guide.id));
  return <section className="sw-publication-section" id="quick-core" aria-labelledby={`${placement}-guides-title`}><PublicationHeading title={title} id={`${placement}-guides-title`}>Players can start with Play and Create. GMs can add Run. Create &amp; Publish explains sharing, selling and the license boundaries.</PublicationHeading><div className={`sw-publication-grid${guides.length === 1 ? ' sw-publication-grid--single' : ''}`}>{guides.map(guide => <PdfTile key={guide.id} id={guide.id} title={guide.title} description={guide.description} href={guide.href} pages={guide.pages} bytes={guide.bytes} event={quickCoreDownloadEvent(guide.id, placement)} />)}</div></section>;
}

export function CompanionShelf({ placement }: { placement: Placement }) {
  return <section className="sw-publication-section" id="materials" aria-labelledby={`${placement}-materials-title`}><PublicationHeading title="Bring a little structure to the table" id={`${placement}-materials-title`}>Two original companions with room for your own decisions. Fill them in with a compatible PDF reader, or print them.</PublicationHeading><div className="sw-publication-grid sw-publication-grid--companions">{companionManifest.materials.map(material => {
    const id = material.pdf.includes('first-session') ? 'first-session-run-sheet' : 'build-with-neris';
    const image = companionManifest.assets.find(asset => 'pdf' in asset && asset.pdf === material.pdf);
    return <PdfTile key={material.pdf} id={id} title={material.title} description={material.description} href={`/press/${material.pdf}`} pages={material.pages} bytes={material.pdfBytes} note="Fillable" textHref={`/press/${material.text}`} {...(placement === 'press' && image ? { imageHref: `/press/${image.file}` } : {})} />;
  })}</div>{placement === 'press' && <p className="sw-publication-footnote">Using a page image in your coverage? Keep its supplied <a href="/press/captions.md">caption and credit</a>. Artwork, branding and fonts retain their separate notices.</p>}</section>;
}

export function CharacterSheetShelf({ placement }: { placement: Placement }) {
  const group = (kind: 'blank-front' | 'blank-support' | 'example', title: string, description: string) => <div className="sw-sheet-group"><h3>{title}</h3><p>{description}</p><div className={`sw-publication-grid${kind === 'blank-front' ? '' : ' sw-publication-grid--pair'}`}>{CHARACTER_SHEET_FILES.filter(file => file.group === kind).map(file => <PdfTile key={file.id} id={file.id} title={file.label} description={file.description} href={file.href} pages={file.pages} bytes={file.bytes} note="Gold/teal" event={characterSheetDownloadEvent(file.id, placement)} />)}</div></div>;
  return <section className="sw-publication-section" id="character-sheets" aria-labelledby={`${placement}-sheets-title`}><PublicationHeading title="A character sheet that fits your build" id={`${placement}-sheets-title`}>Aegis in gold and teal, ready for pencil and paper. Choose one front, add matching support pages, or download the whole set.</PublicationHeading>
    <div className="sw-pack-bar"><PackageOpen size={28} aria-hidden="true" /><div><h3>All eight sheets, together</h3><p>25 pages, two filled examples, printing instructions and credits.</p></div><div><TrackLink className="sw-publication-button" href={CHARACTER_SHEET_PACK.href} download event={characterSheetDownloadEvent('pack', placement)}><Download size={16} aria-hidden="true" /> Color ZIP · {fileSize(CHARACTER_SHEET_PACK.bytes)}</TrackLink><TrackLink href={CHARACTER_SHEET_MONOCHROME_PACK.href} download event={characterSheetDownloadEvent('monochrome-pack', placement)}>Monochrome ZIP · {fileSize(CHARACTER_SHEET_MONOCHROME_PACK.bytes)}</TrackLink></div></div>
    {group('blank-front', 'Choose your front', 'Portrait or foldable landscape. Normal leaves more room to write; dense holds more owned ingredients.')}
    {group('blank-support', 'Add only the pages you need', 'Use portrait support with a portrait front, or landscape support with a landscape front. Repeat a page when you run out of space.')}
    {group('example', 'See a filled character', 'Tarn is a level-one starting point. Orren is a more elaborate level-sixteen build. These are public demonstration records.')}
    <div className="sw-publication-print-note"><p>Print on A4 at 100% / actual size. Both landscape fronts use two primitive columns and a protected 16 pt centre fold. These are pencil sheets; the fillable companions are separate.</p><a href={CHARACTER_SHEET_README}>Printing instructions &amp; credits <ArrowRight size={15} aria-hidden="true" /></a><small>Digital layout checks are complete. Physical print, pencil and fold testing is pending. Other styles and personalized exports are in the website character-sheet generator.</small></div>
  </section>;
}
