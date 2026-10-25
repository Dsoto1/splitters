import { describe, expect, it } from 'vitest';
import { Unzipper, Zipper } from '../src/game/peerZip.ts';

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
