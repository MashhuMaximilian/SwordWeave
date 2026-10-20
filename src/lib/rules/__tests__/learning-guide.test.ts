import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { LearningGuide, resolveGuideAnchor } from '@/components/rules/learning-guide';
import { searchTopics } from '../guide-search';
import { PLAY_GUIDE, type GuideBlock, type GuideTopic } from '../play-guide';
import { CREATING_GUIDE } from '../creating-guide';
import { PRIMITIVE_TUTORIAL } from '../primitive-tutorial';
import { NERIS_GUIDE } from '../neris-example';
import { ADVANCED_CHARACTER_GUIDE } from '../advanced-character-guide';
import { publicHtmlMarkdown } from '@/lib/seo/markdown';

const topics: GuideTopic[] = [
  {
    id: 'identity', title: 'Make a readable rule', summary: 'A focused authoring lesson.', keywords: 'primitive author',
    sources: [{ title: 'Original source', url: '/original' }],
    blocks: [{
      id: 'recipe', title: 'Name the change', body: 'The existing description stays visible.',
      paragraphs: ['A reusable permission supports more than one expression.'],
      rules: ['Read the authored limit.'],
      ordered: ['Describe the intent.', 'Review the result.'],
      table: { caption: 'A checked comparison', headers: ['Intent', 'Cost'], rows: [['Move a cup', 'Negligible'], ['Divert a stream', 'Continued direction']] },
      example: 'This is an illustrative table agreement.',
      links: [{ title: 'Inspect the water example', url: '/character#build-example' }, { title: 'Continue to review', url: '#review' }],
      details: [{ id: 'more detail', title: 'Optional explanation', paragraphs: ['Nested words remain searchable.'], links: [{ title: 'Another relevant lesson', url: '/creating' }] }],
    }],
  },
  { id: 'review', title: 'Check what you saved', summary: 'Review the actual result.', keywords: 'test', blocks: [{ title: 'Finish', body: 'Compare the saved entry.' }] },
];

describe('reusable learning-guide search', () => {
  it('finds rich paragraphs, ordered steps, table cells and link labels', () => {
    for (const query of ['reusable permission', 'describe intent', 'checked comparison', 'continued direction', 'inspect water', 'another relevant']) {
      expect(searchTopics(topics, query).map(topic => topic.id)).toEqual(['identity']);
    }
  });

  it('searches recursively, requires all words and leaves the ordered input intact', () => {
    expect(searchTopics(topics, ' NESTED   searchable ').map(topic => topic.id)).toEqual(['identity']);
    expect(searchTopics(topics, 'nested nonexistent')).toEqual([]);
    expect(searchTopics(topics, '  ')).toEqual(topics);
    expect(topics.map(topic => topic.id)).toEqual(['identity', 'review']);
  });

  it('searches only the supplied guide rather than the complete Rules corpus', () => {
    expect(searchTopics([topics[1]!], 'reusable')).toEqual([]);
  });

  it('finds the relevant Creating chapters instead of matching every chapter through copied keywords', () => {
    expect(searchTopics(CREATING_GUIDE, 'private').map(topic => topic.id)).toEqual(['save-river-hand', 'visibility']);
    expect(searchTopics(CREATING_GUIDE, 'fork').map(topic => topic.id)).toEqual(['fork', 'edit']);
  });
});

describe('authored chapter and block deep links', () => {
  it('resolves a chapter and a block to their owning topic', () => {
    expect(resolveGuideAnchor(topics, '#review')).toEqual({ topicId: 'review', blockId: null });
    expect(resolveGuideAnchor(topics, '#recipe')).toEqual({ topicId: 'identity', blockId: 'recipe' });
    expect(resolveGuideAnchor(topics, '#more%20detail')).toEqual({ topicId: 'identity', blockId: 'more detail' });
  });

  it('ignores unknown, empty and malformed URL fragments', () => {
    for (const hash of ['', '#', '#not-a-chapter', '#%E0%A4%A']) expect(resolveGuideAnchor(topics, hash)).toBeNull();
  });
});

describe('shared learning-guide markup', () => {
  it.each([
    ['/rules', PLAY_GUIDE, 15],
    ['/creating', CREATING_GUIDE, 12],
    ['/tutorials/create-a-primitive', PRIMITIVE_TUTORIAL, 10],
    ['/character', NERIS_GUIDE, 7],
    ['/creating-a-character', ADVANCED_CHARACTER_GUIDE, 12],
  ] as const)('includes every %s chapter and its substantive content in canonical server HTML', (basePath, guide, count) => {
    const $ = load(renderToStaticMarkup(createElement(LearningGuide, { topics: guide, basePath })));
    expect($('.sw-play-guide-chapter')).toHaveLength(count);
    expect($('.sw-play-guide-chapter[hidden]')).toHaveLength(0);
    expect($('.sw-play-guide[data-guide-enhanced]')).toHaveLength(0);
    expect($('.sw-play-guide-index nav a')).toHaveLength(count);
    expect($('.sw-play-guide-index nav button')).toHaveLength(0);
    const ids = $('[id]').map((_, element) => $(element).attr('id')).get();
    expect(new Set(ids).size).toBe(ids.length);
    const inspectBlock = (block: GuideBlock, text: string) => {
      for (const copy of [block.body, ...(block.paragraphs ?? []), ...(block.rules ?? []), ...(block.ordered ?? []), block.example, block.table?.caption, ...(block.table?.headers ?? []), ...(block.table?.rows.flat() ?? [])]) {
        if (copy) expect(text).toContain(copy);
      }
      for (const detail of block.details ?? []) inspectBlock(detail, text);
    };
    for (const chapter of guide) {
      const section = $('.sw-play-guide-chapter').filter((_, element) => $(element).attr('id') === chapter.id);
      expect(section).toHaveLength(1);
      expect(section.find('.sw-play-guide-topic-head h2').text()).toBe(chapter.title);
      expect(section.text()).toContain(chapter.summary);
      for (const block of chapter.blocks) inspectBlock(block, section.text());
      const url = `${basePath}#${encodeURIComponent(chapter.id)}`;
      expect($('.sw-play-guide-index nav a').filter((_, element) => $(element).attr('href') === url)).toHaveLength(1);
    }
  });

  it('replaces the complete Neris DOM with a single structured Markdown walkthrough', () => {
    const guide = renderToStaticMarkup(createElement(LearningGuide, { topics: NERIS_GUIDE, basePath: '/character' }));
    const markdown = publicHtmlMarkdown(`<div class="sw-public-site"><h1>Character guide</h1><div data-neris-guide>${guide}</div></div>`, '/character');
    for (const topic of NERIS_GUIDE) expect(markdown.split(`## ${topic.title}\n`).length - 1).toBe(1);
    expect(markdown).not.toContain('Continue learning');
  });

  it('renders all rich block forms and topic-specific references', () => {
    const html = renderToStaticMarkup(createElement(LearningGuide, {
      topics, basePath: '/tutorials/example',
      sourceLinks: { identity: [{ title: 'Checked source', url: '/checked-source' }] },
    }));
    const $ = load(html);
    expect($('.sw-play-guide-reading').text()).toContain('existing description stays visible');
    expect($('.sw-play-guide-reading').text()).toContain('reusable permission');
    expect($('.sw-play-guide-ordered > li').map((_, element) => $(element).text()).get()).toEqual(['Describe the intent.', 'Review the result.']);
    expect($('caption').text()).toBe('A checked comparison');
    expect($('thead th[scope="col"]')).toHaveLength(2);
    expect($('tbody tr')).toHaveLength(2);
    expect($('a[href="/character#build-example"]').text()).toContain('Inspect the water example');
    expect($('a[href="/tutorials/example#review"]').text()).toContain('Continue to review');
    expect($('details a[href="/creating"]').text()).toContain('Another relevant lesson');
    expect($('.sw-play-guide-sources').text()).toContain('Checked source');
    expect($('.sw-play-guide-sources').text()).not.toContain('Original source');
    expect($('#recipe').attr('tabindex')).toBe('-1');
  });

  it('uses the configured chapter and base path for an embedded guide', () => {
    const $ = load(renderToStaticMarkup(createElement(LearningGuide, {
      topics, basePath: '/tutorials/example', initialTopicId: 'review', embedded: true,
      endLink: { title: 'Try your own rule', url: '/atelier?build=primitive' },
    })));
    expect($('.sw-play-guide-topic-head h2').text()).toBe('Check what you saved');
    expect($('.sw-play-guide-page-link').attr('href')).toBe('/tutorials/example#review');
    expect($('.sw-play-guide-next .sw-play-guide-next-primary').attr('href')).toBe('/atelier?build=primitive');
    expect($('.sw-play-guide-next .sw-play-guide-next-primary').text()).toContain('Try your own rule');
    expect($('.sw-play-guide--embedded')).toHaveLength(1);
    expect($('.sw-play-guide-chapter')).toHaveLength(1);
    expect($('.sw-play-guide-reading').text()).not.toContain('existing description stays visible');
  });

  it('handles an empty guide without an invalid chapter or destination', () => {
    const $ = load(renderToStaticMarkup(createElement(LearningGuide, {
      topics: [], basePath: '/tutorials/example', emptyHint: 'Try another lesson.',
    })));
    expect($('.sw-play-guide-empty').text()).toContain('Try another lesson.');
    expect($('.sw-play-guide-next')).toHaveLength(0);
    expect($('.sw-play-guide-topic-head')).toHaveLength(0);
  });

  it('does not repeat a single focused chapter title as a numbered block heading', () => {
    const $ = load(renderToStaticMarkup(createElement(LearningGuide, {
      topics: [{ id: 'focused', title: 'Choose the result', summary: 'One focused step.', keywords: '', blocks: [{ title: 'Choose the result', body: 'The instructions still render.' }] }],
      basePath: '/tutorials/example',
    })));
    expect($('.sw-play-guide-topic-head h2').text()).toBe('Choose the result');
    expect($('.sw-play-guide-block h3')).toHaveLength(0);
    expect($('.sw-play-guide-block[aria-label="Choose the result"]').text()).toContain('instructions still render');
  });
});
