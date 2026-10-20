import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/discovery/[...discovery]/route';
import { PUBLIC_PAGES, SITE_URL, markdownPath } from '../public-pages';

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
    // Three books and the complete play guide use shared structured sources.
    expect(fetcher).toHaveBeenCalledTimes(Object.keys(PUBLIC_PAGES).length - 4);
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
