import { PLAY_GUIDE, type GuideTopic } from './play-guide';

const creating = PLAY_GUIDE.find(topic => topic.id === 'creating')!;

export const CREATING_GUIDE_INTRO = {
  title: creating.title,
  summary: creating.summary,
};

const chapters = [
  { id: 'idea', summary: 'Describe the result you want before choosing an entry from the Library.' },
  { id: 'primitive', summary: 'Give one reusable permission or rule a clear scope and agreed price.' },
  { id: 'compose', summary: 'Group useful pieces without turning a saved composition into your only possible action.' },
  { id: 'fork', summary: 'Adapt your own copy while preserving the original author’s work.' },
  { id: 'edit', summary: 'Review the description, composition, budget and version before saving.' },
  { id: 'visibility', summary: 'Keep practice drafts private and choose deliberately when to share them.' },
  { id: 'play', summary: 'Distinguish buying access in BU from resolving and paying for an actual use.' },
  { id: 'reuse', summary: 'Use the same owned ingredients for several actions and capabilities.' },
  { id: 'expression', summary: 'Agree the scope, resolution and Cost of the particular attempt.' },
];

/** A focused reading path over the unchanged Creating chapter of the Rules guide. */
export const CREATING_GUIDE: GuideTopic[] = creating.blocks.map((block, index) => ({
  ...chapters[index]!,
  title: block.title,
  keywords: '',
  blocks: [index === 1 ? {
    ...block,
    links: [
      { title: 'Create your first primitive: editor tutorial', url: '/tutorials/create-a-primitive' },
      { title: 'Open the Atelier', url: '/atelier' },
    ],
  } : block],
  sources: [
    { title: 'Complete Rules & play guide', url: '/rules#creating' },
    { title: 'Player’s Handbook', url: '/books/players-handbook' },
  ],
}));
