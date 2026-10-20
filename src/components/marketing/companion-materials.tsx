import Link from 'next/link';
import { Download } from 'lucide-react';
import content from '@/lib/marketing/companion-content.json';

type CompanionBlock = { type: string; text?: string; lines?: number; items?: string[]; headers?: string[]; rows?: string[][] };

function ReadableBlock({ block }: { block: CompanionBlock }) {
  if (block.type === 'heading') return <h5>{block.text}</h5>;
  if (block.type === 'field') return <p className="sw-press__writing-prompt"><strong>Write:</strong> {block.text} <small>({block.lines} writing {block.lines === 1 ? 'line' : 'lines'} in the PDF)</small></p>;
  if (block.type === 'checks') return <ul>{block.items?.map(item => <li key={item}>{item}</li>)}</ul>;
  if (block.type === 'table') return <div className="sw-press__material-table" role="region" aria-label="Companion reference table" tabIndex={0}><table><thead><tr>{block.headers?.map((header, index) => <th scope="col" key={index}>{header}</th>)}</tr></thead><tbody>{block.rows?.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>;
  return <p>{block.text}</p>;
}

export function CompanionMaterials() {
  return <section className="sw-public-section" id="materials" aria-labelledby="press-materials">
    <header className="sw-press__section-head"><h2 id="press-materials">Companions for your table.</h2><p>Original preparation and construction tools, with room to write. Print them or fill them in a PDF reader; the full text and prompts are also here.</p></header>
    <div className="sw-press__materials">
      {content.map(material => <article key={material.slug}>
        <h3>{material.title}</h3><p>{material.description}</p>
        <p className="sw-press__material-meta">{material.pageCount} pages · Printable and fillable · v0.1 alpha</p>
        <div className="sw-press__material-links"><a className="sw-public-link" href={material.pdf} download><Download aria-hidden="true" /> Download PDF</a><a className="sw-public-link" href={material.markdown}>Read Markdown →</a></div>
        <details className="sw-press__material-text"><summary>Read the full text and writing prompts</summary><div>
          {material.pages.map((page, index) => <section key={page.title} aria-label={page.title}>
            <h4>{index + 1}. {page.title}</h4>
            {page.blocks.map((block, blockIndex) => <ReadableBlock key={blockIndex} block={block} />)}
            <ul>{page.links.map(link => <li key={link.url}><Link href={link.url}>{link.title}</Link></li>)}</ul>
          </section>)}
        </div></details>
      </article>)}
    </div>
  </section>;
}
