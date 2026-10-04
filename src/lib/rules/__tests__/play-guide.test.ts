import { describe, expect, it } from 'vitest';
import { PLAY_GUIDE, searchGuide } from '../play-guide';

describe('play guide reference search', () => {
  it('finds rules inside optional definition panels', () => {
    expect(searchGuide('ecological sacred').map(topic => topic.id)).toContain('rolls');
  });
  it('finds worked examples inside optional analytical panels', () => {
    expect(searchGuide('scaling increase 18').map(topic => topic.id)).toContain('strain');
  });
  it('requires all query words and handles whitespace and case', () => {
    expect(searchGuide('  ECOLOGICAL   Sacred ').map(topic => topic.id)).toEqual(searchGuide('ecological sacred').map(topic => topic.id));
    expect(searchGuide('ecological nonexistentword')).toEqual([]);
  });
  it('returns the complete ordered reading path for an empty search', () => {
    expect(searchGuide('  ')).toEqual(PLAY_GUIDE);
  });
});
