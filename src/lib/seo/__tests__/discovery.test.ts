import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES, markdownPath } from '../public-pages';
import { bookMarkdown, guideMarkdown, publicHtmlMarkdown, CORE_BOOKS } from '../markdown';
import { publicPageMetadata } from '../metadata';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

describe('public discovery', () => {
  it('maps only curated public pages to distinct canonical URLs and formats', () => {
    expect(Object.keys(PUBLIC_PAGES)).toHaveLength(14);
    expect(sitemap()).toHaveLength(14);
    for (const path of Object.keys(PUBLIC_PAGES)) {
      expect(publicPageMetadata(path).alternates?.canonical).toBe(`https://www.swordweave.quest${path === '/' ? '' : path}`);
      expect(markdownPath(path)).toMatch(/\.md$/);
    }
    expect(robots().rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
    expect(publicPageMetadata('/characters/private').robots).toEqual({ index: false, follow: true });
  });
  it('exports the actual complete book source, including table, rules and edition warning', () => {
    for (const book of CORE_BOOKS) {
      const text = bookMarkdown(book);
      for (const block of book.blocks) if (block.type === 'paragraph' || block.type === 'heading') expect(text).toContain(block.text);
      expect(text).toContain('Revised downloadable PDF editions may differ');
      expect(text.length).toBeGreaterThan(10000);
    }
    expect(guideMarkdown()).toContain('Your first game');
  });
  it('converts public rendered content without scripts, navigation, form fields or auth state', () => {
    const md = publicHtmlMarkdown('<div class="sw-public-site"><nav>Private menu</nav><h1>Test</h1><p>Public text <a href="/rules">Rules</a></p><script>secret-auth</script><form><input value="secret-email"/></form><table><tr><th>Rule</th><th>Cost</th></tr><tr><td>Touch</td><td>0</td></tr></table></div>', '/start');
    expect(md).toContain('[Rules](https://www.swordweave.quest/rules)');
    expect(md).toContain('| Touch | 0 |');
    expect(md).not.toMatch(/secret|Private menu/);
    expect(() => publicHtmlMarkdown('<h1>Missing scope</h1>', '/start')).toThrow();
  });
});
