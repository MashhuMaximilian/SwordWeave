/** Compact core PDFs, separately versioned from the expanded illustrated books. */
export const QUICK_CORE_GUIDES = [
  { id: 'play', title: 'Play SwordWeave', pages: 4, bytes: 65997,
    href: '/books/v0.1-alpha/quick-core-2026-10-21/play.pdf',
    description: 'Intent, checks, the shared round, targeting, Costs, damage and recovery.' },
  { id: 'run', title: 'Run SwordWeave', pages: 4, bytes: 74873,
    href: '/books/v0.1-alpha/quick-core-2026-10-21/run.pdf',
    description: 'Prepare and rule, create creatures, appraise encounters, and award advancement.' },
  { id: 'create', title: 'Create SwordWeave', pages: 5, bytes: 78984,
    href: '/books/v0.1-alpha/quick-core-2026-10-21/create.pdf',
    description: 'Make characters, primitives, capabilities, heritages and items; keep the ledgers clear.' },
  { id: 'create-and-publish', title: 'Create & Publish', pages: 4, bytes: 65478,
    href: '/books/v0.1-alpha/quick-core-2026-10-21/create-and-publish.pdf',
    description: 'Create and sell compatible work, give credit, and understand text, artwork and branding rights.' },
] as const;

export type QuickCoreId = typeof QUICK_CORE_GUIDES[number]['id'];
export type QuickCorePlacement = 'books' | 'rules' | 'creating' | 'combat' | 'press' | 'character_guide';
const analyticsIds = { play: 'play_core', run: 'run_core', create: 'create_core', 'create-and-publish': 'creator_guide' } as const;

export function quickCoreDownloadEvent(id: QuickCoreId, placement: QuickCorePlacement) {
  return { name: 'file_download', params: { book_id: analyticsIds[id], edition: 'quick_core', release_version: 'v0.1-alpha', placement } } as const;
}

export function quickCoreMarkdown(ids: readonly QuickCoreId[]) {
  return `## Compact PDF guides\n\n${QUICK_CORE_GUIDES.filter(guide => ids.includes(guide.id)).map(guide =>
    `- [${guide.title}](https://www.swordweave.quest${guide.href}): ${guide.pages} pages. ${guide.description}`,
  ).join('\n')}\n`;
}
