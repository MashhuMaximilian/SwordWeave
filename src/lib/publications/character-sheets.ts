import type { AnalyticsEvent } from '@/lib/analytics/contract';

/** Static, public print files. These are separate from the existing fillable companions. */
export const CHARACTER_SHEET_PACK = {
  "filename": "swordweave-aegis-character-sheets-v0.1-alpha.zip",
  "bytes": 11833101,
  "sha256": "a5be94f3f95f335f95de3dbdfdc2b706268bd15dd45a530c355561d4817df3d2",
  "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/swordweave-aegis-character-sheets-v0.1-alpha.zip"
} as const;

export const CHARACTER_SHEET_FILES = [
  {
    "id": "aegis-blank-portrait-normal",
    "label": "Portrait - Normal",
    "group": "blank-front",
    "pages": 1,
    "bytes": 1765983,
    "sha256": "af1b8c875c354b680484cf8a6343f95ae9248d0b92496fb80c1ab7b4e9fe30f0",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-portrait-normal.pdf",
    "edition": "aegis_portrait_normal",
    "description": "One A4 front with a spacious ingredient record."
  },
  {
    "id": "aegis-blank-portrait-dense",
    "label": "Portrait - Dense",
    "group": "blank-front",
    "pages": 1,
    "bytes": 1765779,
    "sha256": "c68d4fe18cb6935e65f43b1eb3f9ec6569b3ef43832f4298da95161b2edecc2d",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-portrait-dense.pdf",
    "edition": "aegis_portrait_dense",
    "description": "One A4 front with two columns for owned ingredients."
  },
  {
    "id": "aegis-blank-landscape-normal",
    "label": "Landscape - Normal",
    "group": "blank-front",
    "pages": 1,
    "bytes": 1765303,
    "sha256": "bf6dd1aad546b151dc3da36a9ed0620c35ff7238e59f527cfc7ccc6995cfa693",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-landscape-normal.pdf",
    "edition": "aegis_landscape_normal",
    "description": "One A4 sheet with a core panel and a wide ingredient panel; fold through the clear centre."
  },
  {
    "id": "aegis-blank-landscape-dense",
    "label": "Landscape - Dense",
    "group": "blank-front",
    "pages": 1,
    "bytes": 1765565,
    "sha256": "6f353c8432c47ab9047b5a6164b8ffc9724965fdfa9dca637f1c8366b857017a",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-landscape-dense.pdf",
    "edition": "aegis_landscape_dense",
    "description": "One A4 sheet with a core panel and two ingredient columns; fold through the clear centre."
  },
  {
    "id": "aegis-blank-supporting-portrait",
    "label": "Blank supporting pages - portrait",
    "group": "blank-support",
    "pages": 6,
    "bytes": 1782208,
    "sha256": "e02491836a7fa9dcf71d30fd26876a64f8d24d05279cc027813de6a0ff245426",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-supporting-portrait.pdf",
    "edition": "aegis_supporting_portrait",
    "description": "Six repeatable A4 leaves: primitives, compositions/effects, equipment, identity, full rules and a workbench."
  },
  {
    "id": "aegis-blank-supporting-landscape",
    "label": "Blank supporting pages - landscape",
    "group": "blank-support",
    "pages": 3,
    "bytes": 1768250,
    "sha256": "f76221da125d46ae5c277f5cdee2c22153778c13a620edecad10600adbb2a0e4",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-blank-supporting-landscape.pdf",
    "edition": "aegis_supporting_landscape",
    "description": "Three foldable A4 sheets containing six matching supporting panels. Print only the pages you need."
  },
  {
    "id": "aegis-example-tarn",
    "label": "Tarn Emberpost - level 1 example",
    "group": "example",
    "pages": 5,
    "bytes": 1996309,
    "sha256": "43b367b63c5c073b049c00251914e1ba5a04b147aa114c227729178562ba1a26",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-example-tarn.pdf",
    "edition": "aegis_example_tarn",
    "description": "A level-one public example in the normal portrait format, including full rules, equipment and identity."
  },
  {
    "id": "aegis-example-orren",
    "label": "Orren Vaultwright - level 16 example",
    "group": "example",
    "pages": 7,
    "bytes": 2083888,
    "sha256": "bbed40c3f6bdae3dbfe7f20bc87df74a91bc398f3337c92a897e8dce3a319ea4",
    "href": "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-example-orren.pdf",
    "edition": "aegis_example_orren",
    "description": "A level-sixteen public example in the dense landscape format, including its full continuation records."
  }
] as const;

export const CHARACTER_SHEET_PREVIEW = "/character-sheets/aegis-v0.1-alpha-2026-10-23/aegis-four-formats.webp";
export const CHARACTER_SHEET_README = "/character-sheets/aegis-v0.1-alpha-2026-10-23/READ-ME.txt";

export function characterSheetDownloadEvent(id: typeof CHARACTER_SHEET_FILES[number]['id'] | 'pack', placement: 'books' | 'press'): AnalyticsEvent {
  if (id === 'pack') return { name: 'file_download', params: { book_id: 'character_sheet_pack', edition: 'aegis_pack', release_version: 'v0.1-alpha', placement } };
  const file = CHARACTER_SHEET_FILES.find(file => file.id === id);
  if (!file) throw new Error('Unknown character-sheet download');
  const book_id = file.group === 'blank-front' ? 'character_sheet_front' : file.group === 'blank-support' ? 'character_sheet_support' : 'character_sheet_example';
  return { name: 'file_download', params: { book_id, edition: file.edition, release_version: 'v0.1-alpha', placement } };
}
