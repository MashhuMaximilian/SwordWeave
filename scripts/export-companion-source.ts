import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NERIS_EXAMPLE, NERIS_ACQUISITIONS, NERIS_ITEMS, NERIS_LEDGER_STAGES, NERIS_TREATMENT, NERIS_GUIDE } from '../src/lib/rules/neris-example';

const directory = resolve('tmp/pdfs');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'neris-source.json'), JSON.stringify({
  example: NERIS_EXAMPLE, acquisitions: NERIS_ACQUISITIONS, items: NERIS_ITEMS,
  stages: NERIS_LEDGER_STAGES, treatment: NERIS_TREATMENT, guide: NERIS_GUIDE,
}, null, 2) + '\n');
console.log('Exported the checked public Neris teaching source for companion production.');
