import { describe, expect, it } from 'vitest';
import { VotePad } from '../src/game/votePad.ts';

const pad = (down: number[] = [], x = 0) => ({ axes: [x, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) });

describe('the map vote with a controller', () => {
  it('d-pad and stick move the highlight one card a press; A votes for it', () => {
    const v = new VotePad();
    expect(v.poll(pad(), 3)).toEqual({ moved: false, cast: null });
    expect(v.poll(pad([15]), 3).moved).toBe(true);
    expect(v.cursor).toBe(1);
    expect(v.poll(pad([15]), 3).moved).toBe(false); // held: no repeat
    v.poll(pad(), 3);
    v.poll(pad([], 0.9), 3); // stick right
    expect(v.cursor).toBe(2);
    v.poll(pad([], 0.9), 3);
    expect(v.cursor).toBe(2);
    v.poll(pad([15]), 3); // past the end: stays
    expect(v.cursor).toBe(2);
    v.poll(pad(), 3);
    v.poll(pad([14]), 3);
    expect(v.cursor).toBe(1);
    expect(v.poll(pad([0]), 3).cast).toBe(1);
    expect(v.poll(pad([0]), 3).cast).toBeNull(); // held A votes once
    // Changing the vote: A again on another card.
    v.poll(pad(), 3);
    v.poll(pad([14]), 3);
    v.poll(pad(), 3);
    expect(v.poll(pad([0]), 3).cast).toBe(0);
  });
  it('does nothing without a pad', () => {
    expect(new VotePad().poll(undefined, 3)).toEqual({ moved: false, cast: null });
  });
});
