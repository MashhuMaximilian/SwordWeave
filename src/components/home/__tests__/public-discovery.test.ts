import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { PublicNav } from '../public-nav';
import EncountersPage from '@/app/encounters/page';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/encounters/encounter-archive', () => ({
  EncounterArchive: ({ discovery }: { discovery?: boolean }) => createElement('section', { 'data-discovery': String(discovery) }),
}));
vi.mock('@/components/encounters/encounter-workspace', () => ({
  EncounterWorkspace: ({ startNew }: { startNew?: boolean }) => createElement('section', { 'data-new-workspace': String(startNew) }),
}));

describe('public Library discovery without an account provider', () => {
  it('includes Browse library, Monsters and Encounters in the public menu', () => {
    const $ = load(renderToStaticMarkup(createElement(PublicNav)));
    expect($('ul[aria-label="Library"] a').map((_, element) => [[$(element).text(), $(element).attr('href')]]).get()).toEqual([
      ['Browse library', '/library/browse'],
      ['Monsters', '/monsters'],
      ['Encounters', '/encounters'],
    ]);
  });

  it('opens the visibility-filtered public encounter directory rather than the owner-only archive', async () => {
    const $ = load(renderToStaticMarkup(await EncountersPage({ searchParams: Promise.resolve({}) })));
    expect($('[data-discovery="true"]')).toHaveLength(1);
    expect($('[data-new-workspace]')).toHaveLength(0);
  });

  it('retains the existing authenticated creation workspace path', async () => {
    const $ = load(renderToStaticMarkup(await EncountersPage({ searchParams: Promise.resolve({ new: '1' }) })));
    expect($('[data-new-workspace="true"]')).toHaveLength(1);
    expect($('[data-discovery]')).toHaveLength(0);
  });
});
