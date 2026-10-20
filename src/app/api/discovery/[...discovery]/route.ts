import { PUBLIC_PAGES, SITE_URL, markdownPath } from '@/lib/seo/public-pages';
import { bookMarkdown, guideMarkdown, creatingMarkdown, advancedCharacterMarkdown, primitiveTutorialMarkdown, publicHtmlMarkdown, CORE_BOOKS } from '@/lib/seo/markdown';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ discovery: string[] }> }) {
  const { discovery } = await params;
  const requested = `/${discovery.join('/')}`;
  const path = Object.keys(PUBLIC_PAGES).find(path => markdownPath(path) === requested);
  if (!path) return new Response('Not found', { status: 404 });
  const book = CORE_BOOKS.find(book => path === `/books/${book.slug}`);
  let markdown: string;
  try {
    if (book) markdown = bookMarkdown(book);
    else if (path === '/rules') markdown = guideMarkdown();
    else if (path === '/creating') markdown = creatingMarkdown();
    else if (path === '/creating-a-character') markdown = advancedCharacterMarkdown();
    else if (path === '/tutorials/create-a-primitive') markdown = primitiveTutorialMarkdown();
    else {
      // Fetch only explicitly approved public editorial pages, anonymously.
      // This avoids a separately maintained text copy and never forwards cookies/auth.
      // Production uses the canonical host; local development uses a fixed loopback origin.
      const origin = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_URL;
      // This is an anonymous server fetch, not a browser document navigation.
      // Advertising text/html makes Clerk's development handshake redirect it.
      const response = await fetch(`${origin}${path}`, { headers: { Accept: '*/*' }, redirect: 'error', signal: AbortSignal.timeout(15_000), cache: 'no-store' });
      if (!response.ok) throw new Error('Public source unavailable');
      markdown = publicHtmlMarkdown(await response.text(), path);
    }
  } catch {
    return new Response('The public text source is temporarily unavailable. Please use the HTML page.', { status: 503, headers: { 'Retry-After': '60' } });
  }
  return new Response(markdown, { headers: {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Link': `<${SITE_URL}${path}>; rel="canonical", <${SITE_URL}/llms.txt>; rel="describedby"`,
    'X-Robots-Tag': 'noindex, follow',
    'Cache-Control': 'public, max-age=60, s-maxage=300',
  } });
}
