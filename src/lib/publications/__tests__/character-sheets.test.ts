import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CHARACTER_SHEET_FILES, CHARACTER_SHEET_PACK, characterSheetDownloadEvent } from '../character-sheets';
import { validEvent } from '@/lib/analytics/contract';

describe('published Aegis print-pack downloads', () => {
  it('keeps the four empty fronts distinct from supports and filled examples', () => {
    const fronts = CHARACTER_SHEET_FILES.filter(file => file.group === 'blank-front');
    expect(fronts).toHaveLength(4);
    expect(new Set(fronts.map(file => file.id)).size).toBe(4);
    expect(fronts.every(file => file.pages === 1)).toBe(true);
    expect(CHARACTER_SHEET_FILES.filter(file => file.group === 'blank-support')).toHaveLength(2);
    expect(CHARACTER_SHEET_FILES.filter(file => file.group === 'example')).toHaveLength(2);
  });

  it('serves the exact reviewed bytes from stable public paths', () => {
    for (const file of [...CHARACTER_SHEET_FILES, CHARACTER_SHEET_PACK]) {
      expect(file.href).toMatch(/^\/character-sheets\/aegis-v0\.1-alpha-2026-10-23\/[^/]+\.(pdf|zip)$/);
      const bytes = readFileSync(join(process.cwd(), 'public', file.href));
      expect(bytes.byteLength).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    }
  });

  it('uses consented, allowlisted events for each variant and pack', () => {
    for (const placement of ['books', 'press'] as const) {
      for (const file of CHARACTER_SHEET_FILES) expect(validEvent(characterSheetDownloadEvent(file.id, placement))).toBe(true);
      expect(validEvent(characterSheetDownloadEvent('pack', placement))).toBe(true);
    }
    const event = characterSheetDownloadEvent('pack', 'books');
    expect(validEvent({ ...event, params: { ...event.params, edition: 'private-character-id' } } as never)).toBe(false);
  });
});
