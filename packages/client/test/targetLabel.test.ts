import { describe, expect, it } from 'vitest';
import { targetLabel } from '../src/game/targetLabel.ts';

describe('the name of whoever you hit', () => {
  it('is their name alone outside Roulette', () => {
    expect(targetLabel('Mildred', 'The Dapper', false)).toBe('Mildred');
  });

  it('in Roulette names the character worn this life beside it', () => {
    expect(targetLabel('Mildred', 'The Dapper', true)).toBe('Mildred · The Dapper');
    // Not twice when the name is the character's, nor for a look with no name of its own.
    expect(targetLabel('The Dapper', 'The Dapper', true)).toBe('The Dapper');
    expect(targetLabel('Mildred', undefined, true)).toBe('Mildred');
  });
});
