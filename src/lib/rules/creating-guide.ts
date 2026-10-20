import { PLAY_GUIDE, type GuideTopic } from './play-guide';

const creating = PLAY_GUIDE.find(topic => topic.id === 'creating')!;

export const CREATING_GUIDE_INTRO = {
  title: creating.title,
  summary: creating.summary,
};

const summaries: Record<string, string> = {
  idea: 'Describe the result you want before choosing an entry from the Library.',
  reuse: 'Read Mira’s actual owned ingredient list before proposing another use.',
  expression: 'Use the same three permissions for three concrete water tasks.',
  'ordinary-owned-missing': 'Separate an ordinary action, an owned permission and a genuinely missing behavior.',
  'river-hand-resolution': 'Follow permission, check, Cost and changed state through one complete use.',
  'save-river-hand': 'Save one helpful expression while keeping the underlying acquisition ledger unchanged.',
  primitive: 'Give one reusable permission or rule a clear scope and agreed price.',
  compose: 'Group useful pieces without turning a saved composition into your only possible action.',
  fork: 'Adapt your own copy while preserving the original author’s work.',
  edit: 'Review the description, composition, budget and version before saving.',
  visibility: 'Keep practice drafts private and choose deliberately when to share them.',
  play: 'Distinguish buying access in BU from resolving and paying for an actual use.',
};

/** One teaching source supplies the Rules chapter, focused reader and full Markdown. */
export const CREATING_GUIDE: GuideTopic[] = creating.blocks.map((block, index) => ({
  id: block.id ?? `step-${index + 1}`,
  summary: summaries[block.id ?? ''] ?? 'Read the authored rule and review the actual result.',
  title: block.title,
  keywords: '',
  blocks: [block.id === 'primitive' ? {
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
