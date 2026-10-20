import { LearningGuide } from './learning-guide';
import { NERIS_GUIDE } from '@/lib/rules/neris-example';

/** Only the selected reader is marked; the surrounding Character guide remains intact. */
export function NerisWalkthrough() {
  return <div data-neris-guide>
    <LearningGuide
      topics={NERIS_GUIDE}
      basePath="/character"
      initialTopicId="neris-concept"
      indexTitle="Build with Neris"
      indexDescription="Follow the choices, count acquisitions once, then resolve a treatment."
      searchLabel="Search the Neris walkthrough"
      searchPlaceholder="Find a choice, ingredient or result…"
      emptyHint="Try a term such as “Mental”, “ledger”, “Gentle Treatment” or “fork”."
      endLink={{ title: 'Build your character', url: '/characters/new' }}
    />
  </div>;
}
