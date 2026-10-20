import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/discovery/[...discovery]/route';
import { PUBLIC_PAGES, SITE_URL, markdownPath } from '../public-pages';
import { PLAY_GUIDE } from '@/lib/rules/play-guide';
import { CREATING_GUIDE } from '@/lib/rules/creating-guide';
import { PRIMITIVE_TUTORIAL } from '@/lib/rules/primitive-tutorial';

function requestMarkdown(path: string, request = new Request(`${SITE_URL}${path}`)) {
  return GET(request, { params: Promise.resolve({ discovery: path.slice(1).split('/') }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('public Markdown delivery', () => {
  it('serves every curated page with the Markdown type, HTML canonical and index discovery link', async () => {
    const fetcher = vi.fn(async () => new Response('<div class="sw-public-site"><h1>Public source</h1><p>Published page text.</p></div>'));
    vi.stubGlobal('fetch', fetcher);
    for (const path of Object.keys(PUBLIC_PAGES)) {
      const response = await requestMarkdown(markdownPath(path));
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(response.headers.get('Link')).toBe(`<${SITE_URL}${path}>; rel="canonical", <${SITE_URL}/llms.txt>; rel="describedby"`);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
      const markdown = await response.text();
      expect(markdown).toMatch(/^# .+/);
      expect(markdown).toContain(`${SITE_URL}${path}`);
    }
    // Three books and all three learning readers use complete structured sources.
    expect(fetcher).toHaveBeenCalledTimes(Object.keys(PUBLIC_PAGES).length - 6);
  });

  it.each([
    ['/rules.md', PLAY_GUIDE],
    ['/creating.md', CREATING_GUIDE],
    ['/tutorials/create-a-primitive.md', PRIMITIVE_TUTORIAL],
  ] as const)('exports every chapter of %s without depending on a selected HTML chapter', async (path, topics) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await requestMarkdown(path);
    const markdown = await response.text();
    expect(response.status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    for (const topic of topics) expect(markdown).toContain(`## ${topic.title}\n`);
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it('preserves the tutorial’s applied values, phone steps, complete tables and final help links', async () => {
    const markdown = await (await requestMarkdown('/tutorials/create-a-primitive.md')).text();
    expect(PRIMITIVE_TUTORIAL).toHaveLength(10);
    expect(markdown).toContain('click Use number to apply it');
    expect(markdown).toContain('On a phone, open Rule format');
    expect(markdown).toContain('Lexicon on a phone');
    expect(markdown).toContain('choose Private visibility');
    expect(markdown).toContain('A standalone primitive does not have a general on/off button');
    expect(markdown).toContain('| Attack Roll | Add | Fixed number: 2 | Self | Always |');
    expect(markdown).toContain('| Sheet value | The contribution reads a character value');
    expect(markdown).toContain('[Contact](https://www.swordweave.quest/contact)');
    expect(markdown).toContain('the number 2 is the bonus, not its price');
  });

  it('preserves the full creating chapter and its tutorial handoff', async () => {
    const markdown = await (await requestMarkdown('/creating.md')).text();
    const original = PLAY_GUIDE.find(topic => topic.id === 'creating')!;
    expect(CREATING_GUIDE).toHaveLength(original.blocks.length);
    for (const block of original.blocks) {
      expect(markdown).toContain(block.body);
      if (block.example) expect(markdown).toContain(block.example);
    }
    expect(markdown).toContain('[Create your first primitive: editor tutorial](https://www.swordweave.quest/tutorials/create-a-primitive)');
  });

  it('uses the same public Rules references as the reader instead of historical authoring notes', async () => {
    const markdown = await (await requestMarkdown('/rules.md')).text();
    expect(markdown).toContain('[Full explanation and examples](https://www.swordweave.quest/books/srd#construction-reference)');
    expect(markdown).not.toContain('app.notion.com');
  });

  it('never forwards request hosts, query parameters, cookies or authorization to the editorial source', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetcher = vi.fn(async () => new Response('<div class="sw-public-site"><h1>Public source</h1></div>'));
    vi.stubGlobal('fetch', fetcher);
    const response = await requestMarkdown('/contact.md', new Request('https://untrusted.invalid/contact.md?token=private', {
      headers: { Cookie: 'session=private', Authorization: 'Bearer private' },
    }));
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith(`${SITE_URL}/contact`, {
      headers: { Accept: 'text/html' }, redirect: 'error', signal: expect.any(AbortSignal), cache: 'no-store',
    });
    expect(await response.text()).not.toMatch(/untrusted|private/);
  });

  it.each(['/atelier.md', '/sign-in.md', '/characters/private.md', '/characters/1da4e351-da76-4822-bf1f-632d2e657145.md', '/library.md', '/not-a-page.md'])(
    'returns 404 without fetching excluded content at %s', async path => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      const response = await requestMarkdown(path);
      expect(response.status).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(['http-error', 'missing-public-scope', 'network-error'])(
    'fails closed when the public source has %s', async failure => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        if (failure === 'network-error') throw new Error('Source unavailable');
        return failure === 'http-error'
          ? new Response('Private response', { status: 403 })
          : new Response('<h1>Outside approved public content</h1>');
      }));
      const response = await requestMarkdown('/about.md');
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(await response.text()).not.toMatch(/Private response|Outside approved/);
    },
  );
});
