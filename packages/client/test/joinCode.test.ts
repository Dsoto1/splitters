import { describe, expect, it } from 'vitest';
import { JOIN_CODE_ALPHABET, acceptableJoinCode, makeJoinCode } from '../src/game/joinCode.ts';

describe('join codes', () => {
  it('never contain 666 or rude words, also when digits read as letters', () => {
    for (const bad of ['A666BC', '666XYZ', 'QW666Z', 'XASSXY', 'S3XQRT', '4SSQRT', 'KKKABC']) expect(acceptableJoinCode(bad)).toBe(false);
    for (const ok of ['QRT29B', 'H7KM2P', 'A66B6C']) expect(acceptableJoinCode(ok)).toBe(true);
  });

  it('draws again until the code is acceptable', () => {
    // A rigged byte source whose first draw spells 666666, then a clean code.
    const six = JOIN_CODE_ALPHABET.indexOf('6');
    const q = JOIN_CODE_ALPHABET.indexOf('Q');
    const draws = [Array(12).fill(six), Array(12).fill(q)];
    expect(makeJoinCode(() => new Uint8Array(draws.shift()!))).toBe('QQQQQQ');
  });

  it('redraws biased bytes instead of folding them onto early letters', () => {
    // 248-255 would favour A-H if taken modulo 31: they are skipped.
    const draws = [new Uint8Array([255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8])];
    expect(makeJoinCode(() => draws.shift()!)).toBe('ABCDEF');
  });

  it('comes from the CSPRNG, evenly over the alphabet (about 29.7 bits a code)', () => {
    const counts = new Map<string, number>();
    const n = 20000;
    for (let i = 0; i < n; i++) for (const ch of makeJoinCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(JOIN_CODE_ALPHABET.length);
    // Chi-square against uniform (30 degrees of freedom; 99.9% critical value is about 59.7).
    const expected = (n * 6) / JOIN_CODE_ALPHABET.length;
    const chi = [...counts.values()].reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(80);
    expect(6 * Math.log2(JOIN_CODE_ALPHABET.length)).toBeGreaterThan(29.5);
    const original = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    let used = 0;
    globalThis.crypto.getRandomValues = (<T extends ArrayBufferView | null>(a: T): T => {
      used++;
      return original(a as never) as T;
    }) as typeof globalThis.crypto.getRandomValues;
    try {
      makeJoinCode();
    } finally {
      globalThis.crypto.getRandomValues = original;
    }
    expect(used).toBeGreaterThan(0);
  });

  it('makes six characters from the look-alike-free alphabet, never 666', () => {
    for (let i = 0; i < 20000; i++) {
      const code = makeJoinCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
      expect(code).not.toContain('666');
    }
  });
});
