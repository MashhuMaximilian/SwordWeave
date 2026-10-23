import type { AnalyticsEvent } from '@/lib/analytics/contract';

/** Gold/teal static files are the default; a separate ZIP offers monochrome printing. */
export const CHARACTER_SHEET_DEFAULT_EDITION = 'gold_teal' as const;
export const CHARACTER_SHEET_PACK = {
  "filename": "swordweave-aegis-character-sheets-v0.1-alpha.zip",
  "bytes": 15131333,
  "sha256": "f8130e7bb5366741ec114e46361228907f6421a84c4f937ba0561ae2edd12cd1",
  "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/swordweave-aegis-character-sheets-v0.1-alpha.zip",
  "color": true,
  "pages": 25
} as const;

export const CHARACTER_SHEET_MONOCHROME_PACK = {
  "filename": "swordweave-aegis-character-sheets-v0.1-alpha-monochrome.zip",
  "bytes": 12076161,
  "sha256": "589b9123ed4fcf11b4b2a7f33141c67335e76d9ed2524b91490c900b86134bd0",
  "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/swordweave-aegis-character-sheets-v0.1-alpha-monochrome.zip",
  "color": false,
  "pages": 25
} as const;

export const CHARACTER_SHEET_FILES = [
  {
    "id": "aegis-blank-portrait-normal",
    "label": "Portrait - Normal",
    "group": "blank-front",
    "pages": 1,
    "bytes": 2211082,
    "sha256": "6d27a657114a2c748bd51f35649e6481e0e9629d7cdb5d5b436d4f70381b98f6",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-portrait-normal.pdf",
    "edition": "aegis_portrait_normal",
    "description": "One A4 front with a spacious ingredient record."
  },
  {
    "id": "aegis-blank-portrait-dense",
    "label": "Portrait - Dense",
    "group": "blank-front",
    "pages": 1,
    "bytes": 2210817,
    "sha256": "0f6b0a7a432635706c41c4d758a6422d995145e98c3335bf9dd2588eb6dfc91e",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-portrait-dense.pdf",
    "edition": "aegis_portrait_dense",
    "description": "One A4 front with two columns for owned ingredients."
  },
  {
    "id": "aegis-blank-landscape-normal",
    "label": "Landscape - Normal",
    "group": "blank-front",
    "pages": 1,
    "bytes": 2210695,
    "sha256": "a764d0bdb73ebb5c5be1a842a10d0dcdadda009473a91d941a3de1693f481503",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-landscape-normal.pdf",
    "edition": "aegis_landscape_normal",
    "description": "One A4 sheet with a core panel and two primitive columns; fold through the protected 16 pt centre clearance."
  },
  {
    "id": "aegis-blank-landscape-dense",
    "label": "Landscape - Dense",
    "group": "blank-front",
    "pages": 1,
    "bytes": 2210683,
    "sha256": "6b36f7dc95f4920057d5fa171a9f1115b41e15294e627e87d3f69d1575f1a50c",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-landscape-dense.pdf",
    "edition": "aegis_landscape_dense",
    "description": "One A4 sheet with a core panel and two denser primitive columns; fold through the protected 16 pt centre clearance."
  },
  {
    "id": "aegis-blank-supporting-portrait",
    "label": "Blank supporting pages - portrait",
    "group": "blank-support",
    "pages": 6,
    "bytes": 2232953,
    "sha256": "af67625af2dbd0bd4d676487b3ebec6b65705b4f74fbbd4aab5d802b3334327d",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-supporting-portrait.pdf",
    "edition": "aegis_supporting_portrait",
    "description": "Six repeatable A4 leaves: primitives, compositions/effects, equipment, identity, full rules and a workbench."
  },
  {
    "id": "aegis-blank-supporting-landscape",
    "label": "Blank supporting pages - landscape",
    "group": "blank-support",
    "pages": 3,
    "bytes": 2218247,
    "sha256": "dd56cb44cb47959d3c84444ab9c025fa3e5e4e9342e30d7c9ef74607a8da035f",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-blank-supporting-landscape.pdf",
    "edition": "aegis_supporting_landscape",
    "description": "Three foldable A4 sheets containing six matching supporting panels. Print only the pages you need."
  },
  {
    "id": "aegis-example-tarn",
    "label": "Tarn Emberpost - level 1 example",
    "group": "example",
    "pages": 5,
    "bytes": 2645090,
    "sha256": "f11b3907cab33060217360caff8fecb56aecca748fd59ec743e11d24cd0a3042",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-example-tarn.pdf",
    "edition": "aegis_example_tarn",
    "description": "A level-one public example in the normal portrait format, including full rules, equipment and identity."
  },
  {
    "id": "aegis-example-orren",
    "label": "Orren Vaultwright - level 16 example",
    "group": "example",
    "pages": 7,
    "bytes": 2887065,
    "sha256": "aa9bb5bb6896bce110a723074520c9cc45da3e222dccfe0b29e882bb0fa9312c",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-example-orren.pdf",
    "edition": "aegis_example_orren",
    "description": "A level-sixteen public example in the dense landscape format, including its full continuation records."
  }
] as const;

export const CHARACTER_SHEET_PREVIEW = "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/aegis-four-formats.webp";
export const CHARACTER_SHEET_README = "/character-sheets/aegis-v0.1-alpha-2026-10-23-r2/READ-ME.txt";

export function characterSheetDownloadEvent(id: typeof CHARACTER_SHEET_FILES[number]['id'] | 'pack' | 'monochrome-pack', placement: 'books' | 'press'): AnalyticsEvent {
  if (id === 'monochrome-pack') return { name: 'file_download', params: { book_id: 'character_sheet_pack', edition: 'aegis_pack_monochrome', release_version: 'v0.1-alpha', placement } };
  if (id === 'pack') return { name: 'file_download', params: { book_id: 'character_sheet_pack', edition: 'aegis_pack', release_version: 'v0.1-alpha', placement } };
  const file = CHARACTER_SHEET_FILES.find(file => file.id === id);
  if (!file) throw new Error('Unknown character-sheet download');
  const book_id = file.group === 'blank-front' ? 'character_sheet_front' : file.group === 'blank-support' ? 'character_sheet_support' : 'character_sheet_example';
  return { name: 'file_download', params: { book_id, edition: file.edition, release_version: 'v0.1-alpha', placement } };
}
