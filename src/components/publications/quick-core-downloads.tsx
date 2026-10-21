import { Download } from 'lucide-react';
import { TrackLink } from '@/components/analytics/track-link';
import { QUICK_CORE_GUIDES, quickCoreDownloadEvent, type QuickCoreId, type QuickCorePlacement } from '@/lib/publications/quick-core';
import './quick-core-downloads.css';

export function QuickCoreDownloads({ ids, placement, title = 'Start with the compact core', description }: {
  ids?: readonly QuickCoreId[];
  placement: QuickCorePlacement;
  title?: string;
  description?: string;
}) {
  const guides = QUICK_CORE_GUIDES.filter(guide => !ids || ids.includes(guide.id));
  const heading = `quick-core-${placement}-title`;
  return <section id="quick-core" className="sw-quick-core" aria-labelledby={heading}>
    <h2 id={heading}>{title}</h2>
    <p className="sw-quick-core__intro">{description ?? 'Players use Play + Create. DMs also use Run. These compact PDFs carry the practical framework; the PHB, GM Guide and SRD offer more explanation, examples and reference detail.'}</p>
    <ul>{guides.map(guide => <li key={guide.id}>
      <div><h3>{guide.title}</h3><p>{guide.description}</p></div>
      <div className="sw-quick-core__action">
        <TrackLink href={guide.href} download event={quickCoreDownloadEvent(guide.id, placement)} aria-label={`Download ${guide.title} PDF`}>
          <Download size={16} aria-hidden="true" /> Download PDF
        </TrackLink>
        <span>{guide.pages} pages · {Math.ceil(guide.bytes / 1000)} KB · v0.1 alpha</span>
      </div>
    </li>)}</ul>
  </section>;
}
