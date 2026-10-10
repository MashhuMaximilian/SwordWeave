/** Stable book anchors replace front-facing historical source notes. */
export const GUIDE_BOOK_REFERENCES: Record<string, { slug: string; anchor: string }> = {
  start: { slug: 'players-handbook', anchor: 'begin-a-shared-story' },
  'first-character': { slug: 'players-handbook', anchor: 'make-someone-you-want-to-play' },
  'building-blocks': { slug: 'players-handbook', anchor: 'read-and-compose-your-abilities' },
  heritages: { slug: 'players-handbook', anchor: 'build-a-heritage-around-the-person' },
  budget: { slug: 'players-handbook', anchor: 'spend-develop-and-mirror-deliberately' },
  rolls: { slug: 'players-handbook', anchor: 'resolve-uncertainty' },
  combat: { slug: 'players-handbook', anchor: 'act-together-in-combat' },
  reactions: { slug: 'players-handbook', anchor: 'one-independent-reaction' },
  strain: { slug: 'players-handbook', anchor: 'push-the-limits' },
  upkeep: { slug: 'players-handbook', anchor: 'keep-a-working-alive' },
  damage: { slug: 'players-handbook', anchor: 'damage-has-a-source-and-domain' },
  vitality: { slug: 'players-handbook', anchor: 'survive-and-carry-consequences' },
  equipment: { slug: 'players-handbook', anchor: 'equipment-and-growth' },
  creating: { slug: 'srd', anchor: 'construction-reference' },
  sheet: { slug: 'players-handbook', anchor: 'mira-a-complete-starting-character' },
};
