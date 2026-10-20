'use client';

import { guideBookLinks } from '@/lib/publications/book-links';
import { PLAY_GUIDE } from '@/lib/rules/play-guide';
import { LearningGuide } from './learning-guide';

const BOOK_LINKS = Object.fromEntries(PLAY_GUIDE.map(topic => [topic.id, guideBookLinks(topic.id)]));

/** Keep the Rules page and embedded sheet guide on their original reading path. */
export function PlayGuide({ embedded = false }: { embedded?: boolean }) {
  return <LearningGuide
    topics={PLAY_GUIDE}
    basePath="/rules"
    initialTopicId="start"
    embedded={embedded}
    sourceLinks={BOOK_LINKS}
    endLink={{ title: 'Create a character', url: '/characters/new' }}
    searchLabel="Search the play guide"
    emptyHint="Try a term such as “upkeep”, “DC”, “poisoned”, or “slots”."
    sourceLabel="Read in the books"
  />;
}
