import Image from 'next/image';
import { Download } from 'lucide-react';
import { TrackLink } from '@/components/analytics/track-link';
import { CHARACTER_SHEET_FILES, CHARACTER_SHEET_PACK, CHARACTER_SHEET_MONOCHROME_PACK, CHARACTER_SHEET_PREVIEW, CHARACTER_SHEET_README, characterSheetDownloadEvent } from '@/lib/publications/character-sheets';
import './quick-core-downloads.css';
import './character-sheet-downloads.css';

const size = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export function CharacterSheetDownloads({ placement }: { placement: 'books' | 'press' }) {
  const heading = `character-sheets-${placement}-title`;
  const blanks = CHARACTER_SHEET_FILES.filter(file => file.group !== 'example');
  const examples = CHARACTER_SHEET_FILES.filter(file => file.group === 'example');
  const row = (file: typeof CHARACTER_SHEET_FILES[number]) => <li key={file.id}>
    <div><h3>{file.label}</h3><p>{file.description}</p></div>
    <div className="sw-quick-core__action"><TrackLink href={file.href} download event={characterSheetDownloadEvent(file.id, placement)} aria-label={`Download ${file.label} PDF`}><Download size={16} aria-hidden="true" /> Download PDF</TrackLink><span>{file.pages} {file.pages === 1 ? 'page' : 'pages'} · {size(file.bytes)} · Color PDF</span></div>
  </li>;
  return <section id="character-sheets" className="sw-quick-core sw-character-sheets" aria-labelledby={heading}>
    <h2 id={heading}>Printable character sheets.</h2>
    <p className="sw-quick-core__intro">Choose an empty Aegis front and the supporting pages you need, or get the complete pack. Gold/teal is the default; a monochrome ZIP is also available. Write your own character in pencil; no account is needed for these downloads.</p>
    <ul><li><div><h3>The complete Aegis color print pack</h3><p>Four blank fronts, matching portrait and landscape supporting pages, a level-one Tarn example, a level-sixteen Orren example, printing instructions and credits.</p></div><div className="sw-quick-core__action"><TrackLink href={CHARACTER_SHEET_PACK.href} download event={characterSheetDownloadEvent('pack', placement)} aria-label="Download complete Aegis character-sheet ZIP"><Download size={16} aria-hidden="true" /> Download ZIP</TrackLink><span>8 PDFs · {CHARACTER_SHEET_PACK.pages} pages · {size(CHARACTER_SHEET_PACK.bytes)} · Gold/teal</span></div></li><li><div><h3>Monochrome Aegis print pack</h3><p>The same eight updated PDFs in black and white for economical printing.</p></div><div className="sw-quick-core__action"><TrackLink href={CHARACTER_SHEET_MONOCHROME_PACK.href} download event={characterSheetDownloadEvent('monochrome-pack', placement)} aria-label="Download monochrome Aegis character-sheet ZIP"><Download size={16} aria-hidden="true" /> Download monochrome ZIP</TrackLink><span>8 PDFs · {CHARACTER_SHEET_MONOCHROME_PACK.pages} pages · {size(CHARACTER_SHEET_MONOCHROME_PACK.bytes)} · Monochrome</span></div></li></ul>
    <details className="sw-character-sheets__preview"><summary>Preview the four blank formats</summary><a href={CHARACTER_SHEET_PREVIEW} target="_blank" rel="noopener noreferrer"><Image src={CHARACTER_SHEET_PREVIEW} alt="Actual gold/teal Aegis blank fronts: portrait normal, portrait dense, landscape normal and landscape dense" width={1440} height={1610} sizes="(max-width: 640px) 90vw, 900px" /></a></details>
    <p className="sw-quick-core__intro">Print one front at A4 actual size. Both landscape fronts have two primitive columns and fold through a protected 16 pt centre clearance. Print only the supporting leaves you need and repeat them when you run out of room. These are printable sheets; the existing fillable session and Neris companions remain separate.</p>
    <ul>{blanks.map(row)}</ul>
    <details className="sw-character-sheets__examples"><summary>Download the two filled examples individually</summary><ul>{examples.map(row)}</ul></details>
    <p className="sw-character-sheets__notes"><a href={CHARACTER_SHEET_README}>Printing instructions, pack contents and notices</a> · Digital layout checks complete; physical print, pencil and fold proof pending.</p>
  </section>;
}
