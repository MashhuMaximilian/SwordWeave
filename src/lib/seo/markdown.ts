import { load } from 'cheerio';
import TurndownService from 'turndown';
import { CORE_BOOKS, type CoreBook, type BookBlock } from '@/lib/publications/books';
import { PLAY_GUIDE, type GuideBlock, type GuideTopic } from '@/lib/rules/play-guide';
import { CREATING_GUIDE, CREATING_GUIDE_INTRO } from '@/lib/rules/creating-guide';
import { PRIMITIVE_TUTORIAL, PRIMITIVE_TUTORIAL_INTRO } from '@/lib/rules/primitive-tutorial';
import { guideBookLinks } from '@/lib/publications/book-links';
import figures from '@/lib/publications/figures.json';
import art from '@/lib/publications/art.json';
import maps from '@/lib/publications/maps.json';
import worksheets from '@/lib/publications/worksheets.json';
import { SITE_URL } from './public-pages';

const table = (rows: string[][]) => rows.map((row, i) => `| ${row.map(x => x.replace(/\|/g, '\\|').replace(/\n/g, '<br>')).join(' | ')} |${i === 0 ? `\n| ${row.map(() => '---').join(' | ')} |` : ''}`).join('\n');
function blockMarkdown(block: BookBlock): string {
  if (block.type === 'heading') return `${'#'.repeat(Math.min(block.level, 6))} ${block.text}`;
  if (block.type === 'paragraph') return block.text;
  if (block.type === 'aside') return block.paragraphs.map(p => `> ${p}`).join('\n>\n');
  if (block.type === 'list') return block.items.map((p, i) => `${block.ordered ? `${i + 1}.` : '-'} ${p}`).join('\n');
  if (block.type === 'table') return table(block.rows);
  if (block.type === 'art') {
    const entry = (art as Record<string, { caption: string; path: string }>)[block.name];
    return entry ? `![${entry.caption}](${new URL(entry.path, SITE_URL)})` : '';
  }
  if (block.type === 'figure') {
    const entry = (figures as Record<string, { title: string; caption: string }>)[block.name];
    return entry ? `![${entry.title}](${SITE_URL}/books/figures/${block.name}-light.svg)\n\n${entry.caption}` : '';
  }
  if (block.type === 'map') {
    const entry = (maps as Record<string, { title: string; caption: string; rooms: (string | number)[][]; routeTexts: string[]; notes: string[] }>)[block.name];
    return entry ? `### ${entry.title}\n\n${entry.caption}\n\n${entry.rooms.map(room => `- ${room[2]}: ${room[3]}`).join('\n')}\n\n${[...entry.routeTexts, ...entry.notes].map(x => `- ${x}`).join('\n')}` : '';
  }
  if (block.type === 'worksheet') {
    const entry = (worksheets as Record<string, { title: string; fields: string[][] }>)[block.name];
    return entry ? `### ${entry.title}\n\nOptional table tool. These fields record agreements; they do not add rules.\n\n${entry.fields.map(([name, hint]) => `- **${name}:** ${hint}`).join('\n')}` : '';
  }
  return '';
}
export function bookMarkdown(book: CoreBook) {
  return `# ${book.title}\n\n${book.subtitle}\n\n${book.version} · Online reader\n\nSource: ${SITE_URL}/books/${book.slug}\n\nThis exports the current online reader. Revised downloadable PDF editions may differ; see [Books](${SITE_URL}/books) for available editions.\n\n${book.blocks.map(blockMarkdown).filter(Boolean).join('\n\n')}\n`;
}
function guideBlock(block: GuideBlock, level: number, includeTitle = true): string {
  return [
    includeTitle && `${'#'.repeat(Math.min(level, 6))} ${block.title}`,
    block.body,
    block.paragraphs?.join('\n\n'),
    block.rules?.map(rule => `- ${rule}`).join('\n'),
    block.ordered?.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    block.table && `${block.table.caption}\n\n${table([block.table.headers, ...block.table.rows])}`,
    block.example && `> At the table: ${block.example}`,
    block.links?.map(link => `- [${link.title}](${new URL(link.url, SITE_URL)})`).join('\n'),
    block.details?.map(detail => guideBlock(detail, level + 1)).join('\n\n'),
  ].filter(Boolean).join('\n\n');
}
function topicMarkdown(topic: GuideTopic): string {
  return [
    `## ${topic.title}`,
    topic.summary,
    topic.blocks.map(block => guideBlock(block, 3, !(topic.blocks.length === 1 && block.title === topic.title))).join('\n\n'),
    topic.sources?.map(link => `- [${link.title}](${new URL(link.url, SITE_URL)})`).join('\n'),
  ].filter(Boolean).join('\n\n');
}
export function guideMarkdown() {
  return `# Rules & play guide\n\nAll chapters from the same source as the interactive [play guide](${SITE_URL}/rules).\n\n${PLAY_GUIDE.map(topic => topicMarkdown({ ...topic, sources: guideBookLinks(topic.id) })).join('\n\n')}\n`;
}
export function creatingMarkdown() {
  return `# ${CREATING_GUIDE_INTRO.title}\n\n${CREATING_GUIDE_INTRO.summary}\n\nSource: ${SITE_URL}/creating\n\n${CREATING_GUIDE.map(topicMarkdown).join('\n\n')}\n`;
}
export function primitiveTutorialMarkdown() {
  return `# ${PRIMITIVE_TUTORIAL_INTRO.title}\n\n${PRIMITIVE_TUTORIAL_INTRO.summary}\n\n${PRIMITIVE_TUTORIAL_INTRO.editionNote}\n\nSource: ${SITE_URL}/tutorials/create-a-primitive\n\n${PRIMITIVE_TUTORIAL.map(topicMarkdown).join('\n\n')}\n`;
}
export function publicHtmlMarkdown(html: string, path: string): string {
  const $ = load(html);
  const main = $('.sw-public-site').first();
  if (!main.length || !main.find('h1').length) throw new Error('Missing public page content');
  main.find('script,style,nav,footer,svg,button,input,textarea,form,[aria-hidden="true"],.sw-public-nav').remove();
  // Visual line breaks must not split one HTML heading into separate Markdown blocks.
  main.find('h1,h2,h3,h4,h5,h6').find('br').replaceWith(' ');
  main.find('a[href],img[src]').each((_, element) => {
    const key = element.tagName === 'a' ? 'href' : 'src';
    const value = $(element).attr(key);
    if (value) $(element).attr(key, new URL(value, `${SITE_URL}${path}`).toString());
  });
  const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  converter.addRule('tables', { filter: 'table', replacement: (_, node) => {
    const caption = converter.turndown(node.querySelector('caption')?.innerHTML ?? '');
    const rows = Array.from(node.querySelectorAll('tr')).map(row =>
      Array.from(row.querySelectorAll('th,td')).map(cell => converter.turndown(cell.innerHTML).trim()),
    );
    return `\n\n${caption ? `${caption}\n\n` : ''}${table(rows)}\n\n`;
  } });
  return `${converter.turndown(main.html() ?? '')}\n\nSource: ${SITE_URL}${path}\n`;
}
export { CORE_BOOKS };
