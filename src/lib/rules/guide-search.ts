import type { GuideBlock, GuideTopic } from './play-guide';

function blockSearchText(block: GuideBlock): string[] {
  return [
    block.title,
    block.body ?? '',
    ...(block.paragraphs ?? []),
    ...(block.rules ?? []),
    ...(block.ordered ?? []),
    block.example ?? '',
    ...(block.links ?? []).flatMap(link => [link.title, link.url]),
    ...(block.table ? [block.table.caption, ...block.table.headers, ...block.table.rows.flat()] : []),
    ...(block.details ?? []).flatMap(blockSearchText),
  ];
}

/** Search any learning guide without importing the Rules content into its client. */
export function searchTopics(topics: GuideTopic[], query: string): GuideTopic[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return topics.filter(topic => {
    const haystack = [topic.title, topic.summary, topic.keywords, ...topic.blocks.flatMap(blockSearchText)].join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
