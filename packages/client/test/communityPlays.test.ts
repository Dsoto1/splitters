import { describe, expect, it } from 'vitest';
import { PlayTracker } from '../src/game/communityPlays.ts';

describe("a host's end-of-match report (community maps)", () => {
  it('names each signed-in player once, with their time and whether they quit early', () => {
    let t = 0;
    const plays = new PlayTracker(() => t);
    plays.joined(1, 'alice');
    plays.joined(2, 'bob');
    t = 60_000;
    plays.left(2); // bob: 1 minute, an early quit
    plays.joined(3, 'bob'); // and back
    t = 90_000;
    plays.left(3);
    t = 10 * 60_000;
    const r = plays.report('ABC234', `sha256:${'a'.repeat(64)}`, { sub: 'host', since: 0 });
    expect(r.code).toBe('ABC234');
    const by = Object.fromEntries(r.players.map((p) => [p.sub, p]));
    expect(by.alice).toEqual({ sub: 'alice', minutes: 10, early: false });
    expect(by.bob).toEqual({ sub: 'bob', minutes: 1.5, early: true });
    expect(by.host).toEqual({ sub: 'host', minutes: 10, early: false });
    // Reported once: the next report starts empty.
    expect(plays.report('ABC234', `sha256:${'a'.repeat(64)}`, null).players).toEqual([]);
  });
});
