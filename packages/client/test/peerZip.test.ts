import { describe, expect, it } from 'vitest';
import { GUEST_TO_HOST_LIMITS, Reassembler, Unzipper, Zipper } from '../src/game/peerZip.ts';

describe('host game input bounds', () => {
  it('refuses a stream that inflates past the cap, before holding it all', () => {
    const zip = new Zipper();
    const unzip = new Unzipper(1024 * 1024);
    // 8 MiB of one letter compresses to a few KB: a "zip bomb".
    const bomb = zip.pieces('a'.repeat(8 * 1024 * 1024));
    expect(bomb.reduce((n, p) => n + p.length, 0)).toBeLessThan(64 * 1024);
    expect(() => bomb.forEach((p) => unzip.piece(p))).toThrow(/inflates past/);
    // The stream stays refused.
    expect(() => unzip.piece(zip.pieces('{}')[0]!)).toThrow();
  });

  it('puts chunked messages back together within the limits', () => {
    const r = new Reassembler(GUEST_TO_HOST_LIMITS);
    expect(r.add('{"t":"ping"}')).toBe('{"t":"ping"}');
    expect(r.add('\u00017|0|2|{"t":')).toBeNull();
    expect(r.add('\u00017|1|2|"ready"}')).toBe('{"t":"ready"}');
    expect(r.pending).toBe(0);
  });

  it("doesn't trust the sender's piece count, sizes or number of half-sent messages", () => {
    const lim = { maxChunks: 4, maxBytes: 100, maxPartials: 2, timeoutMs: 1000 };
    expect(() => new Reassembler(lim).add('\u00011|0|999999|x')).toThrow(/out of range/);
    expect(() => new Reassembler(lim).add('\u00011|5|4|x')).toThrow(/out of range/);
    expect(() => new Reassembler(lim).add('\u0001nonsense')).toThrow(/malformed/);
    expect(() => new Reassembler(lim).add('x'.repeat(101))).toThrow(/over/);
    const big = new Reassembler(lim);
    big.add(`\u00011|0|2|${'x'.repeat(60)}`);
    expect(() => big.add(`\u00011|1|2|${'x'.repeat(60)}`)).toThrow(/over 100/);
    const many = new Reassembler(lim);
    many.add('\u00011|0|2|a');
    many.add('\u00012|0|2|a');
    expect(() => many.add('\u00013|0|2|a')).toThrow(/half-sent/);
    const twice = new Reassembler(lim);
    twice.add('\u00011|0|2|a');
    expect(() => twice.add('\u00011|0|2|a')).toThrow(/twice/);
    expect(() => twice.add('\u00011|1|3|a')).toThrow(/disagree/);
  });

  it('forgets half-sent messages that never finish', () => {
    let now = 0;
    const r = new Reassembler({ maxChunks: 4, maxBytes: 100, maxPartials: 1, timeoutMs: 1000 }, () => now);
    r.add('\u00011|0|2|a');
    now += 1500;
    expect(r.add('\u00012|0|2|b')).toBeNull();
    expect(r.pending).toBe(1);
  });
});

describe('host game compression', () => {
  it('round-trips a stream of messages, shrinking repeated snapshots', () => {
    const zip = new Zipper();
    const unzip = new Unzipper();
    let raw = 0;
    let wire = 0;
    for (let n = 0; n < 200; n++) {
      const msg = JSON.stringify({ t: 'snapshot', tick: n * 2, players: Array.from({ length: 8 }, (_, k) => ({ s: k, x: +(Math.sin(n / 9 + k) * 20).toFixed(2), z: +(Math.cos(n / 11 + k) * 20).toFixed(2), name: `Pläyer ${k} ✓` })) });
      const pieces = zip.pieces(msg);
      expect(pieces).toHaveLength(1);
      raw += msg.length;
      wire += pieces[0]!.length;
      expect(unzip.piece(pieces[0]!)).toBe(msg);
    }
    expect(raw / wire).toBeGreaterThan(4);
  });

  it('splits a big message into pieces and puts it back together', () => {
    const zip = new Zipper();
    const unzip = new Unzipper();
    // Hard to compress, so it really needs several pieces.
    let seed = 1;
    const noise = Array.from({ length: 50_000 }, () => ((seed = (seed * 16807) % 2147483647), (seed % 1e6).toString(36))).join(',');
    const pieces = zip.pieces(noise, 4096);
    expect(pieces.length).toBeGreaterThan(3);
    expect(pieces.slice(0, -1).every((p) => p[0] === 0) && pieces.at(-1)![0] === 1).toBe(true);
    const out = pieces.map((p) => unzip.piece(p));
    expect(out.slice(0, -1).every((x) => x === null)).toBe(true);
    expect(out.at(-1)).toBe(noise);
    // The stream carries on normally after it.
    expect(unzip.piece(zip.pieces('{"t":"pong"}')[0]!)).toBe('{"t":"pong"}');
  });
});
