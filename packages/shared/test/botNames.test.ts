import { describe, expect, it } from 'vitest';
import { BOT_NAMES } from '../src/sim/match.ts';
import { BOT_NAME_MAX } from '../src/sim/botSet.ts';

describe('bot names', () => {
  it('has at least 96, so a full match never repeats one, each unique and short enough', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(96);
    expect(new Set(BOT_NAMES.map((n) => n.toLowerCase())).size).toBe(BOT_NAMES.length);
    for (const n of BOT_NAMES) {
      expect(n.length, n).toBeLessThanOrEqual(BOT_NAME_MAX);
      expect(n.trim(), n).toBe(n);
      expect(/\d/.test(n), n).toBe(false);
    }
  });

  it('keeps the first twelve (bot sets and players know them)', () => {
    expect(BOT_NAMES.slice(0, 12)).toEqual(['Brassneck', 'Mildred', 'Captain Pell', 'Wick', 'Doctor Umber', 'Spoke', 'Gloam', 'Tibbs', 'Ferro', 'Lady Ash', 'Nub', 'Quill']);
  });
});
