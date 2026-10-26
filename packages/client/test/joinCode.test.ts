import { describe, expect, it } from 'vitest';
import { JOIN_CODE_ALPHABET, acceptableJoinCode, makeJoinCode } from '../src/game/joinCode.ts';

describe('join codes', () => {
  it('never contain 666 or rude words, also when digits read as letters', () => {
    for (const bad of ['A666BC', '666XYZ', 'QW666Z', 'XASSXY', 'S3XQRT', '4SSQRT', 'KKKABC']) expect(acceptableJoinCode(bad)).toBe(false);
    for (const ok of ['QRT29B', 'H7KM2P', 'A66B6C']) expect(acceptableJoinCode(ok)).toBe(true);
  });

  it('draws again until the code is acceptable', () => {
    // A rigged random source whose first draw spells 666666, then a clean code.
    const six = JOIN_CODE_ALPHABET.indexOf('6') / JOIN_CODE_ALPHABET.length;
    const q = JOIN_CODE_ALPHABET.indexOf('Q') / JOIN_CODE_ALPHABET.length;
    const draws = [...Array(6).fill(six), ...Array(6).fill(q)];
    expect(makeJoinCode(() => draws.shift()!)).toBe('QQQQQQ');
  });

  it('makes six characters from the look-alike-free alphabet, never 666', () => {
    for (let i = 0; i < 20000; i++) {
      const code = makeJoinCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
      expect(code).not.toContain('666');
    }
  });
});
