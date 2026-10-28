import { describe, expect, it } from 'vitest';
import { Unzipper, Zipper } from '@tiletrigger/shared/peerZip';

describe("a player's compressed stream", () => {
  it('comes back intact over thousands of messages of every size (one Zipper, one Unzipper)', () => {
    // When a friend's stream turned to garbage, this ruled out the codec: the cause was two streams on one channel.
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const zip = new Zipper();
    const unzip = new Unzipper();
    for (let i = 0; i < 1500; i++) {
      const size = rnd() < 0.03 ? Math.floor(rnd() * 200_000) : Math.floor(rnd() * 20_000);
      let s = '{"t":"snapshot","p":[';
      while (s.length < size) s += rnd() < 0.5 ? `${Math.floor(rnd() * 1e9)},` : rnd() < 0.5 ? '"abc":1,' : String.fromCharCode(32 + Math.floor(rnd() * 90));
      s += '0]}';
      let out: string | null = null;
      for (const piece of zip.pieces(s)) out = unzip.piece(piece);
      if (out !== s) expect.fail(`message ${i} (${s.length} characters) came back changed`);
    }
  });
});
