import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import release from '../../../../docs/publications/quick-core-release-manifest.json';
import { QUICK_CORE_GUIDES, quickCoreDownloadEvent } from '../quick-core';
import { validEvent, type AnalyticsEvent } from '@/lib/analytics/contract';
import { advancedCharacterMarkdown, creatingMarkdown, guideMarkdown } from '@/lib/seo/markdown';
import { GET as llms } from '@/app/llms.txt/route';

describe('published compact core', () => {
  it.each(release.pdfs)('delivers the checked $id PDF at its visible link', pdf => {
    const guide = QUICK_CORE_GUIDES.find(item => item.id === pdf.id);
    expect(guide).toMatchObject({ href: pdf.href, pages: pdf.pages, bytes: pdf.bytes });
    const bytes = readFileSync(resolve(process.cwd(), pdf.path));
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBe(pdf.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pdf.sha256);
    expect(createHash('sha256').update(readFileSync(pdf.source)).digest('hex')).toBe(pdf.sourceSha256);
  });
  it('keeps compact downloads distinct from full books within the consent-gated contract', () => {
    for (const guide of QUICK_CORE_GUIDES) {
      expect(validEvent(quickCoreDownloadEvent(guide.id, 'books'))).toBe(true);
      expect(quickCoreDownloadEvent(guide.id, 'books').params.edition).toBe('quick_core');
    }
    expect(validEvent({ name: 'file_download', params: { ...quickCoreDownloadEvent('play', 'rules').params, filename: 'private-title' } } as unknown as AnalyticsEvent)).toBe(false);
  });
  it('includes the matching downloads in complete Markdown guides and the public index', async () => {
    const play = QUICK_CORE_GUIDES.find(g => g.id === 'play')!;
    const create = QUICK_CORE_GUIDES.find(g => g.id === 'create')!;
    const publish = QUICK_CORE_GUIDES.find(g => g.id === 'create-and-publish')!;
    expect(guideMarkdown()).toContain(play.href);
    expect(creatingMarkdown()).toContain(publish.href);
    expect(advancedCharacterMarkdown()).toContain(create.href);
    const index = await llms().text();
    for (const guide of QUICK_CORE_GUIDES) expect(index).toContain(guide.href);
  });
});
